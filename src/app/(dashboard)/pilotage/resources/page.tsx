import { UsersRound } from "lucide-react";

import { getResourceCommandData } from "@/lib/actions/pilotage.actions";
import { ResourceCommand } from "@/components/pilotage/resource-command";

export const metadata = {
  title: "Pilotage Resources | Horion ERP",
  description: "Resource command and workload reallocation",
};

export default async function PilotageResourcesPage() {
  const res = await getResourceCommandData();
  const data = res.data ?? { teamWorkload: [], moduleBreakdown: [], priorities: { LOW: 0, NORMAL: 0, HIGH: 0, URGENT: 0 } };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <UsersRound className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Resource Command</h1>
          <p className="text-muted-foreground">
            Reallocate teams and agents to protect strategic outcomes.
          </p>
        </div>
      </div>
      {res.error ? (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {res.error}
        </div>
      ) : null}
      <ResourceCommand
        teamWorkload={data.teamWorkload}
        moduleBreakdown={data.moduleBreakdown}
        priorities={data.priorities}
      />
    </div>
  );
}
