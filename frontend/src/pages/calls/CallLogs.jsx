import { useEffect, useMemo, useState } from "react";
import { PhoneCall, Plus, Search } from "lucide-react";
import api from "../../api";
import { useTheme } from "../../contexts/ThemeContext";
import { useToast } from "../../components/common/Toast";

const TASK_CATEGORY_OPTIONS = [
  "Administration & Management",
  "Care Services Compliance",
  "Community Outreach & Client Relations",
  "Finance & Payroll",
  "Health & Safety",
  "Human Resources (HR)",
  "Marketing & Business Development",
  "Quality Assurance",
  "Training & Development",
  "Other"
];

export default function CallLogs() {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const isDark = theme === "dark";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState([]);
  const [openModal, setOpenModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    caller_name: "",
    caller_phone: "",
    call_type: "inbound",
    duration_sec: "",
    call_datetime: "",
    call_summary: "",
    title: "",
    description: "",
    priority: "medium",
    deadline: "",
    assigned_to: "",
    category: ""
  });

  const loadCalls = async () => {
    const { data } = await api.get("/calls");
    const rows = Array.isArray(data) ? data : data.rows || data.data || [];
    setItems(rows);
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [callsRes, usersRes] = await Promise.allSettled([api.get("/calls"), api.get("/users/assign-list")]);
        if (!cancelled) {
          if (callsRes.status === "fulfilled") {
            const data = callsRes.value.data;
            setItems(Array.isArray(data) ? data : data.rows || data.data || []);
          } else {
            setItems([]);
          }

          if (usersRes.status === "fulfilled") {
            const data = usersRes.value.data;
            setUsers(Array.isArray(data) ? data : data.users || data.rows || data.data || []);
          } else {
            setUsers([]);
          }
        }
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

  useEffect(() => {
    const onTaskRemoved = () => {
      loadCalls();
    };
    window.addEventListener("letscare:task-removed", onTaskRemoved);
    return () => window.removeEventListener("letscare:task-removed", onTaskRemoved);
  }, []);

  const onFormChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const resetForm = () => {
    setForm({
      caller_name: "",
      caller_phone: "",
      call_type: "inbound",
      duration_sec: "",
      call_datetime: "",
      call_summary: "",
      title: "",
      description: "",
      priority: "medium",
      deadline: "",
      assigned_to: "",
      category: ""
    });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/calls", {
        ...form,
        duration_sec: form.duration_sec ? Number(form.duration_sec) : 0,
        assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
        deadline: form.deadline || null,
        call_datetime: form.call_datetime || new Date().toISOString()
      });
      showToast("Call logged & task created", "success");
      resetForm();
      setOpenModal(false);
      await loadCalls();
    } catch (err) {
      showToast(err?.response?.data?.error || "Failed to log call", "error");
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(
    () =>
      items.filter((call) => {
        const q = search.toLowerCase();
        return (
          !q ||
          String(call?.caller_name || call?.contact_name || "").toLowerCase().includes(q) ||
          String(call?.caller_phone || call?.phone || "").toLowerCase().includes(q) ||
          String(call?.call_summary || call?.notes || "").toLowerCase().includes(q) ||
          String(call?.task?.title || "").toLowerCase().includes(q)
        );
      }),
    [items, search]
  );

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: isDark ? "#f1f5f9" : "#0f172a", fontWeight: 800 }}>Call Logs</h1>
          <p style={{ margin: "6px 0 0", color: isDark ? "#94a3b8" : "#64748b", fontSize: 13 }}>Track outgoing and incoming call activity.</p>
        </div>
        <button onClick={() => setOpenModal(true)} type="button" style={{ border: "none", background: "linear-gradient(135deg, #0D9488, #0F766E)", color: "#fff", borderRadius: 10, padding: "10px 14px", display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          <Plus size={16} /> Add Call Log
        </button>
      </div>

      <div style={{ background: isDark ? "#1e293b" : "#fff", border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, borderRadius: 14, padding: 12, marginBottom: 14 }}>
        <div style={{ position: "relative", maxWidth: 360 }}>
          <Search size={15} style={{ position: "absolute", left: 10, top: 11, color: isDark ? "#94a3b8" : "#64748b" }} />
          <input
            placeholder="Search calls..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", padding: "10px 12px 10px 32px", borderRadius: 9, border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a", fontSize: 13 }}
          />
        </div>
      </div>

      <div style={{ background: isDark ? "#1e293b" : "#fff", border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, borderRadius: 14, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 16 }}>
            {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 8, marginBottom: 10 }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 44, color: isDark ? "#94a3b8" : "#64748b" }}>
            <PhoneCall size={22} style={{ marginBottom: 8 }} />
            <div>No call logs found.</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: isDark ? "#0f172a" : "#f8fafc", textAlign: "left" }}>
                  {["Contact", "Phone", "Type", "Duration", "Date", "Task", "Summary"].map((h) => (
                    <th key={h} style={{ padding: "12px 14px", fontSize: 12, color: isDark ? "#94a3b8" : "#64748b", fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((call, idx) => (
                  <tr key={call.id || idx} style={{ borderTop: `1px solid ${isDark ? "#334155" : "#f1f5f9"}` }}>
                    <td style={{ padding: "12px 14px", color: isDark ? "#f1f5f9" : "#0f172a", fontWeight: 600 }}>{call.caller_name || call.contact_name || "-"}</td>
                    <td style={{ padding: "12px 14px", color: isDark ? "#cbd5e1" : "#334155", fontSize: 13 }}>{call.caller_phone || call.phone || "-"}</td>
                    <td style={{ padding: "12px 14px", color: isDark ? "#cbd5e1" : "#334155", fontSize: 13, textTransform: "capitalize" }}>{call.call_type || call.type || "-"}</td>
                    <td style={{ padding: "12px 14px", color: isDark ? "#cbd5e1" : "#334155", fontSize: 13 }}>{call.duration_sec ?? call.duration ?? 0}s</td>
                    <td style={{ padding: "12px 14px", color: isDark ? "#cbd5e1" : "#334155", fontSize: 13 }}>{call.call_datetime ? new Date(call.call_datetime).toLocaleString() : "-"}</td>
                    <td style={{ padding: "12px 14px", color: isDark ? "#cbd5e1" : "#334155", fontSize: 13, fontWeight: 600 }}>{call.task?.title || "-"}</td>
                    <td style={{ padding: "12px 14px", color: isDark ? "#cbd5e1" : "#334155", fontSize: 13 }}>{call.call_summary || call.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.55)", zIndex: 1200, display: "grid", placeItems: "center", padding: 16 }}>
          <form onSubmit={handleCreate} style={{ width: "100%", maxWidth: 860, background: isDark ? "#0f172a" : "#fff", border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, borderRadius: 16, padding: 16 }}>
            <h3 style={{ margin: 0, color: isDark ? "#f8fafc" : "#0f172a" }}>Log a Call</h3>
            <p style={{ margin: "6px 0 12px", color: isDark ? "#94a3b8" : "#64748b", fontSize: 13 }}>Create call log and task in one action.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
              <input required placeholder="Caller Name" value={form.caller_name} onChange={(e) => onFormChange("caller_name", e.target.value)} style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`, background: isDark ? "#111827" : "#fff", color: isDark ? "#e2e8f0" : "#0f172a" }} />
              <input placeholder="Caller Phone" value={form.caller_phone} onChange={(e) => onFormChange("caller_phone", e.target.value)} style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`, background: isDark ? "#111827" : "#fff", color: isDark ? "#e2e8f0" : "#0f172a" }} />
              <select value={form.call_type} onChange={(e) => onFormChange("call_type", e.target.value)} style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`, background: isDark ? "#111827" : "#fff", color: isDark ? "#e2e8f0" : "#0f172a" }}>
                <option value="inbound">Inbound</option>
                <option value="outbound">Outbound</option>
              </select>
              <input type="number" min="0" placeholder="Duration (sec)" value={form.duration_sec} onChange={(e) => onFormChange("duration_sec", e.target.value)} style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`, background: isDark ? "#111827" : "#fff", color: isDark ? "#e2e8f0" : "#0f172a" }} />
              <input type="datetime-local" value={form.call_datetime} onChange={(e) => onFormChange("call_datetime", e.target.value)} style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`, background: isDark ? "#111827" : "#fff", color: isDark ? "#e2e8f0" : "#0f172a" }} />
              <input required placeholder="Task Title" value={form.title} onChange={(e) => onFormChange("title", e.target.value)} style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`, background: isDark ? "#111827" : "#fff", color: isDark ? "#e2e8f0" : "#0f172a" }} />
              <textarea placeholder="Call Summary" value={form.call_summary} onChange={(e) => onFormChange("call_summary", e.target.value)} rows={3} style={{ gridColumn: "1 / -1", padding: "10px 12px", borderRadius: 10, border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`, background: isDark ? "#111827" : "#fff", color: isDark ? "#e2e8f0" : "#0f172a" }} />
              <textarea placeholder="Task Description" value={form.description} onChange={(e) => onFormChange("description", e.target.value)} rows={3} style={{ gridColumn: "1 / -1", padding: "10px 12px", borderRadius: 10, border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`, background: isDark ? "#111827" : "#fff", color: isDark ? "#e2e8f0" : "#0f172a" }} />
              <select value={form.priority} onChange={(e) => onFormChange("priority", e.target.value)} style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`, background: isDark ? "#111827" : "#fff", color: isDark ? "#e2e8f0" : "#0f172a" }}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
              <input type="datetime-local" value={form.deadline} onChange={(e) => onFormChange("deadline", e.target.value)} style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`, background: isDark ? "#111827" : "#fff", color: isDark ? "#e2e8f0" : "#0f172a" }} />
              <select value={form.assigned_to || ""} onChange={(e) => onFormChange("assigned_to", e.target.value)} style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`, background: isDark ? "#111827" : "#fff", color: isDark ? "#e2e8f0" : "#0f172a" }}>
                <option value="">-- Unassigned --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                ))}
              </select>
              <select value={form.category || ""} onChange={(e) => onFormChange("category", e.target.value)} style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`, background: isDark ? "#111827" : "#fff", color: isDark ? "#e2e8f0" : "#0f172a" }}>
                <option value="">-- Select Category --</option>
                {TASK_CATEGORY_OPTIONS.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setOpenModal(false)} style={{ border: `1px solid ${isDark ? "#475569" : "#cbd5e1"}`, background: "transparent", color: isDark ? "#e2e8f0" : "#334155", borderRadius: 10, padding: "9px 14px", fontWeight: 700 }}>Cancel</button>
              <button type="submit" disabled={saving} style={{ border: "none", background: "linear-gradient(135deg, #0D9488, #0F766E)", color: "#fff", borderRadius: 10, padding: "9px 14px", fontWeight: 700 }}>{saving ? "Saving..." : "Save Call Log"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
