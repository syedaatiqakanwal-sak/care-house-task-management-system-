const { Router } = require("express");
const { authenticate, authorize } = require("../middlewares/auth");
const c = require("../controllers/reports.controller");

const router = Router();
router.use(authenticate);
router.use(authorize("reports.view"));
router.use((req, res, next) => {
  if (req.user?.Role?.role_name !== "Super Admin") {
    return res.status(403).json({ error: "Super Admin access required" });
  }
  next();
});

router.get("/summary", c.summary);
router.get("/by-user", c.byUser);
router.get("/tasks-over-time", c.tasksOverTime);
router.get("/by-priority", c.byPriority);
router.get("/by-category", c.byCategory);
router.get("/user/:id", c.userReport);

module.exports = router;
