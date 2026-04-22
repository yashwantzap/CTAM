import { z } from "zod";

// Simple user model for RBAC (file-based storage)
export interface User {
  id: string;
  username: string;
  password: string;
  // admin, soc_analyst, auditor
  role: string;
}

export const insertUserSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(3),
  role: z.enum(["admin", "soc_analyst", "auditor"]).default("soc_analyst"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;

// Vulnerability schema
export interface Vulnerability {
  id: string;
  cveId: string;
  vendorProject: string;
  product: string;
  vulnerabilityName: string;
  shortDescription: string;
  dateAdded: string;
  dueDate: string;
  requiredAction: string;
  knownRansomwareCampaignUse: string;
  notes: string;
  cwes: string[];
}

// Risk prediction result
export interface RiskPrediction {
  cveId: string;
  riskLevel: "Low" | "Medium" | "High";
  probability: number;
  features: {
    hasExploit: boolean;
    daysSinceDisclosure: number;
    ransomwareUse: boolean;
    cvssScore: number;
  };
}

// Mitigation plan
export interface MitigationPlan {
  cveId: string;
  riskLevel: string;
  urgency: string;
  mitigation: string;
  steps: string[];
  generatedAt: string;
}

// Audit log entry
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  user: string;
  details: string;
  category: "data_collection" | "model_training" | "analysis" | "alert" | "system";
}

// Alert entry
export interface AlertEntry {
  id: string;
  cveId: string;
  riskLevel: string;
  probability: number;
  mitigation: string;
  timestamp: string;
  status: "pending" | "acknowledged" | "resolved";
  triggeredBy: string;
}

// Model metrics
export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  trainedAt: string;
  samplesUsed: number;
  featureImportance: Record<string, number>;
}

// Dashboard stats
export interface DashboardStats {
  totalVulnerabilities: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  pendingAlerts: number;
  modelAccuracy: number;
  lastDataCollection: string;
  lastModelTraining: string;
}

// Analysis request/response
export const analyzeVulnerabilitySchema = z.object({
  cveId: z.string().min(1, "CVE ID is required"),
});

export type AnalyzeVulnerabilityRequest = z.infer<typeof analyzeVulnerabilitySchema>;

export interface AnalyzeVulnerabilityResponse {
  vulnerability: Vulnerability | null;
  prediction: RiskPrediction;
  mitigation: MitigationPlan;
}

// Custom vulnerability analysis request/response
export const analyzeCustomVulnerabilitySchema = z.object({
  name: z.string().min(1, "Vulnerability name is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  vendor: z.string().optional(),
  product: z.string().optional(),
  hasKnownExploit: z.boolean().default(false),
  isUsedInRansomware: z.boolean().default(false),
  daysSinceDisclosure: z.number().min(0).default(0),
  cweType: z.string().optional(),
});

export type AnalyzeCustomVulnerabilityRequest = z.infer<typeof analyzeCustomVulnerabilitySchema>;

export interface AnalyzeCustomVulnerabilityResponse {
  vulnerability: {
    name: string;
    description: string;
    vendor?: string;
    product?: string;
  };
  prediction: {
    riskLevel: "Low" | "Medium" | "High";
    probability: number;
    features: {
      hasExploit: boolean;
      daysSinceDisclosure: number;
      ransomwareUse: boolean;
      cweAssigned: boolean;
    };
  };
  mitigation: {
    urgency: string;
    summary: string;
    steps: string[];
    generatedAt: string;
  };
}
