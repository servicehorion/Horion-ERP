import Link from "next/link";
import {
  ArrowLeft, ShieldCheck, TrendingUp, TrendingDown,
  AlertTriangle, CreditCard, DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TreasuryWalletManager } from "@/components/finance/treasury-wallet-manager";
import { TreasuryReconciliationPanel } from "@/components/finance/treasury-reconciliation-panel";
import {
  getFinancialKPIs,
  getAgingReport,
  getPaymentMethodStats,
  getTreasuryAccounts,
  getTreasuryTransactions,
} from "@/lib/actions/finance.actions";
import { getPayments } from "@/lib/actions/payment.actions";
import { formatCurrency } from "@/config/currencies";

export const metadata = { title: "Trésorerie | Horion ERP" };

export default async function TreasuryPage() {
  const [kpisRes, agingRes, methodsRes, pendingRes, treasuryAccountsRes, treasuryTransactionsRes] = await Promise.all([
    getFinancialKPIs(),
    getAgingReport(),
    getPaymentMethodStats(),
    getPayments({ status: "PENDING", limit: 20 }),
    getTreasuryAccounts(),
    getTreasuryTransactions(15),
  ]);

  const kpis = kpisRes.data || {
    mtdInbound: 0, mtdOutbound: 0, mtdNet: 0,
    avgMarginPercent: 0, totalGrossMargin: 0, totalRevenue: 0, totalCogs: 0,
    ordersAnalyzed: 0, pendingPayments: 0, activeOrders: 0,
    collectionRate: 0, avgMonthlyBurn: 0,
  };
  const aging = agingRes.data || {
    aging: { current: [], days30: [], days60: [], days90: [], over90: [] },
    totals: { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 },
    totalOutstanding: 0,
  };
  const methods = methodsRes.data || [];
  const pendingPayments = pendingRes.data || [];
  const treasuryAccounts = treasuryAccountsRes.data || [];
  const treasuryTransactions = treasuryTransactionsRes.data || [];

  // Cash position estimate
  const cashPosition = kpis.mtdInbound - kpis.mtdOutbound;
  const runwayMonths = kpis.avgMonthlyBurn > 0
    ? Math.max(0, cashPosition / kpis.avgMonthlyBurn)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/finance"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-7 w-7" />
            Trésorerie
          </h1>
          <p className="text-muted-foreground">
            Position de trésorerie, réconciliation et alertes
          </p>
        </div>
      </div>

      {/* Treasury KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5" /> Position nette MTD
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${cashPosition >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(cashPosition, "XAF")}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Créances impayées
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(aging.totalOutstanding, "XAF")}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-3.5 w-3.5" /> Burn rate /mois
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(kpis.avgMonthlyBurn, "XAF")}
            </div>
          </CardContent>
        </Card>

        <Card className={runwayMonths < 3 && runwayMonths > 0 ? "border-red-200" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" /> Runway estimé
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${runwayMonths < 3 && runwayMonths > 0 ? "text-red-600" : ""}`}>
              {runwayMonths > 0 ? `${runwayMonths.toFixed(1)} mois` : "N/A"}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Wallets Chine & devises</h2>
            <p className="text-sm text-muted-foreground">
              Suivi du wallet CNY, des rechargements et des débits commandes.
            </p>
          </div>
          <Badge variant="secondary">{treasuryAccounts.length} wallet(s)</Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {treasuryAccounts.length === 0 ? (
            <Card className="md:col-span-2 xl:col-span-4">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Aucun wallet configuré pour le moment.
              </CardContent>
            </Card>
          ) : (
            treasuryAccounts.map((account: any) => (
              <Card key={account.id} className={account.belowThreshold ? "border-red-300" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    <span>{account.label}</span>
                    <Badge variant={account.belowThreshold ? "destructive" : "secondary"}>
                      {account.currency}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="text-2xl font-bold">
                    {formatCurrency(Number(account.balance), account.currency)}
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Seuil d'alerte</span>
                    <span>
                      {account.alertBelowAmount != null
                        ? formatCurrency(Number(account.alertBelowAmount), account.currency)
                        : "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Derniers mouvements</span>
                    <span>{account.transactions?.length ?? 0}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <TreasuryWalletManager
          accounts={treasuryAccounts.map((account: any) => ({
            id: account.id,
            label: account.label,
            currency: account.currency,
          }))}
        />

        <Card>
          <CardHeader>
            <CardTitle>Mouvements récents de trésorerie</CardTitle>
          </CardHeader>
          <CardContent>
            {treasuryTransactions.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Aucun mouvement enregistré.
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Compte</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Référence</TableHead>
                      <TableHead>Commande</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {treasuryTransactions.map((transaction: any) => (
                      <TableRow key={transaction.id}>
                        <TableCell>{transaction.account.label}</TableCell>
                        <TableCell>{transaction.type}</TableCell>
                        <TableCell>{transaction.reference || "-"}</TableCell>
                        <TableCell>{transaction.orderId || "-"}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(Number(transaction.amount), transaction.account.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <TreasuryReconciliationPanel />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pending Payments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-yellow-600" />
              Paiements en attente ({kpis.pendingPayments})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingPayments.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">
                Aucun paiement en attente
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Commande</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingPayments.slice(0, 10).map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <Link href={`/orders/${p.orderId}`} className="text-sm text-primary hover:underline">
                            {p.order.orderNumber}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={p.direction === "INBOUND" ? "text-green-700" : "text-red-700"}>
                            {p.direction === "INBOUND" ? "Entrant" : "Sortant"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(Number(p.amountXAF), "XAF")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-indigo-600" />
              Répartition par méthode
            </CardTitle>
          </CardHeader>
          <CardContent>
            {methods.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">
                Aucune donnée disponible
              </p>
            ) : (
              <div className="space-y-3">
                {methods.map((m) => {
                  const maxTotal = methods[0]?.total || 1;
                  return (
                    <div key={m.method} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{m.method}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">
                            {m.count} op.
                          </Badge>
                          <span className="font-medium">
                            {formatCurrency(m.total, "XAF")}
                          </span>
                        </div>
                      </div>
                      <Progress value={(m.total / maxTotal) * 100} className="h-1.5" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Aging Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Détail des créances par ancienneté
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-4">
            {[
              { label: "En cours", amount: aging.totals.current, color: "text-green-600" },
              { label: "1-30 jours", amount: aging.totals.days30, color: "text-blue-600" },
              { label: "31-60 jours", amount: aging.totals.days60, color: "text-yellow-600" },
              { label: "61-90 jours", amount: aging.totals.days90, color: "text-orange-600" },
              { label: ">90 jours", amount: aging.totals.over90, color: "text-red-600" },
            ].map((bucket) => (
              <div key={bucket.label} className="text-center">
                <p className="text-xs text-muted-foreground">{bucket.label}</p>
                <p className={`text-lg font-bold ${bucket.color}`}>
                  {bucket.amount > 0 ? formatCurrency(bucket.amount, "XAF") : "-"}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
