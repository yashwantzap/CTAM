import { useState } from "react";
import { useLocation } from "wouter";
import { useAuthActions, useCurrentUser } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [location, setLocation] = useLocation();
  const { user } = useCurrentUser();
  const { login } = useAuthActions();
  const { toast } = useToast();

  if (user) {
    if (location !== "/") {
      setLocation("/");
    }
    return null;
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !password) {
      toast({
        title: "Missing credentials",
        description: "Please enter both username and password.",
        variant: "destructive",
      });
      return;
    }

    login.mutate(
      { username, password },
      {
        onSuccess: () => {
          toast({
            title: "Login successful",
            description: "Welcome to CTAM Dashboard",
          });
          setLocation("/");
        },
        onError: (error: any) => {
          const status = error.status || 500;
          const message = error.message || "Unknown error occurred";

          if (status === 401) {
            toast({
              title: "Invalid credentials",
              description: "The username or password you entered is incorrect.",
              variant: "destructive",
            });
          } else if (status === 400) {
            toast({
              title: "Invalid input",
              description: message,
              variant: "destructive",
            });
          } else {
            toast({
              title: "Login failed",
              description: message || "An error occurred during login. Please try again.",
              variant: "destructive",
            });
          }
        },
      },
    );
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background cyber-grid px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold tracking-tight">CTAM Access</CardTitle>
          <CardDescription>
            Sign in to the Cyber Threat Analysis and Mitigation dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium">Username</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending ? "Signing in..." : "Sign in"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Default admin credentials: <span className="font-mono">admin / admin123</span>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

