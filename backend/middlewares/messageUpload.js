const path = require("path");
const multer = require("multer");
const { uploadDir } = require("./upload");
const env = require("../config/env");

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/csv"
]);

const ALLOWED_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".txt",
  ".csv"
]);

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const mime = String(file.mimetype || "").toLowerCase();
  if (!ALLOWED_MIME.has(mime) || !ALLOWED_EXT.has(ext)) {
    return cb(new Error("Unsupported file type"));
  }
  return cb(null, true);
}

const messageUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || "");
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, unique);
    }
  }),
  limits: {
    fileSize: env.maxFileSize || 10 * 1024 * 1024,
    files: env.maxMessageAttachments || 5
  },
  fileFilter
});

module.exports = {
  messageUpload,
  ALLOWED_MIME,
  ALLOWED_EXT,
  uploadDir
};
