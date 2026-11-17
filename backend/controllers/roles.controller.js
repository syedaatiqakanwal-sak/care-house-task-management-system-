const { Role, Permission } = require("../models");

exports.listRoles = async (req, res) => {
  const rows = await Role.findAll({ include: [{ model: Permission, as: "permissions" }] });
  res.json(rows);
};
exports.createRole = async (req, res) => {
  const row = await Role.create(req.body);
  res.status(201).json(row);
};
exports.updateRole = async (req, res) => {
  const row = await Role.findByPk(req.params.id);
  if (!row) return res.status(404).json({ message: "Role not found" });
  await row.update(req.body);
  res.json(row);
};
exports.deleteRole = async (req, res) => {
  const row = await Role.findByPk(req.params.id);
  if (!row) return res.status(404).json({ message: "Role not found" });
  if (row.is_system) return res.status(400).json({ message: "System role cannot be deleted" });
  await row.destroy();
  res.json({ message: "Role deleted" });
};
exports.listPermissions = async (req, res) => {
  const rows = await Permission.findAll({ order: [["module", "ASC"], ["permission_key", "ASC"]] });
  res.json(rows);
};
exports.setRolePermissions = async (req, res) => {
  const row = await Role.findByPk(req.params.id);
  if (!row) return res.status(404).json({ message: "Role not found" });
  await row.setPermissions(req.body.permissionIds || []);
  const result = await Role.findByPk(req.params.id, { include: [{ model: Permission, as: "permissions" }] });
  res.json(result);
};
