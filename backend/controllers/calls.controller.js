const { Op } = require("sequelize");
const { CallLog, Task, TaskStatusHistory, Notification, sequelize } = require("../models");

exports.list = async (req, res) => {
  const rows = await CallLog.findAll({
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

exports.get = async (req, res) => {
  const row = await CallLog.findByPk(req.params.id, {
    include: [{ model: Task, as: "task", attributes: ["id", "title", "status"] }]
  });
  if (!row) return res.status(404).json({ message: "Call log not found" });
  return res.json(row);
};

exports.create = async (req, res) => {
  const payload = req.body || {};
  const tx = await sequelize.transaction();
  try {
    let task = null;
    if (payload.task_id) {
      task = await Task.findByPk(payload.task_id, { transaction: tx });
    } else {
      const title = String(payload.title || payload.task_title || "").trim();
      if (!title) {
        await tx.rollback();
        return res.status(400).json({ error: "Task title is required" });
      }
      task = await Task.create(
        {
          title,
          description: payload.description || payload.task_description || null,
          source: "call",
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
          note: "Task created from call log"
        },
        { transaction: tx }
      );
    }

    if (!task) {
      await tx.rollback();
      return res.status(404).json({ error: "Task not found" });
    }

    const row = await CallLog.create(
      {
        task_id: task.id,
        caller_name: payload.caller_name || payload.contact_name || null,
        caller_phone: payload.caller_phone || payload.phone || null,
        call_type: payload.call_type || payload.type || "inbound",
        duration_sec: Number(payload.duration_sec || payload.duration || 0),
        call_summary: payload.call_summary || payload.notes || null,
        received_by: req.user.id,
        call_datetime: payload.call_datetime || new Date()
      },
      { transaction: tx }
    );

    const io = req.app.get("io");
    if (task.assigned_to && Number(task.assigned_to) !== Number(req.user.id)) {
      await Notification.create(
        {
          user_id: task.assigned_to,
          title: "New Task Assigned",
          body: `Call task assigned: "${task.title}"`,
          type: "task",
          link: `/tasks/${task.id}`,
          is_read: false
        },
        { transaction: tx }
      );
      if (io) {
        io.to(`user:${task.assigned_to}`).emit("notification:new", {
          title: "New Task Assigned",
          body: `Call task assigned: "${task.title}"`,
          type: "task",
          link: `/tasks/${task.id}`
        });
        io.to(`user:${task.assigned_to}`).emit("task:assigned", { taskId: task.id, title: task.title });
      }
    }

    await tx.commit();
    return res.status(201).json({ success: true, task, call: row });
  } catch (err) {
    await tx.rollback();
    return res.status(500).json({ error: err.message });
  }
};
