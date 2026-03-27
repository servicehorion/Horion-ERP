"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, ClipboardCheck, Factory, Inbox } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SourcingOverviewProjection, SourcingPriorityAction } from "@/lib/sourcing/types";

const severityClass: Record<SourcingPriorityAction["severity"], string> = {
  info: "bg-slate-100 text-slate-700",
  warning: "bg-amber-100 text-amber-800",
  critical: "bg-red-100 text-red-800",
};

export function SourcingCommandCenterOverview({
  overview,
  priorityActions,
  supplierCount,
}: {
  overview: SourcingOverviewProjection;
  priorityActions: SourcingPriorityAction[];
  supplierCount: number;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-gradient-to-br from-slate-50 via-white to-blue-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold">Sourcing OS</h1>
            <p className="text-sm text-muted-foreground">
              Pipeline canonique du besoin brut jusqu'au dossier fournisseur executable.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="px-3 py-1">
              Inbox {overview.demandInbox}
            </Badge>
            <Badge variant="secondary" className="px-3 py-1">
              Pre-sourcing {overview.qualifiedDemandQueue}
            </Badge>
            <Badge variant="secondary" className="px-3 py-1">
              Cas actifs {overview.activeCases}
            </Badge>
            <Badge variant="secondary" className="px-3 py-1">
              SLA {overview.breachedCases} depassees / {overview.warningCases} alertes
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Demandes entrantes</CardTitle>
            <Inbox className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.demandInbox + overview.qualifiedDemandQueue}</div>
            <p className="text-xs text-muted-foreground">Qualification et pre-sourcing</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pipeline actif</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.activeCases}</div>
            <p className="text-xs text-muted-foreground">Cas sourcing en execution</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Fournisseurs actifs</CardTitle>
            <Factory className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{supplierCount}</div>
            <p className="text-xs text-muted-foreground">Base fournisseurs mobilisable</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Conversion</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.conversionRate}%</div>
            <p className="text-xs text-muted-foreground">{overview.confirmedCases} cas confirmes</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Chaine sourcing canonique</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-5">
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
                Aucun point de rupture majeur detecte sur le pipeline sourcing.
              </div>
            ) : (
              priorityActions.map((action) => {
                const content = (
                  <div className="flex items-start justify-between gap-3 rounded-xl border p-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge className={severityClass[action.severity]}>
                          {action.count ?? 0}
                        </Badge>
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
    </div>
  );
}
