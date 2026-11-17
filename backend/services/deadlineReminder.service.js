const cron = require("node-cron");
const { Op } = require("sequelize");
const { Task, Notification } = require("../models");

async function hasDeadlineNotifSince(taskId, userId, sinceMs) {
  const since = new Date(Date.now() - sinceMs);
  const found = await Notification.findOne({
    where: {
      user_id: userId,
      type: "deadline",
      link: `/tasks/${taskId}`,
      createdAt: { [Op.gte]: since }
    }
  });
  return !!found;
}

function startDeadlineReminder(io) {
  cron.schedule("*/15 * * * *", async () => {
    try {
      const now = new Date();
      const in24 = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const dueTasks = await Task.findAll({
        where: {
          deadline: { [Op.between]: [now, in24] },
          status: { [Op.notIn]: ["completed", "cancelled"] },
          assigned_to: { [Op.ne]: null }
        }
      });
      console.log(
        "[deadlineReminder] tick at",
        new Date().toISOString(),
        "found",
        dueTasks.length,
        "tasks due within 24h"
      );

      for (const task of dueTasks) {
        try {
          const due = new Date(task.deadline).getTime();
          const msUntil = due - Date.now();
          if (msUntil <= 0) continue;

          const uid = Number(task.assigned_to);
          let title;
          let body;
          let dedupMs;

          if (msUntil <= 30 * 60 * 1000) {
            title = "Deadline very close";
            const mins = Math.max(1, Math.round(msUntil / 60000));
            body = `"${task.title}" is due in about ${mins} minute${mins === 1 ? "" : "s"}`;
            dedupMs = 25 * 60 * 1000;
          } else if (msUntil <= 2 * 60 * 60 * 1000) {
            title = "Deadline approaching";
            const hours = Math.round((msUntil / (60 * 60 * 1000)) * 10) / 10;
            body = `"${task.title}" is due in about ${hours} hour${hours === 1 ? "" : "s"}`;
            dedupMs = 45 * 60 * 1000;
          } else {
            title = "Deadline reminder";
            body = `${task.title} is due within 24 hours`;
            dedupMs = 10 * 60 * 60 * 1000;
          }

          if (await hasDeadlineNotifSince(task.id, uid, dedupMs)) {
            console.log(
              "[deadlineReminder] skipping task",
              task.id,
              "- already notified within dedup window"
            );
            continue;
          }
          console.log(
            "[deadlineReminder] sending",
            title,
            "for task",
            task.id,
            "to user:",
            uid,
            "msUntil:",
            msUntil
          );

          const notif = await Notification.create({
            user_id: uid,
            title,
            body,
            type: "deadline",
            link: `/tasks/${task.id}`,
            is_read: false
          });

          if (io) {
            const payload = {
              id: notif.id,
              title,
              body,
              type: "deadline",
              link: `/tasks/${task.id}`,
              is_read: false,
              created_at: notif.created_at
            };
            io.to(`user:${uid}`).emit("notification:new", payload);
            io.to(`user:${uid}`).emit("toast:show", {
              message: body,
              type: msUntil <= 30 * 60 * 1000 ? "error" : "info"
            });
            console.log("[deadlineReminder] emitted notification:new to user:" + uid);
          }
        } catch (taskErr) {
          console.error("[deadlineReminder] failed for task:", task.id, taskErr.message);
        }
      }
    } catch (err) {
      console.error("[deadlineReminder] cron error:", err.message, err.stack);
    }
  });
}

module.exports = { startDeadlineReminder };
