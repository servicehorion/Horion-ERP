"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  Ship,
  Truck,
  TrendingUp,
  Clock,
  Activity,
  Users,
  AlertTriangle,
  Zap,
  BarChart3,
  Package,
  Wifi,
  Warehouse,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard, KpiGrid } from "@/components/shared/kpi-card";

import { LogisticsDashboardData } from "@/components/logistics/types";
import { LogisticsExportActions } from "@/components/logistics/logistics-export-actions";
import { runLogisticsSlaCheck } from "@/lib/actions/logistics.actions";
import { ShipmentsTab } from "@/components/logistics/shipments-tab";
import { PartnersTab } from "@/components/logistics/partners-tab";
import { CustomsTab } from "@/components/logistics/customs-tab";
import { AiTab } from "@/components/logistics/ai-tab";
import { AnalyticsTab } from "@/components/logistics/analytics-tab";
import { ConsolidationTab } from "@/components/logistics/consolidation-tab";
import { WarehouseReceiptForm } from "@/components/logistics/warehouse-receipt-form";

function formatNumber(value: number, digits = 0) {
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function LogisticsDashboard({
  data,
  canManage,
}: {
  data: LogisticsDashboardData;
  canManage: boolean;
}) {
  const [activeTab, setActiveTab] = useState("shipments");
  const [refreshing, startRefresh] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-6">
      <PageHeader title="Logistique" description="Command center expéditions et dédouanement">
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

      <KpiGrid cols={6}>
        <KpiCard
          label="Expéditions actives"
          value={data.kpis.inProgressCount}
          sub="en cours"
          icon={<Truck className="h-4 w-4 text-muted-foreground" />}
        />
        <KpiCard
          label="OTD global"
          value={`${formatNumber(data.kpis.onTimeRate, 0)}%`}
          sub="livraison à temps"
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
          variant={data.kpis.onTimeRate >= 90 ? "success" : data.kpis.onTimeRate >= 70 ? "default" : "warning"}
        />
        <KpiCard
          label="Délai moyen"
          value={`${formatNumber(data.kpis.avgTransitDays, 1)}j`}
          sub="transit moyen"
          icon={<Clock className="h-4 w-4 text-muted-foreground" />}
        />
        <KpiCard
          label="Coût / kg"
          value={`${formatNumber(data.kpis.costPerKg, 2)} USD`}
          sub="coût moyen"
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
        <TabsList className="grid grid-cols-2 md:grid-cols-7 gap-2">
          <TabsTrigger value="shipments">
            <Ship className="h-4 w-4 mr-2" /> Shipments
          </TabsTrigger>
          <TabsTrigger value="warehouse">
            <Warehouse className="h-4 w-4 mr-2" /> Entrepôt
          </TabsTrigger>
          <TabsTrigger value="partners">
            <Users className="h-4 w-4 mr-2" /> Partners
          </TabsTrigger>
          <TabsTrigger value="customs">
            <AlertTriangle className="h-4 w-4 mr-2" /> Customs
          </TabsTrigger>
          <TabsTrigger value="ai">
            <Zap className="h-4 w-4 mr-2" /> AI Alerts
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="h-4 w-4 mr-2" /> Analytics
          </TabsTrigger>
          <TabsTrigger value="consolidation">
            <Package className="h-4 w-4 mr-2" /> Consolidation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="shipments">
          <ShipmentsTab data={data} canManage={canManage} />
        </TabsContent>
        <TabsContent value="warehouse">
          {canManage ? (
            <div className="max-w-2xl mx-auto">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Warehouse className="h-5 w-5" />
                Réception entrepôt Chine
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Scannez le QR code de l&apos;expédition ou entrez son identifiant manuellement pour enregistrer la réception et les mensurations réelles du colis.
              </p>
              <WarehouseReceiptForm />
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Accès réservé à l&apos;équipe logistique.
            </div>
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
