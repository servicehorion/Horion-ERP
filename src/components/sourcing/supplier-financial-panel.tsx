"use client"

import type { SupplierFinancialMetrics } from "@prisma/client"
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Receipt,
  PieChart,
  Sparkles,
  Target,
  ShoppingCart,
  AlertTriangle,
  Minus,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { formatCurrency } from "@/config/currencies"
import { cn } from "@/lib/utils"

interface SupplierFinancialPanelProps {
  financialMetrics: SupplierFinancialMetrics
}

export function SupplierFinancialPanel({
  financialMetrics,
}: SupplierFinancialPanelProps) {
  const spendConcentration = Number(financialMetrics.spendConcentration)
  const costEfficiency = Number(financialMetrics.costEfficiencyScore)
  const priceTrend = financialMetrics.priceTrendDirection
  const priceTrendPct = financialMetrics.priceTrendPercent
    ? Number(financialMetrics.priceTrendPercent)
    : null

  const PriceTrendIcon =
    priceTrend === "INCREASING" ? TrendingUp :
    priceTrend === "DECREASING" ? TrendingDown :
    Minus

  const priceTrendColor =
    priceTrend === "INCREASING" ? "text-red-600" :
    priceTrend === "DECREASING" ? "text-green-600" :
    "text-gray-600"

  const kpis = [
    {
      title: "Volume total achats",
      value: formatCurrency(Number(financialMetrics.lifetimeSpend), "XAF"),
      icon: DollarSign,
      color: "text-blue-600",
      trend: null as string | null,
      badge: null as React.ReactNode,
    },
    {
      title: "Paiements sortants",
      value: formatCurrency(Number(financialMetrics.totalPaymentsOut), "XAF"),
      icon: TrendingUp,
      color: "text-green-600",
      trend: null,
      badge: null,
    },
    {
      title: "Panier moyen",
      value: formatCurrency(Number(financialMetrics.avgOrderValue), "XAF"),
      icon: Receipt,
      color: "text-teal-600",
      trend: null,
      badge: null,
    },
    {
      title: "Concentration spend",
      value: `${spendConcentration.toFixed(1)}%`,
      icon: PieChart,
      color: spendConcentration > 30 ? "text-orange-600" : "text-gray-600",
      trend: null,
      badge: spendConcentration > 30 ? (
        <Badge variant="destructive" className="ml-2 text-xs">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Risque
        </Badge>
      ) : null,
    },
    {
      title: "Tendance prix",
      value: (
        <div className="flex items-center gap-2">
          <PriceTrendIcon className={cn("h-5 w-5", priceTrendColor)} />
          <span className={priceTrendColor}>
            {priceTrend === "INCREASING" ? "En hausse" :
             priceTrend === "DECREASING" ? "En baisse" :
             "Stable"}
          </span>
          {priceTrendPct !== null && (
            <span className={cn("text-sm", priceTrendColor)}>
              ({priceTrendPct > 0 ? "+" : ""}{priceTrendPct.toFixed(1)}%)
            </span>
          )}
        </div>
      ),
      icon: PriceTrendIcon,
      color: priceTrendColor,
      trend: null,
      badge: null,
    },
    {
      title: "Economies réalisées",
      value: formatCurrency(Number(financialMetrics.savingsRealized), "XAF"),
      icon: Sparkles,
      color: "text-green-600",
      trend: null,
      badge: null,
    },
    {
      title: "Efficacité coût",
      value: (
        <div className="space-y-1 w-full">
          <div className="flex items-center justify-between text-sm">
            <span>{costEfficiency.toFixed(0)}/100</span>
          </div>
          <Progress value={costEfficiency} className="h-2" />
        </div>
      ),
      icon: Target,
      color: "text-indigo-600",
      trend: null,
      badge: null,
    },
    {
      title: "Commandes totales",
      value: financialMetrics.totalOrdersCount.toString(),
      icon: ShoppingCart,
      color: "text-cyan-600",
      trend: null,
      badge: null,
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
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
