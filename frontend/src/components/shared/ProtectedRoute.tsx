import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

interface Props {
  children: React.ReactNode;
  role?: "seeker" | "recruiter" | "admin";
}

export default function ProtectedRoute({ children, role }: Props) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (role && user?.role !== role) {
    return <Navigate to={user?.role === "recruiter" ? "/recruiter/dashboard" : "/dashboard"} replace />;
  }

  return <>{children}</>;
}
