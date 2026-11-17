const { Router } = require("express");
const { authenticate, authorize } = require("../middlewares/auth");
const c = require("../controllers/emails.controller");

const router = Router();
router.use(authenticate);
router.get("/", authorize("emails.view"), c.list);
router.post("/", authorize("emails.log"), c.create);

module.exports = router;
