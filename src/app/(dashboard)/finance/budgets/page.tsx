import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { BudgetService } from "@/lib/services/budget.service";
import { CostCenterService } from "@/lib/services/cost-center.service";
import { createBudgetPlan, addBudgetLine } from "@/lib/actions/finance-advanced.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Budgets | Horion ERP" };

export default async function FinanceBudgetsPage() {
  const user = await getSession();
  checkPermission(user.role, "finance.view");

  const [budgets, costCenters] = await Promise.all([
    BudgetService.list(user.tenantId),
    CostCenterService.list(user.tenantId),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Budgets & Scénarii" description="Planification annuelle et allocation" />

      <Card>
        <CardHeader>
          <CardTitle>Nouveau budget</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createBudgetPlan} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input name="name" placeholder="Nom" required />
            <Input name="year" type="number" defaultValue={new Date().getFullYear()} />
            <Input name="currency" defaultValue="XAF" />
            <Button type="submit">Creer</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Budgets existants</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Annee</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Ajouter ligne</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {budgets.map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell>{b.year}</TableCell>
                    <TableCell>{b.status}</TableCell>
                    <TableCell>{Number(b.total).toFixed(0)} {b.currency}</TableCell>
                    <TableCell>
                      <form action={addBudgetLine} className="flex items-center gap-2">
                        <input type="hidden" name="budgetId" value={b.id} />
                        <Input name="category" placeholder="Categorie" className="h-8" required />
                        <select name="costCenterId" className="h-8 rounded-md border bg-transparent px-2 text-xs">
                          <option value="">Centre</option>
                          {costCenters.map((c: any) => (
                            <option key={c.id} value={c.id}>{c.code}</option>
                          ))}
                        </select>
                        <Input name="month" placeholder="Mois" type="number" className="h-8 w-20" />
                        <Input name="amount" placeholder="Montant" type="number" step="0.01" className="h-8 w-28" required />
                        <Button size="sm" variant="outline">Ajouter</Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
                {budgets.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      Aucun budget
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
