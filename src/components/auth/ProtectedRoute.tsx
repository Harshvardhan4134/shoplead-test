import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth, UserRole } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  requiredRole?: UserRole | UserRole[] | string | string[];
  redirectPath?: string;
}

/**
 * ProtectedRoute component that checks if the user is authenticated
 * and has the required role(s) to access the route.
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  requiredRole, 
  redirectPath = "/login" 
}) => {
  const { user } = useAuth();
  const location = useLocation();

  // If user is not authenticated, redirect to login
  if (!user) {
    return <Navigate to={redirectPath} state={{ from: location }} replace />;
  }

  // If there's a required role check, verify user has the required role
  if (requiredRole) {
    const hasRequiredRole = Array.isArray(requiredRole)
      ? requiredRole.includes(user.role)
      : user.role === requiredRole;

    if (!hasRequiredRole) {
      return <Navigate to="/role-unauthorized" state={{ from: location }} replace />;
    }
  }

  // If all checks pass, render the child routes
  return <Outlet />;
};

export default ProtectedRoute; 