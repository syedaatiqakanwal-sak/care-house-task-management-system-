const { Router } = require("express");
const { authenticate } = require("../middlewares/auth");
const c = require("../controllers/messages.controller");

const router = Router();
router.use(authenticate);
router.get("/", c.listConversations);

module.exports = router;
