import { useMemo } from "react";

/**
 * Color mapping utilities for consistent styling across the app
 */
export const COLOR_CLASSES = {
  urgency: {
    Immediate: "bg-red-500/10 text-red-600 dark:text-red-400",
    High: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    Medium: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    Low: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  status: {
    pending: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    acknowledged: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    resolved: "bg-green-500/10 text-green-600 dark:text-green-400",
  },
  category: {
    data_collection: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    model_training: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    analysis: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    alert: "bg-red-500/10 text-red-600 dark:text-red-400",
    system: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
  },
} as const;

/**
 * Get color classes for urgency level
 */
export function getUrgencyClass(urgency: string): string {
  return COLOR_CLASSES.urgency[urgency as keyof typeof COLOR_CLASSES.urgency] ||
    COLOR_CLASSES.urgency.Low;
}

/**
 * Get color classes for status
 */
export function getStatusClass(status: string): string {
  return COLOR_CLASSES.status[status as keyof typeof COLOR_CLASSES.status] ||
    COLOR_CLASSES.status.pending;
}

/**
 * Get color classes for category
 */
export function getCategoryClass(category: string): string {
  return COLOR_CLASSES.category[category as keyof typeof COLOR_CLASSES.category] ||
    COLOR_CLASSES.category.system;
}

/**
 * Format date to readable string
 */
export function formatDate(dateString: string | undefined): string {
  if (!dateString) return "Unknown";
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Invalid date";
  }
}

/**
 * Format date to relative time (e.g., "2 days ago")
 */
export function formatRelativeTime(dateString: string | undefined): string {
  if (!dateString) return "Unknown";
  try {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    const intervals: { [key: string]: number } = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60,
    };

    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secondsInUnit);
      if (interval >= 1) {
        return `${interval} ${unit}${interval > 1 ? "s" : ""} ago`;
      }
    }
    return "Just now";
  } catch {
    return "Unknown";
  }
}

/**
 * Format percentage for display
 */
export function formatPercent(value: number | undefined, decimals = 1): string {
  if (value === undefined || value === null) return "N/A";
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Safe HTML rendering: only allowed tags and attributes
 * Prevents XSS attacks
 */
export function sanitizeHtml(html: string | undefined): string {
  if (!html) return "";

  // Remove script tags and event handlers
  let sanitized = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/on\w+\s*=\s*[^\s>]*/gi, "")
    .replace(/javascript:/gi, "");

  // Remove dangerous protocols
  sanitized = sanitized.replace(/href\s*=\s*["']?(?!(?:https?:|\/|#))/gi, 'href="');

  return sanitized;
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string | undefined, maxLength: number): string {
  if (!text) return "";
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
}

/**
 * Hook to memoize formatting operations
 */
export function useFormattedData<T>(
  data: T | undefined,
  formatter: (data: T) => any,
  dependencies: any[] = []
) {
  return useMemo(() => {
    if (!data) return null;
    try {
      return formatter(data);
    } catch (error) {
      console.error("Formatting error:", error);
      return null;
    }
  }, [data, ...dependencies]);
}
