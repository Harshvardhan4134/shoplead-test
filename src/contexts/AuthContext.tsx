import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from '@/components/ui/use-toast';

// Define user roles
export type UserRole = 'admin' | 'manager' | 'worker' | '';

// Role to route mapping
export const roleRoutes: Record<UserRole, string> = {
  'admin': '/admin',
  'manager': '/manager',
  'worker': '/worker',
  '': '/',
};

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  skills?: string[];
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  type: 'due_date_change' | 'worker_assignment' | 'job_update' | 'general';
  relatedJobId?: string;
  relatedWorkerId?: string;
}

// Mock users for development
const mockUsers: User[] = [
  {
    id: '1',
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin',
  },
  {
    id: '2',
    name: 'Manager User',
    email: 'manager@example.com',
    role: 'manager',
  },
  {
    id: '3',
    name: 'Worker User',
    email: 'worker@example.com',
    role: 'worker',
  },
];

// Define auth context type
interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (email: string, password: string, name: string, role: UserRole) => Promise<void>;
  notifications: Notification[];
  unreadNotificationCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
}

// Create the auth context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Create the auth provider component
export const AuthProvider: React.FC<{ 
  children: React.ReactNode;
  onNavigate?: (path: string) => void;
}> = ({ children, onNavigate }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Helper function to navigate
  const navigate = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    }
  };

  // Calculate unread notifications
  const unreadNotificationCount = notifications.filter(n => !n.read).length;

  // Add a new notification
  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date(),
      read: false,
    };
    
    setNotifications(prev => [newNotification, ...prev]);
    
    // Show toast for new notification
    toast({
      title: notification.title,
      description: notification.message,
    });
  };

  // Mark a notification as read
  const markNotificationAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id ? { ...notification, read: true } : notification
      )
    );
  };

  // Mark all notifications as read
  const markAllNotificationsAsRead = () => {
    setNotifications(prev =>
      prev.map(notification => ({ ...notification, read: true }))
    );
  };

  // Check if user is logged in on page load
  useEffect(() => {
    const checkAuth = () => {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        
        // Initialize with some demo notifications if user is logged in
        if (parsedUser) {
          setNotifications([
            {
              id: '1',
              title: 'Welcome back!',
              message: `Welcome back to your dashboard, ${parsedUser.name}`,
              timestamp: new Date(),
              read: false,
              type: 'general'
            }
          ]);
        }
      }
      setLoading(false);
    };
    
    checkAuth();
  }, []);

  // Mock login function
  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      const foundUser = mockUsers.find(u => u.email === email);
      if (foundUser && password === 'password') {
        setUser(foundUser);
        localStorage.setItem('user', JSON.stringify(foundUser));
        
        // Add a welcome notification
        addNotification({
          title: 'Login successful',
          message: `Welcome back, ${foundUser.name}!`,
          type: 'general'
        });
        
        // Navigate to the appropriate dashboard based on role
        if (foundUser.role === 'admin') {
          navigate('/admin');
        } else if (foundUser.role === 'manager') {
          navigate('/manager');
        } else if (foundUser.role === 'worker') {
          navigate('/worker');
        }
      } else {
        setError('Invalid email or password');
        toast({
          title: "Login Failed",
          description: "Invalid email or password.",
          variant: "destructive",
        });
      }
    } catch (err) {
      setError('An error occurred during login');
      toast({
        title: "Login Error",
        description: "An error occurred during login.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Mock logout function
  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    setNotifications([]);
    navigate('/login');
  };

  // Mock registration function
  const register = async (email: string, password: string, name: string, role: UserRole) => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      // Check if user already exists
      if (mockUsers.some(u => u.email === email)) {
        setError('User with this email already exists');
        return;
      }
      
      // Create new user
      const newUser: User = {
        id: (mockUsers.length + 1).toString(),
        name,
        email,
        role,
      };
      
      mockUsers.push(newUser);
      setUser(newUser);
      localStorage.setItem('user', JSON.stringify(newUser));
      
      // Add a welcome notification
      addNotification({
        title: 'Account created',
        message: `Welcome, ${name}! Your account has been created successfully.`,
        type: 'general'
      });
      
      // Navigate to the appropriate dashboard based on role
      if (role === 'admin') {
        navigate('/admin');
      } else if (role === 'manager') {
        navigate('/manager');
      } else if (role === 'worker') {
        navigate('/worker');
      }
    } catch (err) {
      setError('An error occurred during registration');
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    logout,
    register,
    notifications,
    unreadNotificationCount,
    addNotification,
    markNotificationAsRead,
    markAllNotificationsAsRead
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Create a custom hook to use the auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 