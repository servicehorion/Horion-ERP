"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiChartRevenue } from "@/components/dashboard/kpi-chart-revenue";
import { KpiChartPipeline } from "@/components/dashboard/kpi-chart-pipeline";
import { KpiChartCashflow } from "@/components/dashboard/kpi-chart-cashflow";

type RevenuePoint = { date: string; value: number };
type PipelinePoint = { label: string; value: number };

type DashboardData = {
  role: string;
  currency: string;
  defaultRange: { from: string; to: string };
  revenueSeries: RevenuePoint[];
  topClients: { name: string; revenue: number }[];
  cashPosition: number;
  ordersByStatus: PipelinePoint[];
  slaHeatmap: { day: number; bucket: number; count: number }[];
  delayedShipments: { id: string; orderNumber: string; origin: string; destination: string; eta?: string | null }[];
  cashflowSeries: { month: string; inbound: number; outbound: number; balance: number }[];
  agingTotals: Record<string, number>;
  crmFunnel: { stage: string; count: number; value: number }[];
};

type DateRange = { from?: Date; to?: Date };

const formatCurrency = (value: number, currency: string) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(value || 0);

const formatDateUtc = (date: Date) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC" }).format(date);

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC" }).format(new Date(value));
};

const clampDate = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const bucketLabels = ["Nuit", "Matin", "Apres-midi", "Soir"];
const dayLabels = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

const DashboardDateRange = dynamic(
  () => import("@/components/dashboard/dashboard-date-range"),
  {
    ssr: false,
    loading: () => (
      <Button variant="outline" suppressHydrationWarning>
        Chargement...
      </Button>
    ),
  }
);

export function DashboardClient({ data }: { data: DashboardData }) {
  const [range, setRange] = useState<DateRange>({
    from: new Date(data.defaultRange.from),
    to: new Date(data.defaultRange.to),
  });

  const revenueSeries = useMemo(() => {
    const from = range.from ? clampDate(range.from) : undefined;
    const to = range.to ? clampDate(range.to) : undefined;
    return data.revenueSeries.filter((item) => {
      const d = clampDate(new Date(item.date));
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [data.revenueSeries, range]);

  const totalRevenue = revenueSeries.reduce((s, p) => s + p.value, 0);
  const topClients = data.topClients.slice(0, 10);

  const heatmapMatrix = useMemo(() => {
    const grid = Array.from({ length: 7 }, () => Array.from({ length: 4 }, () => 0));
    for (const cell of data.slaHeatmap) {
      if (grid[cell.day] && typeof grid[cell.day][cell.bucket] !== "undefined") {
        grid[cell.day][cell.bucket] = cell.count;
      }
    }
    return grid;
  }, [data.slaHeatmap]);

  const maxHeat = Math.max(1, ...data.slaHeatmap.map((c) => c.count));

  const view = useMemo(() => {
    if (["CEO", "ADMIN", "DIRECTION"].includes(data.role)) return "CEO";
    if (["FINANCE", "FINANCE_MANAGER"].includes(data.role)) return "FINANCE";
    if (["COMMERCIAL", "CRM_MANAGER"].includes(data.role)) return "COMMERCIAL";
    return "OPS";
  }, [data.role]);

  const rangeLabel = range.from
    ? range.to
      ? `${formatDateUtc(range.from)} - ${formatDateUtc(range.to)}`
      : formatDateUtc(range.from)
    : "Choisir une periode";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Pilotage</h1>
          <p className="text-muted-foreground">Vue d'ensemble par role</p>
        </div>
        <DashboardDateRange range={range} onRangeChange={setRange} label={rangeLabel} />
      </div>

      {view === "CEO" && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">CA sur periode</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {formatCurrency(totalRevenue, data.currency)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Cash position</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {formatCurrency(data.cashPosition, data.currency)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Top clients (10)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {topClients.map((client) => (
                    <div key={client.name} className="flex items-center justify-between text-sm">
                      <span>{client.name}</span>
                      <span className="font-medium">{formatCurrency(client.revenue, data.currency)}</span>
                    </div>
                  ))}
                  {topClients.length === 0 && (
                    <p className="text-xs text-muted-foreground">Aucun client</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <KpiChartRevenue data={revenueSeries} currency={data.currency} />
            </CardContent>
          </Card>
        </div>
      )}

      {view === "OPS" && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Commandes par statut</CardTitle>
              </CardHeader>
              <CardContent>
                <KpiChartPipeline data={data.ordersByStatus} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>SLA breaches</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div />
                  {bucketLabels.map((b) => (
                    <div key={b} className="text-center text-muted-foreground">{b}</div>
                  ))}
                  {heatmapMatrix.map((row, dayIdx) => (
                    <div key={dayIdx} className="contents">
                      <div className="text-muted-foreground">{dayLabels[dayIdx]}</div>
                      {row.map((val, idx) => {
                        const intensity = Math.round((val / maxHeat) * 100);
                        return (
                          <div
                            key={idx}
                            className="h-7 rounded-md border"
                            style={{ backgroundColor: `rgba(239, 68, 68, ${0.15 + intensity / 200})` }}
                            title={`${val} retards`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Shipments en retard</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.delayedShipments.map((ship) => (
                  <div key={ship.id} className="flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium">{ship.orderNumber}</div>
                      <div className="text-xs text-muted-foreground">
                        {ship.origin} → {ship.destination}
                      </div>
                    </div>
                    <Badge variant="destructive">ETA {formatDate(ship.eta)}</Badge>
                  </div>
                ))}
                {data.delayedShipments.length === 0 && (
                  <p className="text-xs text-muted-foreground">Aucun shipment en retard</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {view === "FINANCE" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Cashflow (actual + forecast)</CardTitle>
            </CardHeader>
            <CardContent>
              <KpiChartCashflow data={data.cashflowSeries} currency={data.currency} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Aging creances</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-5 text-sm">
                {Object.entries(data.agingTotals).map(([bucket, value]) => (
                  <div key={bucket} className="rounded-md border p-3">
                    <div className="text-xs uppercase text-muted-foreground">{bucket}</div>
                    <div className="text-lg font-semibold">{formatCurrency(value, data.currency)}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {view === "COMMERCIAL" && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Funnel CRM</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.crmFunnel.map((stage) => (
                    <div key={stage.stage} className="flex items-center justify-between text-sm">
                      <span>{stage.stage}</span>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary">{stage.count}</Badge>
                        <span className="font-medium">
                          {formatCurrency(stage.value, data.currency)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Pipeline valeur</CardTitle>
              </CardHeader>
              <CardContent>
                <KpiChartPipeline
                  data={data.crmFunnel.map((s) => ({ label: s.stage, value: s.value }))}
                  formatter={(value) => formatCurrency(value, data.currency)}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
