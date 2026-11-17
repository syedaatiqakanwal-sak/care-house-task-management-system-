import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Eye, X } from "lucide-react";
import api from "../../api";
import { useTheme } from "../../contexts/ThemeContext";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

const COLORS = {
  completed: "#10b981",
  pending: "#f59e0b",
  in_progress: "#3b82f6",
  overdue: "#ef4444",
  urgent: "#dc2626",
  high: "#f97316",
  medium: "#eab308",
  low: "#6b7280"
};

function MetricCard({ title, value, accent = "#0D9488", isDark, subtext, progress }) {
  return (
    <div style={{ background: isDark ? "#1e293b" : "#fff", border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, borderRadius: 14, padding: 16, boxShadow: isDark ? "none" : "0 4px 16px rgba(15,23,42,0.05)" }}>
      <div style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: 12, fontWeight: 700 }}>{title}</div>
      <div style={{ marginTop: 10, color: accent, fontSize: 28, fontWeight: 800 }}>{value}</div>
      {subtext ? <div style={{ marginTop: 6, fontSize: 12, color: isDark ? "#94a3b8" : "#64748b" }}>{subtext}</div> : null}
      {typeof progress === "number" ? (
        <div style={{ marginTop: 10 }}>
          <div style={{ height: 8, borderRadius: 999, background: isDark ? "#334155" : "#e2e8f0", overflow: "hidden" }}>
            <div style={{ width: `${Math.max(0, Math.min(100, progress))}%`, height: "100%", background: accent }} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function buildCSV(headers, rows) {
  const escape = (val) => {
    const s = String(val ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const head = headers.map(escape).join(",");
  const body = rows.map((row) => row.map(escape).join(",")).join("\n");
  return `${head}\n${body}`;
}

function downloadCSV(filename, headers, rows) {
  const csv = buildCSV(headers, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function statusBadge(status, isDark) {
  const s = String(status || "").toLowerCase();
  const colors = {
    completed: { bg: "#ecfdf5", color: "#065f46" },
    pending: { bg: "#fffbeb", color: "#92400e" },
    in_progress: { bg: "#eff6ff", color: "#1d4ed8" },
    overdue: { bg: "#fef2f2", color: "#991b1b" }
  };
  const tone = colors[s] || { bg: isDark ? "#334155" : "#f1f5f9", color: isDark ? "#cbd5e1" : "#334155" };
  return (
    <span style={{ background: tone.bg, color: tone.color, borderRadius: 999, padding: "3px 8px", fontSize: 11, fontWeight: 700 }}>
      {s.replace(/_/g, " ")}
    </span>
  );
}

function UserDetailModal({ open, report, loading, isDark, onClose }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(2,6,23,0.55)", display: "grid", placeItems: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 960, maxHeight: "90vh", overflow: "auto", background: isDark ? "#0f172a" : "#fff", borderRadius: 16, border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}` }}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ color: isDark ? "#f1f5f9" : "#0f172a" }}>{report?.full_name || "User Report"}</strong>
          <button type="button" onClick={onClose} style={{ border: "none", background: "transparent", color: isDark ? "#cbd5e1" : "#334155", cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>
        {loading ? (
          <div style={{ padding: 16 }}>
            <div className="skeleton" style={{ height: 88, borderRadius: 12, marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 220, borderRadius: 12 }} />
          </div>
        ) : !report ? (
          <div style={{ padding: 20, color: isDark ? "#94a3b8" : "#64748b" }}>No user report found.</div>
        ) : (
          <div style={{ padding: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 14 }}>
              <MetricCard title="Assigned" value={report.total_assigned} isDark={isDark} />
              <MetricCard title="Completed" value={report.completed} isDark={isDark} accent={COLORS.completed} />
              <MetricCard title="Overdue" value={report.overdue} isDark={isDark} accent={COLORS.overdue} />
              <MetricCard title="On Time" value={report.completed_on_time} isDark={isDark} accent="#0ea5e9" />
            </div>
            <div style={{ background: isDark ? "#111827" : "#f8fafc", borderRadius: 12, border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, padding: 12, marginBottom: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: isDark ? "#f1f5f9" : "#0f172a" }}>Monthly Completion Trend (6 months)</div>
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={report.monthly_completion_trend || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} />
                    <XAxis dataKey="month" stroke={isDark ? "#94a3b8" : "#64748b"} />
                    <YAxis allowDecimals={false} stroke={isDark ? "#94a3b8" : "#64748b"} />
                    <Tooltip />
                    <Bar dataKey="completed" fill={COLORS.completed} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div style={{ background: isDark ? "#111827" : "#fff", border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "10px 12px", fontWeight: 700, color: isDark ? "#f1f5f9" : "#0f172a", borderBottom: `1px solid ${isDark ? "#334155" : "#e2e8f0"}` }}>Last 20 Tasks</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 700, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: isDark ? "#0b1220" : "#f8fafc", textAlign: "left" }}>
                      {["Title", "Status", "Priority", "Deadline", "Created"].map((h) => (
                        <th key={h} style={{ padding: "10px 12px", fontSize: 12, color: isDark ? "#94a3b8" : "#64748b" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(report.recent_tasks || []).map((t) => (
                      <tr key={t.id} style={{ borderTop: `1px solid ${isDark ? "#334155" : "#f1f5f9"}` }}>
                        <td style={{ padding: "10px 12px", color: isDark ? "#e2e8f0" : "#0f172a" }}>{t.title}</td>
                        <td style={{ padding: "10px 12px" }}>{statusBadge(t.status, isDark)}</td>
                        <td style={{ padding: "10px 12px", color: isDark ? "#e2e8f0" : "#334155" }}>{t.priority}</td>
                        <td style={{ padding: "10px 12px", color: isDark ? "#e2e8f0" : "#334155" }}>{t.deadline ? new Date(t.deadline).toLocaleString() : "-"}</td>
                        <td style={{ padding: "10px 12px", color: isDark ? "#e2e8f0" : "#334155" }}>{new Date(t.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Reports() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [period, setPeriod] = useState("month");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  const [byUser, setByUser] = useState([]);
  const [overTime, setOverTime] = useState([]);
  const [byPriority, setByPriority] = useState([]);
  const [byCategory, setByCategory] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUserReport, setSelectedUserReport] = useState(null);
  const [loadingUserReport, setLoadingUserReport] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [summaryRes, byUserRes, overTimeRes, priorityRes, categoryRes] = await Promise.all([
        api.get("/reports/summary"),
        api.get("/reports/by-user"),
        api.get("/reports/tasks-over-time", { params: { period } }),
        api.get("/reports/by-priority"),
        api.get("/reports/by-category")
      ]);
      setSummary(summaryRes.data || {});
      setByUser(Array.isArray(byUserRes.data) ? byUserRes.data : []);
      setOverTime(Array.isArray(overTimeRes.data) ? overTimeRes.data : []);
      setByPriority(Array.isArray(priorityRes.data) ? priorityRes.data : []);
      setByCategory(Array.isArray(categoryRes.data) ? categoryRes.data : []);
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to load reports.");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const statusPieData = useMemo(() => [
    { name: "completed", value: Number(summary?.completed_tasks || 0), color: COLORS.completed },
    { name: "pending", value: Number(summary?.pending_tasks || 0), color: COLORS.pending },
    { name: "in_progress", value: Number(summary?.in_progress_tasks || 0), color: COLORS.in_progress },
    { name: "overdue", value: Number(summary?.overdue_tasks || 0), color: COLORS.overdue }
  ], [summary]);

  const handleUserReport = async (userId) => {
    setSelectedUserId(userId);
    setLoadingUserReport(true);
    try {
      const { data } = await api.get(`/reports/user/${userId}`);
      setSelectedUserReport(data || null);
    } catch {
      setSelectedUserReport(null);
    } finally {
      setLoadingUserReport(false);
    }
  };

  const exportSummaryCSV = () => {
    if (!summary) return;
    downloadCSV(
      "reports-summary.csv",
      ["metric", "value"],
      [
        ["total_tasks", summary.total_tasks],
        ["completed_tasks", summary.completed_tasks],
        ["pending_tasks", summary.pending_tasks],
        ["in_progress_tasks", summary.in_progress_tasks],
        ["overdue_tasks", summary.overdue_tasks],
        ["completion_rate", summary.completion_rate],
        ["total_users", summary.total_users],
        ["total_calls", summary.total_calls],
        ["total_emails", summary.total_emails],
        ["avg_completion_time_days", summary.avg_completion_time_days]
      ]
    );
    setExportOpen(false);
  };

  const exportUserCSV = () => {
    downloadCSV(
      "reports-users.csv",
      ["name", "role", "assigned", "completed", "pending", "overdue", "completion_rate", "avg_days", "email"],
      byUser.map((u) => [u.full_name, u.role, u.total_assigned, u.completed, u.pending, u.overdue, u.completion_rate, u.avg_completion_days, u.email])
    );
    setExportOpen(false);
  };

  const exportAllTasksCSV = async () => {
    try {
      const { data } = await api.get("/tasks", { params: { page: 1, limit: 1000 } });
      const rows = Array.isArray(data) ? data : data.rows || [];
      downloadCSV(
        "reports-all-tasks.csv",
        ["title", "status", "priority", "assigned_to", "deadline", "created_at"],
        rows.map((t) => [t.title, t.status, t.priority, t.assignee?.full_name || "-", t.deadline || "", t.created_at || t.createdAt || ""])
      );
    } finally {
      setExportOpen(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: isDark ? "#f1f5f9" : "#0f172a", fontWeight: 800 }}>Reports & Analytics</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {[
            { id: "week", label: "This Week" },
            { id: "month", label: "This Month" },
            { id: "year", label: "This Year" }
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              style={{
                border: `1px solid ${period === p.id ? "#0D9488" : isDark ? "#334155" : "#cbd5e1"}`,
                background: period === p.id ? "#0D9488" : "transparent",
                color: period === p.id ? "#fff" : isDark ? "#e2e8f0" : "#334155",
                borderRadius: 9,
                padding: "8px 10px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              {p.label}
            </button>
          ))}
          <div style={{ position: "relative" }}>
            <button type="button" onClick={() => setExportOpen((s) => !s)} style={{ border: "none", background: "linear-gradient(135deg, #0D9488, #0F766E)", color: "#fff", borderRadius: 10, padding: "9px 12px", display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, cursor: "pointer" }}>
              <Download size={14} /> Export
            </button>
            {exportOpen ? (
              <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", background: isDark ? "#1e293b" : "#fff", border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, borderRadius: 10, overflow: "hidden", minWidth: 220, zIndex: 20 }}>
                <button type="button" onClick={exportSummaryCSV} style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", padding: "9px 12px", color: isDark ? "#f1f5f9" : "#0f172a", cursor: "pointer" }}>Export Summary as CSV</button>
                <button type="button" onClick={exportUserCSV} style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", padding: "9px 12px", color: isDark ? "#f1f5f9" : "#0f172a", cursor: "pointer" }}>Export User Report as CSV</button>
                <button type="button" onClick={exportAllTasksCSV} style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", padding: "9px 12px", color: isDark ? "#f1f5f9" : "#0f172a", cursor: "pointer" }}>Export All Tasks as CSV</button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {error ? (
        <div style={{ background: isDark ? "#1e293b" : "#fff", border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, borderRadius: 14, padding: 24, color: "#ef4444" }}>
          {error}
        </div>
      ) : loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="skeleton" style={{ height: 110, borderRadius: 14 }} />)}
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 16 }}>
            <MetricCard title="Total Tasks" value={summary?.total_tasks || 0} isDark={isDark} />
            <MetricCard title="Completed" value={summary?.completed_tasks || 0} isDark={isDark} accent={COLORS.completed} />
            <MetricCard title="Pending" value={summary?.pending_tasks || 0} isDark={isDark} accent={COLORS.pending} />
            <MetricCard title="Overdue" value={summary?.overdue_tasks || 0} isDark={isDark} accent={COLORS.overdue} />
            <MetricCard title="Completion Rate" value={`${summary?.completion_rate || 0}%`} isDark={isDark} accent="#0ea5e9" progress={summary?.completion_rate || 0} />
            <MetricCard title="Avg Completion Time" value={`${summary?.avg_completion_time_days || 0}d`} isDark={isDark} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
            <div style={{ background: isDark ? "#1e293b" : "#fff", border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, borderRadius: 14, padding: 14, minHeight: 320 }}>
              <h3 style={{ margin: 0, marginBottom: 10, color: isDark ? "#f1f5f9" : "#0f172a", fontSize: 14, fontWeight: 800 }}>Tasks Created Over Time</h3>
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <LineChart data={overTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} />
                    <XAxis dataKey="date" stroke={isDark ? "#94a3b8" : "#64748b"} />
                    <YAxis allowDecimals={false} stroke={isDark ? "#94a3b8" : "#64748b"} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#0D9488" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ background: isDark ? "#1e293b" : "#fff", border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, borderRadius: 14, padding: 14, minHeight: 320 }}>
              <h3 style={{ margin: 0, marginBottom: 10, color: isDark ? "#f1f5f9" : "#0f172a", fontSize: 14, fontWeight: 800 }}>Tasks by Status</h3>
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={statusPieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                      {statusPieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div style={{ background: isDark ? "#1e293b" : "#fff", border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
            <h3 style={{ margin: 0, marginBottom: 10, color: isDark ? "#f1f5f9" : "#0f172a", fontSize: 14, fontWeight: 800 }}>Tasks by Priority</h3>
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={byPriority} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} />
                  <XAxis type="number" allowDecimals={false} stroke={isDark ? "#94a3b8" : "#64748b"} />
                  <YAxis type="category" dataKey="priority" stroke={isDark ? "#94a3b8" : "#64748b"} />
                  <Tooltip />
                  <Bar dataKey="count">
                    {byPriority.map((row) => (
                      <Cell key={row.priority} fill={COLORS[row.priority] || "#0D9488"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ background: isDark ? "#1e293b" : "#fff", border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, borderRadius: 14, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, color: isDark ? "#f1f5f9" : "#0f172a", fontWeight: 800 }}>
              Team Performance
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 980, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: isDark ? "#0f172a" : "#f8fafc", textAlign: "left" }}>
                    {["Name", "Role", "Assigned", "Completed", "Pending", "Overdue", "Completion Rate", "Avg Days", "Actions"].map((h) => (
                      <th key={h} style={{ padding: "10px 12px", fontSize: 12, color: isDark ? "#94a3b8" : "#64748b" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {byUser.map((u) => (
                    <tr key={u.user_id} style={{ borderTop: `1px solid ${isDark ? "#334155" : "#f1f5f9"}` }}>
                      <td style={{ padding: "10px 12px", color: isDark ? "#f1f5f9" : "#0f172a", fontWeight: 600 }}>{u.full_name}</td>
                      <td style={{ padding: "10px 12px", color: isDark ? "#cbd5e1" : "#334155" }}>{u.role}</td>
                      <td style={{ padding: "10px 12px", color: isDark ? "#cbd5e1" : "#334155" }}>{u.total_assigned}</td>
                      <td style={{ padding: "10px 12px", color: COLORS.completed, fontWeight: 700 }}>{u.completed}</td>
                      <td style={{ padding: "10px 12px", color: COLORS.pending, fontWeight: 700 }}>{u.pending}</td>
                      <td style={{ padding: "10px 12px", color: u.overdue > 0 ? COLORS.overdue : (isDark ? "#cbd5e1" : "#334155"), fontWeight: u.overdue > 0 ? 700 : 500 }}>{u.overdue}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 80, height: 7, borderRadius: 999, background: isDark ? "#334155" : "#e2e8f0", overflow: "hidden" }}>
                            <div style={{ width: `${u.completion_rate}%`, height: "100%", background: "#0D9488" }} />
                          </div>
                          <span style={{ fontSize: 12, color: isDark ? "#cbd5e1" : "#334155" }}>{u.completion_rate}%</span>
                        </div>
                      </td>
                      <td style={{ padding: "10px 12px", color: isDark ? "#cbd5e1" : "#334155" }}>{u.avg_completion_days}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <button type="button" onClick={() => handleUserReport(u.user_id)} style={{ border: "1px solid #99f6e4", color: "#0f766e", background: "#f0fdfa", borderRadius: 8, padding: "6px 8px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 12 }}>
                          <Eye size={13} /> View Full Report
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10 }}>
            <MetricCard title="Tasks from manual entry" value={summary?.source_breakdown?.manual || 0} isDark={isDark} />
            <MetricCard title="Tasks from calls" value={summary?.source_breakdown?.call || 0} isDark={isDark} />
            <MetricCard title="Tasks from emails" value={summary?.source_breakdown?.email || 0} isDark={isDark} />
          </div>
        </>
      )}

      <UserDetailModal
        open={!!selectedUserId}
        report={selectedUserReport}
        loading={loadingUserReport}
        isDark={isDark}
        onClose={() => {
          setSelectedUserId(null);
          setSelectedUserReport(null);
        }}
      />
    </div>
  );
}
