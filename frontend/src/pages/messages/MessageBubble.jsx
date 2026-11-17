import { useEffect, useRef, useState } from "react";
import {
  Check,
  CheckCheck,
  Copy,
  CornerUpLeft,
  Download,
  FileText,
  MoreVertical,
  Pencil,
  Forward,
  Trash2,
  X
} from "lucide-react";

const TEAL = "linear-gradient(135deg, #0D9488, #0F766E)";

function formatBytes(size) {
  if (!size && size !== 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageAttachment(att) {
  return String(att?.mime_type || "").startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(att?.original_file_name || att?.storage_path || "");
}

export default function MessageBubble({
  msg,
  isGroup,
  isDark,
  userId,
  textColor,
  showAvatar,
  showSenderName,
  formatTime,
  onReply,
  onEdit,
  onDelete,
  onCopy,
  onForward,
  onJumpToReply,
  onPreviewImage
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(msg.body || "");
  const menuRef = useRef(null);
  const isSent = msg.sender_id === userId;
  const deleted = Boolean(msg.is_deleted || msg.deleted_at);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDoc = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  useEffect(() => {
    setEditValue(msg.body || "");
    setEditing(false);
  }, [msg.id, msg.body, msg.edited_at]);

  const attachments = msg.attachments || [];
  const legacyUrl = msg.attachment_url
    ? [{ storage_path: msg.attachment_url, original_file_name: "Attachment", mime_type: "" }]
    : [];
  const files = attachments.length ? attachments : legacyUrl;

  const reply = msg.ReplyTo || msg.reply_to;

  return (
    <div
      id={`message-${msg.id}`}
      style={{
        display: "flex",
        justifyContent: isSent ? "flex-end" : "flex-start",
        alignItems: "flex-end",
        gap: "8px",
        position: "relative"
      }}
    >
      {!isSent && (
        <div
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "50%",
            background: showAvatar ? TEAL : "transparent",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: "11px",
            flexShrink: 0
          }}
        >
          {showAvatar ? msg.Sender?.full_name?.[0]?.toUpperCase() : ""}
        </div>
      )}

      <div
        style={{
          maxWidth: "70%",
          display: "flex",
          flexDirection: "column",
          alignItems: isSent ? "flex-end" : "flex-start",
          position: "relative"
        }}
        onMouseLeave={() => setMenuOpen(false)}
      >
        {showSenderName && (
          <span style={{ fontSize: "10px", fontWeight: 700, color: "#0D9488", marginBottom: "2px", marginLeft: "4px" }}>
            {msg.Sender?.full_name || "Unknown"}
          </span>
        )}

        <div style={{ display: "flex", alignItems: "flex-start", gap: "4px", flexDirection: isSent ? "row-reverse" : "row" }}>
          <div
            style={{
              padding: deleted ? "10px 14px" : "10px 14px",
              borderRadius: isSent ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              background: deleted
                ? isDark
                  ? "#334155"
                  : "#f1f5f9"
                : isSent
                  ? TEAL
                  : isDark
                    ? "#334155"
                    : "#f1f5f9",
              color: deleted ? "#94a3b8" : isSent ? "#fff" : textColor,
              fontSize: "13px",
              lineHeight: 1.5,
              wordBreak: "break-word",
              whiteSpace: "pre-wrap",
              fontStyle: deleted ? "italic" : "normal",
              minWidth: "60px"
            }}
          >
            {msg.is_forwarded && !deleted && (
              <div style={{ fontSize: "10px", opacity: 0.85, marginBottom: "4px", fontWeight: 700 }}>Forwarded</div>
            )}

            {reply && !deleted && (
              <button
                type="button"
                onClick={() => onJumpToReply?.(reply.id)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  borderLeft: `3px solid ${isSent ? "rgba(255,255,255,0.7)" : "#0D9488"}`,
                  background: isSent ? "rgba(255,255,255,0.12)" : isDark ? "rgba(15,23,42,0.35)" : "rgba(13,148,136,0.08)",
                  borderRadius: "8px",
                  padding: "6px 8px",
                  marginBottom: "8px",
                  cursor: "pointer",
                  color: "inherit",
                  fontFamily: "inherit"
                }}
              >
                <div style={{ fontSize: "10px", fontWeight: 700, opacity: 0.9 }}>
                  {reply.Sender?.full_name || "Message"}
                </div>
                <div style={{ fontSize: "11px", opacity: 0.85, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {reply.body || (reply.attachments?.length ? "Attachment" : "")}
                </div>
              </button>
            )}

            {editing ? (
              <div>
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  rows={3}
                  style={{
                    width: "100%",
                    minWidth: "220px",
                    borderRadius: "8px",
                    border: "1px solid rgba(255,255,255,0.3)",
                    padding: "8px",
                    fontFamily: "inherit",
                    fontSize: "13px",
                    resize: "vertical",
                    color: "#0f172a"
                  }}
                />
                <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      onEdit?.(msg, editValue);
                      setEditing(false);
                    }}
                    style={{
                      border: "none",
                      borderRadius: "8px",
                      padding: "6px 10px",
                      background: "#fff",
                      color: "#0F766E",
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: "12px"
                    }}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      setEditValue(msg.body || "");
                    }}
                    style={{
                      border: "none",
                      borderRadius: "8px",
                      padding: "6px 10px",
                      background: "rgba(15,23,42,0.2)",
                      color: "#fff",
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: "12px"
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                {deleted ? "This message was deleted" : msg.body}
                {!deleted &&
                  files.map((att, idx) => {
                    const url = att.storage_path || att.url;
                    if (isImageAttachment(att) || /\.(png|jpe?g|webp)$/i.test(url || "")) {
                      return (
                        <button
                          key={att.id || idx}
                          type="button"
                          onClick={() => onPreviewImage?.(url)}
                          style={{
                            display: "block",
                            marginTop: msg.body ? "8px" : 0,
                            padding: 0,
                            border: "none",
                            background: "none",
                            cursor: "pointer"
                          }}
                        >
                          <img
                            src={url}
                            alt={att.original_file_name || "Image"}
                            style={{
                              maxWidth: "240px",
                              maxHeight: "220px",
                              borderRadius: "10px",
                              display: "block"
                            }}
                          />
                        </button>
                      );
                    }
                    return (
                      <a
                        key={att.id || idx}
                        href={url}
                        download={att.original_file_name || true}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginTop: msg.body ? "8px" : 0,
                          padding: "8px 10px",
                          borderRadius: "10px",
                          background: isSent ? "rgba(255,255,255,0.15)" : isDark ? "rgba(15,23,42,0.4)" : "#fff",
                          color: "inherit",
                          textDecoration: "none",
                          fontSize: "12px"
                        }}
                      >
                        <FileText size={16} />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {att.original_file_name || "Document"}
                          </div>
                          <div style={{ opacity: 0.8 }}>{formatBytes(att.file_size)}</div>
                        </span>
                        <Download size={14} />
                      </a>
                    );
                  })}
              </>
            )}
          </div>

          {!deleted && !editing && (
            <div ref={menuRef} style={{ position: "relative", alignSelf: "center" }}>
              <button
                type="button"
                aria-label="Message actions"
                onClick={() => setMenuOpen((v) => !v)}
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "6px",
                  border: "none",
                  background: "transparent",
                  color: "#94a3b8",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: menuOpen ? 1 : 0.55
                }}
              >
                <MoreVertical size={14} />
              </button>
              {menuOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    [isSent ? "right" : "left"]: 0,
                    zIndex: 20,
                    minWidth: "150px",
                    background: isDark ? "#1e293b" : "#fff",
                    border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
                    borderRadius: "10px",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                    padding: "4px",
                    overflow: "hidden"
                  }}
                >
                  {[
                    { key: "reply", label: "Reply", icon: CornerUpLeft, onClick: () => onReply?.(msg) },
                    { key: "copy", label: "Copy", icon: Copy, onClick: () => onCopy?.(msg) },
                    { key: "forward", label: "Forward", icon: Forward, onClick: () => onForward?.(msg) },
                    ...(isSent
                      ? [
                          {
                            key: "edit",
                            label: "Edit",
                            icon: Pencil,
                            onClick: () => {
                              setEditing(true);
                              setMenuOpen(false);
                            }
                          },
                          { key: "delete", label: "Delete", icon: Trash2, onClick: () => onDelete?.(msg), danger: true }
                        ]
                      : [])
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        item.onClick?.();
                      }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px 10px",
                        border: "none",
                        background: "transparent",
                        color: item.danger ? "#dc2626" : textColor,
                        cursor: "pointer",
                        fontSize: "12px",
                        fontFamily: "inherit",
                        borderRadius: "8px",
                        textAlign: "left"
                      }}
                    >
                      <item.icon size={14} />
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "3px" }}>
          <span style={{ fontSize: "10px", color: "#94a3b8" }}>{formatTime(msg.created_at || msg.createdAt)}</span>
          {msg.is_edited && !deleted && <span style={{ fontSize: "10px", color: "#94a3b8" }}>Edited</span>}
          {isSent && !isGroup && !deleted && (msg.is_read ? <CheckCheck size={12} color="#0D9488" /> : <Check size={12} color="#94a3b8" />)}
        </div>
      </div>
    </div>
  );
}

export function AttachmentPreviews({ files, onRemove, isDark }) {
  if (!files?.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "8px" }}>
      {files.map((file, idx) => {
        const isImage = file.previewUrl || String(file.type || file.mime_type || "").startsWith("image/");
        return (
          <div
            key={file.id || idx}
            style={{
              position: "relative",
              width: isImage ? "72px" : "160px",
              borderRadius: "10px",
              border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
              background: isDark ? "#0f172a" : "#fff",
              overflow: "hidden",
              padding: isImage ? 0 : "8px"
            }}
          >
            {isImage ? (
              <img src={file.previewUrl || file.url} alt={file.name} style={{ width: "72px", height: "72px", objectFit: "cover", display: "block" }} />
            ) : (
              <div style={{ fontSize: "11px", color: isDark ? "#f1f5f9" : "#0f172a" }}>
                <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</div>
                <div style={{ color: "#94a3b8" }}>{formatBytes(file.size)}</div>
              </div>
            )}
            <button
              type="button"
              onClick={() => onRemove?.(idx)}
              aria-label="Remove attachment"
              style={{
                position: "absolute",
                top: "4px",
                right: "4px",
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                border: "none",
                background: "rgba(15,23,42,0.75)",
                color: "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
