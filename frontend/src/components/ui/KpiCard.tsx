import type { ReactNode } from "react";
import { Sparkline } from "./Sparkline";
import { SkeletonKpi } from "./Skeleton";
import { TrendingUp, TrendingDown } from "lucide-react";

export interface KpiCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  subtitle?: string;
  icon?: ReactNode;
  sparklineData?: number[];
  isLoading?: boolean;
  className?: string;
}

export function KpiCard({
  title,
  value,
  change,
  changeType = "neutral",
  subtitle,
  icon,
  sparklineData,
  isLoading = false,
  className = "",
}: KpiCardProps) {
  if (isLoading) {
    return <SkeletonKpi />;
  }

  const changeColor = {
    positive: "text-[#16A34A] bg-[#DCFCE7] border-[#BBF7D0]",
    negative: "text-[#DC2626] bg-[#FEE2E2] border-[#FECACA]",
    neutral: "text-[#6B6B6B] bg-[#EFEEEB] border-[#E7E7E4]",
  }[changeType];

  return (
    <div
      className={`bg-white rounded-xl border border-[#E7E7E4] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all hover:border-[#D4D4D0] flex flex-col justify-between ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#6B6B6B]">
          {title}
        </span>
        {icon && (
          <div className="h-8 w-8 rounded-lg bg-[#EFEEEB] border border-[#E7E7E4] flex items-center justify-center text-[#18181B] shrink-0">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-4">
        <div>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[#18181B]">
            {value}
          </div>
          {subtitle && (
            <div className="text-xs text-[#6B6B6B] mt-0.5">{subtitle}</div>
          )}
        </div>

        {sparklineData && sparklineData.length > 0 && (
          <div className="shrink-0 pt-1">
            <Sparkline
              data={sparklineData}
              width={80}
              height={28}
              color={changeType === "negative" ? "#DC2626" : "#2563EB"}
              filled
            />
          </div>
        )}
      </div>

      {change && (
        <div className="mt-4 pt-3 border-t border-[#F4F4F5] flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded border ${changeColor}`}
          >
            {changeType === "positive" && <TrendingUp className="h-3 w-3" />}
            {changeType === "negative" && <TrendingDown className="h-3 w-3" />}
            {change}
          </span>
          <span className="text-[11px] text-[#6B6B6B]">vs. previous period</span>
        </div>
      )}
    </div>
  );
}
