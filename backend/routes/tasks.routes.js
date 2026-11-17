const { Router } = require("express");
const { authenticate, authorize } = require("../middlewares/auth");
const { upload } = require("../middlewares/upload");
const c = require("../controllers/tasks.controller");

const router = Router();
router.use(authenticate);

router.get("/", c.list);
router.get("/:id/comments", c.getComments);
router.get("/:id/history", c.getHistory);
router.patch("/:id/status", authenticate, c.changeStatus);
router.post("/:id/attachments", authenticate, upload.single("file"), c.uploadAttachment);
router.get("/:id/attachments", authenticate, c.getAttachments);
router.delete("/:id/attachments/:aid", authenticate, c.deleteAttachment);
router.get("/:id", c.get);
router.post("/", authorize("tasks.create"), c.create);
router.patch("/:id", authorize("tasks.edit"), c.update);
router.delete("/:id", authorize("tasks.delete"), c.remove);
router.patch("/:id/restore", authorize("tasks.delete"), c.restore);
router.delete("/:id/permanent", authorize("tasks.delete"), c.permanentRemove);
router.post("/:id/comments", c.addComment);

module.exports = router;
