import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { FinanceAnalyticsService } from "@/lib/services/finance-analytics.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "P&L analytique | Horion ERP" };

export default async function FinancePnlPage() {
  const user = await getSession();
  checkPermission(user.role, "finance.view");

  const [byClient, byOrder, byProject] = await Promise.all([
    FinanceAnalyticsService.getPnlByClient(user.tenantId),
    FinanceAnalyticsService.getPnlByOrder(user.tenantId),
    FinanceAnalyticsService.getPnlByProject(user.tenantId),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="P&L Analytique" description="Par client, dossier et projet" />

      <Card>
        <CardHeader>
          <CardTitle>P&L par client</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>CA</TableHead>
                  <TableHead>Marge</TableHead>
                  <TableHead>Dossiers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byClient.map((row) => (
                  <TableRow key={row.client}>
                    <TableCell>{row.client}</TableCell>
                    <TableCell>{row.revenue.toFixed(0)} XAF</TableCell>
                    <TableCell>{row.margin.toFixed(0)} XAF</TableCell>
                    <TableCell>{row.count}</TableCell>
                  </TableRow>
                ))}
                {byClient.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      Aucun client
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>P&L par dossier (commande)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Commande</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>CA</TableHead>
                  <TableHead>Marge</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byOrder.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono">{row.orderNumber}</TableCell>
                    <TableCell>{row.client}</TableCell>
                    <TableCell>{row.revenue.toFixed(0)} XAF</TableCell>
                    <TableCell>{row.margin.toFixed(0)} XAF</TableCell>
                  </TableRow>
                ))}
                {byOrder.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      Aucune commande
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>P&L par projet</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projet</TableHead>
                  <TableHead>CA</TableHead>
                  <TableHead>Marge</TableHead>
                  <TableHead>Dossiers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byProject.map((row) => (
                  <TableRow key={row.project}>
                    <TableCell>{row.project}</TableCell>
                    <TableCell>{row.revenue.toFixed(0)} XAF</TableCell>
                    <TableCell>{row.margin.toFixed(0)} XAF</TableCell>
                    <TableCell>{row.count}</TableCell>
                  </TableRow>
                ))}
                {byProject.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      Aucun projet lie
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
