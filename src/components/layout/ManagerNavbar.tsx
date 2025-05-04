import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    BarChart3,
    ClipboardList,
    Settings,
    Users,
    LineChart,
    Activity
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const ManagerNavbar: React.FC = () => {
    const { logout } = useAuth();

    return (
        <nav className="fixed left-0 top-0 h-full w-16 bg-white border-r border-gray-200">
            <div className="flex flex-col items-center h-full py-4">
                <NavLink
                    to="/manager"
                    className={({ isActive }) =>
                        `w-12 h-12 mb-4 flex items-center justify-center rounded-lg hover:bg-gray-100 ${isActive ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
                        }`
                    }
                >
                    <BarChart3 className="h-6 w-6" />
                </NavLink>

                <NavLink
                    to="/manager/operations"
                    className={({ isActive }) =>
                        `w-12 h-12 mb-4 flex items-center justify-center rounded-lg hover:bg-gray-100 ${isActive ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
                        }`
                    }
                >
                    <Activity className="h-6 w-6" />
                </NavLink>

                <NavLink
                    to="/manager/insights"
                    className={({ isActive }) =>
                        `w-12 h-12 mb-4 flex items-center justify-center rounded-lg hover:bg-gray-100 ${isActive ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
                        }`
                    }
                >
                    <LineChart className="h-6 w-6" />
                </NavLink>

                <NavLink
                    to="/manager/jobs"
                    className={({ isActive }) =>
                        `w-12 h-12 mb-4 flex items-center justify-center rounded-lg hover:bg-gray-100 ${isActive ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
                        }`
                    }
                >
                    <ClipboardList className="h-6 w-6" />
                </NavLink>

                <NavLink
                    to="/manager/team"
                    className={({ isActive }) =>
                        `w-12 h-12 mb-4 flex items-center justify-center rounded-lg hover:bg-gray-100 ${isActive ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
                        }`
                    }
                >
                    <Users className="h-6 w-6" />
                </NavLink>

                <div className="flex-1" />

                <NavLink
                    to="/manager/settings"
                    className={({ isActive }) =>
                        `w-12 h-12 flex items-center justify-center rounded-lg hover:bg-gray-100 ${isActive ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
                        }`
                    }
                >
                    <Settings className="h-6 w-6" />
                </NavLink>
            </div>
        </nav>
    );
};

export default ManagerNavbar;