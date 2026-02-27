import { Kanban, Plus, ShoppingCart, TrendingUp, AlertTriangle, Truck } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/shared/data-table";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { orderColumns, type OrderTableRow } from "@/components/orders/order-table";
import { getOrders, getOrderStatusCounts } from "@/lib/actions/order.actions";
import { OrdersExportActions } from "@/components/orders/orders-export-actions";

export const metadata = {
  title: "Commandes | Horion ERP",
  description: "Gestion des commandes d'importation",
};

interface PageProps {
  searchParams: {
    page?: string;
    status?: string;
    q?: string;
  };
}

const TERMINAL_STATUSES = ["CLOTURE", "ANNULE"];
const LITIGE_STATUS = "LITIGE";
const TRANSIT_STATUSES = ["EN_TRANSIT", "DEDOUANE"];

export default async function OrdersPage({ searchParams }: PageProps) {
  // KPIs — fetch all counts
  const countsResult = await getOrderStatusCounts();
  const counts = (countsResult.data as Record<string, number>) ?? {};

  const totalActive = Object.entries(counts)
    .filter(([s]) => !TERMINAL_STATUSES.includes(s))
    .reduce((sum, [, n]) => sum + n, 0);
  const enLitige = counts[LITIGE_STATUS] ?? 0;
  const enTransit = TRANSIT_STATUSES.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
  const totalCommandes = Object.values(counts).reduce((s, n) => s + n, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Commandes</h1>
          <p className="text-muted-foreground">
            Gestion des commandes d&apos;importation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/orders/board">
              <Kanban className="mr-1.5 h-4 w-4" />
              Pipeline
            </Link>
          </Button>
          <OrdersExportActions />
          <Button asChild>
            <Link href="/orders/new">
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle commande
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 bg-muted/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Total</span>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{totalCommandes}</p>
            <p className="text-xs text-muted-foreground mt-0.5">toutes commandes</p>
          </CardContent>
        </Card>

        <Card className="border-0 bg-muted/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Actives</span>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{totalActive}</p>
            <p className="text-xs text-muted-foreground mt-0.5">en cours</p>
          </CardContent>
        </Card>

        <Card className="border-0 bg-muted/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">En transit</span>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{enTransit}</p>
            <p className="text-xs text-muted-foreground mt-0.5">transit + dédouanement</p>
          </CardContent>
        </Card>

        <Card className={`border-0 ${enLitige > 0 ? "bg-red-50" : "bg-muted/40"}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Litiges</span>
              <AlertTriangle className={`h-4 w-4 ${enLitige > 0 ? "text-red-500" : "text-muted-foreground"}`} />
            </div>
            <p className={`text-2xl font-bold ${enLitige > 0 ? "text-red-600" : ""}`}>{enLitige}</p>
            <p className="text-xs text-muted-foreground mt-0.5">à traiter</p>
          </CardContent>
        </Card>
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <OrdersList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function OrdersList({ searchParams }: { searchParams: PageProps["searchParams"] }) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const status = searchParams.status;
  const q = searchParams.q;

  const result = await getOrders({
    status,
    search: q,
    page,
    limit: 20,
  });

  if (result.error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
        {result.error}
      </div>
    );
  }

  const orders = result.data || [];
  const totalPages = (result as any).totalPages || 1;
  const total = (result as any).total || orders.length;

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
    <>
      <DataTable
        columns={orderColumns}
        data={tableData}
        searchKey="orderNumber"
        searchPlaceholder="Rechercher par numéro..."
        paginate={false}
      />
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} sur {totalPages} ({total} commande{total > 1 ? "s" : ""})
          </p>
          <div className="flex items-center gap-2">
            {page > 1 && (
              <Button variant="outline" size="sm" asChild>
                <Link href={buildUrl(searchParams, { page: page - 1 })}>
                  Précédent
                </Link>
              </Button>
            )}
            {page < totalPages && (
              <Button variant="outline" size="sm" asChild>
                <Link href={buildUrl(searchParams, { page: page + 1 })}>
                  Suivant
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function buildUrl(
  current: Record<string, string | undefined>,
  overrides: Record<string, string | number | undefined>
): string {
  const params = new URLSearchParams();
  const merged = { ...current, ...overrides };
  for (const [k, v] of Object.entries(merged)) {
    if (v != null && v !== "" && v !== "all") params.set(k, String(v));
  }
  return `/orders?${params.toString()}`;
}
