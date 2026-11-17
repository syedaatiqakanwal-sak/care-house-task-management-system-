const { Notification } = require("../models");

exports.list = async (req, res) => {
  const rows = await Notification.findAll({
    where: { user_id: req.user.id },
    order: [["created_at", "DESC"]],
    limit: 100
  });
  return res.json(rows);
};

exports.markRead = async (req, res) => {
  const row = await Notification.findOne({
    where: { id: req.params.id, user_id: req.user.id }
  });
  if (!row) return res.status(404).json({ message: "Notification not found" });
  await row.update({ is_read: true });
  return res.json({ ok: true });
};

exports.markAllRead = async (req, res) => {
  await Notification.update({ is_read: true }, { where: { user_id: req.user.id, is_read: false } });
  return res.json({ ok: true });
};
