const { Router } = require("express");
const { authenticate } = require("../middlewares/auth");
const { messageUpload } = require("../middlewares/messageUpload");
const c = require("../controllers/messages.controller");

const router = Router();
router.use(authenticate);

router.get("/conversations", c.listConversations);
router.post("/conversations/group", c.createGroup);
router.get("/conversations/:id", c.getConversation);
router.patch("/conversations/:id", c.updateGroup);
router.post("/conversations/:id/members", c.addMembers);
router.delete("/conversations/:id/members/:userId", c.removeMember);
router.post("/conversations/:id/leave", c.leaveGroup);
router.get("/conversations/:id/messages", c.listMessages);

function optionalMultipart(req, res, next) {
  const ct = String(req.headers["content-type"] || "");
  if (!ct.includes("multipart/form-data")) return next();
  return messageUpload.array("files", 5)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    return next();
  });
}

router.post("/messages", optionalMultipart, c.send);
router.post(
  "/uploads",
  (req, res, next) => {
    messageUpload.array("files", 5)(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      return next();
    });
  },
  c.uploadAttachments
);

router.patch("/messages/:id", c.editMessage);
router.delete("/messages/:id", c.deleteMessage);
router.post("/messages/:id/forward", c.forwardMessage);
router.patch("/messages/:id/read", c.markRead);

router.get("/push/vapid-public-key", c.getVapidPublicKey);
router.post("/push/subscribe", c.subscribePush);
router.post("/push/unsubscribe", c.unsubscribePush);

module.exports = router;
