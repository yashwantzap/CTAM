import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { storage } from "./storage";
import type { User } from "@shared/schema";

const SESSION_COOKIE_NAME = "ctam_session";

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set");
  }
  return secret;
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return header.split(";").reduce<Record<string, string>>((acc, part) => {
    const [key, ...rest] = part.trim().split("=");
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

interface SessionPayload {
  userId: string;
}

function signSession(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const hmac = crypto
    .createHmac("sha256", getSessionSecret())
    .update(data)
    .digest("base64url");
  return `${data}.${hmac}`;
}

function verifySession(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;

  const expected = crypto
    .createHmac("sha256", getSessionSecret())
    .update(data)
    .digest("base64url");

  const valid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected),
  );
  if (!valid) return null;

  try {
    const json = Buffer.from(data, "base64url").toString("utf-8");
    return JSON.parse(json) as SessionPayload;
  } catch {
    return null;
  }
}

declare module "express-serve-static-core" {
  interface Request {
    user?: User;
  }
}

export enum UserRole {
  ADMIN = "admin",
  SOC_ANALYST = "soc_analyst",
  AUDITOR = "auditor",
}

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.ADMIN]: [
    "view_dashboard",
    "view_stats",
    "view_vulnerabilities",
    "analyze_vulnerability",
    "analyze_custom_vulnerability",
    "analyze_all_vulnerabilities",
    "train_model",
    "view_model_metrics",
    "view_alerts",
    "acknowledge_alert",
    "resolve_alert",
    "create_alert",
    "send_alert_email",
    "view_audit_logs",
    "view_mitigations",
    "manage_users",
    "manage_roles",
    "collect_data",
    "export_data",
    "configure_settings",
  ],
  [UserRole.SOC_ANALYST]: [
    "view_dashboard",
    "view_stats",
    "view_vulnerabilities",
    "analyze_vulnerability",
    "analyze_custom_vulnerability",
    "analyze_all_vulnerabilities",
    "view_model_metrics",
    "view_alerts",
    "acknowledge_alert",
    "resolve_alert",
    "send_alert_email",
    "view_audit_logs",
    "view_mitigations",
  ],
  [UserRole.AUDITOR]: [
    "view_dashboard",
    "view_stats",
    "view_vulnerabilities",
    "view_alerts",
    "view_audit_logs",
    "view_model_metrics",
    "view_mitigations",
    "export_reports",
  ],
};

function getUserRole(user: User | undefined): UserRole | null {
  if (!user) return null;
  if (user.role === UserRole.ADMIN) return UserRole.ADMIN;
  if (user.role === UserRole.SOC_ANALYST) return UserRole.SOC_ANALYST;
  if (user.role === UserRole.AUDITOR) return UserRole.AUDITOR;
  return null;
}

export function userHasPermission(user: User | undefined, permission: string) {
  const role = getUserRole(user);
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[SESSION_COOKIE_NAME];
    const session = verifySession(token);
    if (!session) {
      return next();
    }

    const user = await storage.getUser(session.userId);
    if (!user) {
      return next();
    }

    req.user = user;
    return next();
  } catch {
    return next();
  }
}

export function setSessionCookie(res: Response, userId: string) {
  const token = signSession({ userId });
  const isProduction = process.env.NODE_ENV === "production";
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (isProduction) {
    parts.push("Secure");
  }
  res.setHeader("Set-Cookie", parts.join("; "));
}

export function clearSessionCookie(res: Response) {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }
  res.setHeader("Set-Cookie", parts.join("; "));
}

export function requireAuth() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    return next();
  };
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    if (!userHasPermission(req.user, permission)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    return next();
  };
}

