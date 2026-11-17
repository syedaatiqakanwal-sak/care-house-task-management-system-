const bcrypt = require("bcrypt");
const env = require("../config/env");
const { Role, Permission, User } = require("../models");

const permissionKeys = [
  "users.view", "users.create", "users.edit", "users.delete",
  "roles.view", "roles.create", "roles.edit", "roles.delete",
  "tasks.view_all", "tasks.view_own", "tasks.create", "tasks.edit", "tasks.delete", "tasks.assign", "tasks.change_status",
  "calls.view", "calls.log",
  "emails.view", "emails.log",
  "messages.send", "messages.view",
  "reports.view", "reports.export",
  "notifications.view",
  "settings.manage"
];

async function run() {
  for (const key of permissionKeys) {
    const module = key.split(".")[0];
    await Permission.findOrCreate({ where: { permission_key: key }, defaults: { module, description: key } });
  }

  const [superAdmin] = await Role.findOrCreate({
    where: { role_name: "Super Admin" },
    defaults: { description: "System super admin", is_system: true }
  });
  const defaults = [
    ["Major Role / Project Manager", "Default manager role"],
    ["HR Manager", "HR operations"],
    ["Risk Assessor", "Risk and compliance"]
  ];
  for (const [role_name, description] of defaults) {
    await Role.findOrCreate({ where: { role_name }, defaults: { role_name, description, is_system: false } });
  }
  const allPermissions = await Permission.findAll();
  await superAdmin.setPermissions(allPermissions.map((p) => p.id));

  const hash = await bcrypt.hash("Admin@123", env.bcryptRounds);
  await User.findOrCreate({
    where: { email: "admin@letscareall.com" },
    defaults: {
      full_name: "Super Admin",
      email: "admin@letscareall.com",
      password_hash: hash,
      role_id: superAdmin.id,
      force_password_change: true
    }
  });
  // eslint-disable-next-line no-console
  console.log("Seed completed");
  process.exit(0);
}
run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
