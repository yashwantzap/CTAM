import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Brain, 
  Zap, 
  Target, 
  TrendingUp,
  BarChart3,
  RefreshCw,
  CheckCircle2,
  Clock
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ModelMetrics, DashboardStats } from "@shared/schema";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from "recharts";

export default function Model() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: metrics, isLoading: metricsLoading } = useQuery<ModelMetrics & { trained?: boolean }>({
    queryKey: ["/api/model/metrics"],
  });

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const trainMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/trainmodel");
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Model Training Complete",
        description: `Model trained with ${data.metrics?.samplesUsed || "N/A"} samples`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/model/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    },
    onError: () => {
      toast({
        title: "Training Failed",
        description: "Failed to train the model. Make sure data is collected first.",
        variant: "destructive",
      });
    },
  });

  const isModelTrained = metrics && metrics.trained !== false && metrics.accuracy !== undefined;

  const performanceData = isModelTrained ? [
    { metric: "Accuracy", value: (metrics.accuracy || 0) * 100 },
    { metric: "Precision", value: (metrics.precision || 0) * 100 },
    { metric: "Recall", value: (metrics.recall || 0) * 100 },
    { metric: "F1 Score", value: (metrics.f1Score || 0) * 100 },
  ] : [];

  const radarData = isModelTrained ? [
    { subject: "Accuracy", A: (metrics.accuracy || 0) * 100, fullMark: 100 },
    { subject: "Precision", A: (metrics.precision || 0) * 100, fullMark: 100 },
    { subject: "Recall", A: (metrics.recall || 0) * 100, fullMark: 100 },
    { subject: "F1", A: (metrics.f1Score || 0) * 100, fullMark: 100 },
  ] : [];

  const featureImportanceData = isModelTrained && metrics.featureImportance
    ? Object.entries(metrics.featureImportance).map(([name, value]) => ({
        name: name.replace(/([A-Z])/g, ' $1').trim(),
        importance: (value as number) * 100,
      })).sort((a, b) => b.importance - a.importance)
    : [];

  if (metricsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
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
            ML Model
          </h1>
          <p className="text-muted-foreground">
            Random Forest classifier for vulnerability risk prediction
          </p>
        </div>
        <Button
          onClick={() => trainMutation.mutate()}
          disabled={trainMutation.isPending || !stats?.totalVulnerabilities}
          data-testid="button-train-model"
        >
          {trainMutation.isPending ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Training...
            </>
          ) : (
            <>
              <Brain className="mr-2 h-4 w-4" />
              {isModelTrained ? "Retrain Model" : "Train Model"}
            </>
          )}
        </Button>
      </div>

      {!isModelTrained ? (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <div className="rounded-full bg-muted p-6">
                <Brain className="h-12 w-12 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Model Not Trained</h3>
                <p className="text-muted-foreground max-w-md mx-auto mt-1">
                  {stats?.totalVulnerabilities 
                    ? "Click the Train Model button to train the Random Forest classifier on the collected vulnerability data."
                    : "Collect vulnerability data from the dashboard first, then train the model."}
                </p>
              </div>
              {stats?.totalVulnerabilities ? (
                <Badge variant="outline" className="mt-2">
                  {stats.totalVulnerabilities} vulnerabilities available for training
                </Badge>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Accuracy
                </CardTitle>
                <Target className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-accuracy">
                  {((metrics?.accuracy || 0) * 100).toFixed(1)}%
                </div>
                <Progress value={(metrics?.accuracy || 0) * 100} className="mt-2" />
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Precision
                </CardTitle>
                <Zap className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-precision">
                  {((metrics?.precision || 0) * 100).toFixed(1)}%
                </div>
                <Progress value={(metrics?.precision || 0) * 100} className="mt-2" />
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Recall
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-recall">
                  {((metrics?.recall || 0) * 100).toFixed(1)}%
                </div>
                <Progress value={(metrics?.recall || 0) * 100} className="mt-2" />
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  F1 Score
                </CardTitle>
                <BarChart3 className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-f1">
                  {((metrics?.f1Score || 0) * 100).toFixed(1)}%
                </div>
                <Progress value={(metrics?.f1Score || 0) * 100} className="mt-2" />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Model Performance</CardTitle>
                <CardDescription>Overall metrics visualization</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid className="stroke-muted" />
                      <PolarAngleAxis dataKey="subject" className="text-xs" />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} />
                      <Radar
                        name="Model"
                        dataKey="A"
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary))"
                        fillOpacity={0.3}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Feature Importance</CardTitle>
                <CardDescription>Contribution to risk prediction</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={featureImportanceData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis dataKey="name" type="category" width={100} className="text-xs" />
                      <Tooltip />
                      <Bar 
                        dataKey="importance" 
                        fill="hsl(var(--primary))" 
                        radius={[0, 4, 4, 0]} 
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Training Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex items-center gap-3 p-4 rounded-lg border">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Training Samples</p>
                    <p className="font-medium" data-testid="text-samples">
                      {metrics?.samplesUsed || 0}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-lg border">
                  <Brain className="h-5 w-5 text-purple-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Algorithm</p>
                    <p className="font-medium">Random Forest</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-lg border">
                  <Clock className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Last Trained</p>
                    <p className="font-medium" data-testid="text-trained-at">
                      {metrics?.trainedAt 
                        ? new Date(metrics.trainedAt).toLocaleString()
                        : "Never"
                      }
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
