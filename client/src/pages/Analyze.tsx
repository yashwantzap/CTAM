import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Search,
  AlertTriangle,
  Shield,
  CheckCircle2,
  Loader2,
  Sparkles,
  Target,
  Clock,
  FileWarning,
  PenLine,
  InfoIcon
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { RiskBadge } from "@/components/RiskBadge";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { analyzeCustomVulnerabilitySchema, type AnalyzeVulnerabilityResponse, type AnalyzeCustomVulnerabilityResponse, type AnalyzeCustomVulnerabilityRequest } from "@shared/schema";
import { hasPermission } from "@/lib/auth";

export default function Analyze() {
  const searchParams = useSearch();
  const params = new URLSearchParams(searchParams);
  const initialCve = params.get("cve") || "";

  const [cveId, setCveId] = useState(initialCve);
  const [result, setResult] = useState<AnalyzeVulnerabilityResponse | null>(null);
  const [customResult, setCustomResult] = useState<AnalyzeCustomVulnerabilityResponse | null>(null);
  const [activeTab, setActiveTab] = useState("cve");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  const canSendAlertEmail = user ? hasPermission(user.role, "send_alert_email") : false;

  const form = useForm<AnalyzeCustomVulnerabilityRequest>({
    resolver: zodResolver(analyzeCustomVulnerabilitySchema),
    defaultValues: {
      name: "",
      description: "",
      vendor: "",
      product: "",
      hasKnownExploit: false,
      isUsedInRansomware: false,
      daysSinceDisclosure: 0,
      cweType: "",
    },
  });

  useEffect(() => {
    if (initialCve) {
      setCveId(initialCve);
    }
  }, [initialCve]);

  const analyzeMutation = useMutation({
    mutationFn: async (cve: string) => {
      const response = await apiRequest("POST", "/api/analyzevulnerability", { cveId: cve });
      const data = await response.json();
      return data as AnalyzeVulnerabilityResponse;
    },
    onSuccess: (data: AnalyzeVulnerabilityResponse) => {
      setResult(data);
      setCustomResult(null);
      queryClient.invalidateQueries({ queryKey: ["/api/predictions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Analysis Complete",
        description: `${data.prediction?.cveId || data.vulnerability?.cveId} classified as ${data.prediction?.riskLevel} risk`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze vulnerability",
        variant: "destructive",
      });
    },
  });

  const analyzeCustomMutation = useMutation({
    mutationFn: async (data: AnalyzeCustomVulnerabilityRequest) => {
      const response = await apiRequest("POST", "/api/analyzecustomvulnerability", data);
      const result = await response.json();
      return result as AnalyzeCustomVulnerabilityResponse;
    },
    onSuccess: (data: AnalyzeCustomVulnerabilityResponse) => {
      setCustomResult(data);
      setResult(null);
      queryClient.invalidateQueries({ queryKey: ["/api/auditlogs"] });
      toast({
        title: "Analysis Complete",
        description: `"${data.vulnerability.name}" classified as ${data.prediction.riskLevel} risk`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze custom vulnerability",
        variant: "destructive",
      });
    },
  });

  const handleAnalyze = () => {
    if (!cveId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a CVE ID",
        variant: "destructive",
      });
      return;
    }
    analyzeMutation.mutate(cveId.trim().toUpperCase());
  };

  const onCustomSubmit = (data: AnalyzeCustomVulnerabilityRequest) => {
    analyzeCustomMutation.mutate(data);
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "Immediate": return "bg-red-500/10 text-red-600 dark:text-red-400";
      case "High": return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
      case "Medium": return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
      default: return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    }
  };

  const isPending = analyzeMutation.isPending || analyzeCustomMutation.isPending;
  const hasResult = result || customResult;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
          Analyze Vulnerability
        </h1>
        <p className="text-muted-foreground">
          Get AI-powered risk prediction and mitigation guidance
        </p>
      </div>

      {!canSendAlertEmail && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
          <InfoIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">⚠️ Email notification permission</p>
            <p className="text-xs mt-1 opacity-90">Your role cannot send alert email notifications. High-risk vulnerabilities will be detected and alerts created, but email notifications will not be sent.</p>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="cve" className="gap-2" data-testid="tab-cve-lookup">
            <Search className="h-4 w-4" />
            CVE Lookup
          </TabsTrigger>
          <TabsTrigger value="custom" className="gap-2" data-testid="tab-custom-vuln">
            <PenLine className="h-4 w-4" />
            Custom Vulnerability
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cve" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                CVE Lookup
              </CardTitle>
              <CardDescription>
                Enter the CVE identifier (e.g., CVE-2024-1234)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Input
                    placeholder="CVE-2024-XXXXX"
                    value={cveId}
                    onChange={(e) => setCveId(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                    className="font-mono text-lg"
                    data-testid="input-cve-id"
                  />
                </div>
                <Button 
                  onClick={handleAnalyze}
                  disabled={analyzeMutation.isPending}
                  size="lg"
                  data-testid="button-analyze"
                >
                  {analyzeMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Analyze
                    </>
                  )}
                </Button>

                <Button
  onClick={async () => {
    const res = await fetch("/api/analyzeall", {
      method: "POST"
    });

    const data = await res.json();

    alert(`Analyzed ${data.analyzed} vulnerabilities`);
  }}
>
  Analyze All Vulnerabilities
</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PenLine className="h-5 w-5" />
                Custom Vulnerability Analysis
              </CardTitle>
              <CardDescription>
                Enter your vulnerability details for risk assessment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onCustomSubmit)} className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vulnerability Name *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="e.g., SQL Injection in Login Form" 
                              {...field} 
                              data-testid="input-custom-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="cweType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CWE Type (Optional)</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="e.g., CWE-89" 
                              {...field} 
                              data-testid="input-custom-cwe"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description *</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe the vulnerability, how it was discovered, and its potential impact..." 
                            className="min-h-[100px]"
                            {...field} 
                            data-testid="input-custom-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="vendor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vendor (Optional)</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="e.g., Microsoft" 
                              {...field} 
                              data-testid="input-custom-vendor"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="product"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Product (Optional)</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="e.g., Windows Server" 
                              {...field} 
                              data-testid="input-custom-product"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="daysSinceDisclosure"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Days Since Discovery</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            data-testid="input-custom-days"
                          />
                        </FormControl>
                        <FormDescription>
                          How many days ago was this vulnerability discovered?
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-6 md:grid-cols-2 p-4 rounded-lg bg-muted/50">
                    <FormField
                      control={form.control}
                      name="hasKnownExploit"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between gap-4">
                          <div className="space-y-0.5">
                            <FormLabel>Known Exploit Available</FormLabel>
                            <FormDescription>
                              Is there a public exploit for this vulnerability?
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-custom-exploit"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="isUsedInRansomware"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between gap-4">
                          <div className="space-y-0.5">
                            <FormLabel>Used in Ransomware</FormLabel>
                            <FormDescription>
                              Is this vulnerability used in ransomware campaigns?
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-custom-ransomware"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button 
                    type="submit"
                    disabled={analyzeCustomMutation.isPending}
                    size="lg"
                    className="w-full"
                    data-testid="button-analyze-custom"
                  >
                    {analyzeCustomMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Analyze Vulnerability
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {isPending && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-medium">Analyzing vulnerability...</p>
                <p className="text-sm text-muted-foreground">
                  Running ML prediction and generating mitigation plan
                </p>
              </div>
              <Progress value={66} className="w-64" />
            </div>
          </CardContent>
        </Card>
      )}

      {result && !isPending && result.prediction && result.mitigation && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Vulnerability Details
                </CardTitle>
                <RiskBadge level={result.prediction.riskLevel} showIcon />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">CVE ID</p>
                <p className="font-mono font-medium text-lg" data-testid="text-result-cve">
                  {result.vulnerability?.cveId || "N/A"}
                </p>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">Vendor / Product</p>
                <p className="font-medium">
                  {result.vulnerability?.vendorProject || "N/A"} - {result.vulnerability?.product || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vulnerability Name</p>
                <p className="font-medium">{result.vulnerability?.vulnerabilityName || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="text-sm">{result.vulnerability?.shortDescription || "No description available."}</p>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Date Added</p>
                  <p className="font-medium">
                    {result.vulnerability?.dateAdded 
                      ? new Date(result.vulnerability.dateAdded).toLocaleDateString()
                      : "N/A"
                    }
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ransomware Use</p>
                  <Badge 
                    variant={result.vulnerability?.knownRansomwareCampaignUse === "Known" ? "destructive" : "outline"}
                  >
                    {result.vulnerability?.knownRansomwareCampaignUse || "Unknown"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Risk Prediction
              </CardTitle>
              <CardDescription>ML model analysis results</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm text-muted-foreground">Risk Level</p>
                  <p className="text-2xl font-bold" data-testid="text-risk-level">
                    {result.prediction.riskLevel}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Confidence</p>
                  <p className="text-2xl font-bold" data-testid="text-confidence">
                    {((result.prediction.probability || 0.7) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">Feature Analysis</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 p-2 rounded border">
                    {result.prediction.features?.hasExploit ? (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    )}
                    <span className="text-sm">
                      {result.prediction.features?.hasExploit ? "Exploit Available" : "No Known Exploit"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded border">
                    {result.prediction.features?.ransomwareUse ? (
                      <FileWarning className="h-4 w-4 text-red-500" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    )}
                    <span className="text-sm">
                      {result.prediction.features?.ransomwareUse ? "Ransomware Use" : "No Ransomware"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded border col-span-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {result.prediction.features?.daysSinceDisclosure || 0} days since disclosure
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    AI-Generated Mitigation Plan
                  </CardTitle>
                  <CardDescription>Powered by OpenAI</CardDescription>
                </div>
                <Badge className={getUrgencyColor(result.mitigation.urgency)}>
                  {result.mitigation.urgency} Priority
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <p className="font-medium text-primary mb-1">Summary</p>
                <p data-testid="text-mitigation-summary">{result.mitigation.mitigation}</p>
              </div>

              <div>
                <p className="font-medium mb-3">Remediation Steps</p>
                <ol className="space-y-2">
                  {result.mitigation.steps?.map((step: string, index: number) => (
                    <li 
                      key={index} 
                      className="flex gap-3 p-3 rounded-lg border hover-elevate"
                      data-testid={`text-mitigation-step-${index}`}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <p className="text-xs text-muted-foreground">
                Generated at: {result.mitigation.generatedAt ? new Date(result.mitigation.generatedAt).toLocaleString() : "N/A"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {customResult && !isPending && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Vulnerability Details
                </CardTitle>
                <RiskBadge level={customResult.prediction.riskLevel} showIcon />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Vulnerability Name</p>
                <p className="font-medium text-lg" data-testid="text-custom-result-name">
                  {customResult.vulnerability.name}
                </p>
              </div>
              <Separator />
              {(customResult.vulnerability.vendor || customResult.vulnerability.product) && (
                <div>
                  <p className="text-sm text-muted-foreground">Vendor / Product</p>
                  <p className="font-medium">
                    {customResult.vulnerability.vendor || "N/A"} - {customResult.vulnerability.product || "N/A"}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="text-sm" data-testid="text-custom-result-description">
                  {customResult.vulnerability.description}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Risk Prediction
              </CardTitle>
              <CardDescription>ML model analysis results</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm text-muted-foreground">Risk Level</p>
                  <p className="text-2xl font-bold" data-testid="text-custom-risk-level">
                    {customResult.prediction.riskLevel}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Confidence</p>
                  <p className="text-2xl font-bold" data-testid="text-custom-confidence">
                    {((customResult.prediction.probability || 0.7) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">Feature Analysis</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 p-2 rounded border">
                    {customResult.prediction.features.hasExploit ? (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    )}
                    <span className="text-sm">
                      {customResult.prediction.features.hasExploit ? "Exploit Available" : "No Known Exploit"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded border">
                    {customResult.prediction.features.ransomwareUse ? (
                      <FileWarning className="h-4 w-4 text-red-500" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    )}
                    <span className="text-sm">
                      {customResult.prediction.features.ransomwareUse ? "Ransomware Use" : "No Ransomware"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded border">
                    {customResult.prediction.features.cweAssigned ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm">
                      {customResult.prediction.features.cweAssigned ? "CWE Assigned" : "No CWE"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded border">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {customResult.prediction.features.daysSinceDisclosure} days old
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    AI-Generated Mitigation Plan
                  </CardTitle>
                  <CardDescription>Powered by OpenAI</CardDescription>
                </div>
                <Badge className={getUrgencyColor(customResult.mitigation.urgency)}>
                  {customResult.mitigation.urgency} Priority
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <p className="font-medium text-primary mb-1">Summary</p>
                <p data-testid="text-custom-mitigation-summary">{customResult.mitigation.summary}</p>
              </div>

              <div>
                <p className="font-medium mb-3">Remediation Steps</p>
                <ol className="space-y-2">
                  {customResult.mitigation.steps.map((step: string, index: number) => (
                    <li 
                      key={index} 
                      className="flex gap-3 p-3 rounded-lg border hover-elevate"
                      data-testid={`text-custom-mitigation-step-${index}`}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <p className="text-xs text-muted-foreground">
                Generated at: {customResult.mitigation.generatedAt ? new Date(customResult.mitigation.generatedAt).toLocaleString() : "N/A"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {!hasResult && !isPending && (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <div className="rounded-full bg-muted p-6">
                {activeTab === "cve" ? (
                  <Search className="h-12 w-12 text-muted-foreground" />
                ) : (
                  <PenLine className="h-12 w-12 text-muted-foreground" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  {activeTab === "cve" 
                    ? "Enter a CVE ID to analyze" 
                    : "Enter vulnerability details"
                  }
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto mt-1">
                  The system will use machine learning to predict the risk level 
                  and generate an AI-powered mitigation plan
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
