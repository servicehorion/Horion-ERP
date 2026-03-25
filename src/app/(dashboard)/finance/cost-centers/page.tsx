import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { CostCenterService } from "@/lib/services/cost-center.service";
import { createCostCenter } from "@/lib/actions/finance-advanced.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata = { title: "Centres de cout | Horion ERP" };

export default async function FinanceCostCentersPage() {
  const user = await getSession();
  checkPermission(user.role, "finance.view");

  const [centers, budgetVsActual] = await Promise.all([
    CostCenterService.list(user.tenantId),
    CostCenterService.getBudgetVsActual({ tenantId: user.tenantId }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Centres de cout</h1>
        <p className="text-muted-foreground">Budget vs realise par centre</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nouveau centre</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createCostCenter} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input name="code" placeholder="Code" required />
            <Input name="name" placeholder="Nom" required />
            <Input name="description" placeholder="Description" />
            <Button type="submit">Ajouter</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Budget vs realise</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Realise</TableHead>
                  <TableHead>Ecart</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {budgetVsActual.map((row) => {
                  const delta = Number(row.budget) - Number(row.actual);
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono">{row.code}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{Number(row.budget).toFixed(0)} XAF</TableCell>
                      <TableCell>{Number(row.actual).toFixed(0)} XAF</TableCell>
                      <TableCell className={delta >= 0 ? "text-green-600" : "text-red-600"}>
                        {delta.toFixed(0)} XAF
                      </TableCell>
                    </TableRow>
                  );
                })}
                {budgetVsActual.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      Aucun centre
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
