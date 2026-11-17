const bcrypt = require("bcrypt");
const { Op } = require("sequelize");
const env = require("../config/env");
const {
  sequelize,
  User,
  Role,
  Task,
  Notification,
  TaskComment,
  Message,
  Conversation,
  ConversationMember,
  TaskAttachment,
  TaskStatusHistory,
  ActivityLog
} = require("../models");

exports.list = async (req, res) => {
  const q = String(req.query.q || "").trim();
  const where = {};
  if (q) {
    where[Op.or] = [
      { full_name: { [Op.like]: `%${q}%` } },
      { email: { [Op.like]: `%${q}%` } }
    ];
  }
  const rows = await User.findAll({
    where,
    attributes: { exclude: ["password_hash", "refresh_token", "reset_token", "two_factor_otp"] },
    include: [{ model: Role }],
    order: [["created_at", "DESC"]]
  });
  return res.json(rows);
};

exports.listForAssign = async (req, res) => {
  try {
    const users = await User.findAll({
      where: { status: "active" },
      attributes: ["id", "full_name", "email"],
      include: [{ model: Role, attributes: ["role_name"] }],
      order: [["full_name", "ASC"]]
    });
    return res.json(users);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.get = async (req, res) => {
  const row = await User.findByPk(req.params.id, {
    attributes: { exclude: ["password_hash", "refresh_token", "reset_token", "two_factor_otp"] },
    include: [{ model: Role }]
  });
  if (!row) return res.status(404).json({ message: "User not found" });
  return res.json(row);
};

exports.create = async (req, res) => {
  const payload = req.body || {};
  const password = payload.password || "ChangeMe@123";
  const password_hash = await bcrypt.hash(password, env.bcryptRounds);
  const row = await User.create({
    full_name: payload.full_name,
    email: String(payload.email || "").toLowerCase(),
    phone: payload.phone || null,
    role_id: payload.role_id,
    password_hash,
    status: payload.status || "active",
    force_password_change: payload.force_password_change ?? true
  });
  return res.status(201).json(row);
};

exports.update = async (req, res) => {
  const row = await User.findByPk(req.params.id);
  if (!row) return res.status(404).json({ message: "User not found" });
  const patch = { ...req.body };
  if (patch.password) {
    patch.password_hash = await bcrypt.hash(patch.password, env.bcryptRounds);
    delete patch.password;
  }
  await row.update(patch);
  return res.json(row);
};

exports.remove = async (req, res) => {
  const row = await User.findByPk(req.params.id);
  if (!row) return res.status(404).json({ message: "User not found" });
  if (Number(req.user?.id) === Number(row.id)) {
    return res.status(400).json({ message: "You cannot delete your own account" });
  }

  const tx = await sequelize.transaction();
  try {
    const createdTaskCount = await Task.count({
      where: { assigned_by: row.id },
      transaction: tx
    });
    if (createdTaskCount > 0) {
      await tx.rollback();
      return res.status(409).json({
        message: "Cannot delete user because they created tasks. Reassign those tasks first."
      });
    }

    await Task.update(
      { assigned_to: null },
      { where: { assigned_to: row.id }, transaction: tx }
    );
    await TaskAttachment.update(
      { uploaded_by: null },
      { where: { uploaded_by: row.id }, transaction: tx }
    );
    await TaskStatusHistory.update(
      { changed_by: null },
      { where: { changed_by: row.id }, transaction: tx }
    );
    await ActivityLog.update(
      { user_id: null },
      { where: { user_id: row.id }, transaction: tx }
    );

    await Notification.destroy({ where: { user_id: row.id }, transaction: tx });
    await TaskComment.destroy({ where: { user_id: row.id }, transaction: tx });
    await Message.destroy({
      where: { [Op.or]: [{ sender_id: row.id }, { receiver_id: row.id }] },
      transaction: tx
    });
    await ConversationMember.destroy({ where: { user_id: row.id }, transaction: tx });
    await Conversation.destroy({
      where: { [Op.or]: [{ user1_id: row.id }, { user2_id: row.id }] },
      transaction: tx
    });
    await row.destroy({ transaction: tx });

    await tx.commit();
    return res.json({ message: "User deleted" });
  } catch (err) {
    await tx.rollback();
    throw err;
  }
};

exports.toggleAccess = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const newValue = user.status !== "active";
    await user.update({ status: newValue ? "active" : "inactive" });
    return res.json({
      success: true,
      is_active: newValue,
      status: newValue ? "active" : "inactive",
      message: newValue ? "User access restored" : "User access blocked"
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
