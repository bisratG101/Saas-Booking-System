import type { ReactNode } from "react";

export interface CardProps {
  title?: string;
  subtitle?: string;
  headerAction?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function Card({
  title,
  subtitle,
  headerAction,
  children,
  footer,
  className = "",
  noPadding = false,
}: CardProps) {
  return (
    <div
      className={`bg-white rounded-xl border border-[#E7E7E4] shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden transition-all ${className}`}
    >
      {(title || subtitle || headerAction) && (
        <div className="px-5 py-4 border-b border-[#E7E7E4] flex items-center justify-between gap-4">
          <div>
            {title && (
              <h3 className="font-semibold text-[#18181B] text-base leading-tight">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-[#6B6B6B] mt-0.5 leading-normal">
                {subtitle}
              </p>
            )}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}

      <div className={noPadding ? "" : "p-5"}>{children}</div>

      {footer && (
        <div className="px-5 py-3 bg-[#FAFAF8] border-t border-[#E7E7E4]">
          {footer}
        </div>
      )}
    </div>
  );
}

export function CardHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`px-5 py-4 border-b border-[#E7E7E4] flex items-center justify-between gap-4 ${className}`}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h3
      className={`font-semibold text-[#18181B] text-base leading-tight ${className}`}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={`text-xs text-[#6B6B6B] mt-0.5 leading-normal ${className}`}>
      {children}
    </p>
  );
}

export function CardContent({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}

export function CardFooter({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`px-5 py-3 bg-[#FAFAF8] border-t border-[#E7E7E4] ${className}`}
    >
      {children}
    </div>
  );
}
