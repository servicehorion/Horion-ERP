import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { getLogisticsDashboard } from "@/lib/actions/logistics.actions";
import { LogisticsDashboard } from "@/components/logistics/logistics-dashboard";
import { LogisticsDashboardProjectionService } from "@/lib/services/logistics-dashboard-projection.service";

export const metadata = {
  title: "Logistique | Horion ERP",
  description: "Pilotage des expeditions, dedouanement et performance fret",
};

export default async function LogisticsPage() {
  const session = await getSession();

  if (!hasPermission(session.role, "logistics.view")) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Logistique</h1>
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          Vous n&apos;avez pas l&apos;autorisation d&apos;accéder à la vue logistique avec le rôle <span className="font-medium text-foreground">{session.role}</span>.
        </div>
      </div>
    );
  }

  const [result, projection] = await Promise.all([
    getLogisticsDashboard(),
    LogisticsDashboardProjectionService.get(session.tenantId),
  ]);

  if (result.error || !result.data) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Logistique</h1>
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          {result.error ?? "Erreur lors du chargement des donnees."}
        </div>
      </div>
    );
  }

  const canManage = hasPermission(session.role, "logistics.manage");

  return <LogisticsDashboard data={result.data as any} canManage={canManage} projection={projection} />;
}
