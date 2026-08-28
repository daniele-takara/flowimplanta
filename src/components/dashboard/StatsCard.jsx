import { cn } from "@/lib/utils";

export default function StatsCard({ title, value, subtitle, icon: Icon, color = "blue", trend, onClick, active }) {
  const colors = {
    blue: { bg: "bg-blue-50", icon: "text-blue-600", border: "border-blue-100", ring: "ring-blue-400" },
    green: { bg: "bg-green-50", icon: "text-green-600", border: "border-green-100", ring: "ring-green-400" },
    orange: { bg: "bg-orange-50", icon: "text-orange-600", border: "border-orange-100", ring: "ring-orange-400" },
    red: { bg: "bg-red-50", icon: "text-red-600", border: "border-red-100", ring: "ring-red-400" },
    purple: { bg: "bg-purple-50", icon: "text-purple-600", border: "border-purple-100", ring: "ring-purple-400" },
    slate: { bg: "bg-slate-50", icon: "text-slate-600", border: "border-slate-100", ring: "ring-slate-400" }
  };
  const c = colors[color];
  const Comp = onClick ? "button" : "div";

  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "bg-white rounded-xl border p-5 text-left transition-all w-full",
        c.border,
        onClick && "cursor-pointer hover:shadow-md hover:-translate-y-0.5",
        active && cn("ring-2 ring-offset-1", c.ring)
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{title}</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
          {trend && (
            <p className={cn("text-xs mt-2 font-medium", trend.positive ? "text-green-600" : "text-red-600")}>
              {trend.label}
            </p>
          )}
        </div>
        <div className={cn("p-3 rounded-xl", c.bg)}>
          <Icon className={cn("w-5 h-5", c.icon)} />
        </div>
      </div>
    </Comp>
  );
}