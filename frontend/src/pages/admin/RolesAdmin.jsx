import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyRound, Pencil, Plus, Search, ShieldCheck, Trash2, X } from "lucide-react";
import api from "../../api";
import { useTheme } from "../../contexts/ThemeContext";
import { useToast } from "../../components/common/Toast";

const emptyRole = { role_name: "", description: "" };

export default function RolesAdmin() {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const isDark = theme === "dark";
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState(emptyRole);
  const [permRole, setPermRole] = useState(null);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState([]);

  const loadRoles = useCallback(async () => {
    const { data } = await api.get("/roles");
    const rows = Array.isArray(data) ? data : data.rows || data.data || [];
    setRoles(rows);
  }, []);

  const loadPermissions = useCallback(async () => {
    const { data } = await api.get("/roles/permissions/list");
    const rows = Array.isArray(data) ? data : data.rows || data.data || [];
    setPermissions(rows);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadRoles(), loadPermissions()]);
    } finally {
      setLoading(false);
    }
  }, [loadPermissions, loadRoles]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(
    () =>
      roles.filter((r) => {
        const q = query.toLowerCase();
        return !q || String(r.role_name || r.name || "").toLowerCase().includes(q);
      }),
    [roles, query]
  );

  const groupedPermissions = useMemo(() => {
    return permissions.reduce((acc, p) => {
      const key = p.module || "general";
      if (!acc[key]) acc[key] = [];
      acc[key].push(p);
      return acc;
    }, {});
  }, [permissions]);

  const openCreateRole = () => {
    setEditingRole(null);
    setRoleForm(emptyRole);
    setShowRoleModal(true);
  };

  const openEditRole = (role) => {
    setEditingRole(role);
    setRoleForm({ role_name: role.role_name || "", description: role.description || "" });
    setShowRoleModal(true);
  };

  const handleSaveRole = async (e) => {
    e.preventDefault();
    if (!roleForm.role_name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        role_name: roleForm.role_name.trim(),
        description: roleForm.description.trim() || null
      };
      if (editingRole) await api.put(`/roles/${editingRole.id}`, payload);
      else await api.post("/roles", payload);
      showToast(editingRole ? "Role updated" : "Role created", "success");
      setShowRoleModal(false);
      await loadRoles();
    } catch {
      showToast("Failed to save role", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async (role) => {
    if (role.is_system) {
      showToast("System role cannot be deleted", "warning");
      return;
    }
    if (!window.confirm(`Delete role "${role.role_name}"?`)) return;
    try {
      await api.delete(`/roles/${role.id}`);
      setRoles((prev) => prev.filter((r) => r.id !== role.id));
      showToast("Role deleted", "success");
    } catch {
      showToast("Failed to delete role", "error");
    }
  };

  const openPermissionsEditor = (role) => {
    setPermRole(role);
    const rolePerms = role.permissions || role.Permissions || [];
    setSelectedPermissionIds(rolePerms.map((p) => p.id));
  };

  const togglePermission = (id) => {
    setSelectedPermissionIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const savePermissions = async () => {
    if (!permRole) return;
    setSaving(true);
    try {
      await api.put(`/roles/${permRole.id}/permissions`, { permissionIds: selectedPermissionIds });
      showToast("Permissions updated", "success");
      setPermRole(null);
      await loadRoles();
    } catch {
      showToast("Failed to update permissions", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: isDark ? "#f1f5f9" : "#0f172a", fontWeight: 800 }}>Roles & Permissions</h1>
          <p style={{ margin: "6px 0 0", color: isDark ? "#94a3b8" : "#64748b", fontSize: 13 }}>Define access levels and permission groups.</p>
        </div>
        <button type="button" onClick={openCreateRole} style={{ border: "none", borderRadius: 10, background: "linear-gradient(135deg, #0D9488, #0F766E)", color: "#fff", padding: "10px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Plus size={16} /> Add Role
        </button>
      </div>

      <div style={{ background: isDark ? "#1e293b" : "#fff", border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, borderRadius: 14, padding: 12, marginBottom: 14 }}>
        <div style={{ position: "relative", maxWidth: 360 }}>
          <Search size={15} style={{ position: "absolute", left: 10, top: 11, color: isDark ? "#94a3b8" : "#64748b" }} />
          <input placeholder="Search roles..." value={query} onChange={(e) => setQuery(e.target.value)} style={{ width: "100%", padding: "10px 12px 10px 32px", borderRadius: 9, border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a", fontSize: 13 }} />
        </div>
      </div>

      <div style={{ background: isDark ? "#1e293b" : "#fff", borderRadius: 14, border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 14 }}>{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 54, borderRadius: 8, marginBottom: 10 }} />)}</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 44, color: isDark ? "#94a3b8" : "#64748b" }}>
            <ShieldCheck size={22} style={{ marginBottom: 8 }} />
            <div>No roles found.</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: isDark ? "#0f172a" : "#f8fafc", textAlign: "left" }}>
                  {["Role", "Description", "Permissions", "Actions"].map((h) => (
                    <th key={h} style={{ padding: "12px 14px", fontSize: 12, color: isDark ? "#94a3b8" : "#64748b", fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((role, idx) => {
                  const perms = role.permissions || role.Permissions || [];
                  return (
                    <tr key={role.id || idx} style={{ borderTop: `1px solid ${isDark ? "#334155" : "#f1f5f9"}` }}>
                      <td style={{ padding: "12px 14px", color: isDark ? "#f1f5f9" : "#0f172a", fontWeight: 600 }}>{role.role_name || role.name || "-"}</td>
                      <td style={{ padding: "12px 14px", color: isDark ? "#cbd5e1" : "#334155", fontSize: 13 }}>{role.description || "-"}</td>
                      <td style={{ padding: "12px 14px", color: isDark ? "#cbd5e1" : "#334155", fontSize: 13 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <KeyRound size={13} /> {perms.length}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button type="button" onClick={() => openPermissionsEditor(role)} style={{ border: "1px solid #bfdbfe", color: "#1d4ed8", background: "#eff6ff", borderRadius: 8, padding: "5px 8px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                            Permissions
                          </button>
                          <button type="button" onClick={() => openEditRole(role)} style={{ border: "1px solid #bfdbfe", color: "#1d4ed8", background: "#eff6ff", borderRadius: 8, padding: "5px 8px", cursor: "pointer" }}>
                            <Pencil size={13} />
                          </button>
                          <button type="button" onClick={() => handleDeleteRole(role)} style={{ border: "1px solid #fecaca", color: "#dc2626", background: "#fef2f2", borderRadius: 8, padding: "5px 8px", cursor: "pointer" }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showRoleModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 520, background: isDark ? "#1e293b" : "#fff", borderRadius: 16, border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ color: isDark ? "#f1f5f9" : "#0f172a" }}>{editingRole ? "Edit Role" : "Create Role"}</strong>
              <button type="button" onClick={() => setShowRoleModal(false)} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer" }}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveRole} style={{ padding: 16, display: "grid", gap: 10 }}>
              <input value={roleForm.role_name} onChange={(e) => setRoleForm((p) => ({ ...p, role_name: e.target.value }))} placeholder="Role name" required style={{ padding: 10, borderRadius: 8, border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a" }} />
              <textarea value={roleForm.description} onChange={(e) => setRoleForm((p) => ({ ...p, description: e.target.value }))} placeholder="Description" rows={3} style={{ padding: 10, borderRadius: 8, border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`, background: isDark ? "#0f172a" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a" }} />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                <button type="button" onClick={() => setShowRoleModal(false)} style={{ border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`, background: "transparent", color: "#64748b", borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}>
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

      {permRole && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 760, maxHeight: "86vh", overflow: "auto", background: isDark ? "#1e293b" : "#fff", borderRadius: 16, border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}` }}>
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: isDark ? "#1e293b" : "#fff" }}>
              <strong style={{ color: isDark ? "#f1f5f9" : "#0f172a" }}>Permissions: {permRole.role_name}</strong>
              <button type="button" onClick={() => setPermRole(null)} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer" }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: 16, display: "grid", gap: 12 }}>
              {Object.entries(groupedPermissions).map(([module, perms]) => (
                <div key={module} style={{ border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 8 }}>{module}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
                    {perms.map((p) => (
                      <label key={p.id} style={{ fontSize: 13, color: isDark ? "#cbd5e1" : "#334155", display: "flex", alignItems: "center", gap: 8 }}>
                        <input type="checkbox" checked={selectedPermissionIds.includes(p.id)} onChange={() => togglePermission(p.id)} />
                        {p.permission_key}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: 16, borderTop: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setPermRole(null)} style={{ border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`, background: "transparent", color: "#64748b", borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}>
                Cancel
              </button>
              <button type="button" onClick={savePermissions} disabled={saving} style={{ border: "none", background: "linear-gradient(135deg, #0D9488, #0F766E)", color: "#fff", borderRadius: 8, padding: "8px 12px", cursor: saving ? "not-allowed" : "pointer" }}>
                {saving ? "Saving..." : "Save Permissions"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
