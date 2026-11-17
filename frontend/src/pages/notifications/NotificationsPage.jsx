import { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import api from "../../api";
import { useTheme } from "../../contexts/ThemeContext";

export default function NotificationsPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data } = await api.get("/notifications");
        const rows = Array.isArray(data) ? data : data.rows || data.data || [];
        if (!cancelled) setItems(rows);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const markRead = async (id) => {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, is_read: true, isRead: true } : x)));
    try {
      await api.patch(`/notifications/${id}/read`);
    } catch {
      // Keep optimistic UI.
    }
  };

  const markAll = async () => {
    setItems((prev) => prev.map((x) => ({ ...x, is_read: true, isRead: true })));
    try {
      await api.patch("/notifications/mark-all-read");
    } catch {
      // Keep optimistic UI.
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: isDark ? "#f1f5f9" : "#0f172a", fontWeight: 800 }}>Notifications</h1>
          <p style={{ margin: "6px 0 0", color: isDark ? "#94a3b8" : "#64748b", fontSize: 13 }}>Stay updated with task and workflow alerts.</p>
        </div>
        <button
          type="button"
          onClick={markAll}
          style={{ border: "none", background: isDark ? "#1e293b" : "#fff", color: isDark ? "#e2e8f0" : "#334155", borderRadius: 10, padding: "10px 14px", display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13, cursor: "pointer", borderColor: isDark ? "#334155" : "#e2e8f0", borderStyle: "solid", borderWidth: 1 }}
        >
          <CheckCheck size={15} /> Mark all read
        </button>
      </div>

      <div style={{ background: isDark ? "#1e293b" : "#fff", borderRadius: 14, border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 14 }}>
            {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 10, marginBottom: 10 }} />)}
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: "center", padding: 44, color: isDark ? "#94a3b8" : "#64748b" }}>
            <Bell size={22} style={{ marginBottom: 8 }} />
            <div>No notifications yet.</div>
          </div>
        ) : (
          <div style={{ display: "grid" }}>
            {items.map((n, idx) => {
              const isRead = Boolean(n.is_read ?? n.isRead);
              return (
                <div
                  key={n.id || idx}
                  style={{
                    borderTop: idx === 0 ? "none" : `1px solid ${isDark ? "#334155" : "#f1f5f9"}`,
                    padding: "14px 16px",
                    background: isRead ? "transparent" : isDark ? "rgba(13,148,136,0.08)" : "rgba(13,148,136,0.06)",
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 10
                  }}
                >
                  <div>
                    <div style={{ color: isDark ? "#f1f5f9" : "#0f172a", fontWeight: 700, fontSize: 14 }}>
                      {n.title || n.type || "Notification"}
                    </div>
                    <div style={{ color: isDark ? "#cbd5e1" : "#334155", fontSize: 13, marginTop: 5 }}>
                      {n.message || n.body || ""}
                    </div>
                    <div style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: 11, marginTop: 6 }}>
                      {n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}
                    </div>
                  </div>
                  {!isRead && (
                    <button
                      type="button"
                      onClick={() => markRead(n.id)}
                      style={{ border: "none", background: "transparent", color: "#0D9488", fontWeight: 700, cursor: "pointer", fontSize: 12 }}
                    >
                      Mark read
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
