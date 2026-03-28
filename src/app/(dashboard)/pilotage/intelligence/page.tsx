import { Brain } from "lucide-react";

import { getStrategicIntelligence } from "@/lib/actions/pilotage.actions";
import { StrategicIntelligence } from "@/components/pilotage/strategic-intelligence";

export const metadata = {
  title: "Intelligence Strategique | Horion ERP",
  description: "Lecture directionnelle cross-OS, signaux et priorites d'arbitrage",
};

export default async function PilotageIntelligencePage() {
  const res = await getStrategicIntelligence();
  const data = res.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Brain className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Intelligence strategique</h1>
          <p className="text-muted-foreground">
            Vue directionnelle stable des OS, anomalies critiques et priorites d'arbitrage.
          </p>
        </div>
      </div>
      {res.error ? (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {res.error}
        </div>
      ) : null}
      {data ? <StrategicIntelligence data={data} /> : null}
    </div>
  );
}
