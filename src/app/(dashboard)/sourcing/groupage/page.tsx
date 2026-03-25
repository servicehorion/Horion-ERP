import { Layers } from "lucide-react";
import { getGroupageBatches, detectGroupageOpportunities } from "@/lib/actions/sourcing.actions";
import { GroupageManager } from "@/components/sourcing/groupage-manager";

export const metadata = { title: "Groupage & Consolidation | Horion ERP" };

export default async function GroupagePage() {
  const [batchesResult, opportunitiesResult] = await Promise.all([
    getGroupageBatches(),
    detectGroupageOpportunities(),
  ]);

  const batches = (batchesResult.data ?? []) as Parameters<
    typeof GroupageManager
  >[0]["initialBatches"];
  const opportunities = (opportunitiesResult.data ?? []) as Parameters<
    typeof GroupageManager
  >[0]["opportunities"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Layers className="h-7 w-7" />
          Groupage &amp; Consolidation
        </h1>
        <p className="text-muted-foreground mt-1">
          Consolidez plusieurs expéditions en un seul lot pour optimiser les coûts de transport
        </p>
      </div>

      {/* Stats bar */}
      {batches.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          {(["OPEN", "READY", "IN_TRANSIT", "DELIVERED"] as const).map((s) => {
            const count = batches.filter((b) => b.status === s).length;
            const labels: Record<string, string> = {
              OPEN: "Ouverts",
              READY: "Prêts",
              IN_TRANSIT: "En transit",
              DELIVERED: "Livrés",
            };
            const colors: Record<string, string> = {
              OPEN: "text-blue-600",
              READY: "text-yellow-600",
              IN_TRANSIT: "text-purple-600",
              DELIVERED: "text-green-600",
            };
            return (
              <div
                key={s}
                className="rounded-lg border bg-card p-4 text-center"
              >
                <p className={`text-2xl font-bold ${colors[s]}`}>{count}</p>
                <p className="text-xs text-muted-foreground mt-1">{labels[s]}</p>
              </div>
            );
          })}
        </div>
      )}

      <GroupageManager initialBatches={batches} opportunities={opportunities} />
    </div>
  );
}
