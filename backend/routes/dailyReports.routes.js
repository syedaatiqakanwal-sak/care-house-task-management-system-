const { Router } = require("express");
const { authenticate } = require("../middlewares/auth");
const c = require("../controllers/dailyReports.controller");

const router = Router();
router.use(authenticate);

router.post("/", c.create);
router.post("/bulk-today", c.bulkUpsertToday);
router.get("/my", c.listMy);
router.get("/all", c.listAll);
router.get("/user/:userId", c.listByUser);
router.patch("/:id", c.update);
router.patch("/:id/status", c.updateStatus);
router.delete("/:id", c.remove);

module.exports = router;
