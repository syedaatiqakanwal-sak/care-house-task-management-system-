import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Bell, Camera, Eye, EyeOff, Lock, Mail, Shield, User } from "lucide-react";
import api from "../../api";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useToast } from "../../components/common/Toast";
import {
  ensurePushSubscription,
  notificationSupport,
  requestNotificationPermission,
  unsubscribePush
} from "../../utils/desktopNotifications";

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const location = useLocation();
  const isChangePasswordRoute = location.pathname === "/profile/change-password";
  const isDark = theme === "dark";
  const inputRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: ""
  });
  const [passwordErrors, setPasswordErrors] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: ""
  });
  const [showPassword, setShowPassword] = useState({
    currentPassword: false,
    newPassword: false,
    confirmNewPassword: false
  });
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: ""
  });
  const [notifPrefs, setNotifPrefs] = useState({
    desktop_notifications_enabled: true,
    notification_sound_enabled: true,
    notification_preview_enabled: true,
    notify_direct_messages: true,
    notify_group_messages: true
  });
  const [notifSaving, setNotifSaving] = useState(false);
  const browserNotif = useMemo(() => notificationSupport(), []);

  useEffect(() => {
    setForm({
      full_name: user?.full_name || "",
      email: user?.email || "",
      phone: user?.phone || ""
    });
    setNotifPrefs({
      desktop_notifications_enabled: user?.desktop_notifications_enabled !== false,
      notification_sound_enabled: user?.notification_sound_enabled !== false,
      notification_preview_enabled: user?.notification_preview_enabled !== false,
      notify_direct_messages: user?.notify_direct_messages !== false,
      notify_group_messages: user?.notify_group_messages !== false
    });
  }, [user]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put("/auth/me", { full_name: form.full_name, phone: form.phone });
      await refreshUser();
    } catch {
      // Keep UX quiet for now.
    } finally {
      setSaving(false);
    }
  };

  const saveNotificationPrefs = async (nextPrefs) => {
    setNotifSaving(true);
    try {
      await api.put("/auth/me", nextPrefs);
      await refreshUser();
      if (nextPrefs.desktop_notifications_enabled) {
        const permission = await requestNotificationPermission();
        if (permission === "granted") await ensurePushSubscription(nextPrefs);
      } else {
        await unsubscribePush();
      }
      showToast("Notification preferences saved", "success");
    } catch {
      showToast("Failed to save notification preferences", "error");
    } finally {
      setNotifSaving(false);
    }
  };

  const onPickFile = () => inputRef.current?.click();
  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("profile_pic", file);
    try {
      await api.post("/auth/profile-pic", fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      await refreshUser();
    } catch {
      // Keep UX resilient if endpoint differs.
    } finally {
      e.target.value = "";
    }
  };

  const picUrl = user?.profile_pic
    ? user.profile_pic.startsWith("http")
      ? user.profile_pic
      : `${window.location.origin}${user.profile_pic}`
    : null;

  const onPasswordSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = { currentPassword: "", newPassword: "", confirmNewPassword: "" };
    if (!passwords.currentPassword.trim()) nextErrors.currentPassword = "Current password is required";
    if (passwords.newPassword.length < 8) nextErrors.newPassword = "Password must be at least 8 characters";
    if (passwords.newPassword !== passwords.confirmNewPassword) nextErrors.confirmNewPassword = "Passwords do not match";
    setPasswordErrors(nextErrors);
    if (nextErrors.currentPassword || nextErrors.newPassword || nextErrors.confirmNewPassword) return;

    setPasswordSaving(true);
    try {
      await api.patch("/auth/change-password", {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword
      });
      setPasswords({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
      setPasswordErrors({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
      showToast("Password updated successfully", "success");
    } catch (err) {
      if (err?.response?.data?.message === "Current password is incorrect") {
        setPasswordErrors((p) => ({ ...p, currentPassword: "Current password is incorrect" }));
      } else {
        setPasswordErrors((p) => ({ ...p, currentPassword: err?.response?.data?.message || "Failed to update password" }));
      }
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22, color: isDark ? "#f1f5f9" : "#0f172a", fontWeight: 800 }}>{isChangePasswordRoute ? "Change Password" : "My Profile"}</h1>
        <p style={{ margin: "6px 0 0", color: isDark ? "#94a3b8" : "#64748b", fontSize: 13 }}>
          {isChangePasswordRoute ? "Update your password to keep your account secure." : "Update personal details and account settings."}
        </p>
      </div>

      {!isChangePasswordRoute ? (
        <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 14 }}>
          <div style={{ background: isDark ? "#1e293b" : "#fff", border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, borderRadius: 16, padding: 18 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              {picUrl ? (
                <img src={picUrl} alt={user?.full_name || "User"} style={{ width: 112, height: 112, borderRadius: "50%", objectFit: "cover", border: "3px solid #0D9488" }} />
              ) : (
                <div style={{ width: 112, height: 112, borderRadius: "50%", background: "linear-gradient(135deg, #0D9488, #0F766E)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, fontWeight: 800 }}>
                  {(user?.full_name?.[0] || "U").toUpperCase()}
                </div>
              )}
              <button type="button" onClick={onPickFile} style={{ marginTop: 12, border: "none", borderRadius: 9, background: isDark ? "#334155" : "#f1f5f9", color: isDark ? "#e2e8f0" : "#334155", padding: "8px 12px", display: "inline-flex", alignItems: "center", gap: 7, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                <Camera size={14} /> Change photo
              </button>
              <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onUpload} />
              <div style={{ marginTop: 14, color: isDark ? "#f1f5f9" : "#0f172a", fontWeight: 700 }}>{user?.full_name || "User"}</div>
              <div style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: 12, marginTop: 3 }}>{user?.Role?.role_name || "Member"}</div>
            </div>
          </div>

          <form onSubmit={onSubmit} style={{ background: isDark ? "#1e293b" : "#fff", border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, borderRadius: 16, padding: 18 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#64748b", fontWeight: 700 }}>Full Name</span>
                <div style={{ position: "relative" }}>
                  <User size={14} style={{ position: "absolute", left: 10, top: 11, color: isDark ? "#94a3b8" : "#64748b" }} />
                  <input value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} style={{ width: "100%", padding: "10px 12px 10px 31px", borderRadius: 9, border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a", fontSize: 13 }} />
                </div>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#64748b", fontWeight: 700 }}>Email</span>
                <div style={{ position: "relative" }}>
                  <Mail size={14} style={{ position: "absolute", left: 10, top: 11, color: isDark ? "#94a3b8" : "#64748b" }} />
                  <input value={form.email} disabled style={{ width: "100%", padding: "10px 12px 10px 31px", borderRadius: 9, border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`, background: isDark ? "#0b1220" : "#f8fafc", color: isDark ? "#94a3b8" : "#64748b", fontSize: 13 }} />
                </div>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#64748b", fontWeight: 700 }}>Phone</span>
                <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a", fontSize: 13 }} />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#64748b", fontWeight: 700 }}>Role</span>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 9, border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`, background: isDark ? "#0b1220" : "#f8fafc", color: isDark ? "#cbd5e1" : "#334155", fontSize: 13 }}>
                  <Shield size={14} />
                  {user?.Role?.role_name || "Member"}
                </div>
              </label>
            </div>

            <div style={{ marginTop: 16 }}>
              <button type="submit" disabled={saving} style={{ border: "none", background: "linear-gradient(135deg, #0D9488, #0F766E)", color: "#fff", borderRadius: 10, padding: "10px 14px", display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
          </div>

          <div style={{ background: isDark ? "#1e293b" : "#fff", border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, borderRadius: 16, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Bell size={16} color="#0D9488" />
              <h2 style={{ margin: 0, fontSize: 16, color: isDark ? "#f1f5f9" : "#0f172a", fontWeight: 800 }}>Desktop notifications</h2>
            </div>
            <p style={{ margin: "0 0 12px", color: isDark ? "#94a3b8" : "#64748b", fontSize: 12 }}>
              Browser permission:{" "}
              <strong>
                {!browserNotif.supported
                  ? "Not supported"
                  : browserNotif.permission === "granted"
                    ? "Enabled"
                    : browserNotif.permission === "denied"
                      ? "Permission denied"
                      : "Not enabled yet"}
              </strong>
              {browserNotif.permission === "denied" ? ". Enable notifications in your browser site settings for this domain." : ""}
            </p>
            {[
              { key: "desktop_notifications_enabled", label: "Enable desktop notifications" },
              { key: "notification_preview_enabled", label: "Show message preview in notifications" },
              { key: "notification_sound_enabled", label: "Notification sound (where supported)" },
              { key: "notify_direct_messages", label: "Direct message notifications" },
              { key: "notify_group_messages", label: "Group message notifications" }
            ].map((item) => (
              <label key={item.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: `1px solid ${isDark ? "#334155" : "#f1f5f9"}`, color: isDark ? "#f1f5f9" : "#0f172a", fontSize: 13 }}>
                <span>{item.label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(notifPrefs[item.key])}
                  disabled={notifSaving}
                  onChange={(e) => {
                    const next = { ...notifPrefs, [item.key]: e.target.checked };
                    setNotifPrefs(next);
                    saveNotificationPrefs(next);
                  }}
                />
              </label>
            ))}
          </div>
        </div>
      ) : (
        <div
          id="change-password"
          style={{ background: isDark ? "#1e293b" : "#fff", border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, borderRadius: 16, padding: 18 }}
        >
          <h2 style={{ margin: 0, fontSize: 18, color: isDark ? "#f1f5f9" : "#0f172a", fontWeight: 800 }}>Change Password</h2>
          <p style={{ margin: "6px 0 0", color: isDark ? "#94a3b8" : "#64748b", fontSize: 13 }}>Update your password to keep your account secure.</p>

          <form onSubmit={onPasswordSubmit} style={{ marginTop: 14, display: "grid", gap: 12, maxWidth: 540 }}>
            {[
              { key: "currentPassword", label: "Current Password" },
              { key: "newPassword", label: "New Password" },
              { key: "confirmNewPassword", label: "Confirm New Password" }
            ].map((field) => (
              <label key={field.key} style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#64748b", fontWeight: 700 }}>{field.label}</span>
                <div style={{ position: "relative" }}>
                  <Lock size={14} style={{ position: "absolute", left: 10, top: 11, color: isDark ? "#94a3b8" : "#64748b" }} />
                  <input
                    type={showPassword[field.key] ? "text" : "password"}
                    value={passwords[field.key]}
                    onChange={(e) => {
                      const value = e.target.value;
                      setPasswords((p) => ({ ...p, [field.key]: value }));
                      if (field.key === "confirmNewPassword" || field.key === "newPassword") {
                        setPasswordErrors((p) => ({
                          ...p,
                          confirmNewPassword:
                            field.key === "confirmNewPassword"
                              ? ""
                              : p.confirmNewPassword && value !== passwords.confirmNewPassword
                                ? "Passwords do not match"
                                : ""
                        }));
                      }
                    }}
                    style={{ width: "100%", padding: "10px 40px 10px 31px", borderRadius: 9, border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a", fontSize: 13 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => ({ ...p, [field.key]: !p[field.key] }))}
                    style={{ position: "absolute", right: 8, top: 7, border: "none", background: "transparent", color: isDark ? "#94a3b8" : "#64748b", cursor: "pointer", padding: 4 }}
                  >
                    {showPassword[field.key] ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {passwordErrors[field.key] ? (
                  <span style={{ color: "#dc2626", fontSize: 12, fontWeight: 600 }}>{passwordErrors[field.key]}</span>
                ) : null}
              </label>
            ))}

            <div>
              <button type="submit" disabled={passwordSaving} style={{ border: "none", background: "linear-gradient(135deg, #0D9488, #0F766E)", color: "#fff", borderRadius: 10, padding: "10px 14px", display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13, cursor: passwordSaving ? "not-allowed" : "pointer", opacity: passwordSaving ? 0.7 : 1 }}>
                {passwordSaving ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
