import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Dashboard from "@/pages/Dashboard";
import NCRTracker from "@/pages/NCRTracker";
import WorkCenters from "@/pages/WorkCenters";
import Scheduling from "@/pages/Scheduling";
import Forecasting from "@/pages/Forecasting";
import Purchase from "@/pages/Purchase";
import Logistics from "@/pages/logistics";
import NotFound from "@/pages/NotFound";
import Login from "@/pages/Login";
import RoleUnauthorized from "@/pages/RoleUnauthorized";
import ManagerDashboard from "@/pages/ManagerDashboard";
import ShopLeadDashboard from "@/pages/ShopLeadDashboard";
import MachinistDashboard from "@/pages/MachinistDashboard";
import WelderDashboard from "@/pages/WelderDashboard";
import MechanicDashboard from "@/pages/MechanicDashboard";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 3,
      refetchOnWindowFocus: false,
    },
  },
});

// Home route component that redirects based on role
const HomeRedirect = () => {
  const { user, loading } = useAuth();
  
  // If auth is still loading, don't redirect yet
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 rounded-full border-t-transparent"></div>
      </div>
    );
  }
  
  // Only redirect to login if explicitly not authenticated
  // For demo purposes, allow anonymous access with fallback to dashboard
  if (!user) {
    // For production, uncomment this:
    // return <Navigate to="/login" />;
    
    // For demo, go to general dashboard if not logged in
    return <Navigate to="/dashboard" />;
  }
  
  switch (user.role) {
    case 'admin':
      return <Navigate to="/admin" />;
    case 'manager':
      return <Navigate to="/manager" />;
    case 'worker':
      return <Navigate to="/worker" />;
    default:
      // If role doesn't match or no role, show the main dashboard
      return <Navigate to="/dashboard" />;
  }
};

// This component includes AuthProvider with navigation
const AppWithAuth = () => {
  const navigate = useNavigate();
  
  // Auto-login for demo purposes
  useEffect(() => {
    const autoLogin = async () => {
      const storedUser = localStorage.getItem('user');
      if (!storedUser) {
        console.log("Auto-logging in as admin for demo");
        // Auto-login as admin for demo
        try {
          // Create a user object directly
          const adminUser = {
            id: '1',
            name: 'Admin User',
            email: 'admin@example.com',
            role: 'admin'
          };
          
          // Store in localStorage
          localStorage.setItem('user', JSON.stringify(adminUser));
          
          // Don't force a page reload - this causes infinite refresh
          console.log("User data stored in localStorage");
        } catch (error) {
          console.error("Auto-login failed:", error);
        }
      }
    };
    
    // Add a flag to prevent running this more than once
    const hasRun = sessionStorage.getItem('autoLoginAttempted');
    if (!hasRun) {
      sessionStorage.setItem('autoLoginAttempted', 'true');
      autoLogin();
    }
  }, []);
  
  return (
    <AuthProvider onNavigate={navigate}>
      <div className="min-h-screen flex flex-col">
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/role-unauthorized" element={<RoleUnauthorized />} />
          
          {/* Home route with role-based redirect */}
          <Route path="/" element={<HomeRedirect />} />
          
          {/* Original dashboard for data uploads - accessible to everyone */}
          <Route path="/dashboard" element={
            <>
              <Navbar />
              <main className="flex-1 bg-gray-50">
                <Dashboard />
              </main>
            </>
          } />
          
          {/* Role-specific dashboards - mapped to our available roles */}
          <Route element={<ProtectedRoute requiredRole="manager" />}>
            <Route path="/manager" element={
              <>
                <Navbar />
                <main className="flex-1 bg-gray-50">
                  <ManagerDashboard />
                </main>
              </>
            } />
          </Route>
          
          <Route element={<ProtectedRoute requiredRole="worker" />}>
            <Route path="/worker" element={
              <>
                <Navbar />
                <main className="flex-1 bg-gray-50">
                  <ShopLeadDashboard />
                </main>
              </>
            } />
            
            {/* For backward compatibility, keep these routes but make them all use worker role */}
            <Route path="/shop-lead" element={
              <>
                <Navbar />
                <main className="flex-1 bg-gray-50">
                  <ShopLeadDashboard />
                </main>
              </>
            } />
            
            <Route path="/machinist" element={
              <>
                <Navbar />
                <main className="flex-1 bg-gray-50">
                  <MachinistDashboard />
                </main>
              </>
            } />
            
            <Route path="/welder" element={
              <>
                <Navbar />
                <main className="flex-1 bg-gray-50">
                  <WelderDashboard />
                </main>
              </>
            } />
            
            <Route path="/mechanic" element={
              <>
                <Navbar />
                <main className="flex-1 bg-gray-50">
                  <MechanicDashboard />
                </main>
              </>
            } />
          </Route>
          
          {/* Admin routes */}
          <Route element={<ProtectedRoute requiredRole="admin" />}>
            <Route path="/admin" element={
              <>
                <Navbar />
                <main className="flex-1 bg-gray-50">
                  <ManagerDashboard />
                </main>
              </>
            } />
          </Route>
          
          {/* Other routes that require authentication */}
          <Route element={<ProtectedRoute requiredRole={["admin", "manager"]} />}>
            <Route path="/ncr-tracking" element={
              <>
                <Navbar />
                <main className="flex-1 bg-gray-50">
                  <NCRTracker />
                </main>
              </>
            } />
            <Route path="/work-centers" element={
              <>
                <Navbar />
                <main className="flex-1 bg-gray-50">
                  <WorkCenters />
                </main>
              </>
            } />
            <Route path="/scheduling" element={
              <>
                <Navbar />
                <main className="flex-1 bg-gray-50">
                  <Scheduling />
                </main>
              </>
            } />
            <Route path="/forecasting" element={
              <>
                <Navbar />
                <main className="flex-1 bg-gray-50">
                  <Forecasting />
                </main>
              </>
            } />
            <Route path="/purchase" element={
              <>
                <Navbar />
                <main className="flex-1 bg-gray-50">
                  <Purchase />
                </main>
              </>
            } />
            <Route path="/logistics" element={
              <>
                <Navbar />
                <main className="flex-1 bg-gray-50">
                  <Logistics />
                </main>
              </>
            } />
          </Route>
          
          {/* Not found route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </AuthProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppWithAuth />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
