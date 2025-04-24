import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
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
  User
} from "lucide-react";

interface NavigationItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const navigationItems: NavigationItem[] = [
  { href: "/", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { href: "/scheduling", label: "Scheduling", icon: <Calendar size={18} /> },
  { href: "/forecasting", label: "Forecasting", icon: <FileText size={18} /> },
  { href: "/work-centers", label: "Work Centers", icon: <Factory size={18} /> },
  { href: "/logistics", label: "Logistics", icon: <Truck size={18} /> },
  { href: "/purchase", label: "Purchase", icon: <ShoppingCart size={18} /> },
  { href: "/ncr-tracking", label: "NCR Tracker", icon: <AlertTriangle size={18} /> },
];

export default function Navbar() {
  const location = useLocation();

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center py-2">
            <div className="flex items-center mr-6 cursor-pointer" onClick={() => window.location.href = "/"}>
              <span className="font-bold text-xl text-primary">ShopLead</span>
              <span className="ml-1 text-xl font-normal text-gray-600">Dashboard</span>
            </div>
            <div className="flex overflow-x-auto">
              {navigationItems.map((item) => (
                <div
                  key={item.href}
                  className={cn(
                    "px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap flex items-center cursor-pointer",
                    location.pathname === item.href
                      ? "text-primary border-primary"
                      : "text-gray-600 hover:text-gray-900 border-transparent hover:border-gray-300"
                  )}
                  onClick={() => {
                    window.location.href = item.href;
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
            <button className="mr-4 text-gray-500 hover:text-gray-700">
              <Bell size={20} />
            </button>
            <button className="mr-4 text-gray-500 hover:text-gray-700">
              <Cog size={20} />
            </button>
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center mr-2">
                <User size={16} />
              </div>
              <span className="text-sm font-medium text-gray-700">Shop Lead</span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

