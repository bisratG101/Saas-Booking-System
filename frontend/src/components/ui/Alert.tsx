export interface AlertProps {
  type?: "error" | "warning" | "success" | "info";
  title?: string;
  message: string;
  details?: { path: string; message: string }[];
  className?: string;
}

export function Alert({
  type = "error",
  title,
  message,
  details,
  className = "",
}: AlertProps) {
  const styles = {
    error: "bg-red-50 border-red-200 text-red-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
    info: "bg-blue-50 border-blue-200 text-blue-800",
  }[type];

  return (
    <div
      role="alert"
      className={`p-4 rounded-lg border text-sm ${styles} ${className}`}
    >
      {title && <h4 className="font-semibold mb-1">{title}</h4>}
      <p>{message}</p>
      {details && details.length > 0 && (
        <ul className="mt-2 list-disc list-inside space-y-1">
          {details.map((d, idx) => (
            <li key={idx}>
              <span className="font-mono text-xs font-semibold">{d.path}:</span>{" "}
              {d.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
