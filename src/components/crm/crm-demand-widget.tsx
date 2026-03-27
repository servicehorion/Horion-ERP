import Link from "next/link";
import { AlertCircle, ArrowRight, Inbox } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CrmDemandWidgetProjection } from "@/lib/crm/types";

function demandBadgeClass(status: string) {
  switch (status) {
    case "RAW":
      return "bg-muted text-muted-foreground";
    case "QUALIFIED":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-100";
    case "INDICATIF_PENDING":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-100";
    case "CONVERTED":
      return "bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-100";
    case "LOST":
      return "bg-destructive/10 text-destructive";
    default:
      return "bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-100";
  }
}

function demandStatusLabel(status: string) {
  switch (status) {
    case "RAW":
      return "Brut";
    case "QUALIFIED":
      return "Qualifie";
    case "INDICATIF_PENDING":
      return "Sourcing";
    case "CONVERTED":
      return "Converti";
    case "LOST":
      return "Perdu";
    default:
      return "Devis";
  }
}

export function CrmDemandWidget({ projection }: { projection: CrmDemandWidgetProjection }) {
  const { kpis, recentDemands } = projection;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Inbox className="h-4 w-4 text-primary" />
          Pipeline Demandes Clients
          {kpis.raw > 0 ? (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/60 dark:text-amber-100">
              <AlertCircle className="h-3 w-3" />
              {kpis.raw} a traiter
            </span>
          ) : null}
        </CardTitle>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span><strong>{kpis.total}</strong> total</span>
          <span className="text-blue-600"><strong>{kpis.qualified}</strong> qualif.</span>
          <span className="text-amber-600"><strong>{kpis.indicatifPending}</strong> sourcing</span>
          <span className="text-green-600"><strong>{kpis.converted}</strong> converties</span>
          <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
            <Link href="/crm/demands">
              Gerer <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      {recentDemands.length > 0 ? (
        <CardContent className="pt-0">
          <div className="space-y-2">
            {recentDemands.map((demand) => (
              <div key={demand.id} className="flex items-center justify-between rounded-lg border bg-background p-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{demand.clientName}</p>
                  <p className="truncate text-xs text-muted-foreground">{demand.rawDescription}</p>
                  {demand.nextAction ? (
                    <p className="mt-1 text-xs text-primary">Next: {demand.nextAction}</p>
                  ) : null}
                </div>
                <div className="ml-3 flex shrink-0 flex-col items-end gap-1">
                  <Badge className={`border-0 text-xs ${demandBadgeClass(demand.status)}`}>
                    {demandStatusLabel(demand.status)}
                  </Badge>
                  {demand.assigneeName ? (
                    <span className="text-[11px] text-muted-foreground">{demand.assigneeName}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      ) : (
        <CardContent className="pt-0">
          <p className="py-4 text-center text-sm text-muted-foreground">
            Aucune demande pour le moment - elles apparaissent automatiquement depuis WhatsApp ou le CRM.
          </p>
        </CardContent>
      )}
    </Card>
  );
}
