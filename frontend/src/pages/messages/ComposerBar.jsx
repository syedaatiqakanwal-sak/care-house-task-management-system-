import { useRef } from "react";
import { Paperclip, Send, X } from "lucide-react";
import { AttachmentPreviews } from "./MessageBubble";

const TEAL = "linear-gradient(135deg, #0D9488, #0F766E)";
const ACCEPT =
  ".png,.jpg,.jpeg,.webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/png,image/jpeg,image/webp,application/pdf";

export default function ComposerBar({
  isDark,
  text,
  border,
  pageBg,
  surface,
  newMessage,
  onChangeMessage,
  onSend,
  sending,
  pendingFiles,
  onRemoveFile,
  onAddFiles,
  replyTo,
  onCancelReply,
  dragOver,
  setDragOver
}) {
  const fileRef = useRef(null);
  const canSend = Boolean(newMessage.trim() || pendingFiles.length);

  const onPaste = async (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItems = items.filter((item) => item.type.startsWith("image/"));
    if (!imageItems.length) return;

    e.preventDefault();
    const files = [];
    for (const item of imageItems) {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
    if (files.length) onAddFiles?.(files);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver?.(false);
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length) onAddFiles?.(files);
  };

  return (
    <div
      style={{
        padding: "12px 16px",
        borderTop: `1px solid ${border}`,
        background: surface
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver?.(true);
      }}
      onDragLeave={() => setDragOver?.(false)}
      onDrop={onDrop}
    >
      {replyTo && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "8px",
            padding: "8px 10px",
            borderRadius: "10px",
            borderLeft: "3px solid #0D9488",
            background: isDark ? "#0f172a" : "#f1f5f9"
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#0D9488" }}>
              Replying to {replyTo.Sender?.full_name || "message"}
            </div>
            <div
              style={{
                fontSize: "12px",
                color: isDark ? "#cbd5e1" : "#475569",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }}
            >
              {replyTo.is_deleted || replyTo.deleted_at
                ? "This message was deleted"
                : replyTo.body || "Attachment"}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label="Cancel reply"
            style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <AttachmentPreviews files={pendingFiles} onRemove={onRemoveFile} isDark={isDark} />

      {dragOver && (
        <div
          style={{
            marginBottom: "8px",
            padding: "12px",
            borderRadius: "10px",
            border: "1.5px dashed #0D9488",
            color: "#0D9488",
            fontSize: "12px",
            fontWeight: 700,
            textAlign: "center"
          }}
        >
          Drop files to attach
        </div>
      )}

      <div style={{ display: "flex", alignItems: "flex-end", gap: "10px" }}>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          title="Attach files"
          aria-label="Attach files"
          style={{
            width: "42px",
            height: "42px",
            borderRadius: "50%",
            border: `1px solid ${border}`,
            background: pageBg,
            color: "#64748b",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
          }}
        >
          <Paperclip size={16} />
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={ACCEPT}
          style={{ display: "none" }}
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (files.length) onAddFiles?.(files);
            e.target.value = "";
          }}
        />

        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            background: pageBg,
            border: `1.5px solid ${border}`,
            borderRadius: "24px",
            padding: "8px 16px",
            gap: "8px"
          }}
        >
          <textarea
            value={newMessage}
            onChange={(e) => onChangeMessage?.(e.target.value)}
            onPaste={onPaste}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend?.();
              }
            }}
            placeholder="Type a message... Paste screenshots with Ctrl+V"
            aria-label="Message input"
            rows={1}
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              outline: "none",
              fontSize: "13px",
              color: text,
              fontFamily: "inherit",
              resize: "none",
              maxHeight: "96px",
              lineHeight: 1.4
            }}
          />
        </div>

        <button
          type="button"
          onClick={onSend}
          disabled={!canSend || sending}
          aria-label="Send message"
          style={{
            width: "42px",
            height: "42px",
            borderRadius: "50%",
            border: "none",
            background: !canSend ? "#e2e8f0" : TEAL,
            color: !canSend ? "#94a3b8" : "#fff",
            cursor: !canSend ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
          }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
