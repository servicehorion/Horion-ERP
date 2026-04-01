import Link from "next/link";
import { Activity, AlertCircle, MessageSquare, Sparkles, Target, TrendingUp, UserPlus, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard, KpiGrid } from "@/components/shared/kpi-card";
import type { CrmOverviewProjection, CrmPriorityAction } from "@/lib/crm/types";

function formatLtv(value: number) {
  return `${(value / 1_000_000).toFixed(1)}M XAF`;
}

export function CrmDashboardOverview({
  overview,
  priorityActions,
}: {
  overview: CrmOverviewProjection;
  priorityActions: CrmPriorityAction[];
}) {
  return (
    <div className="space-y-6">
      <KpiGrid cols={4}>
        <KpiCard
          label="Clients totaux"
          value={overview.totalCustomers}
          sub="portefeuille CRM"
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
        />
        <KpiCard
          label="Leads actifs"
          value={overview.activeLeads}
          sub={`+${overview.newProspects} nouveaux prospects`}
          icon={<UserPlus className="h-4 w-4 text-muted-foreground" />}
        />
        <KpiCard
          label="WhatsApp actif"
          value={overview.whatsappConnected}
          sub={`${overview.whatsappRate}% des clients`} 
          icon={<MessageSquare className="h-4 w-4 text-muted-foreground" />}
        />
        <KpiCard
          label="Valeur client (LTV)"
          value={formatLtv(overview.totalLtvXaf)}
          sub="total portefeuille"
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
          variant="success"
        />
      </KpiGrid>

      <KpiGrid cols={4}>
        <KpiCard
          label="Score IA portefeuille"
          value={`${overview.avgAiScore}/100`}
          sub="sante globale"
          icon={<Sparkles className="h-4 w-4 text-muted-foreground" />}
        />
        <KpiCard
          label="Leads forte intention"
          value={overview.highIntentLeads}
          sub="score CRM >= 75"
          icon={<Target className="h-4 w-4 text-muted-foreground" />}
          variant="success"
        />
        <KpiCard
          label="Clients a risque"
          value={overview.atRiskCustomers}
          sub={`Demandes RAW: ${overview.rawDemands}`}
          icon={<AlertCircle className="h-4 w-4 text-muted-foreground" />}
          variant={overview.atRiskCustomers > 0 || overview.rawDemands > 0 ? "danger" : "default"}
        />
        <KpiCard
          label="Actions a faire"
          value={overview.nextActions}
          sub={`Leads hors SLA: ${overview.leadsOutsideSla}`}
          icon={<Activity className="h-4 w-4 text-muted-foreground" />}
          variant={overview.nextActions > 0 ? "warning" : "default"}
        />
      </KpiGrid>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Flux canonique CRM</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {overview.canonicalJourney.map((step) => (
              <div key={step.label} className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{step.label}</p>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <span className="text-2xl font-bold tabular-nums">{step.count}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    step.tone === "success"
                      ? "bg-green-100 text-green-700"
                      : step.tone === "warning"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-700"
                  }`}>
                    {step.tone === "success" ? "OK" : step.tone === "warning" ? "Attention" : "Suivi"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-2">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-semibold">Actions prioritaires</CardTitle>
            <p className="text-xs text-muted-foreground">{"Prochaines meilleures actions dérivées du CRM et des modules OS"}</p>
          </div>
          <Badge className="bg-primary text-primary-foreground">{priorityActions.length} actions</Badge>
        </CardHeader>
        <CardContent>
          {priorityActions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune action prioritaire pour le moment.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {priorityActions.map((action) => (
                <Link key={`${action.entityType}-${action.id}`} href={action.href || "/crm"} className="rounded-lg border border-border p-3 transition-colors hover:bg-muted/30">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{action.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {action.entityType} · Responsable : {action.owner}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {action.tag}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{action.nextAction}</p>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
