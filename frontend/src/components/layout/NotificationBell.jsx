import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, Bell, CheckSquare, Info, MessageSquare } from "lucide-react";
import api from "../../api";
import { useSocket } from "../../contexts/SocketContext";
import { useTheme } from "../../contexts/ThemeContext";

const PRIMARY = "#0F766E";

function timeAgo(d) {
  if (!d) return "";
  const sec = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

const typeIcon = {
  task: { Icon: CheckSquare, color: "#0d9488", bg: "#ccfbf1" },
  message: { Icon: MessageSquare, color: "#2563eb", bg: "#dbeafe" },
  deadline: { Icon: AlertCircle, color: "#dc2626", bg: "#fee2e2" },
  system: { Icon: Info, color: "#475569", bg: "#e2e8f0" }
};

export function NotificationBell() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const wrapRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/notifications");
      setItems(Array.isArray(data) ? data.slice(0, 10) : []);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!socket) return undefined;
    const onNew = (n) => setItems((prev) => [n, ...prev].slice(0, 10));
    socket.on("notification:new", onNew);
    return () => socket.off("notification:new", onNew);
  }, [socket]);

  useEffect(() => {
    const fn = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("click", fn);
    return () => document.removeEventListener("click", fn);
  }, []);

  const unread = items.filter((n) => !n.is_read).length;

  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, is_read: true } : x)));
    } catch {
      /* ignore */
    }
  };

  const markAll = async () => {
    try {
      await api.patch("/notifications/mark-all-read");
      setItems((prev) => prev.map((x) => ({ ...x, is_read: true })));
    } catch {
      /* ignore */
    }
  };

  const go = (n) => {
    if (n.link) navigate(n.link);
    setOpen(false);
    if (!n.is_read) markRead(n.id);
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          border: "none",
          background: unread > 0 ? (isDark ? "#422006" : "#fef3c7") : isDark ? "#1e293b" : "#f8fafc",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.15s",
          color: unread > 0 ? "#d97706" : isDark ? "#94a3b8" : "#64748b"
        }}
      >
        <Bell size={18} />
        {unread > 0 && (
          <div
            className="badge-pulse"
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              background: "linear-gradient(135deg, #ef4444, #dc2626)",
              color: "#fff",
              fontSize: 10,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
              border: `2px solid ${isDark ? "#0f172a" : "#fff"}`,
              boxShadow: "0 2px 6px rgba(239,68,68,0.4)"
            }}
          >
            {unread > 9 ? "9+" : unread}
          </div>
        )}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: 360,
            maxHeight: 420,
            overflowY: "auto",
            background: isDark ? "#1e293b" : "#fff",
            border: `1px solid ${isDark ? "#334155" : "rgba(0,0,0,0.08)"}`,
            borderRadius: 16,
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
            zIndex: 200
          }}
        >
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${isDark ? "#334155" : "#f1f5f9"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: isDark ? "#f1f5f9" : "#0f172a" }}>Notifications</span>
            <button type="button" onClick={markAll} style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, background: "none", border: "none", cursor: "pointer" }}>
              Mark all read
            </button>
          </div>
          {items.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: isDark ? "#94a3b8" : "#64748b", fontSize: 14 }}>🔔 No notifications yet</div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => go(n)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "12px 16px",
                  border: "none",
                  borderBottom: `1px solid ${isDark ? "#334155" : "#f1f5f9"}`,
                  background: !n.is_read ? (isDark ? "#0f172a" : "#f0fdfa") : "transparent",
                  cursor: "pointer"
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  {(() => {
                    const meta = typeIcon[n.type] || { Icon: Bell, color: "#64748b", bg: "#f1f5f9" };
                    const Icon = meta.Icon;
                    return (
                      <span
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: isDark ? "#334155" : meta.bg,
                          color: isDark ? "#cbd5e1" : meta.color,
                          flexShrink: 0
                        }}
                      >
                        <Icon size={15} />
                      </span>
                    );
                  })()}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: isDark ? "#f1f5f9" : "#0f172a" }}>{n.title}</div>
                    <div style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#64748b", marginTop: 4 }}>{n.body}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{timeAgo(n.created_at || n.createdAt)}</div>
                  </div>
                </div>
              </button>
            ))
          )}
          <div style={{ padding: 10, textAlign: "center" }}>
            <Link to="/notifications" style={{ color: PRIMARY, fontWeight: 700, fontSize: 13 }} onClick={() => setOpen(false)}>
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
