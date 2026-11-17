const { ActivityLog } = require("../models");

function activityLogger(req, res, next) {
  const mutating = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  if (!mutating) return next();
  res.on("finish", async () => {
    if (res.statusCode >= 400) return;
    try {
      await ActivityLog.create({
        user_id: req.user?.id || null,
        action: `${req.method} ${req.path}`,
        module: req.baseUrl?.split("/").pop() || "api",
        details: { body: req.body },
        ip_address: req.ip,
        user_agent: req.headers["user-agent"]
      });
    } catch (_) {}
  });
  return next();
}

module.exports = activityLogger;
