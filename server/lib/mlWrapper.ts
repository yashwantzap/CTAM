import { spawn } from "child_process";
import path from "path";
import * as fs from "fs";
import type { Vulnerability, ModelMetrics, RiskPrediction } from "@shared/schema";
import { storage } from "../storage";

export interface PredictionResult {
  riskLevel: "Low" | "Medium" | "High";
  probability: number;
  confidence: number;
  features: {
    hasExploit: boolean;
    daysSinceDisclosure: number;
    ransomwareUse: boolean;
    cvssScore: number;
  };
}

/**
 * Call Python ML model for training
 */
export async function trainMLModel(): Promise<ModelMetrics> {
  return new Promise((resolve, reject) => {
    console.log("[MLWrapper] Starting Python ML training...");

    const pythonProcess = spawn("python", [path.join(process.cwd(), "ml_model.py")], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    pythonProcess.on("error", (error) => {
      reject(new Error(`Failed to spawn Python training process: ${error.message}`));
    });

    pythonProcess.stdout?.on("data", (data) => {
      stdout += data.toString();
      console.log(`[ML] ${data.toString().trim()}`);
    });

    pythonProcess.stderr?.on("data", (data) => {
      stderr += data.toString();
      console.error(`[ML Error] ${data.toString().trim()}`);
    });

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Python ML training failed with code ${code}: ${stderr}`));
        return;
      }

      // Read the metrics file
      try {
        const metricsPath = path.join(process.cwd(), "data", "modelMetrics.json");
        const metricsData = JSON.parse(fs.readFileSync(metricsPath, "utf-8"));
        resolve(metricsData as ModelMetrics);
      } catch (error) {
        reject(new Error(`Failed to read metrics: ${error}`));
      }
    });
  });
}

/**
 * Predict risk for a vulnerability using Python ML model
 */
export async function predictVulnerabilityRisk(vuln: Vulnerability): Promise<RiskPrediction> {
  // Call Python module via spawn for prediction
  return new Promise((resolve, reject) => {
    // Safely encode vulnerability data as base64 to prevent code injection
    const vulnJson = JSON.stringify(vuln);
    const encodedVuln = Buffer.from(vulnJson).toString('base64');

    const pythonCode = `
import sys
import json
import base64
sys.path.insert(0, '${process.cwd()}')
from ml_model import MLEnsembleModel

try:
    model = MLEnsembleModel('data')
    model.load_models()

    # Safely decode base64 data
    vuln_data = json.loads(base64.b64decode('${encodedVuln}'))
    result = model.predict_vulnerability(vuln_data)

    print(json.dumps(result))
except Exception as e:
    print(json.dumps({"error": str(e)}), file=sys.stderr)
    sys.exit(1)
`;

    const pythonProcess = spawn("python", ["-c", pythonCode], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    pythonProcess.on("error", (error) => {
      reject(new Error(`Failed to spawn Python process: ${error.message}`));
    });

    pythonProcess.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    pythonProcess.on("close", (code) => {
      if (code !== 0 || stderr) {
        console.warn(`[ML] Prediction warning: ${stderr}`);
        // Fallback to rule-based prediction
        resolve(rulBasedPrediction(vuln));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        if (result.error) {
          console.warn(`[ML] Model prediction error: ${result.error}, using fallback`);
          resolve(rulBasedPrediction(vuln));
          return;
        }

        resolve({
          cveId: vuln.cveId,
          riskLevel: result.riskLevel,
          probability: result.probability,
          features: result.features,
        } as RiskPrediction);
      } catch (error) {
        console.warn(`[ML] Failed to parse prediction: ${error}, using fallback`);
        resolve(rulBasedPrediction(vuln));
      }
    });
  });
}

/**
 * Fallback rule-based prediction when Python ML is unavailable
 */
function rulBasedPrediction(vuln: Vulnerability): RiskPrediction {
  let riskScore = 0;

  if (vuln.knownRansomwareCampaignUse?.toLowerCase() === "known") {
    riskScore += 4;
  }

  try {
    const dueDate = new Date(vuln.dueDate);
    const daysUntilDue = Math.floor((dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue <= 7) riskScore += 3;
    else if (daysUntilDue <= 30) riskScore += 2;
    else if (daysUntilDue <= 90) riskScore += 1;
  } catch {}

  const requiredAction = vuln.requiredAction?.toLowerCase() || "";
  if (requiredAction.includes("patch") || requiredAction.includes("update")) {
    riskScore += 1;
  }

  const description = `${vuln.vulnerabilityName || ""} ${vuln.shortDescription || ""} ${vuln.notes || ""}`.toLowerCase();

  if (vuln.cwes?.some(cwe => ["CWE-78", "CWE-89", "CWE-94", "CWE-287"].some(c => cwe.includes(c)))) {
    riskScore += 3;
  }

  if (["rce", "remote code execution", "arbitrary code"].some(term => description.includes(term))) {
    riskScore += 3;
  }

  if (description.includes("privilege escalation") || description.includes("privilege")) {
    riskScore += 2;
  }

  if (description.includes("authentication bypass") || description.includes("auth bypass")) {
    riskScore += 2;
  }

  if (description.includes("denial of service") || description.includes(" dos ")) {
    riskScore += 1;
  }

  let riskLevel: "Low" | "Medium" | "High";
  let probability: number;

  if (riskScore >= 6) {
    riskLevel = "High";
    probability = 0.85 + (riskScore - 6) * 0.02;
  } else if (riskScore >= 3) {
    riskLevel = "Medium";
    probability = 0.65;
  } else {
    riskLevel = "Low";
    probability = 0.45;
  }

  return {
    cveId: vuln.cveId,
    riskLevel,
    probability: Math.min(probability, 0.99),
    features: {
      hasExploit: description.includes("exploit") ? true : false,
      daysSinceDisclosure: 180 / 365,
      ransomwareUse: vuln.knownRansomwareCampaignUse?.toLowerCase() === "known",
      cvssScore: 7.5,
    },
  };
}
