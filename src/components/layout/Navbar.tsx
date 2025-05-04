import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  ShoppingCart,
  Truck,
  FileText,
  AlertTriangle,
  Factory,
  Calendar,
  Bell,
  Package,
  Send,
  Cog,
  Search,
  User,
  LogOut,
  Home
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationIcon } from "@/components/NotificationIcon";
import { useEffect } from "react";

interface NavigationItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles?: string[]; // Only show nav item for these roles
}

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const role = user?.role || '';
  
  // Force role to be admin temporarily for debugging
  console.log("Auth state in Navbar:", { user, role, userLocalStorage: localStorage.getItem('user') });
  
  // Create a helper function for development that will ensure the role is set to admin
  useEffect(() => {
    if (!user || !user.role) {
      console.log("No user or role found, checking localStorage");
      const storedUser = localStorage.getItem('user');
      
      if (storedUser) {
        console.log("Found user in localStorage:", storedUser);
        // Don't force reload here - it causes infinite refresh
      }
    }
  }, [user]);
  
  const navigationItems: NavigationItem[] = [
    // Role-specific dashboard - made primary
    { 
      href: role === 'admin' ? "/admin" : 
            role === 'manager' ? "/manager" : 
            role === 'worker' ? "/worker" : "/", 
      label: "Dashboard", 
      icon: <LayoutDashboard size={18} /> 
    },
    // General Dashboard - moved to secondary position
    { 
      href: "/dashboard", 
      label: "General Dashboard", 
      icon: <Home size={18} /> 
    },
    { 
      href: "/scheduling", 
      label: "Scheduling", 
      icon: <Calendar size={18} />
    },
    { 
      href: "/forecasting", 
      label: "Forecasting", 
      icon: <FileText size={18} />
    },
    { 
      href: "/work-centers", 
      label: "Work Centers", 
      icon: <Factory size={18} />
    },
    { 
      href: "/logistics", 
      label: "Logistics", 
      icon: <Truck size={18} />
    },
    { 
      href: "/purchase", 
      label: "Purchase", 
      icon: <ShoppingCart size={18} />
    },
    { 
      href: "/ncr-tracking", 
      label: "NCR Tracker", 
      icon: <AlertTriangle size={18} />
    },
    // Shop Lead is still available for workers
    { 
      href: "/shop-lead", 
      label: "Shop Lead", 
      icon: <User size={18} />,
      roles: ['worker']
    }
  ];

  // Filter navigation items based on user role
  const filteredNavigationItems = navigationItems.filter(item => {
    // The primary dashboard and general dashboard are always shown
    if (item.href === "/dashboard" || item.label === "Dashboard") return true;
    
    // If no roles specified, show to everyone
    if (!item.roles) return true;
    
    // If roles are specified, check if user has that role
    // Admin sees everything
    if (role === 'admin') return true;
    
    // For other roles, check if their role is included
    return item.roles.includes(role);
  });

  console.log("Filtered navigation items:", filteredNavigationItems);

  const handleLogout = () => {
    console.log("Logout clicked");
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center py-2">
            <div className="flex items-center mr-6 cursor-pointer" onClick={() => {
              // Navigate to role-specific dashboard based on role
              const targetPath = role === 'admin' ? "/admin" : 
                               role === 'manager' ? "/manager" : 
                               role === 'worker' ? "/worker" : "/dashboard";
              console.log("Navigating to:", targetPath);
              navigate(targetPath);
            }}>
              <span className="font-bold text-xl text-primary">ShopLead</span>
              <span className="ml-1 text-xl font-normal text-gray-600">Dashboard</span>
            </div>
            <div className="flex overflow-x-auto">
              {/* Always use filtered navigation items based on role */}
              {filteredNavigationItems.map((item) => (
                <div
                  key={item.href}
                  className={cn(
                    "px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap flex items-center cursor-pointer",
                    location.pathname === item.href
                      ? "text-primary border-primary"
                      : "text-gray-600 hover:text-gray-900 border-transparent hover:border-gray-300"
                  )}
                  onClick={() => {
                    console.log("Navigating to menu item:", item.href);
                    navigate(item.href);
                  }}
                >
                  {item.icon}
                  <span className="ml-2">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center">
            <div className="relative mr-4">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search jobs..."
                className="h-9 pl-9 pr-4 rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
              />
            </div>
            <NotificationIcon />
            <button className="mr-4 text-gray-500 hover:text-gray-700">
              <Cog size={20} />
            </button>
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center mr-2">
                <User size={16} />
              </div>
              <span className="text-sm font-medium text-gray-700 mr-3">{user?.name || 'Guest'}</span>
              {user && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleLogout} 
                  className="text-gray-500 hover:text-gray-700"
                >
                  <LogOut size={16} className="mr-1" />
                  <span className="sr-only sm:not-sr-only sm:inline-block">Logout</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

