import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serializeDecimals } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/config/order-statuses";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { FinanceAnalyticsService } from "@/lib/services/finance-analytics.service";
import { FinanceIntelligenceService } from "@/lib/services/finance-intelligence.service";
import { getCrmLeadScopeWithDelegation } from "@/lib/access-control";

export const metadata = {
  title: "Dashboard Quotidien | Horion ERP",
  description: "Cockpit quotidien par role pour piloter l'activite Horion",
};

async function safeDashboardRead<T>(label: string, run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch (error) {
    console.error(`[dashboard] ${label}`, error);
    return fallback;
  }
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  const tenantId = session.user.tenantId;
  const role = session.user.role;
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 30);
  const dataFrom = new Date(now);
  dataFrom.setDate(dataFrom.getDate() - 180);

  // Keep dashboard reads intentionally low-concurrency.
  // This page sits behind auth + layout badges and was exhausting the DB pool in dev/staging.
  const deliveredOrders = await safeDashboardRead("delivered-orders", () =>
    prisma.order.findMany({
      where: { tenantId, status: "LIVRE", createdAt: { gte: dataFrom } },
      select: { totalClient: true, createdAt: true, actualDelivery: true },
    }),
    [] as Array<{ totalClient: unknown; createdAt: Date; actualDelivery: Date | null }>
  );

  const topClientOrders = await safeDashboardRead("top-client-orders", () =>
    prisma.order.findMany({
      where: { tenantId, createdAt: { gte: dataFrom } },
      select: { totalClient: true, contact: { select: { name: true } } },
    }),
    [] as Array<{ totalClient: unknown; contact: { name: string } | null }>
  );

  const ordersByStatus = await safeDashboardRead("orders-by-status", () =>
    prisma.order.groupBy({
      by: ["status"],
      where: { tenantId, status: { notIn: ["ANNULE"] } },
      _count: { status: true },
    }),
    [] as Array<{ status: string; _count: { status: number } }>
  );

  const slaTasks = await safeDashboardRead("sla-tasks", () =>
    prisma.task.findMany({
      where: { tenantId, slaBreach: true, createdAt: { gte: dataFrom } },
      select: { createdAt: true },
    }),
    [] as Array<{ createdAt: Date }>
  );

  const delayedShipments = await safeDashboardRead("delayed-shipments", () =>
    prisma.shipment.findMany({
      where: {
        order: { tenantId },
        estimatedArrival: { lt: now },
        actualArrival: null,
      },
      select: {
        id: true,
        origin: true,
        destination: true,
        estimatedArrival: true,
        order: { select: { orderNumber: true } },
      },
      take: 8,
      orderBy: { estimatedArrival: "asc" },
    }),
    [] as Array<{
      id: string;
      origin: string;
      destination: string;
      estimatedArrival: Date | null;
      order: { orderNumber: string } | null;
    }>
  );

  const cashflowSeries = await safeDashboardRead("cashflow-series", () =>
    FinanceAnalyticsService.getCashflowSeries(tenantId, 6),
    [] as Array<{ month: string; inbound: number; outbound: number; net: number; balance: number }>
  );

  const agingReport = await safeDashboardRead("aging-report", () =>
    FinanceIntelligenceService.getAgingReport(tenantId),
    {
      aging: { current: [], days30: [], days60: [], days90: [], over90: [] },
      totals: { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 },
      totalOutstanding: 0,
    }
  );

  const leadScope = await safeDashboardRead("lead-scope", () =>
    getCrmLeadScopeWithDelegation({ id: session.user.id, tenantId, role }),
    null
  );

  const cashPositionRaw = await safeDashboardRead("cash-position", () =>
    prisma.payment.groupBy({
      by: ["direction"],
      where: { status: "CONFIRMED", order: { tenantId } },
      _sum: { amountXAF: true },
    }),
    [] as Array<{ direction: string; _sum: { amountXAF: unknown | null } }>
  );

  const tenantMeta = await safeDashboardRead("tenant-meta", () =>
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { currency: true } }),
    { currency: "XAF" }
  );

  const revenueBuckets = new Map<string, number>();
  for (const order of deliveredOrders) {
    const date = (order.actualDelivery || order.createdAt).toISOString().slice(0, 10);
    revenueBuckets.set(date, (revenueBuckets.get(date) || 0) + Number(order.totalClient));
  }
  const revenueSeries: Array<{ date: string; value: number }> = [];
  for (let d = new Date(dataFrom); d <= now; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    revenueSeries.push({ date: key, value: Math.round(revenueBuckets.get(key) || 0) });
  }

  const clientMap = new Map<string, number>();
  for (const order of topClientOrders) {
    const name = order.contact?.name || "Client";
    clientMap.set(name, (clientMap.get(name) || 0) + Number(order.totalClient));
  }
  const topClients = Array.from(clientMap.entries())
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const ordersPipeline = ordersByStatus.map((item) => ({
    label: ORDER_STATUS_LABELS[item.status as keyof typeof ORDER_STATUS_LABELS] || item.status,
    value: item._count.status,
  }));

  const heatmapCounts = new Map<string, number>();
  for (const task of slaTasks) {
    const day = task.createdAt.getDay();
    const hour = task.createdAt.getHours();
    const bucket = Math.min(3, Math.floor(hour / 6));
    const key = `${day}-${bucket}`;
    heatmapCounts.set(key, (heatmapCounts.get(key) || 0) + 1);
  }
  const slaHeatmap = Array.from(heatmapCounts.entries()).map(([key, count]) => {
    const [day, bucket] = key.split("-").map((v) => Number(v));
    return { day, bucket, count };
  });

  const delayed = delayedShipments.map((ship) => ({
    id: ship.id,
    orderNumber: ship.order?.orderNumber || "-",
    origin: ship.origin,
    destination: ship.destination,
    eta: ship.estimatedArrival?.toISOString() || null,
  }));

  const cashPosition = cashPositionRaw.reduce((acc, item) => {
    const amount = Number(item._sum?.amountXAF || 0);
    return item.direction === "INBOUND" ? acc + amount : acc - amount;
  }, 0);

  const leadWhere = leadScope ? { ...leadScope, isArchived: false } : { id: "none" };
  const leadGroups = await safeDashboardRead("lead-groups", () =>
    prisma.lead.groupBy({
      by: ["status"],
      where: leadWhere,
      _count: { status: true },
      _sum: { estimatedValue: true },
    }),
    [] as Array<{ status: string; _count: { status: number }; _sum: { estimatedValue: unknown | null } }>
  );

  const leadLabels: Record<string, string> = {
    NEW: "Nouveau",
    CONTACTED: "Contacte",
    QUALIFIED: "Qualifie",
    QUOTED: "Devis",
    WON: "Gagne",
    LOST: "Perdu",
  };

  const crmFunnel = leadGroups.map((group) => ({
    stage: leadLabels[group.status] || group.status,
    count: group._count.status,
    value: Math.round(Number(group._sum.estimatedValue || 0)),
  }));

  const dashboardData = serializeDecimals({
    role,
    currency: tenantMeta?.currency || "XAF",
    defaultRange: { from: defaultFrom.toISOString(), to: now.toISOString() },
    revenueSeries,
    topClients,
    cashPosition,
    ordersByStatus: ordersPipeline,
    slaHeatmap,
    delayedShipments: delayed,
    cashflowSeries,
    agingTotals: agingReport.totals,
    crmFunnel,
  });

  return <DashboardClient data={dashboardData} />;
}
