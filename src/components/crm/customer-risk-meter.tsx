"use client"

import { CustomerRiskProfile } from "@prisma/client"
import { AlertCircle, TrendingDown, TrendingUp, Shield } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { formatCurrency } from "@/config/currencies"
import { cn } from "@/lib/utils"

interface CustomerRiskMeterProps {
  riskProfile: CustomerRiskProfile
}

export function CustomerRiskMeter({ riskProfile }: CustomerRiskMeterProps) {
  const globalRisk = riskProfile.globalRiskScore
  const paymentRisk = riskProfile.paymentRisk
  const logisticsRisk = riskProfile.logisticsRisk
  const customsRisk = riskProfile.customsRisk
  const disputeRisk = Number(riskProfile.disputeFrequency) * 100
  const cashExposure = Number(riskProfile.cashExposure)

  const getRiskLevel = (score: number) => {
    if (score <= 30) return { label: "FAIBLE", color: "bg-green-500", variant: "default" as const }
    if (score <= 60) return { label: "MOYEN", color: "bg-yellow-500", variant: "secondary" as const }
    return { label: "ÉLEVÉ", color: "bg-red-500", variant: "destructive" as const }
  }

  const globalRiskLevel = getRiskLevel(globalRisk)

  const getRiskColor = (score: number) => {
    if (score <= 30) return "bg-green-500"
    if (score <= 60) return "bg-yellow-500"
    return "bg-red-500"
  }

  const riskFactors = (riskProfile.riskFactors as any) || {}
  const riskFactorsList = Object.entries(riskFactors).map(([key, value]) => ({
    key,
    value: String(value),
  }))

  return (
    <div className="space-y-6">
      {/* Global Risk Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Score de Risque Global
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center">
            <div className="relative">
              <div
                className={cn(
                  "w-32 h-32 rounded-full flex items-center justify-center border-8",
                  globalRiskLevel.color === "bg-green-500"
                    ? "border-green-500"
                    : globalRiskLevel.color === "bg-yellow-500"
                    ? "border-yellow-500"
                    : "border-red-500"
                )}
              >
                <div className="text-center">
                  <div className="text-3xl font-bold">{globalRisk}</div>
                  <div className="text-xs text-muted-foreground">/100</div>
                </div>
              </div>
            </div>
          </div>
          <div className="text-center">
            <Badge variant={globalRiskLevel.variant} className="text-sm">
              {globalRiskLevel.label}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Risk Dimensions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Risque Paiement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress
              value={paymentRisk}
              className={cn("h-2", getRiskColor(paymentRisk))}
            />
            <div className="text-xs text-muted-foreground">
              {paymentRisk}/100
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Risque Logistique</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress
              value={logisticsRisk}
              className={cn("h-2", getRiskColor(logisticsRisk))}
            />
            <div className="text-xs text-muted-foreground">
              {logisticsRisk}/100
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Risque Douanes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress
              value={customsRisk}
              className={cn("h-2", getRiskColor(customsRisk))}
            />
            <div className="text-xs text-muted-foreground">
              {customsRisk}/100
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Risque Litiges</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress
              value={Math.min(disputeRisk, 100)}
              className={cn("h-2", getRiskColor(Math.min(disputeRisk, 100)))}
            />
            <div className="text-xs text-muted-foreground">
              {Number(riskProfile.disputeFrequency).toFixed(2)} par commande
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cash Exposure Alert */}
      {cashExposure > 0 && (
        <Card className="border-red-500 bg-red-50 dark:bg-red-950/20">
          <CardHeader>
            <CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Exposition Cash
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {formatCurrency(cashExposure, "XAF")}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Argent Horion actuellement à risque
            </p>
          </CardContent>
        </Card>
      )}

      {/* Risk Factors List */}
      {riskFactorsList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Facteurs de Risque</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {riskFactorsList.map((factor, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm"
                >
                  <TrendingDown className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium">{factor.key}:</span>{" "}
                    <span className="text-muted-foreground">{factor.value}</span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
