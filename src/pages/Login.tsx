import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth, UserRole } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const Login = () => {
  const { login, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("password");
  const navigate = useNavigate();
  const location = useLocation();

  // Pre-fill with example credentials for demo
  useEffect(() => {
    setEmail("admin@example.com");
  }, []);

  // Get the redirect path from location state or default to "/"
  const from = location.state?.from?.pathname || "/";

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
  };

  const handleDemoLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("password");
  };

  const handleLogin = async () => {
    try {
      await login(email, password);
      // Navigation will happen in the AuthContext after successful login
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">ShopLead Dashboard</CardTitle>
          <CardDescription>Enter your credentials to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="user@example.com" 
                value={email}
                onChange={handleEmailChange}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                value={password}
                onChange={handlePasswordChange}
              />
              <p className="text-xs text-gray-500">
                For demo purposes, all accounts use the password "password"
              </p>
            </div>
            <div className="grid gap-2">
              <Label>Quick Login as:</Label>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  type="button"
                  onClick={() => handleDemoLogin("admin@example.com")}
                >
                  Admin
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  type="button"
                  onClick={() => handleDemoLogin("manager@example.com")}
                >
                  Manager
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  type="button"
                  onClick={() => handleDemoLogin("worker@example.com")}
                >
                  Worker
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full" 
            onClick={handleLogin}
            disabled={!email || !password}
          >
            Sign In
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Login; 