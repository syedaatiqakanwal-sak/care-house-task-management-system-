const dotenv = require("dotenv");

dotenv.config();

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  db: {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    name: process.env.DB_NAME || "letscare_all",
    user: process.env.DB_USER || "root",
    pass: process.env.DB_PASS || ""
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || "change_me_access",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "change_me_refresh",
    accessExpires: process.env.JWT_ACCESS_EXPIRES || "15m",
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || "7d"
  },
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 12),
  uploadDir: process.env.UPLOAD_DIR || "uploads",
  maxFileSize: Number(process.env.MAX_FILE_SIZE || 10485760),
  maxMessageAttachments: Number(process.env.MAX_MESSAGE_ATTACHMENTS || 5),
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY || "",
    privateKey: process.env.VAPID_PRIVATE_KEY || "",
    subject: process.env.VAPID_SUBJECT || "mailto:admin@letscareall.com"
  },
  mail: {
    host: process.env.MAIL_HOST || "",
    port: Number(process.env.MAIL_PORT || 587),
    user: process.env.MAIL_USER || "",
    pass: process.env.MAIL_PASS || "",
    from: process.env.MAIL_FROM || "Lets Care All <no-reply@letscareall.com>"
  }
};
