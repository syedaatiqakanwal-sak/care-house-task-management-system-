const { Router } = require("express");
const { authenticate, authorize } = require("../middlewares/auth");
const c = require("../controllers/users.controller");

const router = Router();
router.use(authenticate);

router.get("/assign-list", c.listForAssign);
router.get("/", authorize("users.view"), c.list);
router.get("/:id", authorize("users.view"), c.get);
router.post("/", authorize("users.create"), c.create);
router.put("/:id", authorize("users.edit"), c.update);
router.patch("/:id/toggle-access", authorize("users.edit"), c.toggleAccess);
router.delete("/:id", authorize("users.delete"), c.remove);

module.exports = router;
