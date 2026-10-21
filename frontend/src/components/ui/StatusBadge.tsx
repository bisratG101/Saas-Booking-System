import type { ReactNode } from "react";

export type StatusVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "confirmed"
  | "pending"
  | "cancelled"
  | "active"
  | "inactive";

export interface StatusBadgeProps {
  status: StatusVariant | string;
  label?: string;
  children?: ReactNode;
  showDot?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function StatusBadge({
  status,
  label,
  children,
  showDot = true,
  size = "sm",
  className = "",
}: StatusBadgeProps) {
  // Normalize status string
  const normalized = (status || "").toLowerCase();

  let variant: "success" | "warning" | "danger" | "info" | "neutral" = "neutral";

  if (
    ["active", "confirmed", "success", "open", "completed", "paid"].includes(
      normalized
    )
  ) {
    variant = "success";
  } else if (
    ["pending", "warning", "trial", "past_due", "awaiting"].includes(
      normalized
    )
  ) {
    variant = "warning";
  } else if (
    ["cancelled", "canceled", "danger", "error", "inactive", "suspended", "closed"].includes(
      normalized
    )
  ) {
    variant = "danger";
  } else if (["info", "customer", "pro", "business"].includes(normalized)) {
    variant = "info";
  }

  const styles = {
    success: {
      bg: "bg-[#DCFCE7] text-[#16A34A] border-[#BBF7D0]",
      dot: "bg-[#16A34A]",
    },
    warning: {
      bg: "bg-[#FEF3C7] text-[#D97706] border-[#FDE68A]",
      dot: "bg-[#D97706]",
    },
    danger: {
      bg: "bg-[#FEE2E2] text-[#DC2626] border-[#FECACA]",
      dot: "bg-[#DC2626]",
    },
    info: {
      bg: "bg-[#E8F0FE] text-[#2563EB] border-[#BFDBFE]",
      dot: "bg-[#2563EB]",
    },
    neutral: {
      bg: "bg-[#EFEEEB] text-[#6B6B6B] border-[#E7E7E4]",
      dot: "bg-[#A1A1AA]",
    },
  }[variant];

  const sizeClasses =
    size === "sm"
      ? "text-[11px] px-2 py-0.5 gap-1.5 font-medium"
      : "text-xs px-2.5 py-1 gap-2 font-medium";

  const displayText =
    children || label || (normalized.charAt(0).toUpperCase() + normalized.slice(1));

  return (
    <span
      className={`inline-flex items-center rounded-md border ${styles.bg} ${sizeClasses} ${className} select-none leading-none`}
    >
      {showDot && (
        <span
          className={`h-1.5 w-1.5 rounded-full shrink-0 ${styles.dot}`}
          aria-hidden="true"
        />
      )}
      <span>{displayText}</span>
    </span>
  );
}
