const { Op } = require("sequelize");
const {
  Task,
  User,
  TaskAttachment,
  TaskComment,
  TaskStatusHistory,
  Notification,
  CallLog,
  EmailLog,
  sequelize
} = require("../models");

function canCommentOrViewCommentsOnTask(req, task) {
  if (!task) return false;
  const perms = req.user?.Role?.permissions?.map((p) => p.permission_key) || [];
  const isAdmin = req.user?.Role?.role_name === "Super Admin";
  const hasEdit = perms.includes("tasks.edit");
  const hasViewAll = perms.includes("tasks.view_all");
  const uid = Number(req.user.id);
  const isAssignee = task.assigned_to != null && Number(task.assigned_to) === uid;
  const isAssigner = task.assigned_by != null && Number(task.assigned_by) === uid;
  return isAdmin || hasEdit || hasViewAll || isAssignee || isAssigner;
}

function canManageTaskStatus(req, task) {
  if (!task) return false;
  const perms = req.user?.Role?.permissions?.map((p) => p.permission_key) || [];
  const isAdmin = req.user?.Role?.role_name === "Super Admin";
  const hasEdit = perms.includes("tasks.edit");
  const uid = Number(req.user.id);
  const isAssignee = task.assigned_to != null && Number(task.assigned_to) === uid;
  const isAssigner = task.assigned_by != null && Number(task.assigned_by) === uid;
  return isAdmin || hasEdit || isAssignee || isAssigner;
}

exports.list = async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const offset = (page - 1) * limit;
  const q = String(req.query.q || "").trim();
  const includeRemoved = String(req.query.include_removed || "false") === "true";

  const where = {};
  if (q) where.title = { [Op.like]: `%${q}%` };
  if (req.query.status) where.status = req.query.status;
  if (req.query.priority) where.priority = req.query.priority;
  if (!includeRemoved && !req.query.status) where.status = { [Op.ne]: "cancelled" };

  const perms = req.user?.Role?.permissions?.map((p) => p.permission_key) || [];
  if (!perms.includes("tasks.view_all") && req.user?.Role?.role_name !== "Super Admin") {
    where[Op.or] = [{ assigned_to: req.user.id }, { assigned_by: req.user.id }];
  }

  const result = await Task.findAndCountAll({
    where,
    include: [
      { model: User, as: "assignee", attributes: ["id", "full_name", "email", "profile_pic"] },
      { model: User, as: "assigner", attributes: ["id", "full_name", "email"] }
    ],
    order: [["created_at", "DESC"]],
    limit,
    offset
  });

  if (includeRemoved && result.rows.length > 0) {
    const ids = result.rows.map((r) => r.id);
    const histories = await TaskStatusHistory.findAll({
      where: { task_id: ids, new_status: "cancelled" },
      include: [{ model: User, as: "ChangedBy", attributes: ["id", "full_name"] }],
      order: [["changed_at", "DESC"]]
    });
    const firstByTask = new Map();
    for (const h of histories) {
      if (!firstByTask.has(h.task_id)) firstByTask.set(h.task_id, h);
    }
    result.rows.forEach((row) => {
      const h = firstByTask.get(row.id);
      row.setDataValue("removed_at", h?.changed_at || null);
      row.setDataValue("removed_by", h?.ChangedBy || null);
    });
  }

  return res.json({ rows: result.rows, count: result.count, page, limit });
};

exports.get = async (req, res) => {
  const row = await Task.findByPk(req.params.id, {
    include: [
      { model: User, as: "assignee", attributes: ["id", "full_name", "email", "profile_pic"] },
      { model: User, as: "assigner", attributes: ["id", "full_name", "email"] },
      { model: TaskAttachment, as: "attachments" },
      {
        model: TaskComment,
        as: "comments",
        include: [{ model: User, as: "User", attributes: ["id", "full_name", "profile_pic"] }]
      },
      {
        model: TaskStatusHistory,
        as: "statusHistory",
        include: [{ model: User, as: "ChangedBy", attributes: ["id", "full_name"] }]
      }
    ]
  });
  if (!row) return res.status(404).json({ message: "Task not found" });
  return res.json(row);
};

exports.create = async (req, res) => {
  const payload = req.body || {};
  const row = await Task.create({
    title: payload.title,
    description: payload.description || null,
    source: payload.source || "manual",
    priority: payload.priority || "medium",
    status: payload.status || "pending",
    assigned_to: payload.assigned_to || null,
    assigned_by: req.user.id,
    deadline: payload.deadline || null,
    category: payload.category || null
  });

  const assignee = row.assigned_to ? Number(row.assigned_to) : null;
  const io = req.app.get("io");
  const t = row.title;
  if (assignee && assignee !== Number(req.user.id)) {
    let bodyText = `You have been assigned: "${t}"`;
    if (row.deadline) {
      bodyText += `. Due: ${new Date(row.deadline).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}`;
    }
    const notif = await Notification.create({
      user_id: assignee,
      title: "New Task Assigned",
      body: bodyText,
      type: "task",
      link: `/tasks/${row.id}`,
      is_read: false
    });

    if (io) {
      io.to(`user:${assignee}`).emit("notification:new", {
        id: notif.id,
        title: "New Task Assigned",
        body: bodyText,
        type: "task",
        link: `/tasks/${row.id}`,
        is_read: false,
        created_at: notif.created_at
      });
      io.to(`user:${assignee}`).emit("toast:show", {
        message: bodyText,
        type: "info"
      });
    }
  }

  return res.status(201).json(row);
};

exports.update = async (req, res) => {
  try {
    const row = await Task.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: "Task not found" });
    const oldStatus = row.status;
    const oldAssigned = row.assigned_to != null ? Number(row.assigned_to) : null;
    const oldDeadlineMs = row.deadline ? new Date(row.deadline).getTime() : null;

    const body = req.body || {};
    await row.update(body);

    if (body.status && body.status !== oldStatus) {
      await TaskStatusHistory.create({
        task_id: row.id,
        old_status: oldStatus,
        new_status: body.status,
        changed_by: req.user.id,
        note: body.note || null
      });
    }

    const newAssigned = row.assigned_to != null ? Number(row.assigned_to) : null;
    const assignmentChanged =
      Object.prototype.hasOwnProperty.call(body, "assigned_to") && newAssigned !== oldAssigned;
    const newDeadlineMs = row.deadline ? new Date(row.deadline).getTime() : null;
    const deadlineChanged =
      Object.prototype.hasOwnProperty.call(body, "deadline") &&
      ((oldDeadlineMs == null) !== (newDeadlineMs == null) ||
        (oldDeadlineMs != null &&
          newDeadlineMs != null &&
          Math.abs(oldDeadlineMs - newDeadlineMs) > 30000));
    console.log(
      "[task:update] taskId:",
      req.params.id,
      "oldAssigned:",
      oldAssigned,
      "newAssigned:",
      newAssigned,
      "assignmentChanged:",
      assignmentChanged,
      "deadlineChanged:",
      deadlineChanged,
      "notifyUserId:",
      newAssigned && newAssigned !== Number(req.user.id) ? newAssigned : null,
      "bodyKeys:",
      Object.keys(body)
    );

    const assignerId = Number(req.user.id);
    const notifyUserId = newAssigned && newAssigned !== assignerId ? newAssigned : null;

    if (notifyUserId && (assignmentChanged || deadlineChanged)) {
      const io = req.app.get("io");
      let title = "Task updated";
      let bodyText = "";
      let notifType = "task";

      if (assignmentChanged && newAssigned) {
        title = oldAssigned == null ? "New Task Assigned" : "Task reassigned to you";
        bodyText = `You have been assigned: "${row.title}"`;
        if (row.deadline) {
          bodyText += `. Due: ${new Date(row.deadline).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}`;
        }
      } else if (deadlineChanged) {
        notifType = "deadline";
        title = "Due date updated";
        bodyText = row.deadline
          ? `"${row.title}" — due ${new Date(row.deadline).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}`
          : `"${row.title}" — due date removed`;
      }

      console.log(
        "[task:update] Creating notification for user:",
        notifyUserId,
        "title:",
        title,
        "body:",
        bodyText
      );
      const notif = await Notification.create({
        user_id: notifyUserId,
        title,
        body: bodyText,
        type: notifType,
        link: `/tasks/${row.id}`,
        is_read: false
      });
      console.log(
        "[task:update] Notification created, id:",
        notif.id,
        "emitting to socket room: user:" + notifyUserId
      );

      if (io) {
        const payload = {
          id: notif.id,
          title,
          body: bodyText,
          type: notifType,
          link: `/tasks/${row.id}`,
          is_read: false,
          created_at: notif.created_at
        };
        io.to(`user:${notifyUserId}`).emit("notification:new", payload);
        io.to(`user:${notifyUserId}`).emit("toast:show", {
          message: bodyText,
          type: "info"
        });
      }
    }

    return res.json(row);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.remove = async (req, res) => {
  const row = await Task.findByPk(req.params.id);
  if (!row) return res.status(404).json({ message: "Task not found" });
  const oldStatus = row.status;
  const tx = await sequelize.transaction();
  try {
    await CallLog.destroy({ where: { task_id: row.id }, transaction: tx });
    await EmailLog.destroy({ where: { task_id: row.id }, transaction: tx });
    await row.update({ status: "cancelled", completed_at: null }, { transaction: tx });
    await TaskStatusHistory.create(
      {
        task_id: row.id,
        old_status: oldStatus,
        new_status: "cancelled",
        changed_by: req.user.id,
        note: "Task removed by admin"
      },
      { transaction: tx }
    );
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    return res.status(500).json({ error: err.message });
  }
  return res.json({ message: "Task moved to removed" });
};

exports.restore = async (req, res) => {
  const row = await Task.findByPk(req.params.id);
  if (!row) return res.status(404).json({ message: "Task not found" });
  const oldStatus = row.status;
  await row.update({ status: "pending" });
  await TaskStatusHistory.create({
    task_id: row.id,
    old_status: oldStatus,
    new_status: "pending",
    changed_by: req.user.id,
    note: "Task restored from removed"
  });
  return res.json({ message: "Task restored to pending" });
};

exports.permanentRemove = async (req, res) => {
  const row = await Task.findByPk(req.params.id);
  if (!row) return res.status(404).json({ message: "Task not found" });
  const tx = await sequelize.transaction();
  try {
    await CallLog.destroy({ where: { task_id: row.id }, transaction: tx });
    await EmailLog.destroy({ where: { task_id: row.id }, transaction: tx });
    await row.destroy({ transaction: tx });
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    return res.status(500).json({ error: err.message });
  }
  return res.json({ message: "Task permanently deleted" });
};

exports.getComments = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findByPk(id);
    if (!task) return res.status(404).json({ message: "Task not found" });
    if (!canCommentOrViewCommentsOnTask(req, task)) {
      return res.status(403).json({ error: "You do not have permission to view comments on this task" });
    }
    const comments = await TaskComment.findAll({
      where: { task_id: id },
      include: [
        {
          model: User,
          as: "User",
          attributes: ["id", "full_name", "profile_pic"]
        }
      ],
      order: [["created_at", "ASC"]]
    });
    return res.json({ success: true, comments });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body || {};
    if (!comment || !String(comment).trim()) {
      return res.status(400).json({ error: "Comment required" });
    }
    const task = await Task.findByPk(id);
    if (!task) return res.status(404).json({ message: "Task not found" });
    if (!canCommentOrViewCommentsOnTask(req, task)) {
      return res.status(403).json({ error: "You do not have permission to comment on this task" });
    }
    const newComment = await TaskComment.create({
      task_id: task.id,
      user_id: req.user.id,
      comment: String(comment).trim()
    });
    const full = await TaskComment.findByPk(newComment.id, {
      include: [
        {
          model: User,
          as: "User",
          attributes: ["id", "full_name", "profile_pic"]
        }
      ]
    });
    return res.status(201).json({ success: true, comment: full });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const history = await TaskStatusHistory.findAll({
      where: { task_id: id },
      include: [
        {
          model: User,
          as: "ChangedBy",
          attributes: ["id", "full_name"]
        }
      ],
      order: [["changed_at", "DESC"]]
    });
    return res.json({ success: true, history });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.changeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body || {};
    if (!status || !String(status).trim()) {
      return res.status(400).json({ error: "status is required" });
    }

    const task = await Task.findByPk(id);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    if (!canManageTaskStatus(req, task)) {
      return res.status(403).json({ error: "Not authorized to change status" });
    }

    const oldStatus = task.status;
    await task.update({
      status,
      completed_at: status === "completed" ? new Date() : null
    });

    await TaskStatusHistory.create({
      task_id: id,
      old_status: oldStatus,
      new_status: status,
      changed_by: req.user.id,
      note: note || null
    });

    const io = req.app.get("io");
    if (status === "completed" && task.assigned_by && Number(task.assigned_by) !== Number(req.user.id)) {
      await Notification.create({
        user_id: task.assigned_by,
        title: "Task Completed",
        body: `"${task.title}" has been marked as completed by ${req.user.full_name}`,
        type: "task",
        link: `/tasks/${id}`,
        is_read: false
      });
      if (io) {
        io.to(`user:${task.assigned_by}`).emit("notification:new", {
          title: "Task Completed",
          body: `"${task.title}" marked complete`,
          type: "task",
          link: `/tasks/${id}`
        });
        io.to(`user:${task.assigned_by}`).emit("toast:show", {
          message: `Task "${task.title}" completed!`,
          type: "success"
        });
      }
    }

    if (status !== "completed" && task.assigned_to && Number(task.assigned_to) !== Number(req.user.id)) {
      await Notification.create({
        user_id: task.assigned_to,
        title: "Task Status Updated",
        body: `"${task.title}" status changed to ${status}`,
        type: "task",
        link: `/tasks/${id}`,
        is_read: false
      });
      if (io) {
        io.to(`user:${task.assigned_to}`).emit("notification:new", {
          title: "Task Updated",
          body: `Status changed to ${status}`,
          type: "task",
          link: `/tasks/${id}`
        });
      }
    }

    return res.json({ success: true, task });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.uploadAttachment = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findByPk(id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const attachment = await TaskAttachment.create({
      task_id: id,
      file_name: req.file.originalname,
      file_path: `/uploads/${req.file.filename}`,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      uploaded_by: req.user.id
    });

    return res.status(201).json({ success: true, attachment });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.getAttachments = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findByPk(id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    const attachments = await TaskAttachment.findAll({
      where: { task_id: id },
      include: [{ model: User, as: "Uploader", attributes: ["id", "full_name"] }],
      order: [["createdAt", "DESC"]]
    });
    return res.json({ success: true, attachments });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.deleteAttachment = async (req, res) => {
  try {
    const { id, aid } = req.params;
    const task = await Task.findByPk(id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    await TaskAttachment.destroy({ where: { id: aid, task_id: id } });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
