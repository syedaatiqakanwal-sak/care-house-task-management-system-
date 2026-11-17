import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Search,
  Trash2,
  UserCheck,
  Activity
} from "lucide-react";
import api from "../../api";
import { useTheme } from "../../contexts/ThemeContext";

const PAGE_SIZE = 20;

function escapeCsv(value) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function extractMethodEndpoint(rawAction = "") {
  const value = String(rawAction || "").trim();
  const match = value.match(/^([A-Z]+)\s+(.+)$/);
  if (!match) {
    return { method: "", endpoint: "", raw: value };
  }
  return { method: match[1], endpoint: match[2], raw: value };
}

function formatEntity(kind, id) {
  if (!id) return kind;
  return `${kind} #${id}`;
}

function parseActionType(method, endpoint) {
  const ep = String(endpoint || "");
  const m = String(method || "").toUpperCase();
  if (m === "DELETE") return "deleted";
  if (ep.includes("toggle-access")) return "access_changed";
  if (ep.includes("/messages") || ep.includes("/message")) return "message_sent";
  if (m === "POST") return "created";
  if (m === "PATCH" || m === "PUT") return "updated";
  return "updated";
}

function formatAction(method, endpoint, details) {
  const m = String(method || "").toUpperCase();
  const ep = String(endpoint || "").trim();
  const body = details?.body || {};

  if (!m || !ep) return "Updated an item";
  const idMatch = ep.match(/^\/(\d+)(?:\/|$)/);
  const itemId = idMatch?.[1];
  const baseResource = ep.split("/")[1] || "";

  if (m === "DELETE" && itemId) {
    return `Deleted ${formatEntity("task", itemId)}`;
  }
  if (m === "PATCH" && /\/\d+\/toggle-access$/.test(ep)) {
    return `Toggled access for ${formatEntity("user", itemId)}`;
  }
  if (m === "POST" && ep === "/") {
    return "Created a new task";
  }
  if (m === "POST" && (ep === "/messages" || /\/\d+\/messages$/.test(ep))) {
    return "Sent a message";
  }
  if (m === "PATCH" && /\/\d+\/status$/.test(ep)) {
    return `Updated status of ${formatEntity("task", itemId)}`;
  }
  if (m === "POST" && /\/\d+\/comments$/.test(ep)) {
    return `Added a comment to ${formatEntity("task", itemId)}`;
  }
  if (m === "POST" && /\/\d+\/comments\/?$/.test(ep)) {
    return `Added a comment to ${formatEntity("task", itemId)}`;
  }

  if (baseResource === "messages" && m === "POST") return "Sent a message";
  if (m === "POST") return "Created a new record";
  if (m === "DELETE") return "Deleted a record";
  if (m === "PATCH" || m === "PUT") {
    if (body?.status) return "Updated item status";
    return "Updated a record";
  }
  return "Performed an action";
}

function getActionBadge(type) {
  if (type === "created") return { label: "Created", bg: "#DCFCE7", text: "#166534", border: "#86EFAC" };
  if (type === "updated") return { label: "Updated", bg: "#DBEAFE", text: "#1D4ED8", border: "#93C5FD" };
  if (type === "deleted") return { label: "Deleted", bg: "#FEE2E2", text: "#B91C1C", border: "#FCA5A5" };
  if (type === "message_sent") return { label: "Sent Message", bg: "#E5E7EB", text: "#374151", border: "#D1D5DB" };
  if (type === "access_changed") return { label: "Access Changed", bg: "#FEF3C7", text: "#92400E", border: "#FCD34D" };
  return { label: "Updated", bg: "#DBEAFE", text: "#1D4ED8", border: "#93C5FD" };
}

function getInitials(name = "") {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "NA";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function formatRelativeDate(dateInput) {
  if (!dateInput) return "-";
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return "-";
  const diffMs = Date.now() - date.getTime();
  const sec = Math.max(1, Math.floor(diffMs / 1000));
  if (sec < 60) return `${sec} sec ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr > 1 ? "s" : ""} ago`;
  const days = Math.floor(hr / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

function buildDateRange(rangeKey, customStart, customEnd) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (rangeKey === "today") {
    return { from: startOfToday, to: now };
  }
  if (rangeKey === "last7") {
    const from = new Date(startOfToday);
    from.setDate(from.getDate() - 6);
    return { from, to: now };
  }
  if (rangeKey === "last30") {
    const from = new Date(startOfToday);
    from.setDate(from.getDate() - 29);
    return { from, to: now };
  }
  if (rangeKey === "custom" && customStart && customEnd) {
    return {
      from: new Date(customStart),
      to: new Date(`${customEnd}T23:59:59`)
    };
  }
  return null;
}

function summarizeChange(log) {
  const details = log.details || {};
  const body = details.body || {};
  if (body.status) return `Status changed to ${body.status}`;
  if (typeof body.access !== "undefined" || typeof body.isActive !== "undefined") return "Access permissions were updated";
  if (body.comment || body.text) return "Comment details were updated";
  if (Object.keys(body).length) return `Updated fields: ${Object.keys(body).join(", ")}`;
  return "No additional field-level changes recorded";
}

export default function AuditLogs() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState("all");
  const [actionTypeFilter, setActionTypeFilter] = useState("all");
  const [dateRange, setDateRange] = useState("last7");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [expandedRows, setExpandedRows] = useState({});
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data } = await api.get("/audit-logs");
        const rows = Array.isArray(data) ? data : data.rows || data.data || [];
        if (!cancelled) setLogs(rows);
      } catch {
        if (!cancelled) setLogs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const normalizedLogs = useMemo(() => {
    return logs.map((log, idx) => {
      const { method, endpoint } = extractMethodEndpoint(log.action);
      const actionType = parseActionType(method, endpoint);
      const actionText = formatAction(method, endpoint, log.details);
      const userName = log.user?.full_name || log.actor || "Unknown User";
      const createdAt = log.createdAt || log.created_at;
      const id = log.id || `${method}-${endpoint}-${idx}`;
      const resourceId = endpoint.match(/^\/(\d+)(?:\/|$)/)?.[1];
      return {
        ...log,
        id,
        method,
        endpoint,
        actionType,
        actionText,
        userName,
        createdAt,
        resourceId
      };
    });
  }, [logs]);

  const users = useMemo(() => {
    const seen = new Map();
    normalizedLogs.forEach((log) => {
      const id = String(log.user?.id || log.user_id || log.userName);
      if (!seen.has(id)) {
        seen.set(id, {
          id,
          name: log.userName
        });
      }
    });
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [normalizedLogs]);

  const filtered = useMemo(() => {
    const range = buildDateRange(dateRange, customStart, customEnd);
    const query = search.trim().toLowerCase();
    return normalizedLogs.filter((log) => {
      if (userFilter !== "all" && String(log.user?.id || log.user_id || log.userName) !== userFilter) return false;
      if (actionTypeFilter !== "all" && log.actionType !== actionTypeFilter) return false;
      if (query) {
        const matchSearch =
          log.userName.toLowerCase().includes(query) ||
          log.actionText.toLowerCase().includes(query);
        if (!matchSearch) return false;
      }
      if (range?.from && range?.to) {
        const created = new Date(log.createdAt);
        if (Number.isNaN(created.getTime())) return false;
        if (created < range.from || created > range.to) return false;
      }
      return true;
    });
  }, [normalizedLogs, userFilter, actionTypeFilter, search, dateRange, customStart, customEnd]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [search, userFilter, actionTypeFilter, dateRange, customStart, customEnd]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageStart = filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const pageEnd = Math.min(page * PAGE_SIZE, filtered.length);

  const summary = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 6);

    let actionsToday = 0;
    let deletionsThisWeek = 0;
    const activeUsersSet = new Set();
    normalizedLogs.forEach((log) => {
      const created = new Date(log.createdAt);
      if (Number.isNaN(created.getTime())) return;
      if (created >= todayStart) {
        actionsToday += 1;
        activeUsersSet.add(log.user?.id || log.user_id || log.userName);
      }
      if (created >= weekStart && log.actionType === "deleted") {
        deletionsThisWeek += 1;
      }
    });

    return {
      actionsToday,
      activeUsersToday: activeUsersSet.size,
      deletionsThisWeek
    };
  }, [normalizedLogs]);

  const activeFilterChips = [];
  if (search) activeFilterChips.push({ key: "search", label: `Search: ${search}` });
  if (userFilter !== "all") {
    const selectedUser = users.find((u) => u.id === userFilter);
    activeFilterChips.push({ key: "user", label: `User: ${selectedUser?.name || userFilter}` });
  }
  if (actionTypeFilter !== "all") {
    const labelMap = {
      created: "Created",
      updated: "Updated",
      deleted: "Deleted",
      message_sent: "Sent Message",
      access_changed: "Access Changed"
    };
    activeFilterChips.push({ key: "actionType", label: `Action: ${labelMap[actionTypeFilter]}` });
  }
  if (dateRange !== "all") {
    const rangeMap = { today: "Today", last7: "Last 7 days", last30: "Last 30 days", custom: "Custom range" };
    activeFilterChips.push({ key: "dateRange", label: `Date: ${rangeMap[dateRange]}` });
  }

  function removeChip(key) {
    if (key === "search") setSearch("");
    if (key === "user") setUserFilter("all");
    if (key === "actionType") setActionTypeFilter("all");
    if (key === "dateRange") {
      setDateRange("all");
      setCustomStart("");
      setCustomEnd("");
    }
  }

  function toggleExpanded(id) {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function exportCsv() {
    const headers = ["When", "User", "Action Type", "Action", "IP Address"];
    const rows = filtered.map((log) => [
      new Date(log.createdAt).toLocaleString(),
      log.userName,
      getActionBadge(log.actionType).label,
      log.actionText,
      log.ip_address || "-"
    ]);
    const csv = [headers, ...rows].map((line) => line.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const cardStyle = {
    background: isDark ? "#1e293b" : "#FFFFFF",
    border: `0.5px solid ${isDark ? "#334155" : "#E4E7EC"}`,
    borderRadius: 10
  };

  return (
    <div
      style={{
        padding: 24,
        fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        background: isDark ? "#0f172a" : "#F5F6FA",
        minHeight: "100vh",
        color: isDark ? "#f1f5f9" : "#111827"
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 24, color: isDark ? "#f1f5f9" : "#111827", fontWeight: 800 }}>Audit Logs</h1>
        <p style={{ margin: "6px 0 0", color: isDark ? "#94a3b8" : "#6B7280", fontSize: 14 }}>
          A record of all actions taken by users in the system - who did what and when
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 14 }}>
        <div style={{ ...cardStyle, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#6B7280", marginBottom: 6 }}>Actions today</div>
              <div style={{ fontWeight: 800, fontSize: 22 }}>{summary.actionsToday}</div>
            </div>
            <Activity size={20} color="#4F46E5" />
          </div>
        </div>
        <div style={{ ...cardStyle, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#6B7280", marginBottom: 6 }}>Active users today</div>
              <div style={{ fontWeight: 800, fontSize: 22 }}>{summary.activeUsersToday}</div>
            </div>
            <UserCheck size={20} color="#0F766E" />
          </div>
        </div>
        <div style={{ ...cardStyle, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#6B7280", marginBottom: 6 }}>Deletions this week</div>
              <div style={{ fontWeight: 800, fontSize: 22 }}>{summary.deletionsThisWeek}</div>
            </div>
            <Trash2 size={20} color="#B91C1C" />
          </div>
        </div>
      </div>

      <div style={{ ...cardStyle, padding: 12, marginBottom: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(220px,1.5fr) repeat(3, minmax(150px,1fr)) auto", gap: 10, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: 11, color: isDark ? "#94a3b8" : "#6B7280" }} />
            <input
              placeholder="Search by user or action"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", padding: "10px 12px 10px 32px", borderRadius: 9, border: `1px solid ${isDark ? "#475569" : "#D1D5DB"}`, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#111827", fontSize: 13 }}
            />
          </div>
          <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} style={{ padding: "10px 12px", borderRadius: 9, border: `1px solid ${isDark ? "#475569" : "#D1D5DB"}`, fontSize: 13, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#111827" }}>
            <option value="all">All users</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
          <select value={actionTypeFilter} onChange={(e) => setActionTypeFilter(e.target.value)} style={{ padding: "10px 12px", borderRadius: 9, border: `1px solid ${isDark ? "#475569" : "#D1D5DB"}`, fontSize: 13, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#111827" }}>
            <option value="all">All actions</option>
            <option value="created">Created</option>
            <option value="updated">Updated</option>
            <option value="deleted">Deleted</option>
            <option value="message_sent">Sent Message</option>
            <option value="access_changed">Access Changed</option>
          </select>
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} style={{ padding: "10px 12px", borderRadius: 9, border: `1px solid ${isDark ? "#475569" : "#D1D5DB"}`, fontSize: 13, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#111827" }}>
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="last7">Last 7 days</option>
            <option value="last30">Last 30 days</option>
            <option value="custom">Custom</option>
          </select>
          <button onClick={exportCsv} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${isDark ? "#475569" : "#D1D5DB"}`, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#e2e8f0" : "#111827", padding: "9px 12px", borderRadius: 9, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
            <Download size={14} />
            Export CSV
          </button>
        </div>

        {dateRange === "custom" && (
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${isDark ? "#475569" : "#D1D5DB"}`, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#111827", fontSize: 13 }} />
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${isDark ? "#475569" : "#D1D5DB"}`, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#111827", fontSize: 13 }} />
          </div>
        )}

        {!!activeFilterChips.length && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            {activeFilterChips.map((chip) => (
              <button key={chip.key} onClick={() => removeChip(chip.key)} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${isDark ? "#475569" : "#CBD5E1"}`, background: isDark ? "#1e293b" : "#F8FAFC", color: isDark ? "#cbd5e1" : "#334155", padding: "4px 10px", borderRadius: 999, fontSize: 12, cursor: "pointer" }}>
                {chip.label}
                <span style={{ fontWeight: 700 }}>x</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="skeleton" style={{ ...cardStyle, height: 64 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: "center", padding: 44, color: isDark ? "#94a3b8" : "#6B7280" }}>
            <FileText size={28} style={{ marginBottom: 10 }} />
            <div style={{ fontSize: 14 }}>No activity found for the selected filters</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {paged.map((log) => {
              const badge = getActionBadge(log.actionType);
              const isExpanded = !!expandedRows[log.id];
              const created = new Date(log.createdAt);
              const absolute = Number.isNaN(created.getTime()) ? "-" : created.toLocaleString();
              const relative = formatRelativeDate(log.createdAt);
              const borderAccent =
                log.actionType === "deleted" ? "4px solid #FCA5A5" : log.actionType === "created" ? "4px solid #86EFAC" : "4px solid transparent";
              const resourceUrl = log.resourceId ? `/tasks/${log.resourceId}` : "";
              const isDeleted = log.actionType === "deleted";
              return (
                <div key={log.id} style={{ ...cardStyle, borderLeft: borderAccent, overflow: "hidden" }}>
                  <button
                    onClick={() => toggleExpanded(log.id)}
                    style={{
                      width: "100%",
                      display: "grid",
                      gridTemplateColumns: "220px 220px 1fr 36px",
                      gap: 10,
                      alignItems: "center",
                      textAlign: "left",
                      padding: "12px 14px",
                      background: isDark ? "#1e293b" : "#fff",
                      border: "none",
                      cursor: "pointer"
                    }}
                  >
                    <div>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: isDark ? "#94a3b8" : "#6B7280", fontSize: 12 }}>
                        <Calendar size={13} />
                        {`${relative} · ${absolute}`}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 30, height: 30, borderRadius: "50%", background: isDark ? "#334155" : "#E2E8F0", color: isDark ? "#f1f5f9" : "#0F172A", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700 }}>
                        {getInitials(log.userName)}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: isDark ? "#f1f5f9" : "#111827" }}>{log.userName}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ background: badge.bg, color: badge.text, border: `1px solid ${badge.border}`, borderRadius: 999, padding: "3px 8px", fontSize: 12, fontWeight: 700 }}>
                        {badge.label}
                      </span>
                      <span style={{ fontSize: 14, color: isDark ? "#f1f5f9" : "#111827" }}>{log.actionText}</span>
                    </div>
                    <div style={{ color: isDark ? "#94a3b8" : "#6B7280" }}>{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</div>
                  </button>

                  {isExpanded && (
                    <div style={{ borderTop: `1px solid ${isDark ? "#334155" : "#E5E7EB"}`, padding: "12px 14px", background: isDark ? "#0f172a" : "#FAFAFB" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                        <div>
                          <div style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#6B7280", marginBottom: 4 }}>Full action</div>
                          <div style={{ fontSize: 14, color: isDark ? "#f1f5f9" : "#111827" }}>{log.actionText}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#6B7280", marginBottom: 4 }}>What changed</div>
                          <div style={{ fontSize: 14, color: isDark ? "#f1f5f9" : "#111827" }}>{summarizeChange(log)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#6B7280", marginBottom: 4 }}>IP address</div>
                          <div style={{ fontSize: 14, color: isDark ? "#f1f5f9" : "#111827" }}>{log.ip_address || "Not captured"}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#6B7280", marginBottom: 4 }}>Affected resource</div>
                          {resourceUrl ? (
                            isDeleted ? (
                              <span style={{ fontSize: 14, color: "#9CA3AF" }}>This item was deleted</span>
                            ) : (
                              <a href={resourceUrl} style={{ fontSize: 14, color: "#2563EB", textDecoration: "none" }}>
                                View Task #{log.resourceId}
                              </a>
                            )
                          ) : (
                            <span style={{ fontSize: 14, color: "#9CA3AF" }}>No linked resource</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div style={{ ...cardStyle, marginTop: 10, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div style={{ color: isDark ? "#94a3b8" : "#6B7280", fontSize: 13 }}>
              Showing {pageStart}-{pageEnd} of {filtered.length} entries
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ border: `1px solid ${isDark ? "#475569" : "#D1D5DB"}`, padding: "6px 10px", borderRadius: 8, background: page === 1 ? (isDark ? "#334155" : "#F3F4F6") : (isDark ? "#0f172a" : "#fff"), color: isDark ? "#f1f5f9" : "#111827", cursor: page === 1 ? "not-allowed" : "pointer" }}
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .slice(Math.max(0, page - 3), Math.max(0, page - 3) + 5)
                .map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    style={{
                      border: `1px solid ${isDark ? "#475569" : "#D1D5DB"}`,
                      padding: "6px 10px",
                      borderRadius: 8,
                      background: p === page ? (isDark ? "#64748b" : "#111827") : (isDark ? "#0f172a" : "#fff"),
                      color: p === page ? "#fff" : (isDark ? "#f1f5f9" : "#111827"),
                      cursor: "pointer"
                    }}
                  >
                    {p}
                  </button>
                ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{
                  border: `1px solid ${isDark ? "#475569" : "#D1D5DB"}`,
                  padding: "6px 10px",
                  borderRadius: 8,
                  background: page === totalPages ? (isDark ? "#334155" : "#F3F4F6") : (isDark ? "#0f172a" : "#fff"),
                  color: isDark ? "#f1f5f9" : "#111827",
                  cursor: page === totalPages ? "not-allowed" : "pointer"
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
