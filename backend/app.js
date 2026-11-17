require("express-async-errors");
const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const helmet = require("helmet");
const hpp = require("hpp");
const mongoSanitize = require("express-mongo-sanitize");
const xssClean = require("xss-clean");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const env = require("./config/env");
const { globalLimiter } = require("./middlewares/rateLimit");
const activityLogger = require("./middlewares/activityLogger");

const authRoutes = require("./routes/auth.routes");
const taskRoutes = require("./routes/tasks.routes");
const userRoutes = require("./routes/users.routes");
const callRoutes = require("./routes/calls.routes");
const emailRoutes = require("./routes/emails.routes");
const messageRoutes = require("./routes/messages.routes");
const conversationAliasRoutes = require("./routes/conversations.routes");
const notificationRoutes = require("./routes/notifications.routes");
const reportRoutes = require("./routes/reports.routes");
const searchRoutes = require("./routes/search.routes");
const roleRoutes = require("./routes/roles.routes");
const permissionRoutes = require("./routes/permissions.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const auditRoutes = require("./routes/audit.routes");
const dailyReportRoutes = require("./routes/dailyReports.routes");

const app = express();
app.set("trust proxy", 1);

app.use(helmet());
app.use(hpp());
app.use(mongoSanitize());
app.use(xssClean());
app.use(cookieParser());
app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use(globalLimiter);

const uploadDir = path.resolve(__dirname, env.uploadDir || "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use("/uploads", express.static(uploadDir));

app.get("/api/v1/health", (req, res) => {
  res.json({
    ok: true,
    service: "letscare-backend",
    mode: "production",
    timestamp: new Date().toISOString()
  });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/tasks", activityLogger, taskRoutes);
app.use("/api/v1/users", activityLogger, userRoutes);
app.use("/api/v1/calls", activityLogger, callRoutes);
app.use("/api/v1/emails", activityLogger, emailRoutes);
app.use("/api/v1/messages", activityLogger, messageRoutes);
app.use("/api/v1/conversations", activityLogger, conversationAliasRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/reports", reportRoutes);
app.use("/api/v1/search", searchRoutes);
app.use("/api/v1/roles", activityLogger, roleRoutes);
app.use("/api/v1/permissions", permissionRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/audit-logs", auditRoutes);
app.use("/api/v1/activity-logs", auditRoutes);
app.use("/api/v1/daily-reports", activityLogger, dailyReportRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Not found" });
});

app.use((err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  if (res.headersSent) return next(err);
  return res.status(500).json({ message: "Internal server error" });
});

module.exports = app;
