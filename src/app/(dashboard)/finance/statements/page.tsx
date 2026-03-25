import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { FinanceStatementsService } from "@/lib/services/finance-statements.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Etats financiers | Horion ERP" };

export default async function FinanceStatementsPage() {
  const user = await getSession();
  checkPermission(user.role, "finance.view");

  const [balance, income] = await Promise.all([
    FinanceStatementsService.getBalanceSheet(user.tenantId),
    FinanceStatementsService.getIncomeStatement(user.tenantId),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="États Financiers" description="Bilan & Compte de résultat auto-généré" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bilan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Actifs</h3>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Compte</TableHead>
                        <TableHead>Solde</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {balance.assets.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>{a.code} - {a.name}</TableCell>
                          <TableCell>{Number(a.balance).toFixed(0)} {a.currency}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell className="font-medium">Total actifs</TableCell>
                        <TableCell className="font-medium">{balance.totalAssets.toFixed(0)} XAF</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Passifs & capitaux</h3>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Compte</TableHead>
                        <TableHead>Solde</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {balance.liabilities.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>{a.code} - {a.name}</TableCell>
                          <TableCell>{Math.abs(Number(a.balance)).toFixed(0)} {a.currency}</TableCell>
                        </TableRow>
                      ))}
                      {balance.equity.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>{a.code} - {a.name}</TableCell>
                          <TableCell>{Math.abs(Number(a.balance)).toFixed(0)} {a.currency}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell className="font-medium">Total passifs + capitaux</TableCell>
                        <TableCell className="font-medium">{(balance.totalLiabilities + balance.totalEquity).toFixed(0)} XAF</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Compte de resultat</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Produits</h3>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Compte</TableHead>
                        <TableHead>Montant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {income.revenues.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>{a.code} - {a.name}</TableCell>
                          <TableCell>{Math.abs(Number(a.balance)).toFixed(0)} {a.currency}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell className="font-medium">Total produits</TableCell>
                        <TableCell className="font-medium">{income.totalRevenue.toFixed(0)} XAF</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Charges</h3>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Compte</TableHead>
                        <TableHead>Montant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {income.expenses.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>{a.code} - {a.name}</TableCell>
                          <TableCell>{Math.abs(Number(a.balance)).toFixed(0)} {a.currency}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell className="font-medium">Total charges</TableCell>
                        <TableCell className="font-medium">{income.totalExpenses.toFixed(0)} XAF</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Resultat net</TableCell>
                        <TableCell className="font-medium">{income.netIncome.toFixed(0)} XAF</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
