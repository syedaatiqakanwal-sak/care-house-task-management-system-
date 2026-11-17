const fs = require("fs");
const path = require("path");
const multer = require("multer");
const env = require("../config/env");

const uploadDir = path.resolve(__dirname, "..", env.uploadDir || "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, unique);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: env.maxFileSize || 10 * 1024 * 1024 }
});

module.exports = { upload, uploadDir };
