const { Router } = require("express");
const { authenticate, authorize } = require("../middlewares/auth");
const c = require("../controllers/calls.controller");

const router = Router();
router.use(authenticate);
router.get("/", authorize("calls.view"), c.list);
router.get("/:id", authorize("calls.view"), c.get);
router.post("/", authorize("calls.log"), c.create);

module.exports = router;
