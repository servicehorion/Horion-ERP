import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CatalogMetricProvenance } from "@/lib/catalog/types";

const CATEGORY_STYLES: Record<string, string> = {
  manual: "bg-slate-100 text-slate-700",
  observed: "bg-green-100 text-green-700",
  computed: "bg-blue-100 text-blue-700",
  recommended: "bg-amber-100 text-amber-700",
};

const CATEGORY_LABELS: Record<string, string> = {
  manual: "Manuel",
  observed: "Observe",
  computed: "Calcule",
  recommended: "Recommande",
};

export function CatalogProvenancePanel({
  items,
}: {
  items: CatalogMetricProvenance[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Provenance des metriques</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <Badge key={key} className={CATEGORY_STYLES[key]}>
              {label}
            </Badge>
          ))}
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.key} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{item.label}</p>
                  <Badge className={CATEGORY_STYLES[item.category]}>
                    {CATEGORY_LABELS[item.category]}
                  </Badge>
                </div>
                <p className="text-sm font-semibold">{item.value}</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{item.provenance}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
