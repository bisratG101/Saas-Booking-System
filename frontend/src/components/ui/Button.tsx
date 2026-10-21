import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "accent";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  leftIcon,
  rightIcon,
  className = "",
  disabled,
  children,
  ...props
}: ButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none";

  const variantStyles = {
    // Primary is dark charcoal / black per design tokens (#111111)
    primary:
      "bg-[#111111] text-white hover:bg-[#27272A] active:bg-[#09090B] focus:ring-[#111111] shadow-xs",
    secondary:
      "bg-white border border-[#E7E7E4] text-[#18181B] hover:bg-[#F4F4F5] active:bg-[#EFEEEB] focus:ring-[#E7E7E4] shadow-xs",
    outline:
      "border border-[#E7E7E4] text-[#18181B] hover:bg-[#F4F4F5] active:bg-[#EFEEEB] focus:ring-[#18181B]",
    ghost:
      "text-[#18181B] hover:bg-[#EFEEEB] active:bg-[#E7E7E4] focus:ring-slate-300",
    danger:
      "bg-[#DC2626] text-white hover:bg-[#B91C1C] active:bg-[#991B1B] focus:ring-[#DC2626] shadow-xs",
    accent:
      "bg-[#2563EB] text-white hover:bg-[#1D4ED8] active:bg-[#1E40AF] focus:ring-[#2563EB] shadow-xs",
  }[variant];

  const sizeStyles = {
    sm: "px-2.5 py-1 text-xs gap-1.5",
    md: "px-3.5 py-1.5 text-sm gap-2",
    lg: "px-4.5 py-2 text-base gap-2.5",
  }[size];

  return (
    <button
      className={`${baseStyles} ${variantStyles} ${sizeStyles} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="inline-flex items-center gap-2">
          <svg
            className="animate-spin -ml-0.5 h-3.5 w-3.5 text-current"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>{children}</span>
        </span>
      ) : (
        <>
          {leftIcon && <span className="inline-flex items-center">{leftIcon}</span>}
          <span>{children}</span>
          {rightIcon && <span className="inline-flex items-center">{rightIcon}</span>}
        </>
      )}
    </button>
  );
}
