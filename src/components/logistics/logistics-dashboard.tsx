"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock,
  Package,
  RefreshCw,
  Ship,
  TrendingUp,
  Truck,
  Users,
  Warehouse,
  Wifi,
  Zap,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { KpiCard, KpiGrid } from "@/components/shared/kpi-card";
import { LogisticsDashboardData } from "@/components/logistics/types";
import { LogisticsExportActions } from "@/components/logistics/logistics-export-actions";
import { LogisticsDashboardOverview } from "@/components/logistics/logistics-dashboard-overview";
import { ShipmentsTab } from "@/components/logistics/shipments-tab";
import { PartnersTab } from "@/components/logistics/partners-tab";
import { CustomsTab } from "@/components/logistics/customs-tab";
import { AiTab } from "@/components/logistics/ai-tab";
import { AnalyticsTab } from "@/components/logistics/analytics-tab";
import { ConsolidationTab } from "@/components/logistics/consolidation-tab";
import { WarehouseReceiptForm } from "@/components/logistics/warehouse-receipt-form";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { runLogisticsSlaCheck } from "@/lib/actions/logistics.actions";
import type { LogisticsDashboardProjection } from "@/lib/logistics/types";

function formatNumber(value: number, digits = 0) {
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function LogisticsDashboard({
  data,
  canManage,
  projection,
}: {
  data: LogisticsDashboardData;
  canManage: boolean;
  projection: LogisticsDashboardProjection;
}) {
  const [activeTab, setActiveTab] = useState("shipments");
  const [refreshing, startRefresh] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-6">
      <PageHeader title="Logistique" description="Command center expeditions et dedouanement">
        <Button
          variant="outline"
          size="sm"
          disabled={refreshing}
          onClick={() =>
            startRefresh(async () => {
              if (canManage) {
                await runLogisticsSlaCheck();
              }
              router.refresh();
            })
          }
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualiser
        </Button>
        <LogisticsExportActions />
      </PageHeader>

      <LogisticsDashboardOverview
        overview={projection.overview}
        priorityActions={projection.priorityActions}
      />

      <KpiGrid cols={6}>
        <KpiCard
          label="Expeditions actives"
          value={data.kpis.inProgressCount}
          sub="en cours"
          icon={<Truck className="h-4 w-4 text-muted-foreground" />}
        />
        <KpiCard
          label="OTD global"
          value={`${formatNumber(data.kpis.onTimeRate, 0)}%`}
          sub="livraison a temps"
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
          variant={data.kpis.onTimeRate >= 90 ? "success" : data.kpis.onTimeRate >= 70 ? "default" : "warning"}
        />
        <KpiCard
          label="Delai moyen"
          value={`${formatNumber(data.kpis.avgTransitDays, 1)}j`}
          sub="transit moyen"
          icon={<Clock className="h-4 w-4 text-muted-foreground" />}
        />
        <KpiCard
          label="Cout / kg"
          value={`${formatNumber(data.kpis.costPerKg, 2)} USD`}
          sub="cout moyen"
          icon={<Activity className="h-4 w-4 text-muted-foreground" />}
        />
        <KpiCard
          label="Tracking live"
          value={`${formatNumber(data.kpis.trackingCoverage || 0, 0)}%`}
          sub="couverture"
          icon={<Wifi className="h-4 w-4 text-muted-foreground" />}
        />
        <KpiCard
          label="Retards SLA"
          value={data.kpis.lateShipments || 0}
          sub="en risque"
          icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
          variant={(data.kpis.lateShipments || 0) > 0 ? "danger" : "default"}
          urgent={(data.kpis.lateShipments || 0) > 0}
        />
      </KpiGrid>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-2 gap-2 md:grid-cols-7">
          <TabsTrigger value="shipments">
            <Ship className="mr-2 h-4 w-4" /> Shipments
          </TabsTrigger>
          <TabsTrigger value="warehouse">
            <Warehouse className="mr-2 h-4 w-4" /> Entrepot
          </TabsTrigger>
          <TabsTrigger value="partners">
            <Users className="mr-2 h-4 w-4" /> Partners
          </TabsTrigger>
          <TabsTrigger value="customs">
            <AlertTriangle className="mr-2 h-4 w-4" /> Customs
          </TabsTrigger>
          <TabsTrigger value="ai">
            <Zap className="mr-2 h-4 w-4" /> AI Alerts
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="mr-2 h-4 w-4" /> Analytics
          </TabsTrigger>
          <TabsTrigger value="consolidation">
            <Package className="mr-2 h-4 w-4" /> Consolidation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="shipments">
          <ShipmentsTab data={data} canManage={canManage} />
        </TabsContent>

        <TabsContent value="warehouse">
          {canManage ? (
            <div className="mx-auto max-w-2xl">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <Warehouse className="h-5 w-5" />
                Reception entrepot Chine
              </h2>
              <p className="mb-3 text-sm text-muted-foreground">
                Reserve equipe interne Horion Chine / Ops. Le partenaire externe Chine n'utilise pas cet ecran.
              </p>
              <p className="mb-3 text-sm text-muted-foreground">
                Day 1, le flux terrain passe par WhatsApp puis par la file de revue interne{" "}
                <Link href="/logistics/warehouse-bridge" className="font-medium text-foreground underline">
                  Warehouse Bridge
                </Link>
                .
              </p>
              <p className="mb-6 text-sm text-muted-foreground">
                Utilisez ce formulaire uniquement pour l'equipe Horion interne en Chine ou pour les operations qui doivent finaliser un WarehouseReceipt.
              </p>
              <WarehouseReceiptForm />
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">Acces reserve a l'equipe logistique.</div>
          )}
        </TabsContent>

        <TabsContent value="partners">
          <PartnersTab data={data} canManage={canManage} />
        </TabsContent>

        <TabsContent value="customs">
          <CustomsTab data={data} canManage={canManage} />
        </TabsContent>

        <TabsContent value="ai">
          <AiTab data={data} />
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsTab data={data} />
        </TabsContent>

        <TabsContent value="consolidation">
          <ConsolidationTab data={data} canManage={canManage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
