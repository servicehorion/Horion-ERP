"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, MoreHorizontal } from "lucide-react";

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
};

/** Colonnes visibles dans le Kanban (statuts terminaux exclus) */
const KANBAN_COLUMNS: OrderStatus[] = [
  "DEMANDE",
  "RECHERCHE_PRODUIT",
  "DEVIS",
  "PAIEMENT_EN_COURS",
  "SOURCING",
  "EN_PRODUCTION",
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

interface OrdersKanbanProps {
  orders: KanbanOrder[];
  canUpdateStatus?: boolean;
}

export function OrdersKanban({ orders, canUpdateStatus }: OrdersKanbanProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [movingId, setMovingId] = useState<string | null>(null);

  // Group orders by status
  const byStatus = KANBAN_COLUMNS.reduce<Record<string, KanbanOrder[]>>((acc, col) => {
    acc[col] = orders.filter((o) => o.status === col);
    return acc;
  }, {});

  // Hide empty columns (except first 3)
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
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-3 min-w-max">
        {visibleColumns.map((col) => {
          const cards = byStatus[col] ?? [];
          const colTotal = cards.reduce((s, c) => s + c.totalClient, 0);

          return (
            <div key={col} className="flex flex-col w-64 shrink-0">
              {/* Column header */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-t-lg bg-muted/60 border border-b-0">
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                    ORDER_STATUS_COLORS[col as OrderStatus] ?? "bg-gray-100 text-gray-700"
                  }`}
                >
                  {ORDER_STATUS_LABELS[col as OrderStatus] ?? col}
                </span>
                <span className="ml-auto text-xs text-muted-foreground font-medium">
                  {cards.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2 p-2 min-h-[120px] bg-muted/20 border rounded-b-lg">
                {cards.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Vide</p>
                )}
                {cards.map((order) => {
                  const transitions = (ORDER_STATUS_TRANSITIONS as Record<string, string[]>)[order.status] ?? [];
                  const isMoving = movingId === order.id && isPending;

                  return (
                    <div
                      key={order.id}
                      className="bg-background rounded-md border shadow-sm p-3 space-y-2 text-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <Link
                          href={`/orders/${order.id}`}
                          className="font-medium text-xs hover:underline truncate"
                        >
                          {order.orderNumber}
                        </Link>
                        {canUpdateStatus && transitions.length > 0 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 shrink-0"
                                disabled={isMoving}
                              >
                                {isMoving
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : <MoreHorizontal className="h-3 w-3" />
                                }
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="text-xs">
                              {transitions.map((t) => (
                                <DropdownMenuItem
                                  key={t}
                                  onClick={() => handleMove(order.id, t)}
                                  className="text-xs"
                                >
                                  → {ORDER_STATUS_LABELS[t as OrderStatus] ?? t}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground truncate">{order.contactName}</p>

                      <div className="flex items-center justify-between gap-1">
                        <Badge className={`text-[10px] px-1.5 py-0 ${PRIORITY_COLORS[order.priority] ?? ""}`}>
                          {PRIORITY_LABELS[order.priority] ?? order.priority}
                        </Badge>
                        <span className="text-xs font-medium">
                          <CurrencyDisplay amount={order.totalClient} currency="XAF" />
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Column total */}
                {cards.length > 0 && colTotal > 0 && (
                  <div className="pt-1 border-t text-xs text-muted-foreground text-right">
                    <CurrencyDisplay amount={colTotal} currency="XAF" />
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
