const { Router } = require("express");
const { authenticate, authorize } = require("../middlewares/auth");
const c = require("../controllers/roles.controller");

const router = Router();
router.use(authenticate);
router.get("/", authorize("roles.view"), c.listRoles);
router.get("/permissions/list", authorize("roles.view"), c.listPermissions);
router.post("/", authorize("roles.create"), c.createRole);
router.put("/:id", authorize("roles.edit"), c.updateRole);
router.delete("/:id", authorize("roles.delete"), c.deleteRole);
router.put("/:id/permissions", authorize("roles.edit"), c.setRolePermissions);

module.exports = router;
