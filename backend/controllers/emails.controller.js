const { Op } = require("sequelize");
const { EmailLog, Task, TaskStatusHistory, Notification, sequelize } = require("../models");

exports.list = async (req, res) => {
  const rows = await EmailLog.findAll({
    include: [
      {
        model: Task,
        as: "task",
        attributes: ["id", "title", "status", "source"],
        required: true,
        where: {
          status: { [Op.ne]: "cancelled" }
        }
      }
    ],
    order: [["created_at", "DESC"]]
  });
  return res.json(rows);
};

exports.create = async (req, res) => {
  const payload = req.body || {};
  const tx = await sequelize.transaction();
  try {
    let task = null;
    if (payload.task_id) {
      task = await Task.findByPk(payload.task_id, { transaction: tx });
    } else {
      const title = String(payload.title || payload.task_title || payload.subject || "").trim();
      if (!title) {
        await tx.rollback();
        return res.status(400).json({ error: "Task title is required" });
      }
      task = await Task.create(
        {
          title,
          description: payload.description || payload.task_description || payload.body || null,
          source: "email",
          priority: payload.priority || "medium",
          status: "pending",
          assigned_to: payload.assigned_to || null,
          assigned_by: req.user.id,
          deadline: payload.deadline || null,
          category: payload.category || null
        },
        { transaction: tx }
      );

      await TaskStatusHistory.create(
        {
          task_id: task.id,
          old_status: null,
          new_status: "pending",
          changed_by: req.user.id,
          note: "Task created from email log"
        },
        { transaction: tx }
      );
    }

    if (!task) {
      await tx.rollback();
      return res.status(404).json({ error: "Task not found" });
    }

    const row = await EmailLog.create(
      {
        task_id: task.id,
        sender_name: payload.sender_name || payload.from_name || null,
        sender_email: payload.sender_email || payload.from || null,
        subject: payload.subject || null,
        body: payload.body || payload.content || null,
        received_at: payload.received_at || new Date()
      },
      { transaction: tx }
    );

    const io = req.app.get("io");
    if (task.assigned_to && Number(task.assigned_to) !== Number(req.user.id)) {
      await Notification.create(
        {
          user_id: task.assigned_to,
          title: "New Task Assigned",
          body: `Email task assigned: "${task.title}"`,
          type: "task",
          link: `/tasks/${task.id}`,
          is_read: false
        },
        { transaction: tx }
      );
      if (io) {
        io.to(`user:${task.assigned_to}`).emit("notification:new", {
          title: "New Task Assigned",
          body: `Email task assigned: "${task.title}"`,
          type: "task",
          link: `/tasks/${task.id}`
        });
        io.to(`user:${task.assigned_to}`).emit("task:assigned", { taskId: task.id, title: task.title });
      }
    }

    await tx.commit();
    return res.status(201).json({ success: true, task, email: row });
  } catch (err) {
    await tx.rollback();
    return res.status(500).json({ error: err.message });
  }
};
