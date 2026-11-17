import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, CheckCircle, CheckCircle2, Clock, Clock3, Download, Flag, History, MessageSquare, Paperclip, Send, Upload } from "lucide-react";
import api from "../../api";
import { useTheme } from "../../contexts/ThemeContext";
import { useToast } from "../../components/common/Toast";
import { useAuth } from "../../contexts/AuthContext";

function statusTone(status) {
  if (status === "completed") return { bg: "#ecfdf5", text: "#065f46" };
  if (status === "in_progress") return { bg: "#eff6ff", text: "#1d4ed8" };
  return { bg: "#fffbeb", text: "#92400e" };
}

function resolveProfilePicUrl(raw) {
  if (!raw) return null;
  if (String(raw).startsWith("http")) return raw;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return String(raw).startsWith("/") ? `${origin}${raw}` : `${origin}/${raw}`;
}

function CommentAuthorAvatar({ person }) {
  const [imgFailed, setImgFailed] = useState(false);
  const src = resolveProfilePicUrl(person?.profile_pic);
  const initial = (person?.full_name || "?").trim().charAt(0).toUpperCase() || "?";
  const showImg = Boolean(src) && !imgFailed;

  return (
    <div
      style={{
        width: "36px",
        height: "36px",
        borderRadius: "50%",
        flexShrink: 0,
        overflow: "hidden",
        border: "2px solid #0D9488"
      }}
    >
      {showImg ? (
        <img
          src={src}
          alt={person?.full_name || ""}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "linear-gradient(135deg, #0D9488, #0F766E)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: "13px"
          }}
        >
          {initial}
        </div>
      )}
    </div>
  );
}

const STATUS_OPTIONS = ["pending", "in_progress", "on_hold", "completed", "cancelled"];
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

function userCanEditTasks(u) {
  if (!u) return false;
  if (u.Role?.role_name === "Super Admin") return true;
  const keys = (u.Role?.permissions || []).map((p) => p.permission_key || p);
  return keys.includes("tasks.edit");
}

function toDatetimeLocalInputValue(isoOrDate) {
  if (!isoOrDate) return "";
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function TaskDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { theme } = useTheme();
  const toast = useToast();
  const showToast = toast?.showToast;
  const isDark = theme === "dark";
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState([]);
  const [history, setHistory] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [addingComment, setAddingComment] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [assignUpdating, setAssignUpdating] = useState(false);
  const [deadlineUpdating, setDeadlineUpdating] = useState(false);
  const [categoryUpdating, setCategoryUpdating] = useState(false);
  const [users, setUsers] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const canAssign = useMemo(() => userCanEditTasks(user), [user]);

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

  const loadTask = useCallback(async () => {
    const { data } = await api.get(`/tasks/${id}`);
    setTask(data);
  }, [id]);

  const loadComments = useCallback(async () => {
    try {
      const res = await api.get(`/tasks/${id}/comments`);
      setComments(res.data.comments || []);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Load comments:", err);
    }
  }, [id]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await api.get(`/tasks/${id}/history`);
      setHistory(res.data.history || []);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Load history:", err);
    }
  }, [id]);

  const loadAttachments = useCallback(async () => {
    try {
      const res = await api.get(`/tasks/${id}/attachments`);
      setAttachments(res.data.attachments || res.data || []);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Load attachments:", err);
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        await Promise.all([loadTask(), loadComments(), loadHistory(), loadAttachments(), loadUsers()]);
      } catch {
        if (!cancelled) setTask(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id, loadTask, loadComments, loadHistory, loadAttachments, loadUsers]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setAddingComment(true);
    const commentText = newComment.trim();
    setNewComment("");
    try {
      const res = await api.post(`/tasks/${id}/comments`, { comment: commentText });
      const newCommentData = res.data?.comment;
      if (newCommentData) {
        setComments((prev) => [...prev, newCommentData]);
      } else {
        await loadComments();
      }
      if (showToast) showToast("Comment added", "success");
    } catch (err) {
      setNewComment(commentText);
      if (showToast) {
        if (err?.response?.status === 403) showToast("You do not have permission to comment", "error");
        else showToast("Failed to add comment", "error");
      }
    } finally {
      setAddingComment(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!newStatus || newStatus === task?.status) return;
    setStatusUpdating(true);
    try {
      await api.patch(`/tasks/${id}/status`, { status: newStatus });
      await loadTask();
      await loadHistory();
      if (showToast) showToast("Status updated", "success");
    } catch (err) {
      if (showToast) showToast("Failed to update status", "error");
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleAssigneeChange = async (e) => {
    const raw = e.target.value;
    const nextId = raw === "" ? null : parseInt(raw, 10);
    const cur = task?.assigned_to != null && task.assigned_to !== "" ? Number(task.assigned_to) : null;
    if (raw !== "" && Number.isNaN(nextId)) return;
    if (nextId === cur) return;
    setAssignUpdating(true);
    try {
      await api.patch(`/tasks/${id}`, { assigned_to: nextId });
      await loadTask();
      if (showToast) showToast(nextId ? "Assignee updated" : "Task unassigned", "success");
    } catch (err) {
      if (showToast) {
        if (err?.response?.status === 403) showToast("You do not have permission to change assignee", "error");
        else showToast("Failed to update assignee", "error");
      }
    } finally {
      setAssignUpdating(false);
    }
  };

  const handleDeadlineChange = async (e) => {
    const raw = e.target.value;
    const prev = toDatetimeLocalInputValue(task?.deadline || task?.due_date);
    if (raw === prev) return;
    setDeadlineUpdating(true);
    try {
      await api.patch(`/tasks/${id}`, { deadline: raw === "" ? null : new Date(raw).toISOString() });
      await loadTask();
      if (showToast) showToast(raw === "" ? "Due date cleared" : "Due date updated", "success");
    } catch (err) {
      if (showToast) {
        if (err?.response?.status === 403) showToast("You do not have permission to change due date", "error");
        else showToast("Failed to update due date", "error");
      }
    } finally {
      setDeadlineUpdating(false);
    }
  };

  const handleCategoryChange = async (e) => {
    const nextCategory = e.target.value || null;
    const currentCategory = task?.category || null;
    if (nextCategory === currentCategory) return;
    setCategoryUpdating(true);
    try {
      await api.patch(`/tasks/${id}`, { category: nextCategory });
      await loadTask();
      if (showToast) showToast("Category updated", "success");
    } catch (err) {
      if (showToast) {
        if (err?.response?.status === 403) showToast("You do not have permission to change category", "error");
        else showToast("Failed to update category", "error");
      }
    } finally {
      setCategoryUpdating(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast("File too large. Max 10MB", "error");
      e.target.value = "";
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post(`/tasks/${id}/attachments`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setAttachments((prev) => [res.data.attachment, ...prev]);
      showToast("File uploaded successfully", "success");
    } catch (err) {
      showToast("Failed to upload file", "error");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleteAttachment = async (aid) => {
    try {
      await api.delete(`/tasks/${id}/attachments/${aid}`);
      setAttachments((prev) => prev.filter((a) => a.id !== aid));
      showToast("File removed", "success");
    } catch (err) {
      showToast("Failed to remove file", "error");
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <div className="skeleton" style={{ height: 44, width: 220, marginBottom: 14, borderRadius: 10 }} />
        <div className="skeleton" style={{ height: 320, borderRadius: 16 }} />
      </div>
    );
  }

  if (!task) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ background: isDark ? "#1e293b" : "#fff", border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, borderRadius: 14, padding: 24, textAlign: "center", color: isDark ? "#94a3b8" : "#64748b" }}>
          Task not found.
        </div>
      </div>
    );
  }

  const tone = statusTone(task.status);
  const created = task.createdAt || task.created_at;
  const deadline = task.deadline || task.due_date;
  const assignee = task.assignee || task.Assignee;
  const assigner = task.assigner || task.Assigner;
  const assigneeName = assignee?.full_name;
  const assignerName = assigner?.full_name;

  return (
    <div style={{ padding: 24 }}>
      <Link to="/tasks" style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#0D9488", fontWeight: 700, marginBottom: 14 }}>
        <ArrowLeft size={16} /> Back to tasks
      </Link>

      <div style={{ background: isDark ? "#1e293b" : "#fff", border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ background: "linear-gradient(135deg, #0D9488, #0F766E)", color: "#fff", padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 21, fontWeight: 800 }}>{task.title}</h1>
            <div style={{ marginTop: 10 }}>
              <span style={{ background: "rgba(255,255,255,0.2)", borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>
                {(task.source || "manual").toUpperCase()}
              </span>
            </div>
          </div>
          {task.status !== "completed" ? (
            <button
              type="button"
              onClick={() => handleStatusChange("completed")}
              style={{ background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", border: "none", borderRadius: "10px", padding: "10px 20px", fontSize: "13px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
            >
              <CheckCircle size={16} />
              Mark Complete
            </button>
          ) : (
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "8px 16px", color: "#16a34a", fontWeight: 700, fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
              <CheckCircle size={16} />
              Completed
            </div>
          )}
        </div>

        <div style={{ padding: 20, display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
            <div style={{ borderRadius: 12, border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, padding: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: isDark ? "#cbd5e1" : "#334155", fontWeight: 700, fontSize: 13 }}>
                <CheckCircle2 size={14} /> Status
              </div>
              <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <span style={{ background: tone.bg, color: tone.text, borderRadius: 999, padding: "4px 9px", fontSize: 11, fontWeight: 700 }}>{(task.status || "").replace(/_/g, " ")}</span>
                <select value={task.status} disabled={statusUpdating} onChange={(e) => handleStatusChange(e.target.value)} style={{ fontSize: 12, padding: "6px 10px", borderRadius: 8, border: `1px solid ${isDark ? "#475569" : "#cbd5e1"}`, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a" }}>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ background: isDark ? "#0f172a" : "#f8fafc", borderRadius: "12px", padding: "14px 16px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Assigned To</div>
              {canAssign ? (
                <select
                  value={task.assigned_to != null && task.assigned_to !== "" ? String(task.assigned_to) : ""}
                  disabled={assignUpdating}
                  onChange={handleAssigneeChange}
                  style={{
                    width: "100%",
                    maxWidth: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: `1px solid ${isDark ? "#475569" : "#cbd5e1"}`,
                    background: isDark ? "#0f172a" : "#fff",
                    color: isDark ? "#f1f5f9" : "#0f172a",
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    cursor: assignUpdating ? "wait" : "pointer"
                  }}
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name}
                      {u.Role?.role_name ? ` (${u.Role.role_name})` : ""}
                    </option>
                  ))}
                </select>
              ) : assigneeName ? (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "linear-gradient(135deg, #0D9488, #0F766E)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "11px", flexShrink: 0 }}>{assigneeName.charAt(0).toUpperCase()}</div>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: isDark ? "#f1f5f9" : "#0f172a" }}>{assigneeName}</span>
                </div>
              ) : (
                <span style={{ fontSize: "13px", color: "#94a3b8" }}>Unassigned</span>
              )}
            </div>

            {assignerName ? (
              <div style={{ background: isDark ? "#0f172a" : "#f8fafc", borderRadius: "12px", padding: "14px 16px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Assigned By</div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "linear-gradient(135deg, #3b82f6, #2563eb)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "11px" }}>{assignerName.charAt(0).toUpperCase()}</div>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: isDark ? "#f1f5f9" : "#0f172a" }}>{assignerName}</span>
                </div>
              </div>
            ) : null}

            <div style={{ borderRadius: 12, border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, padding: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: isDark ? "#cbd5e1" : "#334155", fontWeight: 700, fontSize: 13 }}>
                <Flag size={14} /> Priority
              </div>
              <div style={{ marginTop: 8, color: isDark ? "#f1f5f9" : "#0f172a", fontWeight: 700 }}>{(task.priority || "medium").toUpperCase()}</div>
            </div>

            <div style={{ borderRadius: 12, border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, padding: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: isDark ? "#cbd5e1" : "#334155", fontWeight: 700, fontSize: 13 }}>
                <Clock3 size={14} /> Created
              </div>
              <div style={{ marginTop: 8, color: isDark ? "#f1f5f9" : "#0f172a", fontSize: 13 }}>{created ? new Date(created).toLocaleString() : "-"}</div>
            </div>

            <div style={{ borderRadius: 12, border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, padding: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: isDark ? "#cbd5e1" : "#334155", fontWeight: 700, fontSize: 13 }}>
                <Calendar size={14} /> Due date
              </div>
              {canAssign ? (
                <input
                  type="datetime-local"
                  value={toDatetimeLocalInputValue(deadline)}
                  disabled={deadlineUpdating}
                  onChange={handleDeadlineChange}
                  style={{
                    width: "100%",
                    marginTop: 8,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: `1px solid ${isDark ? "#475569" : "#cbd5e1"}`,
                    background: isDark ? "#0f172a" : "#fff",
                    color: isDark ? "#f1f5f9" : "#0f172a",
                    fontSize: 13,
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                    cursor: deadlineUpdating ? "wait" : "text"
                  }}
                />
              ) : (
                <div style={{ marginTop: 8, color: isDark ? "#f1f5f9" : "#0f172a", fontSize: 13 }}>{deadline ? new Date(deadline).toLocaleDateString() : "Not set"}</div>
              )}
            </div>

            <div style={{ borderRadius: 12, border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, padding: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: isDark ? "#cbd5e1" : "#334155", fontWeight: 700, fontSize: 13 }}>
                <Flag size={14} /> Category
              </div>
              {canAssign ? (
                <select
                  value={task.category || ""}
                  disabled={categoryUpdating}
                  onChange={handleCategoryChange}
                  style={{
                    width: "100%",
                    marginTop: 8,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: `1px solid ${isDark ? "#475569" : "#cbd5e1"}`,
                    background: isDark ? "#0f172a" : "#fff",
                    color: isDark ? "#f1f5f9" : "#0f172a",
                    fontSize: 13,
                    fontFamily: "inherit",
                    boxSizing: "border-box"
                  }}
                >
                  <option value="">-- Select Category --</option>
                  {TASK_CATEGORY_OPTIONS.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              ) : (
                <div style={{ marginTop: 8, color: isDark ? "#f1f5f9" : "#0f172a", fontSize: 13 }}>{task.category || "Not set"}</div>
              )}
            </div>
          </div>

          <div style={{ borderRadius: 12, border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, padding: 14 }}>
            <div style={{ color: isDark ? "#f1f5f9" : "#0f172a", fontWeight: 800, marginBottom: 8, fontSize: 14 }}>Description</div>
            <div style={{ color: isDark ? "#cbd5e1" : "#334155", fontSize: 13, lineHeight: 1.6 }}>{task.description || "No description provided."}</div>
          </div>

          <div style={{ background: isDark ? "#1e293b" : "#fff", borderRadius: "16px", border: `1px solid ${isDark ? "#334155" : "rgba(0,0,0,0.06)"}`, overflow: "hidden", marginTop: "16px" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${isDark ? "#334155" : "#f1f5f9"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Paperclip size={16} color="#0D9488" />
                <span style={{ fontWeight: 700, fontSize: "14px", color: isDark ? "#f1f5f9" : "#0f172a" }}>Attachments ({attachments.length})</span>
              </div>
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ background: uploading ? "#e2e8f0" : "linear-gradient(135deg, #0D9488, #0F766E)", color: uploading ? "#94a3b8" : "#fff", border: "none", borderRadius: "8px", padding: "7px 14px", fontSize: "12px", fontWeight: 700, cursor: uploading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                <Upload size={13} />
                {uploading ? "Uploading..." : "Upload File"}
              </button>
              <input ref={fileInputRef} type="file" onChange={handleFileUpload} style={{ display: "none" }} accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.mp4,.mov,.mp3" />
            </div>

            <div style={{ padding: "16px 20px" }}>
              {attachments.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px", color: "#94a3b8", fontSize: "13px" }}>No files attached yet</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {attachments.map((att) => (
                    <div key={att.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: isDark ? "#0f172a" : "#f8fafc", borderRadius: "10px", border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "linear-gradient(135deg, #0D9488, #0F766E)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Paperclip size={16} color="#fff" />
                        </div>
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 600, color: isDark ? "#f1f5f9" : "#0f172a" }}>{att.file_name}</div>
                          <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                            {att.file_size ? `${Math.round(att.file_size / 1024)} KB` : ""} • {att.Uploader?.full_name || "Unknown"}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <a href={resolveProfilePicUrl(att.file_path)} target="_blank" rel="noopener noreferrer" download style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", borderRadius: "6px", padding: "5px 10px", fontSize: "11px", fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}>
                          <Download size={12} />
                          Download
                        </a>
                        <button type="button" onClick={() => handleDeleteAttachment(att.id)} style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: "6px", padding: "5px 10px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ background: isDark ? "#1e293b" : "#fff", borderRadius: "16px", border: `1px solid ${isDark ? "#334155" : "rgba(0,0,0,0.06)"}`, overflow: "hidden", marginTop: "16px" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${isDark ? "#334155" : "#f1f5f9"}`, display: "flex", alignItems: "center", gap: "10px" }}>
              <MessageSquare size={16} color="#0D9488" />
              <span style={{ fontWeight: 700, fontSize: "14px", color: isDark ? "#f1f5f9" : "#0f172a" }}>Comments ({comments.length})</span>
            </div>
            <div style={{ padding: "16px 20px" }}>
              {comments.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px", color: "#94a3b8", fontSize: "13px" }}>No comments yet. Be the first to comment!</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "20px" }}>
                  {comments.map((c, idx) => (
                    <div key={c.id || idx} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                      <CommentAuthorAvatar person={c.User} />
                      <div style={{ flex: 1 }}>
                        <div style={{ background: isDark ? "#0f172a" : "#f8fafc", borderRadius: "12px", padding: "12px 14px", border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                            <span style={{ fontWeight: 700, fontSize: "13px", color: isDark ? "#f1f5f9" : "#0f172a" }}>{c.User?.full_name || "Unknown"}</span>
                            <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                              {new Date(c.createdAt || c.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: "13px", color: isDark ? "#cbd5e1" : "#374151", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{c.comment}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ borderTop: comments.length > 0 ? `1px solid ${isDark ? "#334155" : "#f1f5f9"}` : "none", paddingTop: comments.length > 0 ? "16px" : "0" }}>
                <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "linear-gradient(135deg, #0D9488, #0F766E)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "13px", flexShrink: 0, border: "2px solid #0D9488" }}>
                    {(user?.full_name || "U").trim().charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) { e.preventDefault(); handleAddComment(); } }} placeholder="Write a comment... (Ctrl+Enter to submit)" rows={3} style={{ width: "100%", padding: "12px 14px", border: `1.5px solid ${isDark ? "#334155" : "#e2e8f0"}`, borderRadius: "12px", fontSize: "13px", background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a", outline: "none", fontFamily: "inherit", resize: "vertical", transition: "border-color 0.15s", boxSizing: "border-box" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                      <span style={{ fontSize: "11px", color: "#94a3b8" }}>Ctrl+Enter to submit</span>
                      <button type="button" onClick={handleAddComment} disabled={!newComment.trim() || addingComment} style={{ background: !newComment.trim() ? "#e2e8f0" : "linear-gradient(135deg, #0D9488, #0F766E)", color: !newComment.trim() ? "#94a3b8" : "#fff", border: "none", borderRadius: "10px", padding: "8px 18px", fontSize: "13px", fontWeight: 700, cursor: !newComment.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "6px", fontFamily: "inherit", transition: "all 0.15s" }}>
                        {addingComment ? <>⏳ Posting...</> : (<><Send size={13} />Add Comment</>)}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: isDark ? "#1e293b" : "#fff", borderRadius: "16px", border: `1px solid ${isDark ? "#334155" : "rgba(0,0,0,0.06)"}`, overflow: "hidden", marginTop: "16px" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${isDark ? "#334155" : "#f1f5f9"}`, display: "flex", alignItems: "center", gap: "8px" }}>
              <Clock size={16} color="#0D9488" />
              <span style={{ fontWeight: 700, fontSize: "14px", color: isDark ? "#f1f5f9" : "#0f172a" }}>Status History</span>
            </div>
            <div style={{ padding: "16px 20px" }}>
              {history.length === 0 ? (
                <div style={{ color: "#94a3b8", fontSize: "13px", textAlign: "center", padding: "16px" }}>No status changes yet</div>
              ) : (
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", left: "11px", top: "8px", bottom: "8px", width: "2px", background: isDark ? "#334155" : "#e2e8f0" }} />
                  {history.map((h, idx) => {
                    const statusColors = { completed: "#10b981", in_progress: "#3b82f6", pending: "#f59e0b", on_hold: "#64748b", cancelled: "#ef4444" };
                    const color = statusColors[h.new_status] || "#64748b";
                    return (
                      <div key={h.id || idx} style={{ display: "flex", gap: "16px", marginBottom: "16px", position: "relative" }}>
                        <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: color, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, boxShadow: `0 0 0 3px ${color}22` }}>
                          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#fff" }} />
                        </div>
                        <div style={{ flex: 1, paddingTop: "2px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div>
                              <span style={{ background: `${color}20`, color, borderRadius: "6px", padding: "2px 8px", fontSize: "11px", fontWeight: 700 }}>{h.new_status?.replace("_", " ")?.toUpperCase()}</span>
                              {h.old_status ? <span style={{ fontSize: "11px", color: "#94a3b8", marginLeft: "6px" }}>from {h.old_status?.replace("_", " ")}</span> : null}
                            </div>
                            <span style={{ fontSize: "11px", color: "#94a3b8", flexShrink: 0 }}>{new Date(h.changed_at || h.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                            by {h.ChangedBy?.full_name || "Unknown"}
                            {h.note ? ` — "${h.note}"` : ""}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
