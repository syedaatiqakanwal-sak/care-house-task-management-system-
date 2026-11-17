import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Moon,
  Phone,
  Search,
  Settings,
  Shield,
  Sun,
  User,
  Users
} from "lucide-react";
import api from "../../api";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { NotificationBell } from "./NotificationBell";

const NAV_ITEMS = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/tasks", label: "Tasks", icon: CheckSquare },
  { path: "/tasks/kanban", label: "Kanban", icon: Columns },
  { path: "/daily-report", label: "Daily Report", icon: ClipboardList },
  { path: "/calls", label: "Call Logs", icon: Phone },
  { path: "/emails", label: "Emails", icon: Mail },
  { path: "/messages", label: "Messages", icon: MessageSquare },
  { path: "/reports", label: "Reports", icon: BarChart3 },
  { path: "/notifications", label: "Notifications", icon: Bell }
];

const ADMIN_ITEMS = [
  { path: "/admin/users", label: "Users", icon: Users },
  { path: "/admin/roles", label: "Roles", icon: Shield },
  { path: "/admin/audit-logs", label: "Audit Logs", icon: FileText }
];

const SIDEBAR_WIDTH = 260;
const SIDEBAR_COLLAPSED_WIDTH = 70;

export function DashboardLayout({ children }) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const isDark = theme === "dark";

  const [searchQ, setSearchQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState({ tasks: [], users: [], messages: [] });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileDropdown, setProfileDropdown] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  const searchWrap = useRef(null);
  const dropdownRef = useRef(null);
  const searchTimer = useRef(null);

  const isMobile = useMemo(() => window.innerWidth < 768, []);
  const [mobileViewport, setMobileViewport] = useState(isMobile);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved != null) setSidebarCollapsed(JSON.parse(saved));
  }, []);

  useEffect(() => {
    const onResize = () => setMobileViewport(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", JSON.stringify(next));
      return next;
    });
  };

  const isActive = (path) => {
    if (path === "/tasks") return location.pathname === "/tasks";
    return location.pathname === path;
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isAdmin = user?.Role?.role_name === "Super Admin";

  const pageTitle = useMemo(() => {
    const p = location.pathname;
    const all = [...NAV_ITEMS, ...ADMIN_ITEMS, { path: "/profile", label: "My Profile" }, { path: "/profile/change-password", label: "Change Password" }, { path: "/tasks/new", label: "New Task" }];
    const hit = all.find((x) => x.path === p);
    if (hit) return hit.label;
    if (/^\/tasks\/\d+$/.test(p)) return "Task";
    return "Lets Care All";
  }, [location.pathname]);

  const breadcrumb = useMemo(() => {
    const p = location.pathname.split("/").filter(Boolean);
    return p.length ? `Home / ${p.join(" / ")}` : "Home / Dashboard";
  }, [location.pathname]);

  const runSearch = useCallback(async (q) => {
    const t = q.trim();
    if (t.length < 2) {
      setSearchResults({ tasks: [], users: [], messages: [] });
      return;
    }
    try {
      const { data } = await api.get("/search", { params: { q: t } });
      setSearchResults({
        tasks: data.tasks || [],
        users: data.users || [],
        messages: data.messages || []
      });
    } catch {
      setSearchResults({ tasks: [], users: [], messages: [] });
    }
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => runSearch(searchQ), 300);
    return () => clearTimeout(searchTimer.current);
  }, [searchQ, runSearch]);

  useEffect(() => {
    const fn = (e) => {
      if (searchWrap.current && !searchWrap.current.contains(e.target)) setSearchOpen(false);
    };
    document.addEventListener("click", fn);
    return () => document.removeEventListener("click", fn);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setProfileDropdown(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!mobileViewport) return;
    setMobileOpen(false);
  }, [location.pathname, mobileViewport]);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [user?.profile_pic]);

  const collapsed = !mobileViewport && sidebarCollapsed;
  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  const sidebarStyle = mobileViewport
    ? {
        width: SIDEBAR_WIDTH,
        transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
        left: 0,
        boxShadow: mobileOpen ? "8px 0 24px rgba(0,0,0,0.35)" : "none"
      }
    : {
        width: sidebarWidth,
        transform: "translateX(0)",
        left: 0
      };

  const contentMargin = mobileViewport ? 0 : sidebarWidth;
  const picUrl = user?.profile_pic
    ? user.profile_pic.startsWith("http")
      ? user.profile_pic
      : `${window.location.origin}${user.profile_pic}`
    : null;

  const renderNavItem = (item) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    return (
      <Link
        key={item.path}
        to={item.path}
        className="nav-item"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: collapsed ? "12px" : "10px 14px",
          borderRadius: 12,
          textDecoration: "none",
          marginBottom: 4,
          justifyContent: collapsed ? "center" : "flex-start",
          background: active ? "linear-gradient(135deg, var(--e-global-color-ada4927), var(--e-global-color-accent))" : "transparent",
          color: active ? "#fff" : "rgba(255,255,255,0.72)",
          fontSize: 13,
          fontWeight: active ? 700 : 500,
          transition: "all 0.2s ease",
          position: "relative"
        }}
      >
        <Icon size={18} />
        {!collapsed && <span>{item.label}</span>}
        {collapsed && !mobileViewport && (
          <span className="nav-tooltip" style={{ left: 62 }}>
            {item.label}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: isDark
          ? "var(--e-global-color-primary)"
          : "radial-gradient(#e2e8f0 1px, transparent 1px), var(--e-global-color-cd5e12d)",
        backgroundSize: isDark ? "auto" : "20px 20px",
        fontFamily: "Inter, system-ui, sans-serif"
      }}
    >
      {mobileViewport && mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            border: "none",
            zIndex: 150,
            backdropFilter: "blur(2px)",
            cursor: "pointer"
          }}
          aria-label="Close sidebar"
        />
      )}

      <aside
        style={{
          minHeight: "100vh",
          background: "linear-gradient(180deg, var(--e-global-color-54d32f6) 0%, var(--e-global-color-primary) 100%)",
          display: "flex",
          flexDirection: "column",
          position: "fixed",
          top: 0,
          bottom: 0,
          zIndex: 180,
          transition: "width 0.3s ease, transform 0.25s ease",
          ...sidebarStyle
        }}
      >
        {!mobileViewport && (
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            style={{
              position: "absolute",
              right: -12,
              top: "50%",
              transform: "translateY(-50%)",
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "var(--e-global-color-secondary)",
              border: "2px solid #fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 200,
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              color: "#fff"
            }}
          >
            {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>
        )}

        <div style={{ padding: collapsed ? "18px 12px" : "20px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          {!collapsed ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <img
                  src="/letscare-logo.png"
                  alt="Lets Care All"
                  style={{ width: 34, height: 34, objectFit: "contain", borderRadius: 8, background: "rgba(255,255,255,0.08)", padding: 2, flexShrink: 0 }}
                />
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    background: "linear-gradient(135deg, var(--e-global-color-ada4927), var(--e-global-color-57e21c1))",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent"
                  }}
                >
                  Lets Care All
                </div>
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>Premium Workspace</div>
            </>
          ) : (
            <img src="/letscare-logo.png" alt="Lets Care All" style={{ width: 30, height: 30, objectFit: "contain", display: "block", margin: "0 auto" }} />
          )}
        </div>

        <nav style={{ flex: 1, padding: "12px 8px", overflowY: "auto" }}>
          {NAV_ITEMS.map(renderNavItem)}
          {isAdmin && (
            <>
              {!collapsed && (
                <div
                  style={{
                    padding: "14px 12px 8px",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.45)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em"
                  }}
                >
                  Admin
                </div>
              )}
              {ADMIN_ITEMS.map(renderNavItem)}
            </>
          )}
        </nav>
      </aside>

      <div
        style={{
          marginLeft: contentMargin,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          transition: "margin-left 0.3s ease"
        }}
      >
        <header
          style={{
            height: 64,
            background: isDark ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.9)",
            borderBottom: `1px solid ${isDark ? "#334155" : "rgba(0,0,0,0.08)"}`,
            backdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: mobileViewport ? "0 14px" : "0 24px",
            position: "sticky",
            top: 0,
            zIndex: 140,
            gap: 12
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            {mobileViewport && (
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
                  background: isDark ? "#1e293b" : "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: isDark ? "#e2e8f0" : "#334155",
                  cursor: "pointer"
                }}
                aria-label="Open sidebar"
              >
                <Menu size={16} />
              </button>
            )}
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: isDark ? "#f1f5f9" : "#0f172a",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                }}
              >
                {pageTitle}
              </div>
              {!mobileViewport && <div style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#64748b" }}>{breadcrumb}</div>}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {!mobileViewport && (
              <div ref={searchWrap} style={{ position: "relative", width: 280 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: isDark ? "#0f172a" : "#f8fafc",
                    border: `1.5px solid ${isDark ? "#334155" : "#e2e8f0"}`,
                    borderRadius: 12,
                    padding: "8px 14px"
                  }}
                >
                  <Search size={16} color={isDark ? "#94a3b8" : "#94a3b8"} />
                  <input
                    placeholder="Search tasks & users..."
                    value={searchQ}
                    onFocus={() => setSearchOpen(true)}
                    onChange={(e) => {
                      setSearchQ(e.target.value);
                      setSearchOpen(true);
                    }}
                    style={{
                      border: "none",
                      background: "transparent",
                      outline: "none",
                      fontSize: 13,
                      color: isDark ? "#f1f5f9" : "#0f172a",
                      width: "100%"
                    }}
                  />
                </div>

                {searchOpen && (searchResults.tasks.length > 0 || searchResults.users.length > 0 || searchResults.messages.length > 0) && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 8px)",
                      right: 0,
                      left: 0,
                      background: isDark ? "#1e293b" : "#fff",
                      border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
                      borderRadius: 12,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                      maxHeight: 360,
                      overflowY: "auto",
                      zIndex: 160
                    }}
                  >
                    {searchResults.tasks.length > 0 && (
                      <div style={{ padding: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: isDark ? "#94a3b8" : "#64748b", padding: "4px 8px" }}>TASKS</div>
                        {searchResults.tasks.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              navigate(`/tasks/${t.id}`);
                              setSearchOpen(false);
                            }}
                            style={{
                              display: "block",
                              width: "100%",
                              textAlign: "left",
                              padding: "8px 10px",
                              border: "none",
                              background: "transparent",
                              cursor: "pointer",
                              borderRadius: 8,
                              color: isDark ? "#f1f5f9" : "#0f172a",
                              fontSize: 13
                            }}
                          >
                            {t.title}
                          </button>
                        ))}
                      </div>
                    )}
                    {searchResults.users.length > 0 && (
                      <div style={{ padding: 8, borderTop: `1px solid ${isDark ? "#334155" : "#f1f5f9"}` }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: isDark ? "#94a3b8" : "#64748b", padding: "4px 8px" }}>USERS</div>
                        {searchResults.users.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              navigate("/admin/users");
                              setSearchOpen(false);
                            }}
                            style={{
                              display: "block",
                              width: "100%",
                              textAlign: "left",
                              padding: "8px 10px",
                              border: "none",
                              background: "transparent",
                              cursor: "pointer",
                              borderRadius: 8,
                              color: isDark ? "#f1f5f9" : "#0f172a",
                              fontSize: 13
                            }}
                          >
                            {u.full_name} - {u.email}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setTheme(isDark ? "light" : "dark")}
              title={isDark ? "Light Mode" : "Dark Mode"}
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
                background: isDark ? "#1e293b" : "#f8fafc",
                color: isDark ? "#94a3b8" : "#64748b",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s",
                flexShrink: 0
              }}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <NotificationBell />

            <div ref={dropdownRef} style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setProfileDropdown((prev) => !prev)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "6px 10px",
                  borderRadius: 12,
                  border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
                  background: isDark ? "#1e293b" : "#f8fafc",
                  cursor: "pointer",
                  transition: "all 0.15s"
                }}
              >
                {picUrl && !avatarLoadFailed ? (
                  <img
                    src={picUrl}
                    alt={user?.full_name || "User"}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "2px solid var(--e-global-color-accent)",
                      flexShrink: 0
                    }}
                    onError={() => setAvatarLoadFailed(true)}
                  />
                ) : (
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, var(--e-global-color-ada4927), var(--e-global-color-accent))",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: 13,
                      flexShrink: 0,
                      border: "2px solid var(--e-global-color-accent)"
                    }}
                  >
                    {(user?.full_name?.[0] || "U").toUpperCase()}
                  </div>
                )}

                {!mobileViewport && (
                  <div style={{ textAlign: "left" }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: isDark ? "#f1f5f9" : "#0f172a",
                        lineHeight: 1.2,
                        whiteSpace: "nowrap"
                      }}
                    >
                      {user?.full_name || "User"}
                    </div>
                    <div style={{ fontSize: 11, color: isDark ? "#94a3b8" : "#64748b", lineHeight: 1.2 }}>
                      {user?.Role?.role_name || "Member"}
                    </div>
                  </div>
                )}

                <ChevronDown
                  size={14}
                  color={isDark ? "#94a3b8" : "#64748b"}
                  style={{
                    transform: profileDropdown ? "rotate(180deg)" : "rotate(0)",
                    transition: "transform 0.2s"
                  }}
                />
              </button>

              {profileDropdown && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    right: 0,
                    width: 200,
                    background: isDark ? "#1e293b" : "#fff",
                    borderRadius: 14,
                    boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
                    border: `1px solid ${isDark ? "#334155" : "rgba(0,0,0,0.08)"}`,
                    overflow: "hidden",
                    zIndex: 1000
                  }}
                >
                  <div
                    style={{
                      padding: "14px 16px",
                      borderBottom: `1px solid ${isDark ? "#334155" : "#f1f5f9"}`,
                      background: isDark ? "#0f172a" : "#f8fafc"
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? "#f1f5f9" : "#0f172a" }}>
                      {user?.full_name || "User"}
                    </div>
                    <div style={{ fontSize: 11, color: isDark ? "#94a3b8" : "#64748b", marginTop: 2 }}>
                      {user?.email || ""}
                    </div>
                  </div>

                  {[
                    {
                      icon: User,
                      label: "View Profile",
                      onClick: () => {
                        navigate("/profile");
                        setProfileDropdown(false);
                      }
                    },
                    {
                      icon: Settings,
                      label: "Change Password",
                      onClick: () => {
                        navigate("/profile/change-password");
                        setProfileDropdown(false);
                      }
                    }
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={item.onClick}
                      style={{
                        width: "100%",
                        padding: "11px 16px",
                        border: "none",
                        background: "transparent",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        cursor: "pointer",
                        fontSize: 13,
                        color: isDark ? "#cbd5e1" : "#374151",
                        fontWeight: 500,
                        textAlign: "left",
                        fontFamily: "inherit"
                      }}
                    >
                      <item.icon size={15} />
                      {item.label}
                    </button>
                  ))}

                  <div style={{ height: 1, background: isDark ? "#334155" : "#f1f5f9", margin: "4px 0" }} />

                  <button
                    type="button"
                    onClick={() => {
                      handleLogout();
                      setProfileDropdown(false);
                    }}
                    style={{
                      width: "100%",
                      padding: "11px 16px",
                      border: "none",
                      background: "transparent",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      cursor: "pointer",
                      fontSize: 13,
                      color: "#ef4444",
                      fontWeight: 600,
                      textAlign: "left",
                      fontFamily: "inherit"
                    }}
                  >
                    <LogOut size={15} />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main style={{ flex: 1, overflow: "auto", minWidth: 0 }} className="page-enter">
          {children}
        </main>

        <footer
          style={{
            borderTop: "1px solid rgba(255,255,255,0.25)",
            padding: "10px 24px",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            fontSize: "12px",
            color: "rgba(255,255,255,0.92)",
            flexWrap: "wrap",
            background: "rgba(2,6,23,0.28)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)"
          }}
        >
          <span>© {new Date().getFullYear()} Lets Care All Ltd. All rights reserved.</span>
          <a
            href="https://pk.linkedin.com/in/syeda-atiqa-kanwal-838490390"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Developer LinkedIn"
            style={{ color: "var(--e-global-color-9f4945d)", textDecoration: "none", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            <span style={{ color: "rgba(255,255,255,0.92)" }}>Developer</span>
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                background: "var(--e-global-color-f40ed66)",
                color: "var(--e-global-color-da70b5e)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 800,
                lineHeight: 1
              }}
            >
              in
            </span>
          </a>
        </footer>
      </div>
    </div>
  );
}
