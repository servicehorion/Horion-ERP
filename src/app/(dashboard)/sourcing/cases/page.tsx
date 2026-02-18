import Link from "next/link";
import { Plus, Search, Package, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSourcingCases, getSourcingPipeline } from "@/lib/actions/sourcing.actions";
import { SourcingStatusBadge } from "@/components/sourcing/sourcing-status-badge";
import { ExportSourcingButton } from "@/components/sourcing/export-sourcing-button";

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
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {sc.requirement}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Client : {sc.order.contact.name}
                      {sc.supplier && ` · Fournisseur : ${sc.supplier.name}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0 hidden sm:block">
                    {sc.budget && (
                      <p className="text-sm font-medium">
                        {Number(sc.budget).toLocaleString("fr-FR")} {sc.currency}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
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
