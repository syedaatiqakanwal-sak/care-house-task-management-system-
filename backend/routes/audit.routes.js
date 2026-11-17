const { Router } = require("express");
const { authenticate, authorize } = require("../middlewares/auth");
const c = require("../controllers/audit.controller");

const router = Router();
router.use(authenticate);
router.get("/", authorize("users.view"), c.list);

module.exports = router;
