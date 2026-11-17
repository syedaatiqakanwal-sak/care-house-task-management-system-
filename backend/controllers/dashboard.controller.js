const { Op } = require("sequelize");
const { Task, User, Role, Message, CallLog, ConversationMember } = require("../models");

async function countUnreadMessages(userId) {
  const directUnread = await Message.count({
    where: { receiver_id: userId, is_read: false }
  });

  const memberships = await ConversationMember.findAll({
    where: { user_id: userId, left_at: null },
    attributes: ["conversation_id", "last_read_at"]
  });

  let groupUnread = 0;
  for (const membership of memberships) {
    groupUnread += await Message.count({
      where: {
        conversation_id: membership.conversation_id,
        sender_id: { [Op.ne]: userId },
        created_at: { [Op.gt]: membership.last_read_at || new Date(0) }
      }
    });
  }

  return directUnread + groupUnread;
}

exports.widgets = async (req, res) => {
  const permissions = (req.user?.Role?.permissions || []).map((p) => p.permission_key);
  const widgets = [];
  const isSuper = req.user?.Role?.role_name === "Super Admin";
  if (isSuper || permissions.includes("users.view")) {
    widgets.push({ key: "total_users", label: "Total Users", value: await User.count() });
  }
  if (isSuper || permissions.includes("roles.view")) {
    widgets.push({ key: "total_roles", label: "Total Roles", value: await Role.count() });
  }
  widgets.push({
    key: "my_tasks",
    label: "My Tasks",
    value: await Task.count({ where: { assigned_to: req.user.id } })
  });
  if (isSuper || permissions.includes("tasks.view_all")) {
    widgets.push({ key: "all_tasks", label: "All Tasks Overview", value: await Task.count() });
  }
  widgets.push({
    key: "unread_messages",
    label: "Unread Messages",
    value: await countUnreadMessages(req.user.id)
  });
  if (isSuper || permissions.includes("calls.view")) {
    widgets.push({ key: "recent_calls", label: "Recent Call Logs", value: await CallLog.count() });
  }
  res.json(widgets);
};
