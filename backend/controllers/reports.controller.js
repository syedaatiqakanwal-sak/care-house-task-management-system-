const { Op, QueryTypes } = require("sequelize");
const { Task, User, CallLog, EmailLog, Role, sequelize } = require("../models");

function pct(n, d) {
  if (!d) return 0;
  return Math.round((Number(n) / Number(d)) * 10000) / 100;
}

exports.summary = async (req, res) => {
  try {
    const now = new Date();
    const [totalTasks, completedTasks, pendingTasks, inProgressTasks, overdueTasks, totalUsers, totalCalls, totalEmails] =
      await Promise.all([
        Task.count(),
        Task.count({ where: { status: "completed" } }),
        Task.count({ where: { status: "pending" } }),
        Task.count({ where: { status: "in_progress" } }),
        Task.count({
          where: {
            deadline: { [Op.lt]: now },
            status: { [Op.ne]: "completed" }
          }
        }),
        User.count({ where: { status: "active" } }),
        CallLog.count(),
        EmailLog.count()
      ]);

    const avgRow = await sequelize.query(
      `
      SELECT AVG(TIMESTAMPDIFF(HOUR, created_at, completed_at)) / 24 AS avg_days
      FROM tasks
      WHERE status = 'completed' AND completed_at IS NOT NULL
      `,
      { type: QueryTypes.SELECT }
    );
    const avgDays = Number(avgRow?.[0]?.avg_days || 0);

    const sourceRows = await sequelize.query(
      `
      SELECT source, COUNT(*) AS count
      FROM tasks
      GROUP BY source
      `,
      { type: QueryTypes.SELECT }
    );
    const sourceMap = sourceRows.reduce((acc, row) => {
      acc[String(row.source || "manual")] = Number(row.count || 0);
      return acc;
    }, {});

    return res.json({
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      pending_tasks: pendingTasks,
      in_progress_tasks: inProgressTasks,
      overdue_tasks: overdueTasks,
      completion_rate: pct(completedTasks, totalTasks),
      total_users: totalUsers,
      total_calls: totalCalls,
      total_emails: totalEmails,
      avg_completion_time_days: Math.round(avgDays * 100) / 100,
      source_breakdown: {
        manual: sourceMap.manual || 0,
        call: sourceMap.call || 0,
        email: sourceMap.email || 0
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.byUser = async (req, res) => {
  try {
    const rows = await sequelize.query(
      `
      SELECT
        u.id AS user_id,
        u.full_name,
        u.email,
        r.role_name AS role,
        COUNT(t.id) AS total_assigned,
        SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
        SUM(CASE WHEN t.deadline < NOW() AND t.status <> 'completed' THEN 1 ELSE 0 END) AS overdue,
        AVG(CASE WHEN t.status = 'completed' AND t.completed_at IS NOT NULL THEN TIMESTAMPDIFF(HOUR, t.created_at, t.completed_at) / 24 END) AS avg_completion_days,
        MAX(t.updated_at) AS last_active
      FROM tasks t
      JOIN users u ON u.id = t.assigned_to
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE t.assigned_to IS NOT NULL
      GROUP BY u.id, u.full_name, u.email, r.role_name
      ORDER BY total_assigned DESC
      `,
      { type: QueryTypes.SELECT }
    );

    const normalized = rows.map((row) => ({
      user_id: Number(row.user_id),
      full_name: row.full_name,
      email: row.email,
      role: row.role || "-",
      total_assigned: Number(row.total_assigned || 0),
      completed: Number(row.completed || 0),
      pending: Number(row.pending || 0),
      in_progress: Number(row.in_progress || 0),
      overdue: Number(row.overdue || 0),
      completion_rate: pct(Number(row.completed || 0), Number(row.total_assigned || 0)),
      avg_completion_days: Math.round(Number(row.avg_completion_days || 0) * 100) / 100,
      last_active: row.last_active
    }));

    return res.json(normalized);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.tasksOverTime = async (req, res) => {
  try {
    const period = String(req.query.period || "month").toLowerCase();
    let format = "%Y-%m-%d";
    let whereClause = "created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
    if (period === "week") whereClause = "created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
    if (period === "year") {
      format = "%Y-%m";
      whereClause = "created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)";
    }

    const rows = await sequelize.query(
      `
      SELECT DATE_FORMAT(created_at, :fmt) AS date, COUNT(*) AS count
      FROM tasks
      WHERE ${whereClause}
      GROUP BY DATE_FORMAT(created_at, :fmt)
      ORDER BY DATE_FORMAT(created_at, :fmt) ASC
      `,
      {
        replacements: { fmt: format },
        type: QueryTypes.SELECT
      }
    );

    return res.json(rows.map((r) => ({ date: r.date, count: Number(r.count || 0) })));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.byPriority = async (req, res) => {
  try {
    const rows = await sequelize.query(
      `
      SELECT priority, COUNT(*) AS count
      FROM tasks
      GROUP BY priority
      ORDER BY FIELD(priority, 'urgent', 'high', 'medium', 'low')
      `,
      { type: QueryTypes.SELECT }
    );
    return res.json(rows.map((r) => ({ priority: r.priority || "medium", count: Number(r.count || 0) })));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.byCategory = async (req, res) => {
  try {
    const rows = await sequelize.query(
      `
      SELECT COALESCE(NULLIF(category, ''), 'Uncategorized') AS category, status, COUNT(*) AS count
      FROM tasks
      GROUP BY COALESCE(NULLIF(category, ''), 'Uncategorized'), status
      ORDER BY category, status
      `,
      { type: QueryTypes.SELECT }
    );
    return res.json(
      rows.map((r) => ({
        category: r.category,
        status: r.status,
        count: Number(r.count || 0)
      }))
    );
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.userReport = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const user = await User.findByPk(userId, {
      attributes: ["id", "full_name", "email"],
      include: [{ model: Role, attributes: ["id", "role_name"] }]
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const summaryRows = await sequelize.query(
      `
      SELECT
        COUNT(t.id) AS total_assigned,
        SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
        SUM(CASE WHEN t.deadline < NOW() AND t.status <> 'completed' THEN 1 ELSE 0 END) AS overdue,
        AVG(CASE WHEN t.status = 'completed' AND t.completed_at IS NOT NULL THEN TIMESTAMPDIFF(HOUR, t.created_at, t.completed_at) / 24 END) AS avg_completion_days,
        MAX(t.updated_at) AS last_active,
        SUM(CASE WHEN t.status = 'completed' AND t.completed_at IS NOT NULL AND (t.deadline IS NULL OR t.completed_at <= t.deadline) THEN 1 ELSE 0 END) AS completed_on_time,
        SUM(CASE WHEN t.status = 'completed' AND t.completed_at IS NOT NULL AND t.deadline IS NOT NULL AND t.completed_at > t.deadline THEN 1 ELSE 0 END) AS completed_overdue
      FROM tasks t
      WHERE t.assigned_to = :userId
      `,
      { replacements: { userId }, type: QueryTypes.SELECT }
    );
    const s = summaryRows[0] || {};

    const recentTasks = await Task.findAll({
      where: { assigned_to: userId },
      attributes: ["id", "title", "status", "priority", "deadline", "created_at"],
      order: [["created_at", "DESC"]],
      limit: 20
    });

    const trend = await sequelize.query(
      `
      SELECT DATE_FORMAT(completed_at, '%Y-%m') AS month, COUNT(*) AS completed
      FROM tasks
      WHERE assigned_to = :userId
        AND status = 'completed'
        AND completed_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(completed_at, '%Y-%m')
      ORDER BY DATE_FORMAT(completed_at, '%Y-%m') ASC
      `,
      { replacements: { userId }, type: QueryTypes.SELECT }
    );

    const totalAssigned = Number(s.total_assigned || 0);
    const completed = Number(s.completed || 0);

    return res.json({
      user_id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.Role?.role_name || "-",
      total_assigned: totalAssigned,
      completed,
      pending: Number(s.pending || 0),
      in_progress: Number(s.in_progress || 0),
      overdue: Number(s.overdue || 0),
      completion_rate: pct(completed, totalAssigned),
      avg_completion_days: Math.round(Number(s.avg_completion_days || 0) * 100) / 100,
      last_active: s.last_active,
      completed_on_time: Number(s.completed_on_time || 0),
      completed_overdue: Number(s.completed_overdue || 0),
      recent_tasks: recentTasks,
      monthly_completion_trend: trend.map((r) => ({ month: r.month, completed: Number(r.completed || 0) }))
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
