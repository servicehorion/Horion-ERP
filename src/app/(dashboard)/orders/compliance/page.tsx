import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { OrderComplianceService } from "@/lib/services/order-compliance.service";

export const metadata = {
  title: "Compliance & Approvals | Horion ERP",
};

export default async function OrderCompliancePage() {
  const user = await getSession();
  checkPermission(user.role, "order.view");

  const kpis = await OrderComplianceService.getKpis(user.tenantId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Compliance & Approvals</h1>
        <p className="text-muted-foreground">
          Suivi des validations, SLA et conformite des commandes
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Commandes totales</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{kpis.totalOrders}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Approbations requises</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{kpis.approvalRequired}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Taux d'approbation</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-2xl font-semibold">
            {kpis.approvalRate}%
            <Badge variant={kpis.approvalRate >= 90 ? "default" : "secondary"}>SLA</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Delai moyen</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {kpis.avgApprovalHours.toFixed(1)}h
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Etat des validations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>En attente</span>
              <span className="font-semibold">{kpis.pendingOrders}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Rejetees</span>
              <span className="font-semibold">{kpis.rejectedOrders}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Approuvees</span>
              <span className="font-semibold">{kpis.approvedOrders}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>En retard ({">"}{kpis.slaHours}h)</span>
              <span className="font-semibold text-amber-600">{kpis.overdueSteps}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Approvals par role</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {Object.keys(kpis.pendingByRole).length === 0 ? (
              <div className="text-muted-foreground">Aucune validation en attente.</div>
            ) : (
              Object.entries(kpis.pendingByRole).map(([role, count]) => (
                <div key={role} className="flex items-center justify-between">
                  <span>{role}</span>
                  <span className="font-semibold">{count}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>SLA par role</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {Object.keys(kpis.overdueByRole).length === 0 ? (
            <div className="text-muted-foreground">Aucun depassement SLA.</div>
          ) : (
            Object.entries(kpis.overdueByRole).map(([role, count]) => (
              <div key={role} className="flex items-center justify-between">
                <span>{role}</span>
                <span className="font-semibold text-red-600">{count}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
