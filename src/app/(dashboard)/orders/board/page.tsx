import Link from "next/link";
import { ArrowLeft, LayoutList } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getOrders } from "@/lib/actions/order.actions";
import { Button } from "@/components/ui/button";
import { OrdersKanban, type KanbanOrder } from "@/components/orders/orders-kanban";

export const metadata = { title: "Pipeline commandes | Horion ERP" };

export default async function OrdersBoardPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const canUpdateStatus = hasPermission(session.user.role, "order.update_status");

  // Fetch all active orders (no pagination — board shows everything)
  const result = await getOrders({ limit: 500 });
  const raw = result.data ?? [];

  const orders: KanbanOrder[] = raw.map((o: any) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    priority: o.priority,
    totalClient: Number(o.totalClient ?? 0),
    contactName: o.contact?.name ?? "—",
    createdAt: new Date(o.createdAt),
    riskLevel: o.riskLevel ?? null,
    estimatedDelivery: o.estimatedDelivery ? new Date(o.estimatedDelivery) : null,
  }));

  const total = orders.length;
  const pipeline = orders.reduce((s, o) => s + o.totalClient, 0);
  const active = orders.filter(
    (o) => !["CLOTURE", "ANNULE"].includes(o.status)
  ).length;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild className="gap-1.5">
          <Link href="/orders">
            <ArrowLeft className="h-4 w-4" />
            Commandes
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            {active} commandes actives · {pipeline.toLocaleString("fr-FR")} XAF
          </p>
        </div>
        <Button variant="outline" size="sm" asChild className="gap-1.5">
          <Link href="/orders">
            <LayoutList className="h-4 w-4" />
            Vue liste
          </Link>
        </Button>
      </div>

      {total === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          Aucune commande à afficher.
        </div>
      ) : (
        <OrdersKanban orders={orders} canUpdateStatus={canUpdateStatus} />
      )}
    </div>
  );
}
