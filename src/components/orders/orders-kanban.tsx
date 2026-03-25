"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, MoreHorizontal, CalendarClock, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { updateOrderStatus } from "@/lib/actions/order.actions";
import {
  ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, ORDER_STATUS_TRANSITIONS,
} from "@/config/order-statuses";
import type { OrderStatus } from "@prisma/client";

export type KanbanOrder = {
  id: string;
  orderNumber: string;
  status: string;
  priority: string;
  totalClient: number;
  contactName: string;
  createdAt: Date;
  riskLevel?: string | null;
  estimatedDelivery?: Date | null;
};

const KANBAN_COLUMNS: OrderStatus[] = [
  "DEMANDE",
  "RECHERCHE_PRODUIT",
  "DEVIS",
  "PAIEMENT_EN_COURS",
  "SOURCING",
  "EN_PRODUCTION",
  "RECU_ENTREPOT",
  "QC_EN_COURS",
  "QC_VALIDE",
  "EN_TRANSIT",
  "DEDOUANE",
  "LIVRE",
  "LITIGE",
];

const PRIORITY_COLORS: Record<string, string> = {
  LOW:    "bg-gray-100 text-gray-600",
  NORMAL: "bg-blue-50 text-blue-700",
  HIGH:   "bg-orange-100 text-orange-700",
  URGENT: "bg-red-100 text-red-700",
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Basse", NORMAL: "Normale", HIGH: "Haute", URGENT: "Urgent",
};

// Left border color based on risk level
const RISK_BORDER: Record<string, string> = {
  LOW:      "border-l-green-300",
  MEDIUM:   "border-l-yellow-400",
  HIGH:     "border-l-orange-500",
  CRITICAL: "border-l-red-500",
};

const RISK_LABEL: Record<string, string> = {
  LOW: "Faible", MEDIUM: "Moyen", HIGH: "Élevé", CRITICAL: "Critique",
};

function daysUntil(date: Date): number {
  return Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

interface OrdersKanbanProps {
  orders: KanbanOrder[];
  canUpdateStatus?: boolean;
}

export function OrdersKanban({ orders, canUpdateStatus }: OrdersKanbanProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [movingId, setMovingId] = useState<string | null>(null);

  const byStatus = KANBAN_COLUMNS.reduce<Record<string, KanbanOrder[]>>((acc, col) => {
    acc[col] = orders.filter((o) => o.status === col);
    return acc;
  }, {});

  const visibleColumns = KANBAN_COLUMNS.filter(
    (col, i) => i < 3 || (byStatus[col]?.length ?? 0) > 0
  );

  const handleMove = (orderId: string, newStatus: string) => {
    setMovingId(orderId);
    startTransition(async () => {
      const res = await updateOrderStatus(orderId, newStatus);
      if (res.error) toast.error(res.error);
      else { toast.success("Statut mis à jour"); router.refresh(); }
      setMovingId(null);
    });
  };

  return (
    <div className="overflow-x-auto pb-6">
      <div className="flex gap-3 min-w-max">
        {visibleColumns.map((col) => {
          const cards = byStatus[col] ?? [];
          const colTotal = cards.reduce((s, c) => s + c.totalClient, 0);
          const colColor = (ORDER_STATUS_COLORS as Record<string, string>)[col] ?? "bg-gray-100 text-gray-700";

          return (
            <div key={col} className="flex flex-col w-64 shrink-0">
              {/* Column header */}
              <div className={`flex items-center gap-2 px-3 py-2.5 rounded-t-lg border border-b-0 ${
                col === "LITIGE" ? "bg-red-50 border-red-200" : "bg-muted/50"
              }`}>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${colColor}`}>
                  {ORDER_STATUS_LABELS[col as OrderStatus] ?? col}
                </span>
                <span className="ml-auto flex items-center gap-1">
                  {colTotal > 0 && (
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {colTotal >= 1_000_000 ? `${(colTotal / 1_000_000).toFixed(1)}M` : `${(colTotal / 1_000).toFixed(0)}k`} XAF
                    </span>
                  )}
                  <span className={`text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center ${
                    cards.length > 0 ? "bg-primary/10 text-primary" : "text-muted-foreground"
                  }`}>
                    {cards.length}
                  </span>
                </span>
              </div>

              {/* Cards column */}
              <div className={`flex flex-col gap-2 p-2 min-h-[140px] border rounded-b-lg ${
                col === "LITIGE" ? "bg-red-50/50 border-red-200" : "bg-muted/10"
              }`}>
                {cards.length === 0 && (
                  <p className="text-[11px] text-muted-foreground text-center py-6 italic">Vide</p>
                )}

                {cards.map((order) => {
                  const transitions = (ORDER_STATUS_TRANSITIONS as Record<string, string[]>)[order.status] ?? [];
                  const isMoving = movingId === order.id && isPending;
                  const riskLevel = order.riskLevel ?? "LOW";
                  const riskBorder = RISK_BORDER[riskLevel] ?? "border-l-gray-200";
                  const eta = order.estimatedDelivery ? daysUntil(new Date(order.estimatedDelivery)) : null;

                  return (
                    <div
                      key={order.id}
                      className={`bg-background rounded-md border border-l-4 ${riskBorder} shadow-sm p-3 space-y-2 hover:shadow-md transition-all group`}
                    >
                      {/* Header: N° + menu */}
                      <div className="flex items-start justify-between gap-1">
                        <Link
                          href={`/orders/${order.id}`}
                          className="font-mono text-xs font-semibold text-primary hover:underline truncate"
                        >
                          {order.orderNumber}
                        </Link>
                        {canUpdateStatus && transitions.length > 0 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 opacity-60 group-hover:opacity-100" disabled={isMoving}>
                                {isMoving ? <Loader2 className="h-3 w-3 animate-spin" /> : <MoreHorizontal className="h-3 w-3" />}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="text-xs">
                              {transitions.map((t) => (
                                <DropdownMenuItem key={t} onClick={() => handleMove(order.id, t)} className="text-xs gap-1.5">
                                  <span className="text-muted-foreground">→</span>
                                  {ORDER_STATUS_LABELS[t as OrderStatus] ?? t}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>

                      {/* Client */}
                      <p className="text-xs text-muted-foreground truncate font-medium">{order.contactName}</p>

                      {/* Priority + Amount */}
                      <div className="flex items-center justify-between gap-1">
                        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-4 font-medium ${PRIORITY_COLORS[order.priority] ?? ""}`}>
                          {PRIORITY_LABELS[order.priority] ?? order.priority}
                        </Badge>
                        <span className="text-xs font-semibold tabular-nums">
                          <CurrencyDisplay amount={order.totalClient} currency="XAF" />
                        </span>
                      </div>

                      {/* Risk + ETA row */}
                      <div className="flex items-center justify-between gap-1 pt-0.5 border-t border-muted/50">
                        {riskLevel !== "LOW" && (
                          <span className={`flex items-center gap-0.5 text-[10px] font-medium ${
                            riskLevel === "CRITICAL" ? "text-red-600" :
                            riskLevel === "HIGH"     ? "text-orange-600" : "text-yellow-600"
                          }`}>
                            <ShieldAlert className="h-3 w-3" />
                            {RISK_LABEL[riskLevel]}
                          </span>
                        )}
                        {eta !== null && (
                          <span className={`flex items-center gap-0.5 text-[10px] ml-auto font-medium ${
                            eta < 0 ? "text-red-600" : eta <= 7 ? "text-orange-500" : "text-muted-foreground"
                          }`}>
                            <CalendarClock className="h-3 w-3" />
                            {eta < 0 ? `J+${Math.abs(eta)} retard` : eta === 0 ? "Aujourd'hui" : `J-${eta}`}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Column total footer */}
                {cards.length > 1 && colTotal > 0 && (
                  <div className="pt-1 border-t border-muted text-[10px] text-muted-foreground text-right tabular-nums">
                    Total : {colTotal.toLocaleString("fr-FR")} XAF
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
