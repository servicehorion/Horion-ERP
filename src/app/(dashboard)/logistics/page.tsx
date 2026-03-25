import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { getLogisticsDashboard } from "@/lib/actions/logistics.actions";
import { LogisticsDashboard } from "@/components/logistics/logistics-dashboard";

export const metadata = {
  title: "Logistique | Horion ERP",
  description: "Pilotage des expeditions, dedouanement et performance fret",
};

export default async function LogisticsPage() {
  const [session, result] = await Promise.all([
    getSession(),
    getLogisticsDashboard(),
  ]);

  if (result.error || !result.data) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Logistique</h1>
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          Erreur lors du chargement des donnees.
        </div>
      </div>
    );
  }

  const canManage = hasPermission(session.role, "logistics.manage");

  return <LogisticsDashboard data={result.data as any} canManage={canManage} />;
}
