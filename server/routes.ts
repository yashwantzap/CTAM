import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { fetchCISAKevData } from "./lib/cisaFeed";
import { trainModel, predictRisk, predictRiskFromFeatures } from "./lib/mlModel";
import { generateMitigationPlan, generateCustomMitigationPlan } from "./lib/openai";
import { analyzeVulnerabilitySchema, analyzeCustomVulnerabilitySchema, type AnalyzeCustomVulnerabilityResponse, insertUserSchema } from "@shared/schema";
import { clearSessionCookie, requireAuth, requirePermission, setSessionCookie } from "./auth";
import { sendHighRiskAlertEmail } from "./lib/email";
import bcrypt from "bcrypt";
import pLimit from "p-limit";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Authentication & current user
  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = req.body as {
        username?: string;
        password?: string;
      };

      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Compare password using bcrypt
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      setSessionCookie(res, user.id);

      await storage.addAuditLog({
        action: "User Login",
        user: user.username,
        details: `User ${user.username} logged in`,
        category: "system",
      });

      res.json({ id: user.id, username: user.username, role: user.role });
    } catch (error) {
      console.error("Error during login:", error);
      res.status(500).json({ message: "Failed to login" });
    }
  });

  app.post("/api/logout", requireAuth(), async (req, res) => {
    try {
      const username = req.user?.username ?? "unknown";

      clearSessionCookie(res);

      await storage.addAuditLog({
        action: "User Logout",
        user: username,
        details: `User ${username} logged out`,
        category: "system",
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error during logout:", error);
      res.status(500).json({ message: "Failed to logout" });
    }
  });

  app.get("/api/me", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { id, username, role } = req.user;
    res.json({ id, username, role });
  });

  // (Optional) user creation endpoint for seeding additional accounts
  app.post("/api/users", requirePermission("manage_users"), async (req, res) => {
    try {
      const parsed = insertUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid payload" });
      }

      const existing = await storage.getUserByUsername(parsed.data.username);
      if (existing) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Hash password with bcrypt
      const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
      const userData = {
        ...parsed.data,
        password: hashedPassword,
      };

      const user = await storage.createUser(userData);

      await storage.addAuditLog({
        action: "User Created",
        user: req.user?.username ?? "system",
        details: `Created user ${user.username} with role ${user.role}`,
        category: "system",
      });

      res.status(201).json({ id: user.id, username: user.username, role: user.role });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", requirePermission("view_dashboard"), async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // Collect data from CISA KEV feed
  app.post("/api/collectdata", requirePermission("collect_data"), async (req, res) => {
    try {
      const vulnerabilities = await fetchCISAKevData();
      await storage.setVulnerabilities(vulnerabilities);
      await storage.updateLastDataCollection();
      
      await storage.addAuditLog({
        action: "Data Collection",
        user: "system",
        details: `Collected ${vulnerabilities.length} vulnerabilities from CISA KEV feed`,
        category: "data_collection"
      });
      
      res.json({ 
        success: true, 
        count: vulnerabilities.length,
        message: `Successfully collected ${vulnerabilities.length} vulnerabilities`
      });
    } catch (error) {
      console.error("Error collecting data:", error);
      
      await storage.addAuditLog({
        action: "Data Collection Failed",
        user: "system",
        details: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        category: "data_collection"
      });
      
      res.status(500).json({ error: "Failed to collect vulnerability data" });
    }
  });

  // Train ML model (XGBoost + Random Forest ensemble with proper train/test split)
  app.post("/api/trainmodel", requirePermission("train_model"), async (req, res) => {
    try {
      const vulnerabilities = await storage.getVulnerabilities();

      if (vulnerabilities.length === 0) {
        return res.status(400).json({
          error: "No vulnerability data available. Please collect data first."
        });
      }

      console.log(`[API] Training ensemble model with ${vulnerabilities.length} vulnerabilities...`);

      // Train ensemble model (Python: XGBoost + Random Forest)
      const metrics = await trainModel();

      await storage.setModelMetrics(metrics);
      await storage.updateLastModelTraining();

      await storage.addAuditLog({
        action: "Model Training",
        user: req.user?.username ?? "system",
        details: `Ensemble model trained (XGBoost + Random Forest) with ${metrics.samplesUsed} samples. Accuracy: ${(metrics.accuracy * 100).toFixed(1)}%`,
        category: "model_training"
      });

      res.json({
        success: true,
        metrics: {
          accuracy: (metrics.accuracy * 100).toFixed(1) + "%",
          precision: (metrics.precision * 100).toFixed(1) + "%",
          recall: (metrics.recall * 100).toFixed(1) + "%",
          f1Score: (metrics.f1Score * 100).toFixed(1) + "%",
          samplesUsed: metrics.samplesUsed,
          testSamples: (metrics as any).testSamples || "N/A",
          trainedAt: metrics.trainedAt
        }
      });
    } catch (error) {
      console.error("Error training model:", error);

      await storage.addAuditLog({
        action: "Model Training Failed",
        user: "system",
        details: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        category: "model_training"
      });

      res.status(500).json({ error: "Failed to train model" });
    }
  });

  // Analyze a vulnerability using ensemble ML model
  app.post("/api/analyzevulnerability", requirePermission("analyze_vulnerability"), async (req, res) => {
    try {
      const validation = analyzeVulnerabilitySchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({ error: validation.error.errors[0].message });
      }

      const { cveId } = validation.data;

      // Find vulnerability
      let vulnerability = await storage.getVulnerabilityByCveId(cveId);

      if (!vulnerability) {
        // Try to fetch fresh data
        const freshData = await fetchCISAKevData();
        vulnerability = freshData.find(v => v.cveId.toLowerCase() === cveId.toLowerCase());

        if (!vulnerability) {
          return res.status(404).json({
            error: `Vulnerability ${cveId} not found in CISA KEV database`
          });
        }
      }

      // Predict risk using ensemble model
      const prediction = await predictRisk(vulnerability);
      await storage.addPrediction(prediction);

      // Generate mitigation plan
      const mitigationResult = await generateMitigationPlan(
        vulnerability.cveId,
        vulnerability.vulnerabilityName,
        vulnerability.shortDescription,
        prediction.riskLevel,
        prediction.probability
      );

      const mitigation = {
        cveId: vulnerability.cveId,
        riskLevel: prediction.riskLevel,
        urgency: mitigationResult.urgency,
        mitigation: mitigationResult.mitigation,
        steps: mitigationResult.steps,
        generatedAt: new Date().toISOString()
      };

      await storage.addMitigation(mitigation);

      // Create alert for high risk vulnerabilities
      if (prediction.riskLevel === "High" && prediction.probability >= 0.8) {
        console.log(`[Route] High-risk alert triggered for ${vulnerability.cveId}`);
        const alert = await storage.addAlert({
          cveId: vulnerability.cveId,
          riskLevel: prediction.riskLevel,
          probability: prediction.probability,
          mitigation: mitigation.mitigation,
          status: "pending",
          triggeredBy: "vulnerability_analysis"
        });
        sendHighRiskAlertEmail(alert, req.user?.role, req.user?.id).catch((err) =>
          console.error("Email dispatch failed:", err),
        );
      }

      await storage.addAuditLog({
        action: "Vulnerability Analysis",
        user: req.user?.username ?? "system",
        details: `Analyzed ${cveId}: ${prediction.riskLevel} risk (${(prediction.probability * 100).toFixed(1)}% confidence)`,
        category: "analysis"
      });

      res.json({
        vulnerability,
        prediction,
        mitigation
      });
    } catch (error) {
      console.error("Error analyzing vulnerability:", error);
      res.status(500).json({ error: "Failed to analyze vulnerability" });
    }
  });

  // Analyze a custom vulnerability using ensemble ML model
  app.post("/api/analyzecustomvulnerability", requirePermission("analyze_custom_vulnerability"), async (req, res) => {
    try {
      const validation = analyzeCustomVulnerabilitySchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({ error: validation.error.errors[0].message });
      }

      const { name, description, vendor, product, hasKnownExploit, isUsedInRansomware, daysSinceDisclosure, cweType } = validation.data;

      // Additional validation
      if (daysSinceDisclosure < 0 || daysSinceDisclosure > 36500) {
        return res.status(400).json({ error: "daysSinceDisclosure must be between 0 and 36500 days (100 years)" });
      }

      const trimmedName = name.trim();
      const trimmedDesc = description.trim();
      if (trimmedName.length === 0 || trimmedDesc.length === 0) {
        return res.status(400).json({ error: "Name and description cannot be empty or whitespace only" });
      }

      // Predict risk using ensemble ML model
      const prediction = await predictRiskFromFeatures({
        hasKnownExploit: hasKnownExploit ?? false,
        daysSinceDisclosure: daysSinceDisclosure ?? 0,
        isUsedInRansomware: isUsedInRansomware ?? false,
        hasCwe: !!cweType,
        description: `${name} ${description || ''}`
      });

      // Generate mitigation plan
      const mitigation = await generateCustomMitigationPlan(
        name,
        description,
        prediction.riskLevel,
        prediction.probability
      );

      // Create alert for high risk custom vulnerabilities
      if (prediction.riskLevel === "High" && prediction.probability >= 0.8) {
        const alert = await storage.addAlert({
          cveId: `custom-${Date.now()}`,
          riskLevel: prediction.riskLevel,
          probability: prediction.probability,
          mitigation: mitigation.summary,
          status: "pending",
          triggeredBy: "custom_vulnerability_analysis"
        });
        sendHighRiskAlertEmail(alert, req.user?.role, req.user?.id).catch((err) =>
          console.error("Email dispatch failed:", err),
        );
      }

      await storage.addAuditLog({
        action: "Custom Vulnerability Analysis",
        user: req.user?.username ?? "system",
        details: `Analyzed custom vulnerability "${name}": ${prediction.riskLevel} risk (${(prediction.probability * 100).toFixed(1)}% confidence)`,
        category: "analysis"
      });

      const response: AnalyzeCustomVulnerabilityResponse = {
        vulnerability: {
          name,
          description,
          vendor,
          product
        },
        prediction: {
          riskLevel: prediction.riskLevel,
          probability: prediction.probability,
          features: prediction.features
        },
        mitigation: {
          urgency: mitigation.urgency,
          summary: mitigation.summary,
          steps: mitigation.steps,
          generatedAt: new Date().toISOString()
        }
      };

      res.json(response);
    } catch (error) {
      console.error("Error analyzing custom vulnerability:", error);
      res.status(500).json({ error: "Failed to analyze custom vulnerability" });
    }
  });

  // Get all vulnerabilities
  app.get("/api/vulnerabilities", requirePermission("view_vulnerabilities"), async (req, res) => {
    try {
      const vulnerabilities = await storage.getVulnerabilities();
      const predictions = await storage.getPredictions();
      
      // Merge vulnerabilities with their predictions
      const enrichedVulns = vulnerabilities.map(vuln => {
        const prediction = predictions.find(p => p.cveId === vuln.cveId);
        return { ...vuln, prediction };
      });
      
      res.json(enrichedVulns);
    } catch (error) {
      console.error("Error fetching vulnerabilities:", error);
      res.status(500).json({ error: "Failed to fetch vulnerabilities" });
    }
  });

  // Get predictions
  app.get("/api/predictions", requireAuth(), async (req, res) => {
    try {
      const predictions = await storage.getPredictions();
      res.json(predictions);
    } catch (error) {
      console.error("Error fetching predictions:", error);
      res.status(500).json({ error: "Failed to fetch predictions" });
    }
  });

  // Get model metrics
  app.get("/api/model/metrics", requirePermission("view_model_metrics"), async (req, res) => {
    try {
      const metrics = await storage.getModelMetrics();
      res.json(metrics || { trained: false });
    } catch (error) {
      console.error("Error fetching model metrics:", error);
      res.status(500).json({ error: "Failed to fetch model metrics" });
    }
  });

  // Get audit logs
  app.get("/api/auditlogs", requirePermission("view_audit_logs"), async (req, res) => {
    try {
      const logs = await storage.getAuditLogs();
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  // Get alerts
  app.get("/api/alerts", requirePermission("view_alerts"), async (req, res) => {
    try {
      const alerts = await storage.getAlerts();
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  // Update alert status
  app.patch("/api/alerts/:id", requirePermission("acknowledge_alert"), async (req, res) => {
    try {
      const { id } = req.params as { id: string };
      const { status } = req.body as { status: unknown };

      const validStatuses: Array<"pending" | "acknowledged" | "resolved"> = ["pending", "acknowledged", "resolved"];
      if (!validStatuses.includes(status as "pending" | "acknowledged" | "resolved")) {
        return res.status(400).json({ error: "Invalid status" });
      }

      await storage.updateAlertStatus(id, status as "pending" | "acknowledged" | "resolved");
      
      await storage.addAuditLog({
        action: "Alert Status Update",
        user: "system",
        details: `Alert ${id} status changed to ${status}`,
        category: "alert"
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating alert:", error);
      res.status(500).json({ error: "Failed to update alert" });
    }
  });

  // Get mitigations
  app.get("/api/mitigations", requirePermission("view_mitigations"), async (req, res) => {
    try {
      const mitigations = await storage.getMitigations();
      res.json(mitigations);
    } catch (error) {
      console.error("Error fetching mitigations:", error);
      res.status(500).json({ error: "Failed to fetch mitigations" });
    }
  });

  app.post("/api/analyzeall", requirePermission("analyze_all_vulnerabilities"), async (req, res) => {
  try {
    const vulnerabilities = await storage.getVulnerabilities();

    if (vulnerabilities.length === 0) {
      return res.status(400).json({
        error: "No vulnerabilities available. Collect data first."
      });
    }

    let analyzedCount = 0;
    let alertsCreated = 0;

    // Limit concurrency to 5 parallel predictions to avoid system resource exhaustion
    const limit = pLimit(5);

    const analysisPromises = vulnerabilities.map(vuln =>
      limit(async () => {
        try {
          // Predict risk
          const prediction = await predictRisk(vuln);
          await storage.addPrediction(prediction);

          // Generate mitigation
          const mitigationResult = await generateMitigationPlan(
            vuln.cveId,
            vuln.vulnerabilityName,
            vuln.shortDescription,
            prediction.riskLevel,
            prediction.probability
          );

          const mitigation = {
            cveId: vuln.cveId,
            riskLevel: prediction.riskLevel,
            urgency: mitigationResult.urgency,
            mitigation: mitigationResult.mitigation,
            steps: mitigationResult.steps,
            generatedAt: new Date().toISOString()
          };

          await storage.addMitigation(mitigation);

          // Create alert if high risk
          if (prediction.riskLevel === "High" && prediction.probability >= 0.8) {
            const alert = await storage.addAlert({
              cveId: vuln.cveId,
              riskLevel: prediction.riskLevel,
              probability: prediction.probability,
              mitigation: mitigation.mitigation,
              status: "pending",
              triggeredBy: "bulk_analysis"
            });

            alertsCreated++;

            // Fire and forget email sending for each high-risk alert
            sendHighRiskAlertEmail(alert, req.user?.role, req.user?.id).catch((err) =>
              console.error("Email dispatch failed:", err),
            );
          }

          analyzedCount++;
        } catch (error) {
          console.error(`Failed to analyze vulnerability ${vuln.cveId}:`, error);
        }
      })
    );

    // Wait for all analysis to complete
    await Promise.all(analysisPromises);

    await storage.addAuditLog({
      action: "Bulk Vulnerability Analysis",
      user: "system",
      details: `Analyzed ${analyzedCount} vulnerabilities. Alerts created: ${alertsCreated}`,
      category: "analysis"
    });

    res.json({
      success: true,
      analyzed: analyzedCount,
      alertsCreated
    });

  } catch (error) {
    console.error("Bulk analysis error:", error);
    res.status(500).json({ error: "Failed to analyze vulnerabilities" });
  }
});

  // Get mitigation by CVE ID
  app.get("/api/mitigations/:cveId", requirePermission("view_mitigations"), async (req, res) => {
    try {
      const { cveId } = req.params as { cveId: string };
      const mitigation = await storage.getMitigationByCveId(cveId);
      
      if (!mitigation) {
        return res.status(404).json({ error: "Mitigation not found" });
      }
      
      res.json(mitigation);
    } catch (error) {
      console.error("Error fetching mitigation:", error);
      res.status(500).json({ error: "Failed to fetch mitigation" });
    }
  });

  return httpServer;
}

