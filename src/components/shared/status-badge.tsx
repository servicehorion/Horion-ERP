import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
} from "@/config/order-statuses";
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_COLORS,
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
} from "@/config/colors";

interface BadgeProps {
  status: string;
  className?: string;
}

// ─── Order ────────────────────────────────────────────────────────────────────

export function StatusBadge({ status, className }: BadgeProps) {
  const label = ORDER_STATUS_LABELS[status as keyof typeof ORDER_STATUS_LABELS] ?? status;
  const colors = ORDER_STATUS_COLORS[status as keyof typeof ORDER_STATUS_COLORS] ?? "bg-gray-100 text-gray-700";

  return (
    <Badge variant="secondary" className={cn(colors, className)}>
      {label}
    </Badge>
  );
}

// ─── Lead ─────────────────────────────────────────────────────────────────────

export function LeadStatusBadge({ status, className }: BadgeProps) {
  const label = LEAD_STATUS_LABELS[status] ?? status;
  const colors = LEAD_STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700";

  return (
    <Badge variant="secondary" className={cn(colors, className)}>
      {label}
    </Badge>
  );
}

// ─── Task ─────────────────────────────────────────────────────────────────────

export function TaskStatusBadge({ status, className }: BadgeProps) {
  const label = TASK_STATUS_LABELS[status] ?? status;
  const colors = TASK_STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700";

  return (
    <Badge variant="secondary" className={cn(colors, className)}>
      {label}
    </Badge>
  );
}

// ─── Priority ─────────────────────────────────────────────────────────────────

export function PriorityBadge({ priority, className }: { priority: string; className?: string }) {
  const label = PRIORITY_LABELS[priority] ?? priority;
  const colors = PRIORITY_COLORS[priority] ?? "bg-gray-100 text-gray-700";

  return (
    <Badge variant="secondary" className={cn(colors, className)}>
      {label}
    </Badge>
  );
}
