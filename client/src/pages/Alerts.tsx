import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Bell, 
  AlertTriangle, 
  CheckCircle2, 
  Clock,
  ExternalLink,
  Filter
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RiskBadge } from "@/components/RiskBadge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AlertEntry } from "@shared/schema";
import { useState } from "react";
import { useCurrentUser } from "@/hooks/use-auth";
import { hasPermission, UserRole } from "@/lib/auth";

export default function Alerts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { user } = useCurrentUser();

  const { data: alerts, isLoading } = useQuery<AlertEntry[]>({
    queryKey: ["/api/alerts"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/alerts/${id}`, { status }),
    onSuccess: () => {
      toast({
        title: "Alert Updated",
        description: "Alert status has been updated",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update alert status",
        variant: "destructive",
      });
    },
  });

  const filteredAlerts = alerts?.filter((alert) => {
    if (statusFilter === "all") return true;
    return alert.status === statusFilter;
  }) || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-amber-500" />;
      case "acknowledged":
        return <Bell className="h-4 w-4 text-blue-500" />;
      case "resolved":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      acknowledged: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      resolved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
    };
    return (
      <Badge variant="outline" className={variants[status] || ""}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const role = (user?.role as UserRole | undefined) ?? UserRole.SOC_ANALYST;
  const canUpdateAlerts = hasPermission(role, "acknowledge_alert") || hasPermission(role, "resolve_alert");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
            Alerts
          </h1>
          <p className="text-muted-foreground">
            {alerts?.filter(a => a.status === "pending").length || 0} pending alerts
          </p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="select-status-filter">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Alerts</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="acknowledged">Acknowledged</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredAlerts.length > 0 ? (
        <div className="space-y-4">
          {filteredAlerts.map((alert) => (
            <Card 
              key={alert.id} 
              className={`hover-elevate ${alert.status === "pending" ? "border-amber-500/50" : ""}`}
              data-testid={`alert-card-${alert.cveId}`}
            >
              <CardContent className="p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`mt-1 ${alert.status === "pending" ? "pulse-danger" : ""}`}>
                      {getStatusIcon(alert.status)}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-mono font-semibold">{alert.cveId}</h3>
                        <RiskBadge level={alert.riskLevel as "High" | "Medium" | "Low"} />
                        {getStatusBadge(alert.status)}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {alert.mitigation}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Confidence: {(alert.probability * 100).toFixed(0)}%</span>
                        <span>Triggered: {formatTimestamp(alert.timestamp)}</span>
                        <span>By: {alert.triggeredBy}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                    {canUpdateAlerts && alert.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatusMutation.mutate({ 
                            id: alert.id, 
                            status: "acknowledged" 
                          })}
                          data-testid={`button-acknowledge-${alert.id}`}
                        >
                          Acknowledge
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => updateStatusMutation.mutate({ 
                            id: alert.id, 
                            status: "resolved" 
                          })}
                          data-testid={`button-resolve-${alert.id}`}
                        >
                          Resolve
                        </Button>
                      </>
                    )}
                    {canUpdateAlerts && alert.status === "acknowledged" && (
                      <Button
                        size="sm"
                        onClick={() => updateStatusMutation.mutate({ 
                          id: alert.id, 
                          status: "resolved" 
                        })}
                        data-testid={`button-resolve-${alert.id}`}
                      >
                        Resolve
                      </Button>
                    )}
                    <Link href={`/analyze?cve=${alert.cveId}`}>
                      <Button size="sm" variant="ghost">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <div className="rounded-full bg-muted p-6">
                <Bell className="h-12 w-12 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">No alerts found</h3>
                <p className="text-muted-foreground max-w-md mx-auto mt-1">
                  {statusFilter !== "all" 
                    ? "Try changing the filter to see more alerts"
                    : "Alerts are generated when high-risk vulnerabilities are detected with high confidence"
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
