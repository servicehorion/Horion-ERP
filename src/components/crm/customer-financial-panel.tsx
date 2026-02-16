"use client"

import { CustomerFinancialMetrics } from "@prisma/client"
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Percent,
  AlertCircle,
  Clock,
  Target,
  ShoppingCart,
  Receipt,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { formatCurrency } from "@/config/currencies"
import { cn } from "@/lib/utils"

interface CustomerFinancialPanelProps {
  financialMetrics: CustomerFinancialMetrics
}

export function CustomerFinancialPanel({
  financialMetrics,
}: CustomerFinancialPanelProps) {
  const contributionPercent = Number(financialMetrics.contributionScore)
  const marginPercent = Number(financialMetrics.averageMarginPercent)
  const cashAtRisk = Number(financialMetrics.cashAtRisk)
  const hasCashRisk = cashAtRisk > 0

  const kpis = [
    {
      title: "Revenu total",
      value: formatCurrency(
        Number(financialMetrics.lifetimeGrossRevenue),
        "XAF"
      ),
      icon: DollarSign,
      trend: null,
      color: "text-blue-600",
    },
    {
      title: "Profit net",
      value: formatCurrency(Number(financialMetrics.lifetimeNetProfit), "XAF"),
      icon: TrendingUp,
      trend: Number(financialMetrics.lifetimeNetProfit) > 0 ? "up" : "down",
      color: "text-green-600",
    },
    {
      title: "Marge moyenne",
      value: `${marginPercent.toFixed(1)}%`,
      icon: Percent,
      trend: marginPercent > 15 ? "up" : marginPercent < 10 ? "down" : null,
      color: "text-purple-600",
    },
    {
      title: "Cash immobilisé",
      value: formatCurrency(cashAtRisk, "XAF"),
      icon: AlertCircle,
      trend: null,
      color: hasCashRisk ? "text-red-600" : "text-gray-600",
      badge: hasCashRisk ? (
        <Badge variant="destructive" className="ml-2">
          Risque
        </Badge>
      ) : null,
    },
    {
      title: "Jours d'immobilisation",
      value: `${financialMetrics.daysOfCashImmobil}j`,
      icon: Clock,
      trend: null,
      color: "text-orange-600",
    },
    {
      title: "Contribution",
      value: (
        <div className="space-y-1 w-full">
          <div className="flex items-center justify-between text-sm">
            <span>{contributionPercent.toFixed(0)}/100</span>
          </div>
          <Progress value={contributionPercent} className="h-2" />
        </div>
      ),
      icon: Target,
      trend: null,
      color: "text-indigo-600",
    },
    {
      title: "Commandes",
      value: financialMetrics.totalOrdersCount.toString(),
      icon: ShoppingCart,
      trend: null,
      color: "text-cyan-600",
    },
    {
      title: "Panier moyen",
      value: formatCurrency(Number(financialMetrics.avgOrderValue), "XAF"),
      icon: Receipt,
      trend: null,
      color: "text-teal-600",
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi, index) => {
        const Icon = kpi.icon
        return (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </CardTitle>
              <Icon className={cn("h-4 w-4", kpi.color)} />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold">
                  {typeof kpi.value === "string" ? kpi.value : kpi.value}
                </div>
                {kpi.badge}
                {kpi.trend === "up" && (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                )}
                {kpi.trend === "down" && (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
