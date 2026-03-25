import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { PayrollService } from "@/lib/services/payroll.service";
import { prisma } from "@/lib/db";
import { upsertPayrollProfile, createPayrollRun, addPayrollLine, markPayrollRunPaid } from "@/lib/actions/payroll.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Paie | Horion ERP" };

export default async function FinancePayrollPage() {
  const user = await getSession();
  checkPermission(user.role, "finance.view");

  const [profiles, runs, users] = await Promise.all([
    PayrollService.listProfiles(user.tenantId),
    PayrollService.listRuns(user.tenantId),
    prisma.user.findMany({ where: { tenantId: user.tenantId }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Paie" description="Profils salaire et cycles de paie" />

      <Card>
        <CardHeader>
          <CardTitle>Profil salaire</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={upsertPayrollProfile} className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <select name="userId" className="h-9 rounded-md border bg-transparent px-3 text-sm" required>
              <option value="">Employe</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <Input name="baseSalary" type="number" step="0.01" placeholder="Salaire base" required />
            <Input name="currency" defaultValue="XAF" />
            <Input name="bankAccount" placeholder="Compte bancaire" />
            <Button type="submit">Enregistrer</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nouveau cycle de paie</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createPayrollRun} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input name="periodStart" type="date" required />
            <Input name="periodEnd" type="date" required />
            <Button type="submit">Creer</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Runs ({runs.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {runs.map((run) => (
            <div key={run.id} className="rounded-md border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Periode {new Date(run.periodStart).toLocaleDateString("fr-FR")} - {new Date(run.periodEnd).toLocaleDateString("fr-FR")}</p>
                  <p className="text-sm text-muted-foreground">Statut: {run.status} | Brut: {Number(run.totalGross).toFixed(0)} XAF | Net: {Number(run.totalNet).toFixed(0)} XAF</p>
                </div>
                <div className="flex items-center gap-2">
                  <form action={markPayrollRunPaid.bind(null, run.id)}>
                    <Button size="sm" variant="outline">Marquer paye</Button>
                  </form>
                  <Button size="sm" variant="outline" asChild>
                    <a href={`/api/finance/payroll/export?runId=${run.id}`}>Exporter CSV</a>
                  </Button>
                </div>
              </div>
              <form action={addPayrollLine} className="grid grid-cols-1 md:grid-cols-6 gap-2">
                <input type="hidden" name="runId" value={run.id} />
                <select name="userId" className="h-9 rounded-md border bg-transparent px-3 text-sm" required>
                  <option value="">Employe</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                <Input name="baseSalary" type="number" step="0.01" placeholder="Base" required />
                <Input name="allowances" type="number" step="0.01" placeholder="Primes" />
                <Input name="deductions" type="number" step="0.01" placeholder="Retenues" />
                <Button type="submit" size="sm" variant="outline">Ajouter ligne</Button>
              </form>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employe</TableHead>
                      <TableHead>Brut</TableHead>
                      <TableHead>Net</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {run.lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>{line.user?.name}</TableCell>
                        <TableCell>{Number(line.gross).toFixed(0)} XAF</TableCell>
                        <TableCell>{Number(line.net).toFixed(0)} XAF</TableCell>
                        <TableCell>{line.status}</TableCell>
                      </TableRow>
                    ))}
                    {run.lines.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                          Aucune ligne
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
          {runs.length === 0 && (
            <div className="text-sm text-muted-foreground">Aucun run de paie</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profils ({profiles.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employe</TableHead>
                  <TableHead>Salaire</TableHead>
                  <TableHead>Devise</TableHead>
                  <TableHead>Compte</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.user?.name}</TableCell>
                    <TableCell>{Number(p.baseSalary).toFixed(0)}</TableCell>
                    <TableCell>{p.currency}</TableCell>
                    <TableCell>{p.bankAccount || "-"}</TableCell>
                  </TableRow>
                ))}
                {profiles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      Aucun profil
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
