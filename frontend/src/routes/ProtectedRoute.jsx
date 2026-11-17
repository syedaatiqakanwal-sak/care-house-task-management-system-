import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="p-6">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: loc }} />;
  return children;
}
