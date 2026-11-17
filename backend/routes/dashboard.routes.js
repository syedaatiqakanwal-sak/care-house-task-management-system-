const { Router } = require("express");
const { authenticate } = require("../middlewares/auth");
const c = require("../controllers/dashboard.controller");

const router = Router();
router.use(authenticate);
router.get("/widgets", c.widgets);

module.exports = router;
