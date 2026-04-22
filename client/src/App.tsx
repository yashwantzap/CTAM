import { Switch, Route, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Vulnerabilities from "@/pages/Vulnerabilities";
import Analyze from "@/pages/Analyze";
import Model from "@/pages/Model";
import Alerts from "@/pages/Alerts";
import AuditLogs from "@/pages/AuditLogs";
import Login from "@/pages/Login";
import { useCurrentUser, useAuthActions } from "@/hooks/use-auth";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/vulnerabilities" component={Vulnerabilities} />
      <Route path="/analyze" component={Analyze} />
      <Route path="/model" component={Model} />
      <Route path="/alerts" component={Alerts} />
      <Route path="/audit" component={AuditLogs} />
      <Route path="/login" component={Login} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const { user, isLoading } = useCurrentUser();
  const { logout } = useAuthActions();
  const [location, setLocation] = useLocation();

  const isLoginRoute = location.startsWith("/login");

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background cyber-grid">
        <div className="animate-pulse text-sm text-muted-foreground">
          Loading security context...
        </div>
      </div>
    );
  }

  if (!user && !isLoginRoute) {
    setLocation("/login");
    return null;
  }

  if (user && isLoginRoute) {
    setLocation("/");
    return null;
  }

  const handleLogout = async () => {
    await logout.mutateAsync();
    setLocation("/login");
  };

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <ThemeProvider>
        <TooltipProvider>
          <SidebarProvider style={style as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1 overflow-hidden">
                <header className="flex h-14 items-center justify-between gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sticky top-0 z-50">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                  <div className="flex items-center gap-4">
                    <ThemeToggle />
                    {user && (
                      <div className="flex items-center gap-3 pl-4 border-l border-border">
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-medium text-foreground">{user.username}</span>
                          <span className="text-xs text-muted-foreground capitalize">{user.role}</span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={handleLogout}
                          disabled={logout.isPending}
                          data-testid="logout-button"
                        >
                          <LogOut className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </header>
                <main className="flex-1 overflow-auto p-6 cyber-grid">
                  <Router />
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
