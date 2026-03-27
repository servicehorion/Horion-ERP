import Link from "next/link";
import {
  AlertTriangle,
  Boxes,
  ShieldAlert,
  Truck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CatalogDashboardProjection } from "@/lib/catalog/types";

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  warning: "bg-amber-100 text-amber-700",
  info: "bg-blue-100 text-blue-700",
};

export function CatalogDashboardOverview({
  projection,
}: {
  projection: CatalogDashboardProjection;
}) {
  const counters = [
    {
      key: "hotLowConfidenceProducts",
      label: "Produits chauds a cadrer",
      value: projection.counters.hotLowConfidenceProducts,
      detail: "Forte traction, confiance memory encore trop basse.",
      icon: AlertTriangle,
    },
    {
      key: "weakLogisticsMemoryProducts",
      label: "Memoire logistique faible",
      value: projection.counters.weakLogisticsMemoryProducts,
      detail: "Poids/volume reels encore insuffisants.",
      icon: Truck,
    },
    {
      key: "priceSpreadAlerts",
      label: "Spreads prix a arbitrer",
      value: projection.counters.priceSpreadAlerts,
      detail: "Potentiel de negociation ou besoin de sourcing cible.",
      icon: Boxes,
    },
    {
      key: "riskySupplierProducts",
      label: "Dependances fournisseur fragiles",
      value: projection.counters.riskySupplierProducts,
      detail: "Produits importants relies a des fournisseurs trop faibles.",
      icon: ShieldAlert,
    },
  ] as const;

  return (
    <div className="space-y-4">
      <Card className="border-blue-200 bg-blue-50/70">
        <CardHeader>
          <CardTitle>{projection.positioning.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{projection.positioning.description}</p>
          <p className="text-muted-foreground">{projection.positioning.disclaimer}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {counters.map((counter) => {
          const Icon = counter.icon;
          return (
            <Card key={counter.key}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {counter.label}
                    </p>
                    <p className="mt-2 text-2xl font-semibold">{counter.value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{counter.detail}</p>
                  </div>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Actions prioritaires</CardTitle>
        </CardHeader>
        <CardContent>
          {projection.priorityActions.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Aucun signal critique immediat. Le catalogue est lisible, mais on garde la discipline entre donnees manuelles, observees et calculees.
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {projection.priorityActions.map((action) => (
                <div key={action.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{action.title}</p>
                        <Badge className={SEVERITY_STYLES[action.severity] || SEVERITY_STYLES.info}>
                          {action.severity}
                        </Badge>
                        {action.count != null ? (
                          <Badge variant="outline">{action.count}</Badge>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground">{action.description}</p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={action.href}>Ouvrir</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
