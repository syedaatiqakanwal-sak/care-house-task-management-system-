import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Pencil, Plus, Search, Shield, Trash2, Users, X } from "lucide-react";
import api from "../../api";
import { useTheme } from "../../contexts/ThemeContext";
import { useToast } from "../../components/common/Toast";
import { useAuth } from "../../contexts/AuthContext";

const emptyForm = {
  full_name: "",
  email: "",
  phone: "",
  role_id: "",
  password: "",
  status: "active",
  force_password_change: true
};

export default function UsersAdmin() {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const { user: currentUser } = useAuth();
  const isDark = theme === "dark";
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadUsers = useCallback(async () => {
    const { data } = await api.get("/users");
    const rows = Array.isArray(data) ? data : data.rows || data.data || [];
    setUsers(rows);
  }, []);

  const loadRoles = useCallback(async () => {
    const { data } = await api.get("/roles");
    const rows = Array.isArray(data) ? data : data.rows || data.data || [];
    setRoles(rows);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadUsers(), loadRoles()]);
    } catch {
      setUsers([]);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, [loadUsers, loadRoles]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(
    () =>
      users.filter((u) => {
        const q = query.toLowerCase();
        return (
          !q ||
          String(u.full_name || "").toLowerCase().includes(q) ||
          String(u.email || "").toLowerCase().includes(q) ||
          String(u.Role?.role_name || u.role_name || "").toLowerCase().includes(q)
        );
      }),
    [users, query]
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({
      full_name: u.full_name || "",
      email: u.email || "",
      phone: u.phone || "",
      role_id: String(u.role_id || u.Role?.id || ""),
      password: "",
      status: u.status || "active",
      force_password_change: !!u.force_password_change
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.email.trim() || !form.role_id) return;
    setSaving(true);
    try {
      const payload = {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        role_id: Number(form.role_id),
        status: form.status,
        force_password_change: !!form.force_password_change
      };
      if (form.password.trim()) payload.password = form.password.trim();
      if (!editing && !payload.password) payload.password = "ChangeMe@123";

      if (editing) await api.put(`/users/${editing.id}`, payload);
      else await api.post("/users", payload);

      showToast(editing ? "User updated" : "User created", "success");
      setShowModal(false);
      await loadUsers();
    } catch (err) {
      showToast("Failed to save user", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u) => {
    const userId = u?.id ?? u?._id ?? u?.userId;
    console.log("Delete user clicked, userId:", userId, u);
    if (!userId) {
      showToast("Invalid user id", "error");
      return;
    }
    if (!window.confirm(`Delete user "${u.full_name}"?`)) return;
    try {
      await api.delete(`/users/${userId}`);
      setUsers((prev) => prev.filter((x) => (x?.id ?? x?._id ?? x?.userId) !== userId));
      showToast("User deleted successfully", "success");
    } catch (err) {
      console.error("Failed to delete user:", {
        userId,
        message: err?.message,
        response: err?.response?.data
      });
      const serverMessage =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to delete user";
      showToast(serverMessage, "error");
    }
  };

  const handleToggleAccess = async (u) => {
    try {
      const { data } = await api.patch(`/users/${u.id}/toggle-access`);
      const isActive = !!data?.is_active;
      setUsers((prev) =>
        prev.map((item) =>
          item.id === u.id
            ? {
                ...item,
                status: isActive ? "active" : "inactive",
                is_active: isActive
              }
            : item
        )
      );
      showToast(isActive ? "User access restored" : "User access blocked", "success");
    } catch (err) {
      showToast(err?.response?.data?.error || "Failed to update user access", "error");
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: isDark ? "#f1f5f9" : "#0f172a", fontWeight: 800 }}>Users Administration</h1>
          <p style={{ margin: "6px 0 0", color: isDark ? "#94a3b8" : "#64748b", fontSize: 13 }}>Manage team members and access levels.</p>
        </div>
        <button type="button" onClick={openCreate} style={{ border: "none", borderRadius: 10, background: "linear-gradient(135deg, #0D9488, #0F766E)", color: "#fff", padding: "10px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Plus size={16} /> Add User
        </button>
      </div>

      <div style={{ background: isDark ? "#1e293b" : "#fff", border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, borderRadius: 14, padding: 12, marginBottom: 14 }}>
        <div style={{ position: "relative", maxWidth: 360 }}>
          <Search size={15} style={{ position: "absolute", left: 10, top: 11, color: isDark ? "#94a3b8" : "#64748b" }} />
          <input placeholder="Search users..." value={query} onChange={(e) => setQuery(e.target.value)} style={{ width: "100%", padding: "10px 12px 10px 32px", borderRadius: 9, border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a", fontSize: 13 }} />
        </div>
      </div>

      <div style={{ background: isDark ? "#1e293b" : "#fff", borderRadius: 14, border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 14 }}>{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 54, borderRadius: 8, marginBottom: 10 }} />)}</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 44, color: isDark ? "#94a3b8" : "#64748b" }}>
            <Users size={22} style={{ marginBottom: 8 }} />
            <div>No users found.</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: isDark ? "#0f172a" : "#f8fafc", textAlign: "left" }}>
                  {["Name", "Email", "Role", "Status", "Actions"].map((h) => (
                    <th key={h} style={{ padding: "12px 14px", fontSize: 12, color: isDark ? "#94a3b8" : "#64748b", fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, idx) => (
                  <tr key={u.id || idx} style={{ borderTop: `1px solid ${isDark ? "#334155" : "#f1f5f9"}` }}>
                    <td style={{ padding: "12px 14px", color: isDark ? "#f1f5f9" : "#0f172a", fontWeight: 600 }}>{u.full_name || "-"}</td>
                    <td style={{ padding: "12px 14px", color: isDark ? "#cbd5e1" : "#334155", fontSize: 13 }}>{u.email || "-"}</td>
                    <td style={{ padding: "12px 14px", color: isDark ? "#cbd5e1" : "#334155", fontSize: 13 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <Shield size={13} /> {u.Role?.role_name || u.role_name || "-"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ background: u.status === "inactive" ? "#fef2f2" : "#ecfdf5", color: u.status === "inactive" ? "#991b1b" : "#065f46", borderRadius: 999, padding: "4px 9px", fontSize: 11, fontWeight: 700 }}>
                        {u.status || "active"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "inline-flex", gap: 6 }}>
                        {u.id !== currentUser?.id ? (
                          <button
                            type="button"
                            onClick={() => handleToggleAccess(u)}
                            title={u.status === "active" ? "Click to block dashboard access" : "Click to restore dashboard access"}
                            style={{
                              border: "1px solid",
                              borderColor: u.status === "active" ? "#99f6e4" : "#fecaca",
                              color: u.status === "active" ? "#0f766e" : "#dc2626",
                              background: u.status === "active" ? "#f0fdfa" : "#fef2f2",
                              borderRadius: 8,
                              padding: "5px 8px",
                              cursor: "pointer"
                            }}
                          >
                            {u.status === "active" ? <Eye size={13} /> : <EyeOff size={13} />}
                          </button>
                        ) : null}
                        <button type="button" onClick={() => openEdit(u)} style={{ border: "1px solid #bfdbfe", color: "#1d4ed8", background: "#eff6ff", borderRadius: 8, padding: "5px 8px", cursor: "pointer" }}>
                          <Pencil size={13} />
                        </button>
                        {u.Role?.role_name === "Super Admin" || u.role_name === "Super Admin" ? null : (
                          <button type="button" onClick={() => handleDelete(u)} style={{ border: "1px solid #fecaca", color: "#dc2626", background: "#fef2f2", borderRadius: 8, padding: "5px 8px", cursor: "pointer" }}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 560, background: isDark ? "#1e293b" : "#fff", borderRadius: 16, border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ color: isDark ? "#f1f5f9" : "#0f172a" }}>{editing ? "Edit User" : "Create User"}</strong>
              <button type="button" onClick={() => setShowModal(false)} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer" }}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSave} style={{ padding: 16, display: "grid", gap: 10 }}>
              <input value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} placeholder="Full name" required style={{ padding: 10, borderRadius: 8, border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a" }} />
              <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="Email" required style={{ padding: 10, borderRadius: 8, border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a" }} />
              <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="Phone" style={{ padding: 10, borderRadius: 8, border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a" }} />
              <select value={form.role_id} onChange={(e) => setForm((p) => ({ ...p, role_id: e.target.value }))} required style={{ padding: 10, borderRadius: 8, border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a" }}>
                <option value="">Select role</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.role_name}
                  </option>
                ))}
              </select>
              <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a" }}>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
                <option value="suspended">suspended</option>
              </select>
              <input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder={editing ? "New password (optional)" : "Password"} style={{ padding: 10, borderRadius: 8, border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a" }} />
              <label style={{ fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={form.force_password_change} onChange={(e) => setForm((p) => ({ ...p, force_password_change: e.target.checked }))} />
                Force password change on next login
              </label>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`, background: "transparent", color: "#64748b", borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} style={{ border: "none", background: "linear-gradient(135deg, #0D9488, #0F766E)", color: "#fff", borderRadius: 8, padding: "8px 12px", cursor: saving ? "not-allowed" : "pointer" }}>
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
