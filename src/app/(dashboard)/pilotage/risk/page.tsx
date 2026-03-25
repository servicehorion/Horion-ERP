import { ShieldAlert } from "lucide-react";

import { RiskCommand } from "@/components/pilotage/risk-command";
import { getRiskCommandData } from "@/lib/actions/pilotage.actions";

export const metadata = {
  title: "Risk Command | Horion ERP",
  description: "Critical risk registry, escalation flow, and mitigation command",
};

export default async function PilotageRiskPage() {
  const res = await getRiskCommandData();
  const data = res.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Risk Command</h1>
          <p className="text-muted-foreground">
            Detect, escalate, and mitigate critical enterprise risks before they spread.
          </p>
        </div>
      </div>

      {res.error ? (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {res.error}
        </div>
      ) : null}

      {data ? <RiskCommand data={data as any} /> : null}
    </div>
  );
}
