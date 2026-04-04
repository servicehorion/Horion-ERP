import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/config/currencies";
import { checkPermission } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import { FinanceOperationsService } from "@/lib/services/finance-operations.service";

export const metadata = { title: "Etats financiers | Horion ERP" };

export default async function FinanceStatementsPage() {
  const user = await getSession();
  checkPermission(user.role, "finance.view");

  const snapshot = await FinanceOperationsService.getOperationsSnapshot(user.tenantId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Etats financiers operationnels"
        description="Lecture seule. Vue cash-first pour piloter Horion sans lourdeur comptable."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>P&L operationnel</CardTitle>
            <Badge variant="secondary">Read-only</Badge>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>CA brut</span>
              <span className="font-medium">{formatCurrency(snapshot.operationalPnl.grossRevenue, "XAF")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Marge nette</span>
              <span className="font-medium">{formatCurrency(snapshot.operationalPnl.netMargin, "XAF")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Taux de marge</span>
              <span className="font-medium">{snapshot.operationalPnl.netMarginPercent.toFixed(1)}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Flux de tresorerie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Cash bloqué</span>
              <span className="font-medium">{formatCurrency(snapshot.cash.lockedCash, "XAF")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Cash operationnel</span>
              <span className="font-medium">{formatCurrency(snapshot.cash.operatingCash, "XAF")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Cash Chine</span>
              <span className="font-medium">{formatCurrency(snapshot.cash.chinaCash, "XAF")}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <span className="font-semibold">Position nette</span>
              <span className="font-semibold">{formatCurrency(snapshot.cash.netCashPosition, "XAF")}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bilan simplifie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Actifs cash</span>
              <span className="font-medium">{formatCurrency(snapshot.balance.assetsCash, "XAF")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Commandes en cours</span>
              <span className="font-medium">{formatCurrency(snapshot.balance.liabilitiesCustomerOrders, "XAF")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Dettes partenaires</span>
              <span className="font-medium">{formatCurrency(snapshot.balance.liabilitiesPartnerPayables, "XAF")}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <span className="font-semibold">Capitaux propres simplifies</span>
              <span className="font-semibold">{formatCurrency(snapshot.balance.simplifiedEquity, "XAF")}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transactions recentres sur l'operation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Commande</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshot.recentTransactions.map((transaction) => (
                  <TableRow key={`${transaction.source}-${transaction.id}`}>
                    <TableCell>{transaction.occurredAt.toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell>{transaction.source}</TableCell>
                    <TableCell>{transaction.walletLabel}</TableCell>
                    <TableCell>{transaction.category}</TableCell>
                    <TableCell className="font-mono text-xs">{transaction.orderId || "-"}</TableCell>
                    <TableCell>
                      <span className={transaction.direction === "IN" ? "text-green-600" : "text-red-600"}>
                        {transaction.direction === "IN" ? "+" : "-"}
                        {transaction.amountXAF != null
                          ? formatCurrency(transaction.amountXAF, "XAF")
                          : `${transaction.amountLocal.toLocaleString("fr-FR")} ${transaction.currency}`}
                      </span>
                    </TableCell>
                    <TableCell>{transaction.status}</TableCell>
                  </TableRow>
                ))}
                {snapshot.recentTransactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                      Aucun mouvement recent.
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
