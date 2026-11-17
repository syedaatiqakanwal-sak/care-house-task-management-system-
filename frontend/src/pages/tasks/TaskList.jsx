import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Eye, Filter, Plus, Search } from "lucide-react";
import api from "../../api";
import { useTheme } from "../../contexts/ThemeContext";
import { useToast } from "../../components/common/Toast";

const badgeStyle = (status) => {
  if (status === "completed") return { bg: "#ecfdf5", text: "#065f46" };
  if (status === "in_progress") return { bg: "#eff6ff", text: "#1d4ed8" };
  return { bg: "#fffbeb", text: "#92400e" };
};

const getPriorityBadge = (priority) => {
  const map = {
    urgent: { bg: "#fef2f2", color: "#dc2626", border: "#fecaca", label: "Urgent" },
    high: { bg: "#fff7ed", color: "#ea580c", border: "#fed7aa", label: "High" },
    medium: { bg: "#fffbeb", color: "#d97706", border: "#fde68a", label: "Medium" },
    low: { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0", label: "Low" }
  };
  const s = map[priority] || map.medium;
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        borderRadius: "6px",
        padding: "3px 8px",
        fontSize: "11px",
        fontWeight: 700,
        whiteSpace: "nowrap"
      }}
    >
      {s.label}
    </span>
  );
};

const isOverdue = (deadline) => {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
};

const getSourceBadge = (source, isDark) => {
  const s = String(source || "manual").toLowerCase();
  const map =
    s === "call"
      ? { bg: isDark ? "#1e3a5f" : "#dbeafe", color: isDark ? "#93c5fd" : "#1d4ed8", border: isDark ? "#3b82f6" : "#93c5fd", label: "Call" }
      : s === "email"
        ? { bg: isDark ? "#14532d" : "#dcfce7", color: isDark ? "#86efac" : "#15803d", border: isDark ? "#22c55e" : "#86efac", label: "Email" }
        : { bg: isDark ? "#334155" : "#f1f5f9", color: isDark ? "#cbd5e1" : "#475569", border: isDark ? "#475569" : "#e2e8f0", label: "Manual" };
  return (
    <span
      style={{
        background: map.bg,
        color: map.color,
        border: `1px solid ${map.border}`,
        borderRadius: 999,
        padding: "4px 9px",
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: "nowrap"
      }}
    >
      {map.label}
    </span>
  );
};

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

export default function TaskList() {
  const location = useLocation();
  const { showToast } = useToast();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    source: "manual",
    priority: "medium",
    assigned_to: "",
    deadline: "",
    category: ""
  });

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/tasks", { params: { page: 1, limit: 300 } });
      const rows = Array.isArray(data) ? data : data.rows || [];
      setTasks(rows);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const res = await api.get("/users/assign-list");
      const userList = Array.isArray(res.data) ? res.data : res.data.users || res.data.rows || [];
      setUsers(userList);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Load users:", err);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    loadUsers();
  }, [loadTasks, loadUsers]);

  useEffect(() => {
    if (location.state?.openCreate) {
      setShowCreate(true);
    }
  }, [location.state]);

  const filtered = useMemo(
    () =>
      tasks.filter((t) => {
        const hitQuery = query.trim() === "" || t.title?.toLowerCase().includes(query.toLowerCase());
        const hitStatus =
          status === "all" ||
          (status === "unassigned" && (t.assigned_to == null || t.assigned_to === "")) ||
          (status !== "unassigned" && t.status === status);
        return hitQuery && hitStatus;
      }),
    [tasks, query, status]
  );

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setCreating(true);
    try {
      await api.post("/tasks", {
        ...form,
        assigned_to: form.assigned_to ? parseInt(form.assigned_to, 10) : undefined,
        deadline: form.deadline || undefined
      });
      setShowCreate(false);
      setForm({
        title: "",
        description: "",
        source: "manual",
        priority: "medium",
        assigned_to: "",
        deadline: "",
        category: ""
      });
      showToast("Task created successfully!", "success");
      await loadTasks();
    } catch (err) {
      showToast("Failed to create task", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleRemove = async (taskId) => {
    if (!window.confirm("Are you sure you want to remove this task?")) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      setTasks((prev) => prev.filter((t) => Number(t.id) !== Number(taskId)));
      window.dispatchEvent(new CustomEvent("letscare:task-removed", { detail: { taskId } }));
      showToast("Task removed successfully", "success");
      await loadTasks();
    } catch (err) {
      if (err?.response?.status === 403) showToast("You do not have permission to remove tasks", "error");
      else showToast("Failed to remove task", "error");
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: isDark ? "#f1f5f9" : "#0f172a", fontWeight: 800 }}>Task Management</h1>
          <p style={{ margin: 0, color: isDark ? "#94a3b8" : "#64748b", fontSize: 13, marginTop: 5 }}>Track and manage all tasks in one place.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          style={{
            background: "linear-gradient(135deg, #0D9488, #0F766E)",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            padding: "10px 20px",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <Plus size={16} />
          New Task
        </button>
      </div>

      <div style={{ background: isDark ? "#1e293b" : "#fff", borderRadius: 14, border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, padding: 14, marginBottom: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 250px" }}>
          <Search size={15} style={{ position: "absolute", left: 10, top: 11, color: isDark ? "#94a3b8" : "#64748b" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by title..." style={{ width: "100%", padding: "10px 12px 10px 32px", borderRadius: 9, border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a", fontSize: 13 }} />
        </div>
        <div style={{ position: "relative", minWidth: 160 }}>
          <Filter size={15} style={{ position: "absolute", left: 10, top: 11, color: isDark ? "#94a3b8" : "#64748b" }} />
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: "100%", appearance: "none", padding: "10px 12px 10px 32px", borderRadius: 9, border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a", fontSize: 13 }}>
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="unassigned">Unassigned</option>
          </select>
        </div>
      </div>

      <div style={{ background: isDark ? "#1e293b" : "#fff", borderRadius: 14, border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 18 }}>
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton" style={{ height: 44, borderRadius: 8, marginBottom: 10 }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: isDark ? "#94a3b8" : "#64748b" }}>No tasks match your filters.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 880 }}>
              <thead>
                <tr style={{ background: isDark ? "#0f172a" : "#f8fafc", textAlign: "left" }}>
                  {["Title", "Source", "Status", "Priority", "Assigned To", "Assigned By", "Due Date", "Actions"].map((h) => (
                    <th key={h} style={{ fontSize: 12, letterSpacing: ".03em", color: isDark ? "#94a3b8" : "#64748b", padding: "12px 14px", fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((task) => {
                  const badge = badgeStyle(task.status);
                  return (
                    <tr key={task.id} style={{ borderTop: `1px solid ${isDark ? "#334155" : "#f1f5f9"}` }}>
                      <td style={{ padding: "12px 14px", color: isDark ? "#f1f5f9" : "#0f172a", fontWeight: 600 }}>{task.title}</td>
                      <td style={{ padding: "12px 14px" }}>{getSourceBadge(task.source, isDark)}</td>
                      <td style={{ padding: "12px 14px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            background: badge.bg,
                            color: badge.text,
                            borderRadius: 999,
                            padding: "4px 9px",
                            fontSize: 11,
                            fontWeight: 700,
                            whiteSpace: "nowrap"
                          }}
                        >
                          {(task.status || "").replace(/_/g, " ")}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px" }}>{getPriorityBadge(task.priority)}</td>
                      <td style={{ padding: "12px 14px", color: isDark ? "#e2e8f0" : "#334155", fontSize: 13 }}>{task.assignee?.full_name || "-"}</td>
                      <td style={{ padding: "12px 14px", color: isDark ? "#e2e8f0" : "#334155", fontSize: 13 }}>{task.assigner?.full_name || "-"}</td>
                      <td style={{ padding: "12px 14px" }}>
                        {task.deadline ? (
                          <span style={{ color: isOverdue(task.deadline) ? "#dc2626" : "#64748b", fontWeight: isOverdue(task.deadline) ? 700 : 400, fontSize: "13px" }}>
                            {isOverdue(task.deadline) ? "⚠️ " : ""}
                            {new Date(task.deadline).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <Link to={`/tasks/${task.id}`} style={{ color: "#0D9488", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13 }}>
                            <Eye size={14} /> View
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleRemove(task.id)}
                            style={{ border: "none", background: "transparent", color: "#dc2626", cursor: "pointer", fontWeight: 700, fontSize: 13, padding: 0 }}
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
          <div style={{ background: isDark ? "#1e293b" : "#fff", borderRadius: "20px", width: "100%", maxWidth: "560px", maxHeight: "90vh", overflow: "auto", boxShadow: "0 25px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${isDark ? "#334155" : "#f1f5f9"}`, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: isDark ? "#1e293b" : "#fff", zIndex: 1 }}>
              <h2 style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: isDark ? "#f1f5f9" : "#0f172a" }}>Create New Task</h2>
              <button type="button" onClick={() => setShowCreate(false)} style={{ background: "#f1f5f9", border: "none", borderRadius: "8px", width: "32px", height: "32px", cursor: "pointer", fontSize: "18px", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </div>

            <form onSubmit={handleCreate} style={{ padding: "24px" }}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#64748b", marginBottom: "6px", textTransform: "uppercase" }}>Task Title *</label>
                <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Enter task title..." required style={{ width: "100%", padding: "10px 14px", border: `1.5px solid ${isDark ? "#334155" : "#e2e8f0"}`, borderRadius: "10px", fontSize: "13px", background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#64748b", marginBottom: "6px", textTransform: "uppercase" }}>Description</label>
                <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Describe the task..." rows={3} style={{ width: "100%", padding: "10px 14px", border: `1.5px solid ${isDark ? "#334155" : "#e2e8f0"}`, borderRadius: "10px", fontSize: "13px", background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a", outline: "none", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#64748b", marginBottom: "6px", textTransform: "uppercase" }}>Source *</label>
                  <select value={form.source} onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))} style={{ width: "100%", padding: "10px 14px", border: `1.5px solid ${isDark ? "#334155" : "#e2e8f0"}`, borderRadius: "10px", fontSize: "13px", background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a", outline: "none", fontFamily: "inherit" }}>
                    <option value="manual">Manual</option>
                    <option value="call">Call</option>
                    <option value="email">Email</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#64748b", marginBottom: "6px", textTransform: "uppercase" }}>Priority *</label>
                  <select value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))} style={{ width: "100%", padding: "10px 14px", border: `1.5px solid ${isDark ? "#334155" : "#e2e8f0"}`, borderRadius: "10px", fontSize: "13px", background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a", outline: "none", fontFamily: "inherit" }}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#64748b", marginBottom: "6px", textTransform: "uppercase" }}>Assign To</label>
                <select value={form.assigned_to} onChange={(e) => setForm((p) => ({ ...p, assigned_to: e.target.value }))} style={{ width: "100%", padding: "10px 14px", border: `1.5px solid ${isDark ? "#334155" : "#e2e8f0"}`, borderRadius: "10px", fontSize: "13px", background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a", outline: "none", fontFamily: "inherit" }}>
                  <option value="">-- Unassigned --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.Role?.role_name || "?"})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "24px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#64748b", marginBottom: "6px", textTransform: "uppercase" }}>Deadline</label>
                  <input type="datetime-local" value={form.deadline} onChange={(e) => setForm((p) => ({ ...p, deadline: e.target.value }))} style={{ width: "100%", padding: "10px 14px", border: `1.5px solid ${isDark ? "#334155" : "#e2e8f0"}`, borderRadius: "10px", fontSize: "13px", background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#64748b", marginBottom: "6px", textTransform: "uppercase" }}>Category</label>
                  <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} style={{ width: "100%", padding: "10px 14px", border: `1.5px solid ${isDark ? "#334155" : "#e2e8f0"}`, borderRadius: "10px", fontSize: "13px", background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a", outline: "none", fontFamily: "inherit" }}>
                    <option value="">-- Select category --</option>
                    {TASK_CATEGORY_OPTIONS.map((label) => (
                      <option key={label} value={label}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setShowCreate(false)} style={{ padding: "10px 20px", borderRadius: "10px", border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, background: "transparent", color: "#64748b", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  Cancel
                </button>
                <button type="submit" disabled={creating || !form.title.trim()} style={{ padding: "10px 24px", borderRadius: "10px", border: "none", background: creating ? "#e2e8f0" : "linear-gradient(135deg, #0D9488, #0F766E)", color: creating ? "#94a3b8" : "#fff", fontSize: "13px", fontWeight: 700, cursor: creating ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "8px" }}>
                  {creating ? "Creating..." : (<><Plus size={14} />Create Task</>)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
