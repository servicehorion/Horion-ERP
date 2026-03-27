"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  PackageCheck,
  ShieldAlert,
  Truck,
  Warehouse,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  LogisticsOverviewProjection,
  LogisticsPriorityAction,
} from "@/lib/logistics/types";

const severityClass: Record<LogisticsPriorityAction["severity"], string> = {
  info: "bg-slate-100 text-slate-700",
  warning: "bg-amber-100 text-amber-800",
  critical: "bg-red-100 text-red-800",
};

export function LogisticsDashboardOverview({
  overview,
  priorityActions,
}: {
  overview: LogisticsOverviewProjection;
  priorityActions: LogisticsPriorityAction[];
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold">Logistics OS</h1>
            <p className="text-sm text-muted-foreground">
              Pilotage shipment-centric du terrain Chine jusqu&apos;a la remise client.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="px-3 py-1">
              Shipments actifs {overview.activeShipments}
            </Badge>
            <Badge variant="secondary" className="px-3 py-1">
              Ready to book {overview.readyToBookCount}
            </Badge>
            <Badge variant="secondary" className="px-3 py-1">
              Tracking stale {overview.trackingStaleCount}
            </Badge>
            <Badge variant="secondary" className="px-3 py-1">
              Douane bloquee {overview.customsBlockedCount}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Shipments actifs</CardTitle>
            <Truck className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.activeShipments}</div>
            <p className="text-xs text-muted-foreground">Dossiers logistiques encore en mouvement</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Entrepot / booking</CardTitle>
            <Warehouse className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.readyToBookCount}</div>
            <p className="text-xs text-muted-foreground">Shipments mesures et prets a partir</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Douane</CardTitle>
            <ShieldAlert className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.customsBlockedCount}</div>
            <p className="text-xs text-muted-foreground">Dossiers qui retiennent la promesse client</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Incidents critiques</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.criticalIncidentCount}</div>
            <p className="text-xs text-muted-foreground">Exceptions qui exigent une action manager</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Chaine logistique canonique</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            {overview.canonicalJourney.map((step, index) => (
              <div key={step.key} className="space-y-2 rounded-xl border p-3">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">{index + 1}</Badge>
                  <span className="text-sm font-semibold">{step.count}</span>
                </div>
                <div className="font-medium">{step.label}</div>
                <div className="text-xs text-muted-foreground">{step.description}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Actions prioritaires</CardTitle>
            <Badge className="bg-primary text-primary-foreground">{priorityActions.length} actions</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {priorityActions.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Aucune rupture critique detectee sur le pipeline logistique.
              </div>
            ) : (
              priorityActions.map((action) => {
                const content = (
                  <div className="flex items-start justify-between gap-3 rounded-xl border p-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge className={severityClass[action.severity]}>{action.count ?? 0}</Badge>
                        <span className="font-medium">{action.title}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">{action.description}</div>
                    </div>
                    {action.href ? <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" /> : null}
                  </div>
                );

                return action.href ? (
                  <Link key={action.id} href={action.href} className="block">
                    {content}
                  </Link>
                ) : (
                  <div key={action.id}>{content}</div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
          <span>
            Le cockpit lit maintenant la logistique comme une chaine shipment-centric: readiness, transit,
            douane, last mile et exceptions visibles sans passer uniquement par le statut commande.
          </span>
        </div>
      </div>
    </div>
  );
}
