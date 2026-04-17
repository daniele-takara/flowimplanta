import { cn, statusColor } from "@/lib/utils";

export default function StatusBadge({ status, className }) {
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", statusColor(status), className)}>
      {status}
    </span>
  );
}