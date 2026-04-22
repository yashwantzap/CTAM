/**
 * ML Model Module - Wrapper for Python ensemble ML model
 * Handles training and predictions using XGBoost + Random Forest ensemble
 */

import type { Vulnerability, RiskPrediction, ModelMetrics } from "@shared/schema";
import { trainMLModel, predictVulnerabilityRisk } from "./mlWrapper";

/**
 * Add training data and train the ensemble model
 * This is a legacy interface - actual training is done in Python
 */
export async function addTrainingData(vulnerabilities: Vulnerability[]): Promise<void> {
  // Data is loaded directly from storage in Python ML module
  // This function is kept for API compatibility
  console.log(`[ML] Preparing ${vulnerabilities.length} vulnerabilities for training`);
}

/**
 * Train the ensemble model using Python ML module
 * Uses XGBoost and Random Forest with proper train/test split
 */
export async function trainModel(): Promise<ModelMetrics> {
  console.log("[ML] Starting Python ensemble model training...");
  const metrics = await trainMLModel();
  return metrics;
}

/**
 * Predict risk for a vulnerability using the trained ensemble model
 */
export async function predictRisk(vulnerability: Vulnerability): Promise<RiskPrediction> {
  return predictVulnerabilityRisk(vulnerability);
}

/**
 * Predict risk from custom features
 * Legacy interface for custom vulnerability analysis
 */
export async function predictRiskFromFeatures(features: {
  hasKnownExploit: boolean;
  daysSinceDisclosure: number;
  isUsedInRansomware: boolean;
  hasCwe: boolean;
  description: string;
}): Promise<RiskPrediction> {
  // Convert to vulnerability-like structure for prediction
  const vuln: Vulnerability = {
    id: `custom-${Date.now()}`,
    cveId: `CUSTOM-${Date.now()}`,
    vendorProject: "Custom",
    product: "Custom",
    vulnerabilityName: features.description.split('\n')[0].substring(0, 100),
    shortDescription: features.description.substring(0, 200),
    dateAdded: new Date(Date.now() - features.daysSinceDisclosure * 24 * 60 * 60 * 1000).toISOString(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    requiredAction: features.hasKnownExploit ? "Apply patches immediately" : "Monitor",
    knownRansomwareCampaignUse: features.isUsedInRansomware ? "known" : "unknown",
    notes: features.description,
    cwes: features.hasCwe ? ["CWE-Unknown"] : [],
  };

  const prediction = await predictVulnerabilityRisk(vuln);

  // Return with the custom CVE ID format
  return {
    ...prediction,
    cveId: `CUSTOM-${Date.now()}`,
  };
}

/**
 * Reset all model state
 */
export function resetModel(): void {
  console.log("[ML] Model state reset (Python models persist on disk)");
}
