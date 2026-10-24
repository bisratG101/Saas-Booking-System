export interface DateBadgeProps {
  date: string | Date;
  time?: string;
  size?: "sm" | "md";
  className?: string;
}

export function DateBadge({
  date,
  time,
  size = "md",
  className = "",
}: DateBadgeProps) {
  const d = typeof date === "string" ? new Date(date) : date;
  const isValid = !isNaN(d.getTime());

  const month = isValid
    ? d.toLocaleString("en-US", { month: "short" }).toUpperCase()
    : "DATE";
  const day = isValid ? d.getDate() : "--";
  const weekday = isValid
    ? d.toLocaleString("en-US", { weekday: "short" })
    : "";

  const containerSizes = {
    sm: "w-11 py-1",
    md: "w-14 py-1.5",
  }[size];

  const monthSizes = {
    sm: "text-[9px]",
    md: "text-[10px]",
  }[size];

  const daySizes = {
    sm: "text-base font-bold",
    md: "text-lg font-bold",
  }[size];

  return (
    <div
      className={`inline-flex flex-col items-center justify-center rounded-lg bg-white border border-[#E7E7E4] shadow-xs select-none text-center ${containerSizes} ${className}`}
    >
      <span className={`font-semibold tracking-wider text-[#285943] leading-none ${monthSizes}`}>
        {month}
      </span>
      <span className={`text-[#18181B] leading-tight my-0.5 ${daySizes}`}>
        {day}
      </span>
      {weekday && (
        <span className="text-[9px] font-medium text-[#6B6B6B] leading-none">
          {weekday}
        </span>
      )}
      {time && (
        <span className="text-[9px] font-mono text-[#6B6B6B] border-t border-[#E7E7E4] pt-0.5 mt-0.5 w-full">
          {time}
        </span>
      )}
    </div>
  );
}
