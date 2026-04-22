export enum UserRole {
  ADMIN = "admin",
  SOC_ANALYST = "soc_analyst",
  AUDITOR = "auditor",
}

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
}

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
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

export function hasPermission(role: UserRole, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getRolePermissions(role: UserRole): string[] {
  return ROLE_PERMISSIONS[role] || [];
}

export function hasAllPermissions(role: UserRole, permissions: string[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

export function hasAnyPermission(role: UserRole, permissions: string[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}
