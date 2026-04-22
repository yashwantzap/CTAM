import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Shield, 
  Search, 
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RiskBadge } from "@/components/RiskBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Vulnerability, RiskPrediction } from "@shared/schema";

interface EnrichedVulnerability extends Vulnerability {
  prediction?: RiskPrediction;
}

const ITEMS_PER_PAGE = 15;

export default function Vulnerabilities() {
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const { data: vulnerabilities, isLoading } = useQuery<EnrichedVulnerability[]>({
    queryKey: ["/api/vulnerabilities"],
  });

  const filteredVulns = vulnerabilities?.filter((vuln) => {
    const matchesSearch = 
      vuln.cveId.toLowerCase().includes(search.toLowerCase()) ||
      vuln.vendorProject.toLowerCase().includes(search.toLowerCase()) ||
      vuln.product.toLowerCase().includes(search.toLowerCase()) ||
      vuln.vulnerabilityName.toLowerCase().includes(search.toLowerCase());
    
    const matchesRisk = 
      riskFilter === "all" || 
      vuln.prediction?.riskLevel === riskFilter ||
      (!vuln.prediction && riskFilter === "unanalyzed");
    
    return matchesSearch && matchesRisk;
  }) || [];

  const totalPages = Math.ceil(filteredVulns.length / ITEMS_PER_PAGE);
  const paginatedVulns = filteredVulns.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-64" />
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
            Vulnerabilities
          </h1>
          <p className="text-muted-foreground">
            {vulnerabilities?.length || 0} vulnerabilities from CISA KEV feed
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search CVE ID, vendor, or product..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10"
            data-testid="input-search-vulnerabilities"
          />
        </div>
        <Select 
          value={riskFilter} 
          onValueChange={(value) => {
            setRiskFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40" data-testid="select-risk-filter">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Risk Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Risks</SelectItem>
            <SelectItem value="High">High Risk</SelectItem>
            <SelectItem value="Medium">Medium Risk</SelectItem>
            <SelectItem value="Low">Low Risk</SelectItem>
            <SelectItem value="unanalyzed">Unanalyzed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {paginatedVulns.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CVE ID</TableHead>
                  <TableHead>Vendor / Product</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Date Added</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedVulns.map((vuln) => (
                  <TableRow 
                    key={vuln.id}
                    className="hover-elevate"
                    data-testid={`row-vulnerability-${vuln.cveId}`}
                  >
                    <TableCell className="font-mono font-medium">
                      {vuln.cveId}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{vuln.vendorProject}</p>
                        <p className="text-sm text-muted-foreground">{vuln.product}</p>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="truncate" title={vuln.vulnerabilityName}>
                        {vuln.vulnerabilityName}
                      </p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(vuln.dateAdded)}
                    </TableCell>
                    <TableCell>
                      {vuln.prediction ? (
                        <RiskBadge level={vuln.prediction.riskLevel} showIcon />
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Not analyzed
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/analyze?cve=${vuln.cveId}`}>
                        <Button size="sm" variant="ghost" data-testid={`button-analyze-${vuln.cveId}`}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Shield className="mx-auto h-12 w-12 opacity-50" />
                <p className="mt-2">No vulnerabilities found</p>
                <p className="text-sm">
                  {vulnerabilities?.length === 0 
                    ? "Collect data from the dashboard to get started"
                    : "Try adjusting your search filters"
                  }
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * ITEMS_PER_PAGE + 1} to{" "}
            {Math.min(page * ITEMS_PER_PAGE, filteredVulns.length)} of{" "}
            {filteredVulns.length} results
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {page} of {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              data-testid="button-next-page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
