import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { 
  FileText, 
  Database, 
  Brain, 
  Search as SearchIcon,
  Bell,
  Settings,
  Filter
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AuditLogEntry } from "@shared/schema";

export default function AuditLogs() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: logs, isLoading } = useQuery<AuditLogEntry[]>({
    queryKey: ["/api/auditlogs"],
  });

  const filteredLogs = logs?.filter((log) => {
    const matchesSearch = 
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.details.toLowerCase().includes(search.toLowerCase()) ||
      log.user.toLowerCase().includes(search.toLowerCase());
    
    const matchesCategory = 
      categoryFilter === "all" || log.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  }) || [];

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "data_collection":
        return <Database className="h-4 w-4" />;
      case "model_training":
        return <Brain className="h-4 w-4" />;
      case "analysis":
        return <SearchIcon className="h-4 w-4" />;
      case "alert":
        return <Bell className="h-4 w-4" />;
      default:
        return <Settings className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "data_collection":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
      case "model_training":
        return "bg-purple-500/10 text-purple-600 dark:text-purple-400";
      case "analysis":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
      case "alert":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const formatCategory = (category: string) => {
    return category.split("_").map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(" ");
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
          Audit Logs
        </h1>
        <p className="text-muted-foreground">
          System activity and action history
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="input-search-logs"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48" data-testid="select-category-filter">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="data_collection">Data Collection</SelectItem>
            <SelectItem value="model_training">Model Training</SelectItem>
            <SelectItem value="analysis">Analysis</SelectItem>
            <SelectItem value="alert">Alert</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredLogs.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {filteredLogs.map((log) => (
                <div 
                  key={log.id} 
                  className="flex items-start gap-4 p-4 hover-elevate"
                  data-testid={`log-entry-${log.id}`}
                >
                  <div className={`mt-0.5 rounded-md p-2 ${getCategoryColor(log.category)}`}>
                    {getCategoryIcon(log.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{log.action}</p>
                      <Badge variant="outline" className="text-xs">
                        {formatCategory(log.category)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {log.details}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>User: {log.user}</span>
                      <span>{formatTimestamp(log.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <div className="rounded-full bg-muted p-6">
                <FileText className="h-12 w-12 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">No audit logs found</h3>
                <p className="text-muted-foreground max-w-md mx-auto mt-1">
                  {search || categoryFilter !== "all"
                    ? "Try adjusting your search or filter"
                    : "Audit logs will appear here as you use the system"
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {filteredLogs.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          Showing {filteredLogs.length} of {logs?.length || 0} log entries
        </p>
      )}
    </div>
  );
}
