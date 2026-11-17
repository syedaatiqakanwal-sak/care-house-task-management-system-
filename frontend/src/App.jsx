import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "./contexts/AuthContext";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { DynamicDashboard } from "./pages/dashboard/DynamicDashboard";
import TaskList from "./pages/tasks/TaskList";
import KanbanBoard from "./pages/tasks/KanbanBoard";
import TaskDetail from "./pages/tasks/TaskDetail";
import { CreateTask } from "./pages/tasks/CreateTask";
import CallLogs from "./pages/calls/CallLogs";
import EmailLogs from "./pages/emails/EmailLogs";
import Inbox from "./pages/messages/Inbox";
import Reports from "./pages/reports/Reports";
import DailyReport from "./pages/reports/DailyReport";
import NotificationsPage from "./pages/notifications/NotificationsPage";
import UsersAdmin from "./pages/admin/UsersAdmin";
import RolesAdmin from "./pages/admin/RolesAdmin";
import AuditLogs from "./pages/admin/AuditLogs";
import Profile from "./pages/profile/Profile";
import { ForgotPassword } from "./pages/auth/ForgotPassword";
import { ResetPassword } from "./pages/auth/ResetPassword";

const LOGIN_SLIDES = [
  "/login-slides/slide-1.png",
  "/login-slides/slide-2.png",
  "/login-slides/slide-3.png",
  "/login-slides/slide-4.png",
  "/login-slides/slide-5.png"
];

function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [slideIndex, setSlideIndex] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (LOGIN_SLIDES.length <= 1) return undefined;
    const t = window.setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % LOGIN_SLIDES.length);
    }, 5000);
    return () => window.clearInterval(t);
  }, []);

  if (isAuthenticated) {
    const next = location.state?.from?.pathname || "/dashboard";
    return <Navigate to={next} replace />;
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await login(email, password);
      if (result?.requiresTwoFactor) {
        setError("2FA verification is required and not yet wired in this recovery build.");
      } else {
        navigate(location.state?.from?.pathname || "/dashboard", { replace: true });
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", position: "relative", overflow: "hidden", display: "grid", placeItems: "center", padding: 20 }}>
      {LOGIN_SLIDES.map((slide, idx) => (
        <div
          key={slide}
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url("${slide}")`,
            backgroundSize: "cover",
            backgroundPosition: "center top",
            transition: "opacity 1s ease",
            opacity: slideIndex === idx ? 1 : 0
          }}
        />
      ))}

      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(100deg, rgba(2,6,23,0.72) 0%, rgba(2,6,23,0.58) 38%, rgba(2,6,23,0.38) 100%)" }} />

      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 1200, display: "flex", justifyContent: "space-between", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ color: "#fff", maxWidth: 560 }}>
          <img
            src="/lca-logo.webp"
            alt="Lets Care All Logo"
            style={{ width: 130, height: 130, objectFit: "contain", marginBottom: 14 }}
          />
          <h1 style={{ margin: 0, fontSize: "clamp(34px, 6vw, 62px)", lineHeight: 1.02, fontWeight: 800 }}>Welcome to Lets Care All</h1>
          <p style={{ margin: "12px 0 0", fontSize: 22, fontWeight: 500, opacity: 0.95 }}>Your smart task management system for teams, assignments, and progress tracking.</p>
        </div>

        <form
          onSubmit={onSubmit}
          style={{
            width: "100%",
            maxWidth: 420,
            background: "rgba(255,255,255,0.12)",
            borderRadius: 16,
            padding: 24,
            border: "1px solid rgba(255,255,255,0.35)",
            boxShadow: "0 18px 50px rgba(2,6,23,0.35)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)"
          }}
        >
          <h2 style={{ margin: 0, fontSize: 26, color: "#fff", fontWeight: 800 }}>Sign In</h2>
          <p style={{ margin: "6px 0 18px", color: "rgba(255,255,255,0.9)", fontSize: 13 }}>Access your Lets Care All workspace</p>

          <label style={{ display: "grid", gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: "#f8fafc", fontWeight: 700 }}>Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.45)", fontSize: 14, color: "#fff", background: "rgba(15,23,42,0.33)", outline: "none" }} />
          </label>

          <label style={{ display: "grid", gap: 6, marginBottom: 14 }}>
            <span style={{ fontSize: 12, color: "#f8fafc", fontWeight: 700 }}>Password</span>
            <div style={{ position: "relative" }}>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                type={showPassword ? "text" : "password"}
                style={{ width: "100%", padding: "10px 40px 10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.45)", fontSize: 14, color: "#fff", background: "rgba(15,23,42,0.33)", outline: "none", boxSizing: "border-box" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", cursor: "pointer", padding: 0, color: "rgba(248,250,252,0.85)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
              >
                {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
          </label>

          {error && <div style={{ color: "#fecaca", fontSize: 12, marginBottom: 12, fontWeight: 700 }}>{error}</div>}

          <button type="submit" disabled={loading} style={{ width: "100%", border: "none", borderRadius: 10, padding: "11px 14px", color: "var(--e-global-color-da70b5e)", background: "linear-gradient(135deg, var(--e-global-color-ada4927), var(--e-global-color-accent))", fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>

      <footer
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 2,
          borderTop: "1px solid rgba(255,255,255,0.25)",
          background: "rgba(2,6,23,0.28)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)"
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
            padding: "10px 24px",
            boxSizing: "border-box",
            color: "rgba(255,255,255,0.92)",
            fontSize: 12,
            margin: 0
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
        </div>
      </footer>
    </div>
  );
}

function AppShell() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <Routes>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DynamicDashboard />} />
          <Route path="/tasks" element={<TaskList />} />
          <Route path="/tasks/create" element={<CreateTask />} />
          <Route path="/tasks/new" element={<CreateTask />} />
          <Route path="/tasks/kanban" element={<KanbanBoard />} />
          <Route path="/tasks/:id" element={<TaskDetail />} />
          <Route path="/calls" element={<CallLogs />} />
          <Route path="/emails" element={<EmailLogs />} />
          <Route path="/messages" element={<Inbox />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/daily-report" element={<DailyReport />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/admin/users" element={<UsersAdmin />} />
          <Route path="/admin/roles" element={<RolesAdmin />} />
          <Route path="/admin/audit-logs" element={<AuditLogs />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/change-password" element={<Profile />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/*" element={<AppShell />} />
    </Routes>
  );
}
