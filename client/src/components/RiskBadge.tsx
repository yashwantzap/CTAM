import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RiskBadgeProps {
  level: "High" | "Medium" | "Low";
  className?: string;
  showIcon?: boolean;
}

export function RiskBadge({ level, className, showIcon = false }: RiskBadgeProps) {
  const variants = {
    High: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    Medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    Low: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
  };

  return (
    <Badge 
      variant="outline" 
      className={cn(variants[level], "font-medium", className)}
      data-testid={`badge-risk-${level.toLowerCase()}`}
    >
      {showIcon && (
        <span className={cn(
          "mr-1.5 h-1.5 w-1.5 rounded-full",
          level === "High" && "bg-red-500",
          level === "Medium" && "bg-amber-500",
          level === "Low" && "bg-emerald-500"
        )} />
      )}
      {level}
    </Badge>
  );
}
