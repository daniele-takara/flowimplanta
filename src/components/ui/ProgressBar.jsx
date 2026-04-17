import { cn } from "@/lib/utils";

export default function ProgressBar({ value = 0, className, showLabel = true, size = "md" }) {
  const heights = { sm: "h-1.5", md: "h-2", lg: "h-3" };
  const color = value >= 100 ? "bg-green-500" : value >= 70 ? "bg-blue-500" : value >= 40 ? "bg-yellow-500" : "bg-slate-400";

  return (
    <div className={cn("w-full", className)}>
      <div className={cn("w-full bg-slate-200 rounded-full overflow-hidden", heights[size])}>
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-xs text-slate-500 mt-1 text-right">{value}%</p>
      )}
    </div>
  );
}