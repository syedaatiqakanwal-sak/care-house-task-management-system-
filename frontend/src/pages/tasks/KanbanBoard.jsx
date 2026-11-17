import { useEffect, useMemo, useState } from "react";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { AlertTriangle, Calendar, Eye, Lock, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";
import api from "../../api";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../components/common/Toast";

const COLUMNS = [
  { id: "pending", title: "Pending", accent: "#888780" },
  { id: "in_progress", title: "In Progress", accent: "#378ADD" },
  { id: "completed", title: "Completed", accent: "#1D9E75" }
];
const REMOVED = { id: "cancelled", title: "Removed", accent: "#E24B4A" };
const PRIORITY = {
  urgent: { bg: "#fef2f2", text: "#dc2626", border: "#fecaca", label: "Urgent" },
  high: { bg: "#fff7ed", text: "#f97316", border: "#fed7aa", label: "High" },
  medium: { bg: "#fffbeb", text: "#eab308", border: "#fde68a", label: "Medium" },
  low: { bg: "#f3f4f6", text: "#6b7280", border: "#e5e7eb", label: "Low" }
};

function letter(name) {
  return String(name || "?").trim().charAt(0).toUpperCase() || "?";
}

export default function KanbanBoard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("all");
  const [showRemoved, setShowRemoved] = useState(true);
  const [assigneeFilter, setAssigneeFilter] = useState([]);
  const [mobile, setMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 1024 : false);
  const [activeTab, setActiveTab] = useState("pending");
  const [form, setForm] = useState({ title: "", description: "", assigned_to: "", priority: "medium", status: "pending", deadline: "", category: "", tags: "" });

  const roleName = user?.Role?.role_name;
  const perms = (user?.Role?.permissions || []).map((p) => p.permission_key || p);
  const isAdmin = roleName === "Super Admin" || perms.includes("tasks.delete") || perms.includes("tasks.edit");

  const load = async () => {
    setLoading(true);
    try {
      const [tasksRes, usersRes] = await Promise.all([
        api.get("/tasks", { params: { page: 1, limit: 500, include_removed: true } }),
        api.get("/users/assign-list")
      ]);
      setTasks(Array.isArray(tasksRes.data) ? tasksRes.data : tasksRes.data.rows || []);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : usersRes.data.rows || usersRes.data.users || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => setTasks([]));
  }, []);

  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const assignees = useMemo(() => {
    const map = new Map();
    tasks.forEach((t) => {
      if (t.assignee?.id) map.set(t.assignee.id, t.assignee);
    });
    return Array.from(map.values());
  }, [tasks]);

  const filtered = useMemo(
    () =>
      tasks.filter((t) => {
        const hitSearch = !search.trim() || String(t.title || "").toLowerCase().includes(search.toLowerCase());
        const hitPriority = priority === "all" || t.priority === priority;
        const aid = t.assigned_to != null ? Number(t.assigned_to) : null;
        const hitAssignee = assigneeFilter.length === 0 || (aid && assigneeFilter.includes(aid));
        return hitSearch && hitPriority && hitAssignee;
      }),
    [tasks, search, priority, assigneeFilter]
  );

  const groups = useMemo(() => {
    const g = { pending: [], in_progress: [], completed: [], cancelled: [] };
    filtered.forEach((t) => {
      if (g[t.status]) g[t.status].push(t);
    });
    return g;
  }, [filtered]);

  const health = useMemo(() => {
    const active = tasks.filter((t) => t.status !== "cancelled");
    const total = active.length;
    const completed = active.filter((t) => t.status === "completed").length;
    const now = new Date();
    const dueToday = active.filter((t) => t.deadline && new Date(t.deadline).toDateString() === now.toDateString() && t.status !== "completed").length;
    const overdue = active.filter((t) => t.deadline && new Date(t.deadline) < now && t.status !== "completed").length;
    const removed = tasks.filter((t) => t.status === "cancelled").length;
    return { total, progress: total ? Math.round((completed / total) * 100) : 0, dueToday, overdue, removed };
  }, [tasks]);

  const move = async (task, status) => {
    const prev = tasks;
    setTasks((curr) => curr.map((t) => (t.id === task.id ? { ...t, status } : t)));
    try {
      await api.patch(`/tasks/${task.id}`, { status });
    } catch {
      setTasks(prev);
      showToast("Failed to update task", "error");
    }
  };

  const onDragEnd = async ({ source, destination, draggableId }) => {
    if (!destination || destination.droppableId === "cancelled") return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    const task = tasks.find((t) => t.id === Number(draggableId));
    if (!task) return;
    await move(task, destination.droppableId);
  };

  const removeTask = async (task) => {
    if (!isAdmin) return;
    if (!window.confirm(`Remove "${task.title}"?`)) return;
    try {
      await api.delete(`/tasks/${task.id}`);
      window.dispatchEvent(new CustomEvent("letscare:task-removed", { detail: { taskId: task.id } }));
      showToast("Task moved to Removed", "success");
      await load();
    } catch {
      showToast("Failed to remove task", "error");
    }
  };

  const restoreTask = async (task) => {
    try {
      await api.patch(`/tasks/${task.id}/restore`);
      showToast("Task restored", "success");
      await load();
    } catch {
      showToast("Failed to restore task", "error");
    }
  };

  const permanentDelete = async (task) => {
    if (!window.confirm(`Permanently delete "${task.title}"?`)) return;
    try {
      await api.delete(`/tasks/${task.id}/permanent`);
      window.dispatchEvent(new CustomEvent("letscare:task-removed", { detail: { taskId: task.id } }));
      showToast("Task permanently deleted", "success");
      await load();
    } catch {
      showToast("Failed to permanently delete", "error");
    }
  };

  const createTask = async (e) => {
    e.preventDefault();
    try {
      await api.post("/tasks", {
        title: form.title,
        description: form.description || null,
        assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
        priority: form.priority,
        status: form.status,
        deadline: form.deadline || null,
        category: form.category || null
      });
      showToast("Task created", "success");
      setShowCreate(false);
      setForm({ title: "", description: "", assigned_to: "", priority: "medium", status: "pending", deadline: "", category: "", tags: "" });
      await load();
    } catch {
      showToast("Failed to create task", "error");
    }
  };

  const taskCard = (task, idx) => {
    const due = task.deadline ? new Date(task.deadline) : null;
    const overdue = due && due < new Date() && task.status !== "completed";
    const p = PRIORITY[task.priority] || PRIORITY.medium;
    return (
      <Draggable key={task.id} draggableId={String(task.id)} index={idx}>
        {(prov) => (
          <div ref={prov.innerRef} {...prov.draggableProps} {...prov.dragHandleProps} style={prov.draggableProps.style}>
            <div style={{ borderRadius: 12, background: isDark ? "#1e293b" : "#fff", border: `0.5px solid ${isDark ? "#334155" : "#e2e8f0"}`, padding: 12, boxShadow: "0 2px 8px rgba(15,23,42,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: isDark ? "#f1f5f9" : "#0f172a" }}>{task.title}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" title="Open details" onClick={() => setSelectedTask(task)} style={{ border: "none", background: "transparent", color: "#6B7280", cursor: "pointer", padding: 0 }}>
                    <Eye size={13} />
                  </button>
                  {isAdmin ? (
                    <button type="button" title="Remove" onClick={() => removeTask(task)} style={{ border: "none", background: "transparent", color: "#E24B4A", cursor: "pointer", padding: 0 }}>
                      <Trash2 size={13} />
                    </button>
                  ) : null}
                </div>
              </div>
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: isDark ? "#cbd5e1" : "#334155" }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#0F9B72", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                  {letter(task.assignee?.full_name)}
                </span>
                <span>{task.assignee?.full_name || "Unassigned"}</span>
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ background: p.bg, color: p.text, border: `1px solid ${p.border}`, borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{p.label}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: due ? (overdue ? "#ef4444" : "#6B7280") : "#94a3b8", fontSize: 12 }}>
                  {overdue ? <AlertTriangle size={12} /> : <Calendar size={12} />}
                  {due ? due.toLocaleDateString("en-GB") : "No date"}
                </span>
              </div>
            </div>
          </div>
        )}
      </Draggable>
    );
  };

  const removedCard = (task) => (
    <div key={task.id} style={{ borderRadius: 12, background: isDark ? "#3f1d1d" : "#fff5f5", border: "0.5px solid #fca5a5", padding: 12, opacity: 0.65 }}>
      <div style={{ textDecoration: "line-through", color: "#991b1b", fontWeight: 500, fontSize: 14 }}>{task.title}</div>
      <div style={{ marginTop: 8, fontSize: 12, color: "#b91c1c" }}>Removed by {task.removed_by?.full_name || "System"}</div>
      <div style={{ marginTop: 2, fontSize: 11, color: "#7f1d1d" }}>{task.removed_at ? new Date(task.removed_at).toLocaleString() : "-"}</div>
      {isAdmin ? (
        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <button type="button" onClick={() => restoreTask(task)} style={{ border: "1px solid #86efac", background: "#f0fdf4", color: "#166534", borderRadius: 8, fontSize: 12, fontWeight: 700, padding: "6px 8px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <RotateCcw size={12} /> Restore
          </button>
          <button type="button" onClick={() => permanentDelete(task)} style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", borderRadius: 8, fontSize: 12, fontWeight: 700, padding: "6px 8px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Trash2 size={12} /> Delete permanently
          </button>
        </div>
      ) : null}
    </div>
  );

  const col = (column) => (
    <Droppable key={column.id} droppableId={column.id}>
      {(prov, snap) => (
        <div ref={prov.innerRef} {...prov.droppableProps} style={{ minWidth: 320, maxWidth: 320, flex: "0 0 320px", borderRadius: 14, border: `1px solid ${snap.isDraggingOver ? column.accent : isDark ? "#334155" : "#e2e8f0"}`, borderTop: `4px solid ${column.accent}`, background: snap.isDraggingOver ? (isDark ? "#0f172a" : "#f8fafc") : (isDark ? "#1e293b" : "#fff"), padding: 12, height: 620, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h2 style={{ margin: 0, color: isDark ? "#f1f5f9" : "#1E1E2E", fontSize: 16, fontWeight: 600 }}>{column.title}</h2>
            <span style={{ background: isDark ? "#334155" : "#f1f5f9", color: isDark ? "#cbd5e1" : "#334155", borderRadius: 999, padding: "3px 8px", fontSize: 11, fontWeight: 700 }}>{groups[column.id]?.length || 0}</span>
          </div>
          <div style={{ minHeight: 0, flex: 1, overflowY: "auto", display: "grid", gap: 10 }}>
            {(groups[column.id] || []).length === 0 ? <div style={{ color: isDark ? "#94a3b8" : "#6B7280", fontSize: 13 }}>{column.id === "pending" ? "No pending tasks — all caught up!" : column.id === "in_progress" ? "Nothing in progress — drag a task here to start" : "No completed tasks yet — keep going!"}</div> : (groups[column.id] || []).map((t, i) => taskCard(t, i))}
            {prov.placeholder}
          </div>
        </div>
      )}
    </Droppable>
  );

  const removedColumn = showRemoved ? (
    <div style={{ minWidth: 320, maxWidth: 320, flex: "0 0 320px", borderRadius: 14, border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, borderTop: `4px solid ${REMOVED.accent}`, background: isDark ? "#1e293b" : "#fff", padding: 12, height: 620, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <h2 style={{ margin: 0, color: isDark ? "#f1f5f9" : "#1E1E2E", fontSize: 16, fontWeight: 600 }}>{REMOVED.title}</h2>
          {!isAdmin ? <Lock size={14} color="#E24B4A" /> : null}
        </div>
        <span style={{ background: "#fef2f2", color: "#b91c1c", borderRadius: 999, padding: "3px 8px", fontSize: 11, fontWeight: 700 }}>{groups.cancelled?.length || 0}</span>
      </div>
      <div style={{ minHeight: 0, flex: 1, overflowY: "auto", display: "grid", gap: 10 }}>
        {(groups.cancelled || []).length === 0 ? <div style={{ color: isDark ? "#94a3b8" : "#6B7280", fontSize: 13 }}>No removed tasks — nothing has been deleted by admin</div> : (groups.cancelled || []).map((t) => removedCard(t))}
      </div>
    </div>
  ) : null;

  const cols = mobile ? [...COLUMNS, ...(showRemoved ? [REMOVED] : [])].filter((c) => c.id === activeTab) : [...COLUMNS, ...(showRemoved ? [REMOVED] : [])];

  return (
    <div style={{ padding: 24, background: isDark ? "#0f172a" : "#F5F6FA", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: isDark ? "#f1f5f9" : "#1E1E2E", fontWeight: 800 }}>Kanban Board</h1>
          <p style={{ margin: 0, color: isDark ? "#94a3b8" : "#6B7280", fontSize: 13, marginTop: 5 }}>Visual workflow board with task health tracking.</p>
        </div>
        <button type="button" onClick={() => setShowCreate(true)} style={{ border: "none", background: "linear-gradient(135deg,#0F9B72,#0F766E)", color: "#fff", borderRadius: 10, padding: "10px 14px", display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          <Plus size={16} /> New Task
        </button>
      </div>

      <div style={{ background: isDark ? "#1e293b" : "#fff", border: `0.5px solid ${isDark ? "#334155" : "#e2e8f0"}`, borderRadius: 12, padding: 10, marginBottom: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr", gap: 10, alignItems: "center" }}>
          <div style={{ fontSize: 13, color: isDark ? "#f1f5f9" : "#1E1E2E", fontWeight: 700 }}>Total tasks: {health.total}</div>
          <div style={{ gridColumn: "span 2" }}>
            <div style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#6B7280", marginBottom: 4 }}>% Complete {health.progress}%</div>
            <div style={{ height: 7, borderRadius: 999, background: isDark ? "#334155" : "#e5e7eb", overflow: "hidden" }}><div style={{ width: `${health.progress}%`, height: "100%", background: "#1D9E75" }} /></div>
          </div>
          <div style={{ fontSize: 12, color: "#f59e0b", fontWeight: 700 }}>Due today: {health.dueToday}</div>
          <div style={{ fontSize: 12, color: "#ef4444", fontWeight: 700 }}>Overdue: {health.overdue} | Removed: {health.removed}</div>
        </div>
      </div>

      <div style={{ background: isDark ? "#1e293b" : "#fff", border: `0.5px solid ${isDark ? "#334155" : "#e2e8f0"}`, borderRadius: 12, padding: 10, marginBottom: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", minWidth: 220, flex: "1 1 220px" }}>
          <Search size={14} style={{ position: "absolute", left: 9, top: 9, color: isDark ? "#94a3b8" : "#6B7280" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by task title" style={{ width: "100%", padding: "8px 10px 8px 28px", borderRadius: 8, border: `1px solid ${isDark ? "#475569" : "#d1d5db"}`, fontSize: 12, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a" }} />
        </div>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${isDark ? "#475569" : "#d1d5db"}`, fontSize: 12, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a" }}>
          <option value="all">All priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: isDark ? "#cbd5e1" : "#334155" }}>
          <input type="checkbox" checked={showRemoved} onChange={(e) => setShowRemoved(e.target.checked)} />
          Show Removed column
        </label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {assignees.map((a) => {
            const active = assigneeFilter.includes(Number(a.id));
            return (
              <button key={a.id} type="button" onClick={() => setAssigneeFilter((prev) => (active ? prev.filter((id) => id !== Number(a.id)) : [...prev, Number(a.id)]))} style={{ border: `1px solid ${active ? "#0F9B72" : isDark ? "#475569" : "#d1d5db"}`, background: active ? "#ecfdf5" : isDark ? "#0f172a" : "#fff", color: isDark ? "#cbd5e1" : "#334155", borderRadius: 999, padding: "4px 8px", fontSize: 11, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#0F9B72", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>{letter(a.full_name)}</span>
                {a.full_name}
              </button>
            );
          })}
        </div>
      </div>

      {mobile ? (
        <div style={{ display: "flex", gap: 8, marginBottom: 10, overflowX: "auto" }}>
          {[...COLUMNS, ...(showRemoved ? [REMOVED] : [])].map((c) => (
            <button key={c.id} type="button" onClick={() => setActiveTab(c.id)} style={{ border: `1px solid ${activeTab === c.id ? c.accent : isDark ? "#475569" : "#cbd5e1"}`, background: activeTab === c.id ? c.accent : isDark ? "#0f172a" : "#fff", color: activeTab === c.id ? "#fff" : isDark ? "#cbd5e1" : "#334155", borderRadius: 999, padding: "7px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
              {c.title}
              {c.id === "cancelled" && !isAdmin ? <Lock size={12} /> : null}
            </button>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(320px, 1fr))", gap: 16 }}>
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 620, borderRadius: 14 }} />)}
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 8 }}>
            {cols.map((c) => (c.id === "cancelled" ? removedColumn : col(c)))}
          </div>
        </DragDropContext>
      )}

      {selectedTask ? (
        <div style={{ position: "fixed", top: 0, right: 0, width: "min(460px, 100vw)", height: "100vh", background: isDark ? "#1e293b" : "#fff", borderLeft: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, zIndex: 1200, boxShadow: "-10px 0 24px rgba(2,6,23,0.15)" }}>
          <div style={{ padding: 14, borderBottom: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, display: "flex", justifyContent: "space-between", alignItems: "center", color: isDark ? "#f1f5f9" : "#0f172a" }}>
            <strong>Task Details</strong>
            <button type="button" onClick={() => setSelectedTask(null)} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer" }}><X size={16} /></button>
          </div>
          <div style={{ padding: 14 }}>
            <h3 style={{ marginTop: 0, color: isDark ? "#f1f5f9" : "#0f172a" }}>{selectedTask.title}</h3>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: isDark ? "#cbd5e1" : "#334155" }}>{selectedTask.description || "No description"}</p>
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              <div style={{ fontSize: 12, color: isDark ? "#cbd5e1" : "#334155" }}>Assignee: {selectedTask.assignee?.full_name || "Unassigned"}</div>
              <div style={{ fontSize: 12, color: isDark ? "#cbd5e1" : "#334155" }}>Priority: {selectedTask.priority}</div>
              <div style={{ fontSize: 12, color: isDark ? "#cbd5e1" : "#334155" }}>Due: {selectedTask.deadline ? new Date(selectedTask.deadline).toLocaleString() : "Not set"}</div>
              <div style={{ fontSize: 12, color: isDark ? "#cbd5e1" : "#334155" }}>Status: {selectedTask.status?.replace(/_/g, " ")}</div>
            </div>
          </div>
        </div>
      ) : null}

      {showCreate ? (
        <div style={{ position: "fixed", top: 0, right: 0, width: "min(460px, 100vw)", height: "100vh", background: isDark ? "#1e293b" : "#fff", borderLeft: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, zIndex: 1200, boxShadow: "-10px 0 24px rgba(2,6,23,0.15)" }}>
          <form onSubmit={createTask}>
            <div style={{ padding: 14, borderBottom: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, display: "flex", justifyContent: "space-between", alignItems: "center", color: isDark ? "#f1f5f9" : "#0f172a" }}>
              <strong>New Task</strong>
              <button type="button" onClick={() => setShowCreate(false)} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer" }}><X size={16} /></button>
            </div>
            <div style={{ padding: 14, display: "grid", gap: 10 }}>
              <input required placeholder="Title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: `1px solid ${isDark ? "#475569" : "#cbd5e1"}`, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a" }} />
              <textarea placeholder="Description" rows={4} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: `1px solid ${isDark ? "#475569" : "#cbd5e1"}`, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a", resize: "vertical" }} />
              <select value={form.assigned_to} onChange={(e) => setForm((p) => ({ ...p, assigned_to: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: `1px solid ${isDark ? "#475569" : "#cbd5e1"}`, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a" }}>
                <option value="">Assignee</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
              <select value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: `1px solid ${isDark ? "#475569" : "#cbd5e1"}`, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a" }}>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <input type="datetime-local" value={form.deadline} onChange={(e) => setForm((p) => ({ ...p, deadline: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: `1px solid ${isDark ? "#475569" : "#cbd5e1"}`, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a" }} />
              <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: `1px solid ${isDark ? "#475569" : "#cbd5e1"}`, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a" }}>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
              <input value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} placeholder="Category" style={{ padding: 10, borderRadius: 8, border: `1px solid ${isDark ? "#475569" : "#cbd5e1"}`, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a" }} />
              <input value={form.tags} onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))} placeholder="Tags (comma separated)" style={{ padding: 10, borderRadius: 8, border: `1px solid ${isDark ? "#475569" : "#cbd5e1"}`, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a" }} />
              <button type="submit" style={{ border: "none", background: "linear-gradient(135deg,#0F9B72,#0F766E)", color: "#fff", borderRadius: 10, padding: "10px 12px", fontWeight: 700, cursor: "pointer" }}>Create Task</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
