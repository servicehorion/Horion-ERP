import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { CashPlanService } from "@/lib/services/cash-plan.service";
import { createCashPlan, addCashPlanLine } from "@/lib/actions/finance-advanced.actions";
import { CashflowChart } from "@/components/finance/cashflow-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Cash Planning | Horion ERP" };

export default async function FinanceCashPlanningPage() {
  const user = await getSession();
  checkPermission(user.role, "finance.view");

  const plans = await CashPlanService.list(user.tenantId);
  const primaryPlan = plans[0];
  const grouped: Record<string, { inbound: number; outbound: number }> = {};
  if (primaryPlan) {
    for (const line of primaryPlan.lines || []) {
      const month = line.date.toISOString().slice(0, 7);
      if (!grouped[month]) grouped[month] = { inbound: 0, outbound: 0 };
      const amount = Number(line.amount);
      if (line.direction === "IN") grouped[month].inbound += amount;
      else grouped[month].outbound += amount;
    }
  }
  const chartData = Object.entries(grouped)
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([month, values]) => ({
      month,
      inbound: values.inbound,
      outbound: values.outbound,
      net: values.inbound - values.outbound,
    }));
  let running = 0;
  const cashflowData = chartData.map((d) => {
    running += d.net;
    return { ...d, balance: running };
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Cash Planning" description="Plan de trésorerie et scénarios" />

      <CashflowChart data={cashflowData} />

      <Card>
        <CardHeader>
          <CardTitle>Nouveau plan</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createCashPlan} className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <Input name="name" placeholder="Nom" required />
            <Input name="startAt" type="date" required />
            <Input name="endAt" type="date" required />
            <Input name="currency" defaultValue="XAF" />
            <Button type="submit">Creer</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plans existants</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Periode</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Ajouter ligne</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      {p.startAt.toLocaleDateString("fr-FR")} - {p.endAt.toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell>{p.status}</TableCell>
                    <TableCell>
                      <form action={addCashPlanLine} className="flex items-center gap-2">
                        <input type="hidden" name="planId" value={p.id} />
                        <Input name="date" type="date" className="h-8" required />
                        <select name="direction" className="h-8 rounded-md border bg-transparent px-2 text-xs">
                          <option value="IN">IN</option>
                          <option value="OUT">OUT</option>
                        </select>
                        <Input name="amount" type="number" step="0.01" className="h-8 w-28" required />
                        <Input name="description" placeholder="Description" className="h-8" />
                        <Button size="sm" variant="outline">Ajouter</Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
                {plans.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      Aucun plan
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
