import Link from "next/link";
import {
  DollarSign, TrendingUp, TrendingDown, ArrowUpDown,
  CreditCard, BarChart3, BookOpen, ArrowRightLeft,
  AlertTriangle, Percent, ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  getFinancialKPIs,
  getCashflowAnalysis,
  getProfitAndLoss,
  getAgingReport,
  getLatestFXRates,
  getRevenueByClient,
} from "@/lib/actions/finance.actions";
import { ExportFinanceButton } from "@/components/finance/export-finance-button";
import { CashflowChart } from "@/components/finance/cashflow-chart";
import { PnLPanel } from "@/components/finance/pnl-panel";
import { AgingPanel } from "@/components/finance/aging-panel";
import { FXRatesPanel } from "@/components/finance/fx-rates-panel";
import { RevenueByClient } from "@/components/finance/revenue-by-client";
import { formatCurrency } from "@/config/currencies";

export const metadata = { title: "Finance Intelligence | Horion ERP" };

export default async function FinanceDashboardPage() {
  const [kpisRes, cashflowRes, pnlRes, agingRes, fxRes, clientRes] = await Promise.all([
    getFinancialKPIs(),
    getCashflowAnalysis(6),
    getProfitAndLoss(),
    getAgingReport(),
    getLatestFXRates(),
    getRevenueByClient(),
  ]);

  const kpis = kpisRes.data || {
    mtdInbound: 0, mtdOutbound: 0, mtdNet: 0,
    avgMarginPercent: 0, totalGrossMargin: 0, totalRevenue: 0, totalCogs: 0,
    ordersAnalyzed: 0, pendingPayments: 0, activeOrders: 0,
    collectionRate: 0, avgMonthlyBurn: 0,
  };
  const cashflow = cashflowRes.data || [];
  const pnl = pnlRes.data || {
    totalRevenue: 0, totalCogs: 0, grossProfit: 0, grossMarginPercent: 0,
    totalCommission: 0, netProfit: 0, netMarginPercent: 0,
    expenseByType: {}, ordersAnalyzed: 0, revenueInbound: 0,
  };
  const aging = agingRes.data || {
    aging: { current: [], days30: [], days60: [], days90: [], over90: [] },
    totals: { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 },
    totalOutstanding: 0,
  };
  const fxRates = fxRes.data || [];
  const clients = clientRes.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Finance Intelligence</h1>
          <p className="text-muted-foreground">
            Vue Bloomberg — Cash-flow, P&L, Créances, Change
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <ExportFinanceButton />
          <Button variant="outline" size="sm" asChild>
            <Link href="/finance/ledger">
              <BookOpen className="mr-2 h-4 w-4" />
              Grand livre
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/finance/fx">
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Change
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/finance/treasury">
              <ShieldCheck className="mr-2 h-4 w-4" />
              Trésorerie
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/finance/payments">
              <CreditCard className="mr-2 h-4 w-4" />
              Paiements
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/finance/margins">
              <BarChart3 className="mr-2 h-4 w-4" />
              Marges
            </Link>
          </Button>
        </div>
      </div>

      {/* Bloomberg KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
            <CardTitle className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Encaissements MTD
            </CardTitle>
            <TrendingUp className="h-3.5 w-3.5 text-green-600" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-lg font-bold text-green-600">
              {formatCurrency(kpis.mtdInbound, "XAF")}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
            <CardTitle className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Décaissements MTD
            </CardTitle>
            <TrendingDown className="h-3.5 w-3.5 text-red-600" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-lg font-bold text-red-600">
              {formatCurrency(kpis.mtdOutbound, "XAF")}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
            <CardTitle className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Cash-flow net
            </CardTitle>
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className={`text-lg font-bold ${kpis.mtdNet >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(kpis.mtdNet, "XAF")}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
            <CardTitle className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Marge moyenne
            </CardTitle>
            <Percent className="h-3.5 w-3.5 text-purple-600" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-lg font-bold">{kpis.avgMarginPercent.toFixed(1)}%</div>
            <p className="text-[10px] text-muted-foreground">{kpis.ordersAnalyzed} commande(s)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
            <CardTitle className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              En attente
            </CardTitle>
            <AlertTriangle className="h-3.5 w-3.5 text-yellow-600" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-lg font-bold text-yellow-600">{kpis.pendingPayments}</div>
            <p className="text-[10px] text-muted-foreground">{kpis.activeOrders} cmd actives</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
            <CardTitle className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Recouvrement
            </CardTitle>
            <DollarSign className="h-3.5 w-3.5 text-cyan-600" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-lg font-bold">{kpis.collectionRate.toFixed(0)}%</div>
            <Progress value={kpis.collectionRate} className="h-1 mt-1" />
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Cashflow Chart + P&L */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CashflowChart data={cashflow} />
        </div>
        <PnLPanel data={pnl} />
      </div>

      {/* Row 3: Aging + FX + Revenue by Client */}
      <div className="grid gap-6 lg:grid-cols-3">
        <AgingPanel data={aging} />
        <FXRatesPanel rates={fxRates} />
        <RevenueByClient data={clients} />
      </div>

      {/* Burn Rate Alert */}
      {kpis.avgMonthlyBurn > 0 && (
        <Card className="border-orange-200">
          <CardContent className="flex items-center gap-4 py-4">
            <AlertTriangle className="h-6 w-6 text-orange-600 shrink-0" />
            <div>
              <p className="font-medium">Burn rate mensuel moyen</p>
              <p className="text-sm text-muted-foreground">
                Décaissements moyens sur 3 mois :{" "}
                <span className="font-bold text-orange-600">
                  {formatCurrency(kpis.avgMonthlyBurn, "XAF")}/mois
                </span>
              </p>
            </div>
            <Badge variant="secondary" className="ml-auto shrink-0">Burn rate</Badge>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
