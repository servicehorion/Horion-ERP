import { UsersRound } from "lucide-react";

import { getResourceCommandData } from "@/lib/actions/pilotage.actions";
import { ResourceCommand } from "@/components/pilotage/resource-command";

export const metadata = {
  title: "Capacite Equipe | Horion ERP",
  description: "Pilotage de charge et reallocation des ressources",
};

export default async function PilotageResourcesPage() {
  const res = await getResourceCommandData();
  const data = res.data ?? { teamWorkload: [], moduleBreakdown: [], priorities: { LOW: 0, NORMAL: 0, HIGH: 0, URGENT: 0 } };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <UsersRound className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Commande capacite</h1>
          <p className="text-muted-foreground">
            Redistribuer les ressources pour proteger les objectifs strategiques.
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
