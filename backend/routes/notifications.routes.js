const { Router } = require("express");
const { authenticate } = require("../middlewares/auth");
const c = require("../controllers/notifications.controller");

const router = Router();
router.use(authenticate);
router.get("/", c.list);
router.patch("/:id/read", c.markRead);
router.patch("/mark-all-read", c.markAllRead);

module.exports = router;
