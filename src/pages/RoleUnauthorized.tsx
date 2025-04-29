import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

const RoleUnauthorized = () => {
  const { role, getHomeRouteForRole, logout } = useAuth();
  const navigate = useNavigate();

  const handleBackToDashboard = () => {
    if (role) {
      const homeRoute = getHomeRouteForRole(role);
      navigate(homeRoute);
    } else {
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md mx-auto text-center">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-6 w-6 text-yellow-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <span className="font-medium">Access Denied</span>
              </p>
            </div>
          </div>
        </div>
        
        <h1 className="text-2xl font-bold mb-2">Unauthorized Access</h1>
        <p className="text-gray-600 mb-6">
          {role 
            ? `As a ${role}, you don't have permission to access this page.`
            : "You don't have permission to access this page."}
        </p>
        
        <div className="flex flex-col space-y-2">
          <Button onClick={handleBackToDashboard}>
            {role ? "Back to Your Dashboard" : "Go to Login"}
          </Button>
          
          {role && (
            <Button 
              variant="outline" 
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              Log out
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoleUnauthorized; 