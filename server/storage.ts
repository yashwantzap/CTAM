import type {
  User, InsertUser, Vulnerability, RiskPrediction,
  MitigationPlan, AuditLogEntry, AlertEntry, ModelMetrics, DashboardStats
} from "@shared/schema";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import bcrypt from "bcrypt";

// Data directory for persistent storage
const DATA_DIR = path.join(process.cwd(), "data");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper functions for file operations
function loadFromFile<T>(filename: string, defaultValue: T): T {
  const filePath = path.join(DATA_DIR, filename);
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error(`Error loading ${filename}:`, error);
  }
  return defaultValue;
}

function saveToFile<T>(filename: string, data: T): boolean {
  const filePath = path.join(DATA_DIR, filename);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (error) {
    console.error(`Error saving ${filename}:`, error instanceof Error ? error.message : String(error));
    return false;
  }
}

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Vulnerabilities
  getVulnerabilities(): Promise<Vulnerability[]>;
  setVulnerabilities(vulnerabilities: Vulnerability[]): Promise<void>;
  getVulnerabilityByCveId(cveId: string): Promise<Vulnerability | undefined>;
  
  // Predictions
  getPredictions(): Promise<RiskPrediction[]>;
  addPrediction(prediction: RiskPrediction): Promise<void>;
  getPredictionByCveId(cveId: string): Promise<RiskPrediction | undefined>;
  
  // Mitigations
  getMitigations(): Promise<MitigationPlan[]>;
  addMitigation(mitigation: MitigationPlan): Promise<void>;
  getMitigationByCveId(cveId: string): Promise<MitigationPlan | undefined>;
  
  // Audit Logs
  getAuditLogs(): Promise<AuditLogEntry[]>;
  addAuditLog(entry: Omit<AuditLogEntry, "id" | "timestamp">): Promise<AuditLogEntry>;
  
  // Alerts
  getAlerts(): Promise<AlertEntry[]>;
  addAlert(alert: Omit<AlertEntry, "id" | "timestamp">): Promise<AlertEntry>;
  updateAlertStatus(id: string, status: AlertEntry["status"]): Promise<void>;
  
  // Model Metrics
  getModelMetrics(): Promise<ModelMetrics | null>;
  setModelMetrics(metrics: ModelMetrics): Promise<void>;
  
  // Dashboard Stats
  getDashboardStats(): Promise<DashboardStats>;
  updateLastDataCollection(): Promise<void>;
  updateLastModelTraining(): Promise<void>;
}

interface StorageState {
  lastDataCollection: string;
  lastModelTraining: string;
}

export class FileStorage implements IStorage {
  private users: Map<string, User>;
  private vulnerabilities: Vulnerability[];
  private predictions: Map<string, RiskPrediction>;
  private mitigations: Map<string, MitigationPlan>;
  private auditLogs: AuditLogEntry[];
  private alerts: AlertEntry[];
  private modelMetrics: ModelMetrics | null;
  private lastDataCollection: string;
  private lastModelTraining: string;

  constructor() {
    // Load data from files or use defaults
    const usersArray: User[] = loadFromFile("users.json", []);
    this.users = new Map(usersArray.map(u => [u.id, u]));
    
    this.vulnerabilities = loadFromFile("vulnerabilities.json", []);
    
    const predictionsArray: RiskPrediction[] = loadFromFile("predictions.json", []);
    this.predictions = new Map(predictionsArray.map(p => [p.cveId.toLowerCase(), p]));

    const mitigationsArray: MitigationPlan[] = loadFromFile("mitigations.json", []);
    this.mitigations = new Map(mitigationsArray.map(m => [m.cveId.toLowerCase(), m]));
    
    this.auditLogs = loadFromFile("auditLogs.json", []);
    this.alerts = loadFromFile("alerts.json", []);
    this.modelMetrics = loadFromFile("modelMetrics.json", null);
    
    const state: StorageState = loadFromFile("state.json", { 
      lastDataCollection: "", 
      lastModelTraining: "" 
    });
    this.lastDataCollection = state.lastDataCollection;
    this.lastModelTraining = state.lastModelTraining;
    
    // Create default admin user if no users exist
    if (this.users.size === 0) {
      const adminId = randomUUID();
      // Use environment variable or generate temporary password
      const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || "AdminChangeMe123!";
      const hashedPassword = bcrypt.hashSync(defaultPassword, 10);

      this.users.set(adminId, {
        id: adminId,
        username: "admin",
        password: hashedPassword,
        role: "admin",
      });
      this.saveUsers();
      console.warn("⚠️  SECURITY: Default admin user created");
      console.warn("⚠️  Default credentials:");
      console.warn(`    Username: admin`);
      console.warn(`    Password: ${defaultPassword}`);
      console.warn("⚠️  CHANGE PASSWORD IMMEDIATELY IN PRODUCTION!");
    }
    
    console.log(`Loaded data: ${this.vulnerabilities.length} vulnerabilities, ${this.predictions.size} predictions, ${this.alerts.length} alerts`);
  }

  // Save helpers
  private saveUsers(): void {
    saveToFile("users.json", Array.from(this.users.values()));
  }

  private saveVulnerabilities(): void {
    saveToFile("vulnerabilities.json", this.vulnerabilities);
  }

  private savePredictions(): void {
    saveToFile("predictions.json", Array.from(this.predictions.values()));
  }

  private saveMitigations(): void {
    saveToFile("mitigations.json", Array.from(this.mitigations.values()));
  }

  private saveAuditLogs(): boolean {
    return saveToFile("auditLogs.json", this.auditLogs);
  }

  private saveAlerts(): void {
    saveToFile("alerts.json", this.alerts);
  }

  private saveModelMetrics(): void {
    saveToFile("modelMetrics.json", this.modelMetrics);
  }

  private saveState(): void {
    saveToFile("state.json", {
      lastDataCollection: this.lastDataCollection,
      lastModelTraining: this.lastModelTraining
    });
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    this.saveUsers();
    return user;
  }

  // Vulnerabilities
  async getVulnerabilities(): Promise<Vulnerability[]> {
    return this.vulnerabilities;
  }

  async setVulnerabilities(vulnerabilities: Vulnerability[]): Promise<void> {
    this.vulnerabilities = vulnerabilities;
    this.saveVulnerabilities();
  }

  async getVulnerabilityByCveId(cveId: string): Promise<Vulnerability | undefined> {
    return this.vulnerabilities.find(v => 
      v.cveId.toLowerCase() === cveId.toLowerCase()
    );
  }

  // Predictions
  async getPredictions(): Promise<RiskPrediction[]> {
    return Array.from(this.predictions.values());
  }

  async addPrediction(prediction: RiskPrediction): Promise<void> {
    this.predictions.set(prediction.cveId.toLowerCase(), prediction);
    this.savePredictions();
  }

  async getPredictionByCveId(cveId: string): Promise<RiskPrediction | undefined> {
    return this.predictions.get(cveId.toLowerCase());
  }

  // Mitigations
  async getMitigations(): Promise<MitigationPlan[]> {
    return Array.from(this.mitigations.values());
  }

  async addMitigation(mitigation: MitigationPlan): Promise<void> {
    this.mitigations.set(mitigation.cveId.toLowerCase(), mitigation);
    this.saveMitigations();
  }

  async getMitigationByCveId(cveId: string): Promise<MitigationPlan | undefined> {
    return this.mitigations.get(cveId.toLowerCase());
  }

  // Audit Logs
  async getAuditLogs(): Promise<AuditLogEntry[]> {
    return this.auditLogs.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  async addAuditLog(entry: Omit<AuditLogEntry, "id" | "timestamp">): Promise<AuditLogEntry> {
    const log: AuditLogEntry = {
      ...entry,
      id: randomUUID(),
      timestamp: new Date().toISOString()
    };
    this.auditLogs.push(log);
    const saved = this.saveAuditLogs();
    if (!saved) {
      console.warn(`Audit log may not have been persisted: ${entry.action} by ${entry.user}`);
    }
    return log;
  }

  // Alerts
  async getAlerts(): Promise<AlertEntry[]> {
    return this.alerts.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  async addAlert(alert: Omit<AlertEntry, "id" | "timestamp">): Promise<AlertEntry> {
    const entry: AlertEntry = {
      ...alert,
      id: randomUUID(),
      timestamp: new Date().toISOString()
    };
    this.alerts.push(entry);
    this.saveAlerts();
    return entry;
  }

  async updateAlertStatus(id: string, status: AlertEntry["status"]): Promise<void> {
    const alertIndex = this.alerts.findIndex(a => a.id === id);
    if (alertIndex !== -1) {
      this.alerts[alertIndex] = { ...this.alerts[alertIndex], status };
      this.saveAlerts();
    }
  }

  // Model Metrics
  async getModelMetrics(): Promise<ModelMetrics | null> {
    return this.modelMetrics;
  }

  async setModelMetrics(metrics: ModelMetrics): Promise<void> {
    this.modelMetrics = metrics;
    this.saveModelMetrics();
  }

  // Dashboard Stats
  async getDashboardStats(): Promise<DashboardStats> {
    const predictions = Array.from(this.predictions.values());
    const pendingAlerts = this.alerts.filter(a => a.status === "pending").length;
    
    return {
      totalVulnerabilities: this.vulnerabilities.length,
      highRiskCount: predictions.filter(p => p.riskLevel === "High").length,
      mediumRiskCount: predictions.filter(p => p.riskLevel === "Medium").length,
      lowRiskCount: predictions.filter(p => p.riskLevel === "Low").length,
      pendingAlerts,
      modelAccuracy: this.modelMetrics?.accuracy || 0,
      lastDataCollection: this.lastDataCollection,
      lastModelTraining: this.lastModelTraining
    };
  }

  async updateLastDataCollection(): Promise<void> {
    this.lastDataCollection = new Date().toISOString();
    this.saveState();
  }

  async updateLastModelTraining(): Promise<void> {
    this.lastModelTraining = new Date().toISOString();
    this.saveState();
  }
}

export const storage = new FileStorage();
