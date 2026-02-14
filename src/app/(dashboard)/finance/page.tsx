import { DollarSign, TrendingUp, TrendingDown, ArrowUpDown } from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getMonthlyPaymentStats, getAverageMargin } from "@/lib/actions/payment.actions";
import { formatCurrency } from "@/config/currencies";

export const metadata = {
  title: "Finance | Horion ERP",
};

export default async function FinancePage() {
  const [statsResult, marginResult] = await Promise.all([
    getMonthlyPaymentStats(),
    getAverageMargin(),
  ]);

  const stats = statsResult.data || { totalInbound: 0, totalOutbound: 0, netCashflow: 0 };
  const margin = marginResult.data || { avgMarginPercent: 0, totalGrossMargin: 0, totalRevenue: 0, count: 0 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Finance</h1>
          <p className="text-muted-foreground">Paiements, marges et comptabilité</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/finance/payments">Paiements</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/finance/margins">Marges</Link>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Encaissements MTD</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(stats.totalInbound, "XAF")}
            </div>
            <p className="text-xs text-muted-foreground">Paiements reçus ce mois</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Décaissements MTD</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(stats.totalOutbound, "XAF")}
            </div>
            <p className="text-xs text-muted-foreground">Paiements effectués ce mois</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cash-flow net</CardTitle>
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.netCashflow >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(stats.netCashflow, "XAF")}
            </div>
            <p className="text-xs text-muted-foreground">Encaissements - Décaissements</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Marge moyenne</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {margin.avgMarginPercent.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Sur {margin.count} commande{margin.count > 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Paiements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Gérez les encaissements clients et les décaissements fournisseurs.
            </p>
            <Button asChild>
              <Link href="/finance/payments">Voir les paiements</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Marges</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Analysez les marges par commande et le P&L global.
            </p>
            <Button asChild>
              <Link href="/finance/margins">Voir les marges</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
