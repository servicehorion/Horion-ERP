import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { ForecastService } from "@/lib/services/forecast.service";
import { createForecastScenario, addForecastLine } from "@/lib/actions/finance-advanced.actions";
import { ForecastChart } from "@/components/finance/forecast-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Forecast & Scenarios | Horion ERP" };

export default async function FinanceForecastPage() {
  const user = await getSession();
  checkPermission(user.role, "finance.view");

  const scenarios = await ForecastService.list(user.tenantId);
  const primary = scenarios.find((s: any) => s.type === "BASE") || scenarios[0];
  const chartData = primary?.lines?.map((l: any) => ({
    month: l.month,
    revenue: Number(l.revenue),
    cogs: Number(l.cogs),
    expenses: Number(l.expenses),
    cashIn: Number(l.cashIn),
    cashOut: Number(l.cashOut),
  })) || [];

  return (
    <div className="space-y-6">
      <PageHeader title="Forecast & Scénarios" description="Base, optimiste, pessimiste" />

      <ForecastChart data={chartData} title={primary ? `Scenario ${primary.name}` : "Projection"} />

      <Card>
        <CardHeader>
          <CardTitle>Nouveau scenario</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createForecastScenario} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input name="name" placeholder="Nom" required />
            <select name="type" className="h-9 rounded-md border bg-transparent px-3 text-sm">
              <option value="BASE">BASE</option>
              <option value="OPTIMISTIC">OPTIMISTIC</option>
              <option value="PESSIMISTIC">PESSIMISTIC</option>
            </select>
            <div />
            <Button type="submit">Creer</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scenarios existants</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Ajouter ligne</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scenarios.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.type}</TableCell>
                    <TableCell>
                      <form action={addForecastLine} className="grid grid-cols-1 md:grid-cols-6 gap-2">
                        <input type="hidden" name="scenarioId" value={s.id} />
                        <Input name="month" placeholder="2026-03" className="h-8" required />
                        <Input name="revenue" placeholder="Revenus" type="number" step="0.01" className="h-8" required />
                        <Input name="cogs" placeholder="COGS" type="number" step="0.01" className="h-8" required />
                        <Input name="expenses" placeholder="Expenses" type="number" step="0.01" className="h-8" required />
                        <Input name="cashIn" placeholder="Entrées de trésorerie" type="number" step="0.01" className="h-8" required />
                        <Input name="cashOut" placeholder="Sorties de trésorerie" type="number" step="0.01" className="h-8" required />
                        <Button size="sm" variant="outline">Ajouter</Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
                {scenarios.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                      Aucun scenario
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
