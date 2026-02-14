import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@/config/order-statuses";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const label = ORDER_STATUS_LABELS[status as keyof typeof ORDER_STATUS_LABELS] || status;
  const colors = ORDER_STATUS_COLORS[status as keyof typeof ORDER_STATUS_COLORS] || "bg-gray-100 text-gray-800";

  return (
    <Badge variant="secondary" className={`${colors} ${className || ""}`}>
      {label}
    </Badge>
  );
}

// Task status badge
const TASK_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  IN_PROGRESS: "En cours",
  WAITING_APPROVAL: "Approbation",
  BLOCKED: "Bloque",
  COMPLETED: "Termine",
  CANCELLED: "Annule",
};

const TASK_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  WAITING_APPROVAL: "bg-yellow-100 text-yellow-800",
  BLOCKED: "bg-red-100 text-red-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-200 text-gray-500",
};

export function TaskStatusBadge({ status, className }: { status: string; className?: string }) {
  const label = TASK_STATUS_LABELS[status] || status;
  const colors = TASK_STATUS_COLORS[status] || "bg-gray-100 text-gray-800";

  return (
    <Badge variant="secondary" className={`${colors} ${className || ""}`}>
      {label}
    </Badge>
  );
}

// Priority badge
const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Bas",
  NORMAL: "Normal",
  HIGH: "Haut",
  URGENT: "Urgent",
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-600",
  NORMAL: "bg-blue-50 text-blue-700",
  HIGH: "bg-orange-100 text-orange-800",
  URGENT: "bg-red-100 text-red-800",
};

export function PriorityBadge({ priority, className }: { priority: string; className?: string }) {
  const label = PRIORITY_LABELS[priority] || priority;
  const colors = PRIORITY_COLORS[priority] || "bg-gray-100 text-gray-800";

  return (
    <Badge variant="secondary" className={`${colors} ${className || ""}`}>
      {label}
    </Badge>
  );
}
