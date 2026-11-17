import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, ClipboardList, Download, Pencil, Plus, Trash2, X } from "lucide-react";
import api from "../../api";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../components/common/Toast";

const TZ = "Europe/London";

function londonNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
}

function fmtDateUK(dateLike) {
  const date = new Date(dateLike);
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function fmtHeadingDate(dateLike) {
  const date = new Date(dateLike);
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
}

function fmtMonthLabel(dateLike) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, month: "long", year: "numeric" }).format(new Date(dateLike));
}

function fmtTimeNow() {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(londonNow());
  const h = p.find((x) => x.type === "hour")?.value || "00";
  const m = p.find((x) => x.type === "minute")?.value || "00";
  return `${h}:${m}`;
}

function toIsoDate(dateLike) {
  const d = new Date(dateLike);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function weekNumber(dateLike) {
  const d = new Date(Date.UTC(dateLike.getFullYear(), dateLike.getMonth(), dateLike.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function weekRange(today) {
  const d = new Date(today);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return Array.from({ length: 7 }).map((_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    return x;
  });
}

function dayName(dateLike) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "long" }).format(new Date(dateLike));
}

const autoResize = (e) => {
  e.target.style.height = "auto";
  e.target.style.height = `${e.target.scrollHeight}px`;
};

export default function DailyReport() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const isDark = theme === "dark";
  const cardStyle = { background: isDark ? "#1e293b" : "#FFFFFF", border: `0.5px solid ${isDark ? "#334155" : "#E5E7EB"}`, borderRadius: 12 };

  const isAdmin = user?.Role?.role_name === "Super Admin";
  const today = useMemo(() => londonNow(), []);
  const todayIso = toIsoDate(today);
  const currentWeek = weekNumber(today);
  const currentMonth = fmtMonthLabel(today);
  const weekDays = useMemo(() => weekRange(today), [today]);

  const [myLogs, setMyLogs] = useState([]);
  const [dayDraft, setDayDraft] = useState([]);
  const [saving, setSaving] = useState(false);
  const [allRows, setAllRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ user_id: "", period: "week", value: String(currentWeek) });
  const [viewModal, setViewModal] = useState({ open: false, title: "", text: "" });
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const emptyTodayDraftRow = () => ({
    task_description: "",
    start_time: fmtTimeNow(),
    end_time: "",
    status: "pending",
    notes: ""
  });

  const withTodayAddSlot = (rows) => {
    if (!rows.length || rows[rows.length - 1]?.id) return [...rows, emptyTodayDraftRow()];
    return rows;
  };

  const loadMyLogs = async () => {
    const { data } = await api.get("/daily-reports/my", { params: { period: "week", value: currentWeek } });
    const rows = Array.isArray(data) ? data : [];
    setMyLogs(rows);
    const todayRows = rows.filter((r) => r.date === todayIso);
    const mapped = todayRows.map((r) => ({
      id: r.id,
      task_description: r.task_description || "",
      start_time: String(r.start_time || "").slice(0, 5),
      end_time: String(r.end_time || "").slice(0, 5),
      status: r.status || "pending",
      notes: r.notes || ""
    }));
    setDayDraft(withTodayAddSlot(mapped));
  };

  const loadAdmin = async () => {
    if (!isAdmin) return;
    const [rowsRes, usersRes] = await Promise.all([
      api.get("/daily-reports/all", { params: filters }),
      api.get("/users/assign-list")
    ]);
    setAllRows(Array.isArray(rowsRes.data) ? rowsRes.data : []);
    setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
  };

  useEffect(() => {
    loadMyLogs().catch(() => setMyLogs([]));
  }, []);

  useEffect(() => {
    loadAdmin().catch(() => {
      setAllRows([]);
      setUsers([]);
    });
  }, [isAdmin, filters.period, filters.value, filters.user_id]);

  const groupedByDay = useMemo(() => {
    const map = new Map();
    myLogs.forEach((r) => {
      const k = r.date;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(r);
    });
    return map;
  }, [myLogs]);

  const groupedByUser = useMemo(() => {
    const map = new Map();
    allRows.forEach((r) => {
      const k = r.user?.id || r.user_id;
      if (!map.has(k)) map.set(k, { user: r.user, rows: [] });
      map.get(k).rows.push(r);
    });
    return Array.from(map.values());
  }, [allRows]);

  const addTodayRow = () => {
    setDayDraft((p) => {
      const last = p[p.length - 1];
      if (last && !last.id) return p;
      return [...p, emptyTodayDraftRow()];
    });
  };

  const updateDraft = (idx, key, value) => {
    setDayDraft((p) => p.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  };

  const beginEdit = (row) => {
    if (!row?.id) return;
    setEditingId(Number(row.id));
    setDeleteConfirmId(null);
    setEditDraft({
      task_description: row.task_description || "",
      start_time: String(row.start_time || "").slice(0, 5),
      end_time: String(row.end_time || "").slice(0, 5),
      status: row.status || "pending",
      notes: row.notes || ""
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const saveEdit = async (id) => {
    if (!editDraft) return;
    try {
      await api.patch(`/daily-reports/${id}`, {
        task_description: editDraft.task_description,
        start_time: editDraft.start_time || null,
        end_time: editDraft.end_time || null,
        status: editDraft.status,
        notes: editDraft.notes
      });
      await loadMyLogs();
      setEditingId(null);
      setEditDraft(null);
      showToast("Daily report updated", "success");
    } catch {
      showToast("Failed to update daily report", "error");
    }
  };

  const confirmDelete = async (id) => {
    try {
      await api.delete(`/daily-reports/${id}`);
      setMyLogs((prev) => prev.filter((r) => r.id !== id));
      setDayDraft((prev) => withTodayAddSlot(prev.filter((r) => r.id !== id)));
      setDeleteConfirmId(null);
      if (editingId === id) {
        setEditingId(null);
        setEditDraft(null);
      }
      showToast("Task deleted", "success");
    } catch {
      showToast("Failed to delete task", "error");
    }
  };

  const saveToday = async () => {
    setSaving(true);
    try {
      await api.post("/daily-reports/bulk-today", {
        entries: dayDraft
          .filter((r) => r.id || String(r.task_description || "").trim())
          .map((r) => ({
            task_description: r.task_description || "",
            start_time: r.start_time || fmtTimeNow(),
            end_time: r.end_time || null,
            status: r.status || "pending",
            notes: r.notes || ""
          }))
      });
      await loadMyLogs();
      showToast("Daily report saved", "success");
    } catch (err) {
      showToast(err?.response?.data?.error || "Failed to save daily report", "error");
    } finally {
      setSaving(false);
    }
  };

  const updateAdminStatus = async (id, status) => {
    try {
      await api.patch(`/daily-reports/${id}/status`, { status });
      await loadAdmin();
    } catch {
      showToast("Failed to update status", "error");
    }
  };

  const deleteAdmin = async (id) => {
    if (!window.confirm("Delete this daily report entry?")) return;
    try {
      await api.delete(`/daily-reports/${id}`);
      await loadAdmin();
      showToast("Entry deleted", "success");
    } catch {
      showToast("Failed to delete entry", "error");
    }
  };

  const exportCsv = () => {
    const rows = [["User", "Day", "Date", "Task Description", "Start Time", "End Time", "Status", "Notes"]];
    allRows.forEach((r) => {
      rows.push([
        r.user?.full_name || "",
        r.day || "",
        fmtDateUK(r.date),
        r.task_description || "",
        String(r.start_time || "").slice(0, 5),
        String(r.end_time || "").slice(0, 5),
        r.status || "",
        r.notes || ""
      ]);
    });
    const csv = rows.map((line) => line.map((v) => `"${String(v).replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `daily-report-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const openViewModal = (title, text) => {
    setViewModal({ open: true, title, text: text || "" });
  };

  return (
    <div style={{ padding: 24, color: isDark ? "#f1f5f9" : "#111827", background: isDark ? "#0f172a" : "transparent", minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ ...cardStyle, padding: 18, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{isAdmin ? "Daily Report" : "Daily Work Register"}</h1>
            <div style={{ marginTop: 4, color: isDark ? "#94a3b8" : "#6B7280", fontSize: 12 }}>{fmtHeadingDate(today)}</div>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#0F9B72", fontWeight: 700 }}>
            <CalendarDays size={16} />
            {currentMonth}
          </div>
        </div>
      </div>

      {isAdmin ? (
        <div style={{ ...cardStyle, padding: 16 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <select value={filters.user_id} onChange={(e) => setFilters((p) => ({ ...p, user_id: e.target.value }))} style={{ padding: "8px 10px", border: `1px solid ${isDark ? "#475569" : "#E5E7EB"}`, borderRadius: 10, fontSize: 14, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#111827" }}>
              <option value="">All Users</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
            <select
              value={filters.period}
              onChange={(e) => {
                const period = e.target.value;
                const value = period === "day" ? todayIso : period === "month" ? currentMonth : String(currentWeek);
                setFilters((p) => ({ ...p, period, value }));
              }}
              style={{ padding: "8px 10px", border: `1px solid ${isDark ? "#475569" : "#E5E7EB"}`, borderRadius: 10, fontSize: 14, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#111827" }}
            >
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
            <input
              value={filters.value}
              onChange={(e) => setFilters((p) => ({ ...p, value: e.target.value }))}
              placeholder={filters.period === "day" ? "YYYY-MM-DD" : filters.period === "week" ? "Week no." : "Month label"}
              style={{ padding: "8px 10px", border: `1px solid ${isDark ? "#475569" : "#E5E7EB"}`, borderRadius: 10, fontSize: 14, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#111827" }}
            />
            <button type="button" onClick={exportCsv} style={{ border: "none", borderRadius: 10, background: "#0F9B72", color: "#fff", padding: "8px 12px", display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
              <Download size={14} /> Export CSV
            </button>
          </div>

          {groupedByUser.map((group) => (
            <div key={group.user?.id || Math.random()} style={{ marginBottom: 14, border: `1px solid ${isDark ? "#334155" : "#E5E7EB"}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ background: isDark ? "#0f172a" : "#F9FAFB", padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                <ClipboardList size={14} color="#0F9B72" />
                {group.user?.full_name || "Unknown user"}
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                  <thead>
                    <tr style={{ background: isDark ? "#1f2937" : "#F3F4F6", textAlign: "left" }}>
                      <th style={{ width: 100, padding: "8px 10px", fontSize: 12 }}>Day</th>
                      <th style={{ width: 110, padding: "8px 10px", fontSize: 12 }}>Date</th>
                      <th style={{ width: 200, padding: "8px 10px", fontSize: 12 }}>Task Description</th>
                      <th style={{ width: 80, padding: "8px 10px", fontSize: 12 }}>Start</th>
                      <th style={{ width: 80, padding: "8px 10px", fontSize: 12 }}>End</th>
                      <th style={{ width: 130, padding: "8px 10px", fontSize: 12 }}>Status</th>
                      <th style={{ width: 200, padding: "8px 10px", fontSize: 12 }}>Notes</th>
                      <th style={{ width: 60, padding: "8px 10px", fontSize: 12 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((r, idx) => (
                      <tr key={r.id} style={{ background: idx % 2 ? (isDark ? "#0f172a" : "#FCFCFD") : (isDark ? "#1e293b" : "#FFFFFF"), borderTop: `1px solid ${isDark ? "#334155" : "#F3F4F6"}` }}>
                        <td style={{ padding: "8px 10px", fontSize: 14 }}>{r.day}</td>
                        <td style={{ padding: "8px 10px", fontSize: 14 }}>{fmtDateUK(r.date)}</td>
                        <td style={{ padding: "8px 10px", fontSize: 14, maxWidth: 200 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200, display: "inline-block" }}>
                              {r.task_description || "-"}
                            </span>
                            {String(r.task_description || "").length > 50 ? (
                              <button
                                type="button"
                                onClick={() => openViewModal("Task Description", r.task_description)}
                                style={{ border: "none", borderRadius: 8, background: "#0F9B72", color: "#fff", fontSize: 11, padding: "3px 8px", cursor: "pointer", flexShrink: 0 }}
                              >
                                View
                              </button>
                            ) : null}
                          </div>
                        </td>
                        <td style={{ padding: "8px 10px", fontSize: 14 }}>{String(r.start_time || "").slice(0, 5)}</td>
                        <td style={{ padding: "8px 10px", fontSize: 14 }}>{String(r.end_time || "").slice(0, 5)}</td>
                        <td style={{ padding: "8px 10px", fontSize: 14 }}>
                          <select value={r.status} onChange={(e) => updateAdminStatus(r.id, e.target.value)} style={{ borderRadius: 999, border: `1px solid ${isDark ? "#475569" : "#E5E7EB"}`, background: isDark ? "#0f172a" : "#fff", padding: "4px 8px", color: r.status === "completed" ? "#0F9B72" : "#D97706" }}>
                            <option value="completed">Completed</option>
                            <option value="pending">Pending</option>
                          </select>
                        </td>
                        <td style={{ padding: "8px 10px", fontSize: 14, maxWidth: 200 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200, display: "inline-block" }}>
                              {r.notes || "-"}
                            </span>
                            {String(r.notes || "").length > 50 ? (
                              <button
                                type="button"
                                onClick={() => openViewModal("Notes", r.notes)}
                                style={{ border: "none", borderRadius: 8, background: "#0F9B72", color: "#fff", fontSize: 11, padding: "3px 8px", cursor: "pointer", flexShrink: 0 }}
                              >
                                View
                              </button>
                            ) : null}
                          </div>
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          <button type="button" onClick={() => deleteAdmin(r.id)} style={{ border: "none", background: "transparent", color: "#DC2626", cursor: "pointer" }}><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ ...cardStyle, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, alignItems: "center" }}>
            <strong style={{ fontSize: 14 }}>Current Week</strong>
            <button type="button" onClick={saveToday} disabled={saving} style={{ border: "none", borderRadius: 10, background: "#0F9B72", color: "#fff", padding: "8px 14px", fontWeight: 700 }}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 960 }}>
              <thead>
                <tr style={{ background: isDark ? "#1f2937" : "#F3F4F6", textAlign: "left" }}>
                  {["Day", "Date", "Task Description", "Start Time", "End Time", "Status", "Notes", "Action"].map((h) => (
                    <th key={h} style={{ padding: "8px 10px", fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weekDays.map((d, i) => {
                  const iso = toIsoDate(d);
                  const isFuture = iso > todayIso;
                  const dayRows = iso === todayIso ? dayDraft : (groupedByDay.get(iso) || []);
                  const renderRows = dayRows.length ? dayRows : [{}];
                  return renderRows.map((r, idx) => {
                    const isSaved = Boolean(r?.id);
                    const isEditing = isSaved && editingId != null && Number(editingId) === Number(r.id);
                    const rowData = isEditing && editDraft ? editDraft : r;
                    return (
                    <tr key={`${iso}-${idx}`} style={{ background: (i + idx) % 2 ? (isDark ? "#0f172a" : "#FCFCFD") : (isDark ? "#1e293b" : "#FFFFFF"), borderTop: `1px solid ${isDark ? "#334155" : "#F3F4F6"}`, opacity: isFuture ? 0.55 : 1, verticalAlign: "top" }}>
                      <td style={{ padding: "8px 10px", fontSize: 14 }}>{dayName(d)}</td>
                      <td style={{ padding: "8px 10px", fontSize: 14 }}>{fmtDateUK(d)}</td>
                      <td style={{ padding: "8px 10px" }}>
                        {isSaved && !isEditing ? (
                          <div style={{ padding: "6px 8px", fontSize: 14 }}>{rowData.task_description || "-"}</div>
                        ) : (
                          <textarea
                            rows={1}
                            disabled={(iso !== todayIso || isFuture) && !isEditing}
                            value={rowData.task_description || ""}
                            onChange={(e) => (isEditing ? setEditDraft((p) => ({ ...p, task_description: e.target.value })) : updateDraft(idx, "task_description", e.target.value))}
                            onInput={autoResize}
                            style={{ width: "100%", border: `1px solid ${isDark ? "#475569" : "#E5E7EB"}`, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#111827", borderRadius: 8, padding: "6px 8px", fontSize: 14, overflow: "hidden", resize: "none", minHeight: 34, boxSizing: "border-box" }}
                          />
                        )}
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        {isSaved && !isEditing ? (
                          <div style={{ padding: "6px 8px", fontSize: 14 }}>{String(rowData.start_time || "").slice(0, 5)}</div>
                        ) : (
                          <input
                            disabled={(iso !== todayIso || isFuture) && !isEditing}
                            value={String(rowData.start_time || "").slice(0, 5)}
                            onChange={(e) => (isEditing ? setEditDraft((p) => ({ ...p, start_time: e.target.value })) : updateDraft(idx, "start_time", e.target.value))}
                            type="time"
                            style={{ border: `1px solid ${isDark ? "#475569" : "#E5E7EB"}`, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#111827", borderRadius: 8, padding: "6px 8px", fontSize: 14 }}
                          />
                        )}
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        {isSaved && !isEditing ? (
                          <div style={{ padding: "6px 8px", fontSize: 14 }}>{String(rowData.end_time || "").slice(0, 5)}</div>
                        ) : (
                          <input
                            disabled={(iso !== todayIso || isFuture) && !isEditing}
                            value={String(rowData.end_time || "").slice(0, 5)}
                            onChange={(e) => (isEditing ? setEditDraft((p) => ({ ...p, end_time: e.target.value })) : updateDraft(idx, "end_time", e.target.value))}
                            type="time"
                            style={{ border: `1px solid ${isDark ? "#475569" : "#E5E7EB"}`, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#111827", borderRadius: 8, padding: "6px 8px", fontSize: 14 }}
                          />
                        )}
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <select
                          disabled={(iso !== todayIso || isFuture) && !isEditing}
                          value={rowData.status || "pending"}
                          onChange={(e) => (isEditing ? setEditDraft((p) => ({ ...p, status: e.target.value })) : updateDraft(idx, "status", e.target.value))}
                          style={{ borderRadius: 999, border: `1px solid ${isDark ? "#475569" : "#E5E7EB"}`, background: isDark ? "#0f172a" : "#fff", padding: "4px 8px", color: (r.status || "pending") === "completed" ? "#0F9B72" : "#D97706" }}
                        >
                          <option value="completed">Completed</option>
                          <option value="pending">Pending</option>
                        </select>
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        {isSaved && !isEditing ? (
                          <div style={{ padding: "6px 8px", fontSize: 14 }}>{rowData.notes || "-"}</div>
                        ) : (
                          <textarea
                            rows={1}
                            disabled={(iso !== todayIso || isFuture) && !isEditing}
                            value={rowData.notes || ""}
                            onChange={(e) => (isEditing ? setEditDraft((p) => ({ ...p, notes: e.target.value })) : updateDraft(idx, "notes", e.target.value))}
                            onInput={autoResize}
                            style={{ width: "100%", border: `1px solid ${isDark ? "#475569" : "#E5E7EB"}`, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#111827", borderRadius: 8, padding: "6px 8px", fontSize: 14, overflow: "hidden", resize: "none", minHeight: 34, boxSizing: "border-box" }}
                          />
                        )}
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        {isSaved ? (
                          deleteConfirmId != null && Number(deleteConfirmId) === Number(r.id) ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                              <span>Are you sure?</span>
                              <button type="button" onClick={() => confirmDelete(r.id)} style={{ border: "none", borderRadius: 8, background: "#DC2626", color: "#fff", padding: "4px 7px", cursor: "pointer", fontSize: 11 }}>
                                Yes, delete
                              </button>
                              <button type="button" onClick={() => setDeleteConfirmId(null)} style={{ border: `1px solid ${isDark ? "#475569" : "#D1D5DB"}`, borderRadius: 8, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#cbd5e1" : "#6B7280", padding: "4px 7px", cursor: "pointer", fontSize: 11 }}>
                                Cancel
                              </button>
                            </div>
                          ) : isEditing ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <button type="button" onClick={() => saveEdit(r.id)} style={{ border: "none", borderRadius: 8, background: "#0F9B72", color: "#fff", padding: "5px 7px", cursor: "pointer", display: "inline-flex" }}>
                                <Check size={12} />
                              </button>
                              <button type="button" onClick={cancelEdit} style={{ border: `1px solid ${isDark ? "#475569" : "#D1D5DB"}`, borderRadius: 8, background: isDark ? "#0f172a" : "#F9FAFB", color: isDark ? "#cbd5e1" : "#6B7280", padding: "5px 7px", cursor: "pointer", display: "inline-flex" }}>
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <button type="button" onClick={() => beginEdit(r)} style={{ border: "none", borderRadius: 8, background: "transparent", color: "#0F9B72", padding: 0, cursor: "pointer", display: "inline-flex" }}>
                                <Pencil size={14} />
                              </button>
                              <button type="button" onClick={() => setDeleteConfirmId(Number(r.id))} style={{ border: "none", borderRadius: 8, background: "transparent", color: "#DC2626", padding: 0, cursor: "pointer", display: "inline-flex" }}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )
                        ) : iso === todayIso && idx === renderRows.length - 1 && !isFuture ? (
                          <button type="button" onClick={addTodayRow} style={{ border: "1px dashed #0F9B72", borderRadius: 8, background: "transparent", color: "#0F9B72", padding: "6px 8px", display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <Plus size={12} /> Add Task
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                  });
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewModal.open ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.55)", zIndex: 1200, display: "grid", placeItems: "center", padding: 16 }}>
          <div style={{ width: "100%", maxWidth: 500, background: isDark ? "#1e293b" : "#FFFFFF", borderRadius: 12, border: `0.5px solid ${isDark ? "#334155" : "#E5E7EB"}`, boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${isDark ? "#334155" : "#E5E7EB"}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <strong style={{ fontSize: 15 }}>{viewModal.title}</strong>
              <button type="button" onClick={() => setViewModal({ open: false, title: "", text: "" })} style={{ border: "none", background: "transparent", color: isDark ? "#f1f5f9" : "#111827", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: "14px 16px", fontSize: 14, lineHeight: 1.6, color: isDark ? "#e2e8f0" : "#111827", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: "60vh", overflowY: "auto" }}>
              {viewModal.text || "-"}
            </div>
            <div style={{ padding: "0 16px 14px", display: "flex", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setViewModal({ open: false, title: "", text: "" })} style={{ border: "none", borderRadius: 10, background: "#0F9B72", color: "#fff", padding: "8px 12px", fontWeight: 700 }}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
