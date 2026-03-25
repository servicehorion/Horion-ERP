import { Kanban, Plus, ShoppingCart, TrendingUp, AlertTriangle, Truck, DollarSign } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard, KpiGrid } from "@/components/shared/kpi-card";
import { OrdersExportActions } from "@/components/orders/orders-export-actions";
import { OrdersImportDialog } from "@/components/orders/orders-import-dialog";
import { OrdersIntelligence, type IntelligenceOrder } from "@/components/orders/orders-intelligence";
import { getOrders, getOrderStatusCounts } from "@/lib/actions/order.actions";

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
  // Fetch counts + first page of orders in parallel
  const [countsResult, ordersResult] = await Promise.all([
    getOrderStatusCounts(),
    getOrders({
      status: searchParams.status,
      search: searchParams.q,
      page: Math.max(1, Number(searchParams.page) || 1),
      limit: 50,
    }),
  ]);

  const counts = (countsResult.data as Record<string, number>) ?? {};
  const rawOrders = ordersResult.data ?? [];

  // KPI counts
  const totalActive = Object.entries(counts)
    .filter(([s]) => !TERMINAL_STATUSES.includes(s))
    .reduce((sum, [, n]) => sum + n, 0);
  const enLitige = counts[LITIGE_STATUS] ?? 0;
  const enTransit = TRANSIT_STATUSES.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
  const totalCommandes = Object.values(counts).reduce((s, n) => s + n, 0);

  // Build StatusCounts array for pipeline bar
  const statusCounts = Object.entries(counts).map(([status, count]) => ({ status, count }));

  // Total CA (pipeline value) from current page
  const totalCA = rawOrders.reduce((sum: number, o: any) => sum + Number(o.totalClient ?? 0), 0);

  // Map orders to IntelligenceOrder shape
  const intelligenceOrders: IntelligenceOrder[] = rawOrders.map((o: any) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    priority: o.priority,
    riskLevel: o.riskLevel ?? null,
    estimatedDelivery: o.estimatedDelivery ?? null,
    updatedAt: o.updatedAt,
    createdAt: o.createdAt,
    totalClient: Number(o.totalClient),
    contactName: o.contact?.name ?? "—",
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commandes"
        description="Gestion des commandes d'importation"
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/orders/board">
            <Kanban className="mr-1.5 h-4 w-4" />
            Kanban
          </Link>
        </Button>
        <OrdersImportDialog />
        <OrdersExportActions />
        <Button asChild>
          <Link href="/orders/new">
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle commande
          </Link>
        </Button>
      </PageHeader>

      <KpiGrid cols={5}>
        <KpiCard
          label="Total"
          value={totalCommandes}
          sub="toutes commandes"
          icon={<ShoppingCart className="h-4 w-4 text-muted-foreground" />}
        />
        <KpiCard
          label="Actives"
          value={totalActive}
          sub="en cours"
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
        />
        <KpiCard
          label="En transit"
          value={enTransit}
          sub="transit + dédouanement"
          icon={<Truck className="h-4 w-4 text-muted-foreground" />}
        />
        <KpiCard
          label="Litiges"
          value={enLitige}
          sub="à traiter"
          icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
          variant={enLitige > 0 ? "danger" : "default"}
          urgent={enLitige > 0}
        />
        <KpiCard
          label="Pipeline CA"
          value={
            totalCA >= 1_000_000
              ? `${(totalCA / 1_000_000).toFixed(1)}M`
              : `${(totalCA / 1_000).toFixed(0)}k`
          }
          sub="XAF (page courante)"
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        />
      </KpiGrid>

      {/* Intelligence view */}
      <Suspense fallback={<TableSkeleton />}>
        <OrdersIntelligence
          orders={intelligenceOrders}
          statusCounts={statusCounts}
        />
      </Suspense>
    </div>
  );
}
