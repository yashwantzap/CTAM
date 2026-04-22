import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Shield,
  AlertTriangle,
  Activity,
  Brain,
  RefreshCw,
  Database,
  TrendingUp
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatsCard } from "@/components/StatsCard";
import { RiskBadge } from "@/components/RiskBadge";
import { useMutationWithToast } from "@/hooks/use-mutation-toast";
import { apiRequest } from "@/lib/queryClient";
import { useCurrentUser } from "@/hooks/use-auth";
import { hasPermission, UserRole } from "@/lib/auth";
import type { DashboardStats, AlertEntry, RiskPrediction } from "@shared/schema";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend
} from "recharts";

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  const { data: stats, isLoading: statsLoading, isError: statsError } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: alerts = [], isError: alertsError } = useQuery<AlertEntry[]>({
    queryKey: ["/api/alerts"],
  });

  const { data: predictions = [], isError: predictionsError } = useQuery<RiskPrediction[]>({
    queryKey: ["/api/predictions"],
  });

  const collectDataMutation = useMutationWithToast(
    {
      mutationFn: async () => {
        const response = await apiRequest("POST", "/api/collectdata");
        return response.json();
      },
      successTitle: "Data Collection Complete",
      successDescription: (data: any) => data.message || "Vulnerabilities collected successfully",
      errorTitle: "Data Collection Failed",
      errorDescription: "Failed to collect vulnerability data from CISA",
      invalidateQueries: ["/api/dashboard/stats", "/api/vulnerabilities"],
    },
    queryClient
  );

  const trainModelMutation = useMutationWithToast(
    {
      mutationFn: async () => {
        const response = await apiRequest("POST", "/api/trainmodel");
        return response.json();
      },
      successTitle: "Model Training Complete",
      successDescription: (data: any) => `Accuracy: ${data.metrics?.accuracy || "N/A"}`,
      errorTitle: "Model Training Failed",
      errorDescription: "Failed to train model. Ensure data is collected first.",
      invalidateQueries: ["/api/dashboard/stats", "/api/model/metrics"],
    },
    queryClient
  );

  const pendingAlerts = useMemo(() => alerts.filter(a => a.status === "pending"), [alerts]);

  // Memoize chart data to prevent unnecessary re-renders
  const riskDistribution = useMemo(() => [
    { name: "High", value: stats?.highRiskCount || 0, color: "#ef4444" },
    { name: "Medium", value: stats?.mediumRiskCount || 0, color: "#f59e0b" },
    { name: "Low", value: stats?.lowRiskCount || 0, color: "#22c55e" },
  ], [stats?.highRiskCount, stats?.mediumRiskCount, stats?.lowRiskCount]);

  const activityData = useMemo(() => [
    { name: "Total", vulnerabilities: stats?.totalVulnerabilities || 0 },
    { name: "Analyzed", vulnerabilities: predictions.length },
    { name: "High Risk", vulnerabilities: stats?.highRiskCount || 0 },
  ], [stats?.totalVulnerabilities, stats?.highRiskCount, predictions.length]);

  if (statsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Error display
  if (statsError || alertsError || predictionsError) {
    return (
      <Card className="border-red-500/50 bg-red-500/5">
        <CardHeader>
          <CardTitle className="text-red-700 dark:text-red-400">Error Loading Dashboard</CardTitle>
          <CardDescription className="text-red-600/90 dark:text-red-300/90">
            Failed to load dashboard data. Please refresh the page or contact support.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const role = (user?.role as UserRole | undefined) ?? UserRole.SOC_ANALYST;
  const canCollectData = hasPermission(role, "collect_data");
  const canTrainModel = hasPermission(role, "train_model");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
            Security Dashboard
          </h1>
          <p className="text-muted-foreground">
            Real-time threat intelligence and risk analysis
          </p>
        </div>
        <div className="flex gap-2">
          {canCollectData && (
            <Button
              onClick={() => collectDataMutation.mutate()}
              disabled={collectDataMutation.isPending}
              variant="outline"
              data-testid="button-collect-data"
            >
              <Database className="mr-2 h-4 w-4" />
              {collectDataMutation.isPending ? "Collecting..." : "Collect Data"}
            </Button>
          )}
          {canTrainModel && (
            <Button
              onClick={() => trainModelMutation.mutate()}
              disabled={trainModelMutation.isPending || !stats?.totalVulnerabilities}
              data-testid="button-train-model"
            >
              <Brain className="mr-2 h-4 w-4" />
              {trainModelMutation.isPending ? "Training..." : "Train Model"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Vulnerabilities"
          value={stats?.totalVulnerabilities || 0}
          description="From CISA KEV feed"
          icon={Shield}
          iconClassName="bg-primary/10 text-primary"
        />
        <StatsCard
          title="High Risk"
          value={stats?.highRiskCount || 0}
          description="Immediate action required"
          icon={AlertTriangle}
          iconClassName="bg-red-500/10 text-red-500"
        />
        <StatsCard
          title="Model Accuracy"
          value={stats?.modelAccuracy ? `${(stats.modelAccuracy * 100).toFixed(1)}%` : "Not trained"}
          description="Random Forest classifier"
          icon={Brain}
          iconClassName="bg-purple-500/10 text-purple-500"
        />
        <StatsCard
          title="Pending Alerts"
          value={stats?.pendingAlerts || 0}
          description="Awaiting response"
          icon={Activity}
          iconClassName="bg-amber-500/10 text-amber-500"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Risk Distribution</CardTitle>
            <CardDescription>Categorization of analyzed vulnerabilities</CardDescription>
          </CardHeader>
          <CardContent>
            {riskDistribution.some(d => d.value > 0) ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={riskDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {riskDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <TrendingUp className="mx-auto h-12 w-12 opacity-50" />
                  <p className="mt-2">No analysis data yet</p>
                  <p className="text-sm">Collect data and analyze vulnerabilities to see results</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Activity Overview</CardTitle>
            <CardDescription>Vulnerability processing status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="vulnerabilities" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Alerts</CardTitle>
          <CardDescription>High-risk vulnerabilities requiring attention</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingAlerts.length > 0 ? (
            <div className="space-y-3">
              {pendingAlerts.slice(0, 5).map((alert) => (
                <div 
                  key={alert.id} 
                  className="flex items-center justify-between rounded-lg border p-3 hover-elevate"
                  data-testid={`alert-item-${alert.cveId}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-red-500 pulse-danger" />
                    <div>
                      <p className="font-medium">{alert.cveId}</p>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {alert.mitigation}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <RiskBadge level={alert.riskLevel as "High" | "Medium" | "Low"} />
                    <span className="text-xs text-muted-foreground">
                      {(alert.probability * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Activity className="mx-auto h-8 w-8 opacity-50" />
                <p className="mt-2">No pending alerts</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
