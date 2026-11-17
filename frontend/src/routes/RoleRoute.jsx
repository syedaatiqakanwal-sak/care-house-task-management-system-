import { Navigate } from "react-router-dom";
import { usePermission } from "../hooks/usePermission";

export function RoleRoute({ permission, children }) {
  const allowed = usePermission(permission);
  if (!allowed) return <Navigate to="/dashboard" replace />;
  return children;
}
