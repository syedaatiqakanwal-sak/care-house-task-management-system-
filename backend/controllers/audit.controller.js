const { Op } = require("sequelize");
const { ActivityLog, User } = require("../models");

exports.list = async (req, res) => {
  const q = String(req.query.q || "").trim();
  const where = {};
  if (q) where.action = { [Op.like]: `%${q}%` };

  const rows = await ActivityLog.findAll({
    where,
    include: [{ model: User, as: "user", attributes: ["id", "full_name", "email"] }],
    order: [["created_at", "DESC"]],
    limit: Number(req.query.limit || 300)
  });
  return res.json(rows);
};
