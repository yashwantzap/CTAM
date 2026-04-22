/**
 * SafeHtml component - Prevents XSS attacks by sanitizing HTML
 * Use instead of directly rendering user-generated or API content
 */

import { HTMLAttributes } from "react";
import { sanitizeHtml } from "@/hooks/use-formatting";

interface SafeHtmlProps extends HTMLAttributes<HTMLDivElement> {
  html: string | undefined;
  as?: "div" | "span" | "p" | "section";
}

export function SafeHtml({
  html,
  as: Component = "div",
  className = "",
  ...props
}: SafeHtmlProps) {
  if (!html) {
    return <Component className={className} {...props} />;
  }

  const sanitized = sanitizeHtml(html);

  // Use dangerouslySetInnerHTML only after sanitization
  return (
    <Component
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitized }}
      {...props}
    />
  );
}

/**
 * SafeText component - Plain text rendering (no HTML)
 * Safe alternative when HTML is not needed
 */
interface SafeTextProps extends HTMLAttributes<HTMLDivElement> {
  text: string | undefined;
  as?: "div" | "span" | "p" | "section";
  maxLength?: number;
  truncate?: boolean;
}

export function SafeText({
  text,
  as: Component = "div",
  maxLength,
  truncate = false,
  className = "",
  ...props
}: SafeTextProps) {
  if (!text) {
    return <Component className={className} {...props} />;
  }

  let displayText = text;

  if (maxLength && truncate && text.length > maxLength) {
    displayText = `${text.substring(0, maxLength)}...`;
  }

  return (
    <Component
      className={className}
      title={maxLength && truncate && text.length > maxLength ? text : undefined}
      {...props}
    >
      {displayText}
    </Component>
  );
}

/**
 * Array of allowed HTML tags for sanitization
 * Extend as needed based on your security requirements
 */
export const ALLOWED_TAGS = ["b", "i", "u", "strong", "em", "code", "pre", "p", "br", "a"];

/**
 * Validates if tag is in allowed list
 */
export function isAllowedTag(tag: string): boolean {
  return ALLOWED_TAGS.includes(tag.toLowerCase());
}
