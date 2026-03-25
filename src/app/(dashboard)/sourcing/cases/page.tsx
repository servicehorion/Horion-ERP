import Link from "next/link";
import { Plus, Search, Package, ArrowRight, Zap, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSourcingCases, getSourcingPipeline } from "@/lib/actions/sourcing.actions";
import { SourcingStatusBadge } from "@/components/sourcing/sourcing-status-badge";
import { ExportSourcingButton } from "@/components/sourcing/export-sourcing-button";
import { SourcingSlaService } from "@/lib/services/sourcing-sla.service";

export const metadata = { title: "Cas de sourcing | Horion ERP" };

export default async function SourcingCasesPage() {
  const [casesResult, pipelineResult] = await Promise.all([
    getSourcingCases({ limit: 50 }),
    getSourcingPipeline(),
  ]);

  const cases = casesResult.data?.cases || [];
  const pipeline = pipelineResult.data || [];

  const statusOrder = [
    "SEARCHING",
    "OFFERS_RECEIVED",
    "NEGOTIATING",
    "SELECTED",
    "CONFIRMED",
    "CANCELLED",
  ];
  const statusLabels: Record<string, string> = {
    SEARCHING: "Recherche",
    OFFERS_RECEIVED: "Offres reçues",
    NEGOTIATING: "Négociation",
    SELECTED: "Sélectionné",
    CONFIRMED: "Confirmé",
    CANCELLED: "Annulé",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cas de sourcing</h1>
          <p className="text-muted-foreground">
            Gérez vos recherches fournisseurs, offres et négociations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportSourcingButton />
          <Link href="/sourcing/cases/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau cas
            </Button>
          </Link>
        </div>
      </div>

      {/* Pipeline Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {statusOrder.map((status) => {
          const stat = pipeline.find((p) => p.status === status);
          return (
            <Card key={status}>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">{stat?.count || 0}</p>
                <p className="text-xs text-muted-foreground">{statusLabels[status]}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Cases List */}
      {cases.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground space-y-3">
            <Search className="mx-auto h-12 w-12 opacity-20" />
            <p className="font-medium">Aucun cas de sourcing</p>
            <p className="text-sm">
              Créez votre premier cas pour commencer à comparer les offres fournisseurs.
            </p>
            <Link href="/sourcing/cases/new">
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Créer un cas
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {cases.map((sc) => (
            <Link key={sc.id} href={`/sourcing/cases/${sc.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="flex items-center gap-4 py-4">
                  <Package className="h-8 w-8 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-primary">
                        {sc.order.orderNumber}
                      </span>
                      <SourcingStatusBadge status={sc.status} />
                      {(() => {
                        const enteredAt = (sc as any).stageEnteredAt || sc.updatedAt || sc.createdAt;
                        const sla = SourcingSlaService.compute(sc.status, new Date(enteredAt));
                        const color =
                          sla.status === "BREACHED"
                            ? "bg-red-100 text-red-800"
                            : sla.status === "WARNING"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800";
                        return (
                          <Badge className={`text-[10px] ${color}`}>
                            {sla.label}
                          </Badge>
                        );
                      })()}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {sc.requirement}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Client : {sc.order.contact.name}
                      {sc.supplier && ` · Fournisseur : ${sc.supplier.name}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0 hidden sm:block space-y-1">
                    {/* Level badge */}
                    {(sc as any).level === "PROFOND" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-primary/10 text-primary rounded-full px-2 py-0.5">
                        <Zap className="h-2.5 w-2.5" />
                        Profond
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                        Indicatif
                      </span>
                    )}
                    {/* Margin or budget */}
                    {(sc as any).marginPct != null ? (
                      <p className={`text-sm font-semibold flex items-center gap-1 justify-end ${
                        Number((sc as any).marginPct) >= 30 ? "text-green-600" :
                        Number((sc as any).marginPct) >= 20 ? "text-orange-500" :
                        "text-red-600"
                      }`}>
                        <TrendingUp className="h-3.5 w-3.5" />
                        {Number((sc as any).marginPct).toFixed(1)}%
                      </p>
                    ) : sc.budget ? (
                      <p className="text-sm font-medium">
                        {Number(sc.budget).toLocaleString("fr-FR")} {sc.currency}
                      </p>
                    ) : null}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{sc._count.offers} offre(s)</span>
                      <span>·</span>
                      <span>{sc._count.negotiations} échange(s)</span>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
