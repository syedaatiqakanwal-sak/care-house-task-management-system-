const { Router } = require("express");
const { authenticate, authorize } = require("../middlewares/auth");
const { listPermissions } = require("../controllers/roles.controller");

const router = Router();
router.use(authenticate);
router.get("/", authorize("roles.view"), listPermissions);

module.exports = router;
