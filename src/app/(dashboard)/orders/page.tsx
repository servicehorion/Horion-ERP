import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { orderColumns, type OrderTableRow } from "@/components/orders/order-table";
import { getOrders } from "@/lib/actions/order.actions";

export const metadata = {
  title: "Commandes | Horion ERP",
  description: "Gestion des commandes d'importation",
};

export default async function OrdersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Commandes</h1>
          <p className="text-muted-foreground">
            Gestion des commandes d'importation
          </p>
        </div>
        <Button asChild>
          <Link href="/orders/new">
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle commande
          </Link>
        </Button>
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <OrdersList />
      </Suspense>
    </div>
  );
}

async function OrdersList() {
  const result = await getOrders({});

  if (result.error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
        {result.error}
      </div>
    );
  }

  const orders = result.data || [];

  if (orders.length === 0) {
    return (
      <EmptyState
        title="Aucune commande"
        description="Créez votre première commande pour commencer"
        actionLabel="Nouvelle commande"
        actionHref="/orders/new"
      />
    );
  }

  // Transform data for table
  const tableData: OrderTableRow[] = orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    priority: order.priority,
    contactName: order.contact.name,
    totalClient: Number(order.totalClient),
    createdAt: order.createdAt,
  }));

  return (
    <DataTable
      columns={orderColumns}
      data={tableData}
      searchKey="orderNumber"
      searchPlaceholder="Rechercher par numéro..."
    />
  );
}
