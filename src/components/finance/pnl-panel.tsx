import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatCurrency } from "@/config/currencies";

interface PnLData {
  totalRevenue: number;
  totalCogs: number;
  grossProfit: number;
  grossMarginPercent: number;
  totalCommission: number;
  netProfit: number;
  netMarginPercent: number;
  expenseByType: Record<string, number>;
  ordersAnalyzed: number;
}

const EXPENSE_LABELS: Record<string, string> = {
  SUPPLIER_PAYMENT: "Achats marchandises",
  FREIGHT_PAYMENT: "Fret & Transport",
  CUSTOMS_DUTY: "Douane & Taxes",
  QC_PAYMENT: "Contrôle qualité",
  COMMISSION: "Commissions",
  REFUND: "Remboursements",
};

export function PnLPanel({ data }: { data: PnLData }) {
  const expenseEntries = Object.entries(data.expenseByType)
    .map(([type, amount]) => ({
      label: EXPENSE_LABELS[type] || type,
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-purple-600" />
          Compte de résultat (P&L)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Revenue */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-green-700 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Chiffre d&apos;affaires
            </span>
            <span className="font-bold text-green-700">
              {formatCurrency(data.totalRevenue, "XAF")}
            </span>
          </div>
        </div>

        <div className="border-t" />

        {/* COGS */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-red-700 flex items-center gap-1">
              <TrendingDown className="h-3 w-3" /> Coût des marchandises
            </span>
            <span className="font-bold text-red-700">
              -{formatCurrency(data.totalCogs, "XAF")}
            </span>
          </div>

          {/* Expense breakdown */}
          {expenseEntries.length > 0 && (
            <div className="ml-4 space-y-1">
              {expenseEntries.map((e) => (
                <div key={e.label} className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{e.label}</span>
                  <span>{formatCurrency(e.amount, "XAF")}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-dashed" />

        {/* Gross Profit */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold flex items-center gap-1">
            <Minus className="h-3 w-3" /> Marge brute
          </span>
          <div className="text-right">
            <span className={`font-bold ${data.grossProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
              {formatCurrency(data.grossProfit, "XAF")}
            </span>
            <span className="ml-2 text-xs text-muted-foreground">
              ({data.grossMarginPercent.toFixed(1)}%)
            </span>
          </div>
        </div>

        {/* Commission */}
        {data.totalCommission > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Commissions</span>
            <span className="text-red-600">-{formatCurrency(data.totalCommission, "XAF")}</span>
          </div>
        )}

        <div className="border-t-2 border-primary" />

        {/* Net Profit */}
        <div className="flex items-center justify-between">
          <span className="font-bold">Résultat net</span>
          <div className="text-right">
            <span className={`text-xl font-bold ${data.netProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
              {formatCurrency(data.netProfit, "XAF")}
            </span>
            <span className="ml-2 text-xs text-muted-foreground">
              ({data.netMarginPercent.toFixed(1)}%)
            </span>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground text-right">
          Basé sur {data.ordersAnalyzed} commande(s) analysée(s)
        </p>
      </CardContent>
    </Card>
  );
}
