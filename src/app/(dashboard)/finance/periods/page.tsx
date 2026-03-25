import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { AccountingService } from "@/lib/services/accounting.service";
import { createAccountingPeriod, closeAccountingPeriod } from "@/lib/actions/finance-advanced.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageHeader as FinancePageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Periodes Comptables | Horion ERP" };

export default async function FinancePeriodsPage() {
  const user = await getSession();
  checkPermission(user.role, "finance.view");

  const periods = await AccountingService.listPeriods(user.tenantId);

  return (
    <div className="space-y-6">
      <FinancePageHeader title="Periodes Comptables" description="Ouverture, fermeture, controle" />

      <Card>
        <CardHeader>
          <CardTitle>Nouvelle periode</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createAccountingPeriod} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input name="name" placeholder="Ex: 2026-Q1" required />
            <Input name="startAt" type="date" required />
            <Input name="endAt" type="date" required />
            <Button type="submit">Creer</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Periodes existantes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Debut</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.startAt.toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell>{p.endAt.toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell>{p.status}</TableCell>
                    <TableCell className="text-right">
                      {p.status === "OPEN" ? (
                        <form action={closeAccountingPeriod.bind(null, p.id)}>
                          <Button size="sm" variant="outline">Cloturer</Button>
                        </form>
                      ) : (
                        <span className="text-xs text-muted-foreground">Fermee</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {periods.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      Aucune periode creee
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
