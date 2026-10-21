import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 bg-white rounded-xl border border-dashed border-[#E7E7E4] ${className}`}
    >
      <div className="h-12 w-12 rounded-full bg-[#EFEEEB] border border-[#E7E7E4] flex items-center justify-center text-[#6B6B6B] mb-4 shrink-0 shadow-xs">
        {icon ? icon : <Inbox className="h-6 w-6 stroke-[1.5]" />}
      </div>
      <h3 className="text-base font-semibold text-[#18181B] tracking-tight">
        {title}
      </h3>
      <p className="text-sm text-[#6B6B6B] mt-1.5 max-w-sm leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
