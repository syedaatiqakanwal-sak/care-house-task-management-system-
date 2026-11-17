import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle, CheckSquare, Clock, RefreshCw, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../api";
import { useTheme } from "../../contexts/ThemeContext";

function MorningIcon({ color }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="5" fill={color} />
      <path d="M12 2.5V5M12 19V21.5M21.5 12H19M5 12H2.5M18.7 5.3L17 7M7 17L5.3 18.7M18.7 18.7L17 17M7 7L5.3 5.3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function AfternoonIcon({ color }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="10" r="4.5" fill={color} />
      <path d="M4 17.5H20" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 2.5V4.5M18.2 5.8L16.8 7.2M5.8 5.8L7.2 7.2M21 10H19M5 10H3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function EveningIcon({ color }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 16C6.2 12.5 9 11 12 11C15 11 17.8 12.5 20 16" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="8" r="3.2" fill={color} opacity="0.92" />
      <path d="M4 18.5H20" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function NightIcon({ color }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M16.8 14.2C14.2 14.2 12.1 12.1 12.1 9.5C12.1 7.9 12.9 6.4 14.2 5.5C13.5 5.3 12.8 5.2 12.1 5.2C8.5 5.2 5.5 8.1 5.5 11.8C5.5 15.4 8.5 18.4 12.1 18.4C15.8 18.4 18.7 15.4 18.7 11.8C18.7 11.1 18.6 10.4 18.4 9.7C17.5 13 16.8 14.2 16.8 14.2Z" fill={color} />
      <circle cx="18.2" cy="6.2" r="1.2" fill={color} />
    </svg>
  );
}

function getLondonDate() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/London" }));
}

export function DynamicDashboard() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [stats, setStats] = useState({
    totalTasks: 0,
    pendingTasks: 0,
    inProgressTasks: 0,
    completedTasks: 0,
    totalUsers: null
  });
  const [loading, setLoading] = useState(true);
  const [recentTasks, setRecentTasks] = useState([]);
  const [ukNow, setUkNow] = useState(getLondonDate);

  useEffect(() => {
    const updateClock = () => setUkNow(getLondonDate());
    updateClock();
    const timer = window.setInterval(updateClock, 60000);
    return () => window.clearInterval(timer);
  }, []);

  const greetingMeta = useMemo(() => {
    const hour = ukNow.getHours();
    if (hour >= 5 && hour < 12) {
      return {
        greeting: "Good morning",
        message: "Here's what needs your attention today.",
        accent: "#F59E0B",
        textColor: "#1E1E2E",
        mutedColor: "#6B7280",
        iconBg: "#FEF3C7",
        timeColor: "#F59E0B",
        Icon: MorningIcon
      };
    }
    if (hour >= 12 && hour < 17) {
      return {
        greeting: "Good afternoon",
        message: "Hope your day is going well. Here's your update.",
        accent: "#0F9B72",
        textColor: "#1E1E2E",
        mutedColor: "#6B7280",
        iconBg: "#D1FAE5",
        timeColor: "#0F9B72",
        Icon: AfternoonIcon
      };
    }
    if (hour >= 17 && hour < 21) {
      return {
        greeting: "Good evening",
        message: "Wrapping up for the day? Here's where things stand.",
        accent: "#7F77DD",
        textColor: "#1E1E2E",
        mutedColor: "#6B7280",
        iconBg: "#EDE9FE",
        timeColor: "#7F77DD",
        Icon: EveningIcon
      };
    }
    return {
      greeting: "Good night",
      message: "Working late? Here's a quick overview.",
      accent: "#1E1E2E",
      textColor: "#FFFFFF",
      mutedColor: "#D1D5DB",
      iconBg: "#374151",
      timeColor: "#FFFFFF",
      Icon: NightIcon
    };
  }, [ukNow]);

  const hasPermission = (key) => {
    const perms = user?.Role?.permissions || user?.Role?.Permissions || [];
    return user?.Role?.role_name === "Super Admin" || perms.some((p) => p.permission_key === key);
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const requests = [api.get("/tasks", { params: { limit: 200, page: 1 } })];
        if (hasPermission("users.view")) requests.push(api.get("/users"));
        const [taskRes, usersRes] = await Promise.all(requests);
        const data = taskRes.data;
        const tasks = Array.isArray(data) ? data : data.rows || [];
        const users = usersRes?.data;
        if (cancelled) return;
        setStats({
          totalTasks: tasks.length,
          pendingTasks: tasks.filter((t) => t.status === "pending").length,
          inProgressTasks: tasks.filter((t) => t.status === "in_progress").length,
          completedTasks: tasks.filter((t) => t.status === "completed").length,
          totalUsers: Array.isArray(users) ? users.length : null
        });
        setRecentTasks(tasks.slice(0, 5));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const statCards = useMemo(() => {
    const cards = [
      { label: "Total Tasks", value: stats.totalTasks, icon: CheckSquare, color: "#0F9B72", trend: "" },
      { label: "Pending", value: stats.pendingTasks, icon: Clock, color: "#F59E0B", trend: "" },
      { label: "In Progress", value: stats.inProgressTasks, icon: RefreshCw, color: "#378ADD", trend: "" },
      { label: "Completed", value: stats.completedTasks, icon: CheckCircle, color: "#1D9E75", trend: "" },
      { label: "Total Users", value: stats.totalUsers ?? "-", icon: Users, color: "#7F77DD", trend: "" }
    ];
    return cards;
  }, [stats]);

  const completionPct = useMemo(() => {
    if (!stats.totalTasks) return 0;
    return Math.round((stats.completedTasks / stats.totalTasks) * 100);
  }, [stats.completedTasks, stats.totalTasks]);

  const quickStats = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    const getDateFromTask = (task) => {
      const raw = task.due_date || task.dueDate || task.deadline || task.dueAt;
      if (!raw) return null;
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? null : d;
    };

    let dueToday = 0;
    let overdue = 0;
    let completedThisWeek = 0;
    const activeUsers = new Set();

    recentTasks.forEach((task) => {
      const due = getDateFromTask(task);
      const completedAtRaw = task.completed_at || task.completedAt || task.updatedAt || task.updated_at;
      const completedAt = completedAtRaw ? new Date(completedAtRaw) : null;
      const assigneeId = task.assigned_to || task.assignee_id || task.assignee?.id || task.user_id;

      if (due && due >= startOfToday && due <= endOfToday) dueToday += 1;
      if (due && due < startOfToday && (task.status || "") !== "completed") overdue += 1;
      if ((task.status || "") === "completed" && completedAt && !Number.isNaN(completedAt.getTime()) && completedAt >= startOfWeek) completedThisWeek += 1;
      if (assigneeId) activeUsers.add(String(assigneeId));
    });

    return { dueToday, overdue, completedThisWeek, activeUsersToday: activeUsers.size };
  }, [recentTasks]);

  const activityItems = useMemo(() => {
    return recentTasks.slice(0, 4).map((task) => {
      const actor = task.assignee?.full_name || user?.full_name || "A user";
      const action = task.status === "completed" ? "completed" : task.status === "in_progress" ? "updated" : "worked on";
      const title = task.title || "a task";
      const whenRaw = task.updatedAt || task.updated_at || task.createdAt || task.created_at;
      const when = whenRaw ? new Date(whenRaw) : null;
      const hoursAgo = when && !Number.isNaN(when.getTime()) ? Math.max(1, Math.round((Date.now() - when.getTime()) / (1000 * 60 * 60))) : null;
      return {
        id: task.id,
        text: `${actor} ${action} ${title}`,
        timeText: hoursAgo ? `${hoursAgo} hour${hoursAgo > 1 ? "s" : ""} ago` : "recently"
      };
    });
  }, [recentTasks, user?.full_name]);

  if (loading) {
    return (
      <div style={{ padding: 24, background: isDark ? "#0f172a" : "#F5F6FA", minHeight: "100vh" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 16 }} />)}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, background: isDark ? "#0f172a" : "#F5F6FA", minHeight: "100vh", fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <style>
        {`
          .dashboard-stat-grid {
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 12px;
          }
          .dashboard-lower-grid {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 12px;
            align-items: start;
          }
          .dashboard-greeting-card {
            display: flex;
            align-items: center;
            gap: 1.25rem;
            background: ${isDark ? "#1e293b" : "#FFFFFF"};
            border: 0.5px solid ${isDark ? "#334155" : "#E5E7EB"};
            border-radius: 16px;
            padding: 1.5rem 2rem;
            overflow: hidden;
            position: relative;
            margin-bottom: 14px;
          }
          @media (max-width: 1120px) {
            .dashboard-stat-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }
          @media (max-width: 820px) {
            .dashboard-greeting-card {
              flex-direction: column;
              align-items: flex-start;
            }
          }
          @media (max-width: 640px) {
            .dashboard-lower-grid {
              grid-template-columns: 1fr;
            }
          }
          @media (max-width: 480px) {
            .dashboard-stat-grid {
              grid-template-columns: 1fr;
            }
          }
        `}
      </style>

      <div className="dashboard-greeting-card">
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: greetingMeta.accent }} />

        <div style={{ width: 48, height: 48, borderRadius: "50%", background: greetingMeta.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginLeft: 4 }}>
          <greetingMeta.Icon color={greetingMeta.accent} />
        </div>

        <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 500, color: isDark ? "#f1f5f9" : greetingMeta.textColor }}>
            {greetingMeta.greeting}, <span style={{ color: "#0F9B72" }}>{user?.Role?.role_name || "Super Admin"}</span>
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: isDark ? "#94a3b8" : greetingMeta.mutedColor }}>
            {ukNow.toLocaleDateString("en-GB", { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: isDark ? "#94a3b8" : greetingMeta.mutedColor }}>
            {greetingMeta.message}
          </p>
        </div>

      </div>

      <div className="dashboard-stat-grid" style={{ marginBottom: 12 }}>
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} style={{ background: isDark ? "#1e293b" : "#FFFFFF", border: `0.5px solid ${isDark ? "#334155" : "#E5E7EB"}`, borderRadius: 12, padding: "1.25rem", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", right: 16, top: 14, fontSize: 12, color: isDark ? "#94a3b8" : "#86A38E" }}>
                {card.trend}
              </div>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${card.color}20`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <Icon size={16} color={card.color} />
              </div>
              <div style={{ fontSize: 32, fontWeight: 600, color: isDark ? "#f1f5f9" : "#1E1E2E", lineHeight: 1, marginBottom: 6 }}>{card.value}</div>
              <div style={{ fontSize: 13, color: isDark ? "#94a3b8" : "#6B7280", fontWeight: 500 }}>{card.label}</div>
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, background: card.color, borderRadius: "0 0 12px 12px" }} />
            </div>
          );
        })}
      </div>

      <div style={{ background: isDark ? "#1e293b" : "#FFFFFF", border: `0.5px solid ${isDark ? "#334155" : "#E5E7EB"}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr auto", gap: 12, alignItems: "center" }}>
          <div style={{ color: isDark ? "#f1f5f9" : "#1E1E2E", fontSize: 14, fontWeight: 500 }}>Overall completion</div>
          <div style={{ background: isDark ? "#334155" : "#E5E7EB", borderRadius: 999, height: 10, overflow: "hidden" }}>
            <div style={{ width: `${completionPct}%`, height: "100%", background: "#0F9B72", borderRadius: 999 }} />
          </div>
          <div style={{ color: isDark ? "#f1f5f9" : "#1E1E2E", fontSize: 13, fontWeight: 500 }}>{completionPct}% complete</div>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: isDark ? "#94a3b8" : "#6B7280" }}>
          {stats.pendingTasks} pending · {stats.inProgressTasks} in progress · {stats.completedTasks} completed
        </div>
      </div>

      <div className="dashboard-lower-grid">
        <div style={{ background: isDark ? "#1e293b" : "#FFFFFF", border: `0.5px solid ${isDark ? "#334155" : "#E5E7EB"}`, borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h2 style={{ fontSize: 16, fontWeight: 500, color: isDark ? "#f1f5f9" : "#1E1E2E", margin: 0 }}>Recent Tasks</h2>
            <Link to="/tasks" style={{ color: "#0F9B72", fontSize: 13, textDecoration: "none", fontWeight: 500 }}>
              View all →
            </Link>
          </div>
          {recentTasks.length === 0 ? (
            <div style={{ textAlign: "center", color: isDark ? "#94a3b8" : "#6B7280", fontSize: 14, padding: "28px 0" }}>
              <AlertCircle size={20} style={{ marginBottom: 8 }} />
              <div>No tasks yet. Create your first task!</div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {recentTasks.map((task) => {
                const priority = (task.priority || "low").toLowerCase();
                const status = (task.status || "").toLowerCase();
                const statusLabel = status.replace(/_/g, " ") || "pending";
                const source = task.source || "manual";
                const dueRaw = task.due_date || task.dueDate || task.deadline || task.dueAt;
                const dueDate = dueRaw ? new Date(dueRaw) : null;
                const isOverdue = dueDate && !Number.isNaN(dueDate.getTime()) && dueDate < new Date() && status !== "completed";
                const dueText =
                  dueDate && !Number.isNaN(dueDate.getTime())
                    ? dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                    : "No due date";

                const priorityAccent =
                  priority === "urgent" ? "#DC2626" : priority === "medium" ? "#F59E0B" : "#9CA3AF";
                const priorityPillBg =
                  priority === "urgent" ? "#FEE2E2" : priority === "medium" ? "#FEF3C7" : "#F3F4F6";
                const priorityPillText =
                  priority === "urgent" ? "#B91C1C" : priority === "medium" ? "#92400E" : "#6B7280";

                const statusPillBg =
                  status === "completed" ? "#DCFCE7" : status === "in_progress" ? "#DBEAFE" : "#F3F4F6";
                const statusPillText =
                  status === "completed" ? "#166534" : status === "in_progress" ? "#1D4ED8" : "#6B7280";

                return (
                  <div
                    key={task.id}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      overflow: "hidden",
                      background: isDark ? "#0f172a" : "#FFFFFF",
                      border: `0.5px solid ${isDark ? "#334155" : "#E5E7EB"}`,
                      borderRadius: 10,
                      padding: "12px 16px",
                      display: "flex",
                      alignItems: "center",
                      gap: 10
                    }}
                  >
                    <div style={{ width: 3, height: 26, background: priorityAccent, borderRadius: 999, flexShrink: 0 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: isDark ? "#f1f5f9" : "#1E1E2E", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {task.title}
                      </div>
                    </div>
                    <span style={{ background: isDark ? "#334155" : "#F3F4F6", color: isDark ? "#cbd5e1" : "#6B7280", borderRadius: 999, padding: "3px 8px", fontSize: 11, fontWeight: 500, flexShrink: 0 }}>
                      {source}
                    </span>
                    <span style={{ background: priorityPillBg, color: priorityPillText, borderRadius: 999, padding: "3px 8px", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                      {priority[0]?.toUpperCase() + priority.slice(1)}
                    </span>
                    <div style={{ fontSize: 13, color: isDark ? "#cbd5e1" : "#374151", whiteSpace: "nowrap", flexShrink: 0 }}>
                      {(task.assignee?.full_name || task.assigned_to_name || "Unassigned")}
                    </div>
                    <span style={{ background: statusPillBg, color: statusPillText, borderRadius: 999, padding: "3px 8px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>
                      {statusLabel}
                    </span>
                    <div style={{ marginLeft: "auto", fontSize: 12, color: dueDate ? (isOverdue ? "#E24B4A" : "#6B7280") : "#9CA3AF", whiteSpace: "nowrap", flexShrink: 0 }}>
                      {dueText}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ background: isDark ? "#1e293b" : "#FFFFFF", border: `0.5px solid ${isDark ? "#334155" : "#E5E7EB"}`, borderRadius: 12, padding: 14 }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 500, color: isDark ? "#f1f5f9" : "#1E1E2E" }}>Quick Stats</h3>
          <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
            {[
              { label: "Tasks due today", value: quickStats.dueToday, color: "#F59E0B" },
              { label: "Tasks overdue", value: quickStats.overdue, color: "#DC2626" },
              { label: "Tasks completed this week", value: quickStats.completedThisWeek, color: "#1D9E75" },
              { label: "Active users today", value: quickStats.activeUsersToday, color: "#378ADD" }
            ].map((item) => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                  <span style={{ color: isDark ? "#94a3b8" : "#6B7280", fontSize: 13 }}>{item.label}</span>
                </div>
                <span style={{ color: item.color, fontWeight: 700, fontSize: 14 }}>{item.value}</span>
              </div>
            ))}
          </div>

          <h4 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 500, color: isDark ? "#f1f5f9" : "#1E1E2E" }}>Recent Activity</h4>
          <div style={{ display: "grid", gap: 8 }}>
            {activityItems.length === 0 ? (
              <div style={{ color: isDark ? "#94a3b8" : "#9CA3AF", fontSize: 12 }}>No recent activity</div>
            ) : (
              activityItems.map((item) => (
                <div key={item.id} style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#6B7280", lineHeight: 1.45 }}>
                  <span style={{ color: isDark ? "#e2e8f0" : "#374151" }}>{item.text}</span> · {item.timeText}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
