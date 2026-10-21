export function Skeleton({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`animate-pulse bg-[#E7E7E4]/70 rounded-md ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonLine({
  width = "w-full",
  height = "h-4",
  className = "",
}: {
  width?: string;
  height?: string;
  className?: string;
}) {
  return (
    <div
      className={`animate-pulse bg-[#E7E7E4]/70 rounded ${width} ${height} ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div
      className={`bg-white rounded-xl border border-[#E7E7E4] p-5 space-y-3 ${className}`}
    >
      <div className="flex items-center justify-between pb-2 border-b border-[#E7E7E4]">
        <SkeletonLine width="w-1/3" height="h-5" />
        <SkeletonLine width="w-16" height="h-4" />
      </div>
      {Array.from({ length: lines }).map((_, idx) => (
        <SkeletonLine
          key={idx}
          width={idx === lines - 1 ? "w-2/3" : "w-full"}
          height="h-4"
        />
      ))}
    </div>
  );
}

export function SkeletonKpi() {
  return (
    <div className="bg-white rounded-xl border border-[#E7E7E4] p-5 space-y-3">
      <div className="flex items-center justify-between">
        <SkeletonLine width="w-24" height="h-3.5" />
        <SkeletonLine width="w-8" height="h-8" className="rounded-full" />
      </div>
      <SkeletonLine width="w-20" height="h-7" />
      <SkeletonLine width="w-32" height="h-3" />
    </div>
  );
}
