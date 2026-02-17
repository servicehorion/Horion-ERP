"use client"

import type { SupplierRiskProfile } from "@prisma/client"
import {
  Shield,
  AlertCircle,
  AlertTriangle,
  Globe,
  FileCheck,
  Wallet,
  Boxes,
  Truck,
  ShieldCheck,
  Wrench,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { formatCurrency } from "@/config/currencies"
import { cn } from "@/lib/utils"

interface SupplierRiskGaugeProps {
  riskProfile: SupplierRiskProfile
}

const BADGE_CONFIG: Record<string, { label: string; color: string }> = {
  CONCENTRATION_RISK: { label: "Concentration", color: "bg-orange-100 text-orange-800" },
  QUALITY_RISK: { label: "Qualité", color: "bg-red-100 text-red-800" },
  DELIVERY_RISK: { label: "Livraison", color: "bg-yellow-100 text-yellow-800" },
  BLACKLISTED: { label: "Blacklisté", color: "bg-red-100 text-red-800" },
  SUSPENDED: { label: "Suspendu", color: "bg-orange-100 text-orange-800" },
  LOW_RISK: { label: "Faible risque", color: "bg-green-100 text-green-800" },
}

export function SupplierRiskGauge({ riskProfile }: SupplierRiskGaugeProps) {
  const globalRisk = riskProfile.globalRiskScore
  const cashAtRisk = Number(riskProfile.cashAtRisk)
  const outstandingValue = Number(riskProfile.outstandingOrdersValue)
  const badges = (riskProfile.riskBadges as string[]) || []
  const mitigations = (riskProfile.mitigationActions as string[]) || []

  const getRiskLevel = (score: number) => {
    if (score <= 30) return { label: "FAIBLE", color: "border-green-500", variant: "default" as const }
    if (score <= 60) return { label: "MOYEN", color: "border-yellow-500", variant: "secondary" as const }
    return { label: "ÉLEVÉ", color: "border-red-500", variant: "destructive" as const }
  }

  const getRiskColor = (score: number) => {
    if (score <= 30) return "bg-green-500"
    if (score <= 60) return "bg-yellow-500"
    return "bg-red-500"
  }

  const globalRiskLevel = getRiskLevel(globalRisk)

  const dimensions = [
    { label: "Concentration", value: riskProfile.concentrationRisk, icon: Boxes },
    { label: "Qualité", value: riskProfile.qualityRisk, icon: ShieldCheck },
    { label: "Livraison", value: riskProfile.deliveryRisk, icon: Truck },
    { label: "Financier", value: riskProfile.financialRisk, icon: Wallet },
    { label: "Géopolitique", value: riskProfile.geopoliticalRisk, icon: Globe },
    { label: "Conformité", value: riskProfile.complianceRisk, icon: FileCheck },
  ]

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
            <div
              className={cn(
                "w-32 h-32 rounded-full flex items-center justify-center border-8",
                globalRiskLevel.color
              )}
            >
              <div className="text-center">
                <div className="text-3xl font-bold">{globalRisk}</div>
                <div className="text-xs text-muted-foreground">/100</div>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {dimensions.map((dim) => {
          const Icon = dim.icon
          return (
            <Card key={dim.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {dim.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Progress
                  value={dim.value}
                  className={cn("h-2", getRiskColor(dim.value))}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {dim.value}/100
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {dim.value <= 30 ? "Faible" : dim.value <= 60 ? "Moyen" : "Élevé"}
                  </span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Cash at Risk + Outstanding Orders */}
      {(cashAtRisk > 0 || outstandingValue > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cashAtRisk > 0 && (
            <Card className="border-red-500 bg-red-50 dark:bg-red-950/20">
              <CardHeader>
                <CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Cash à risque
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {formatCurrency(cashAtRisk, "XAF")}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Payé mais non encore livré
                </p>
              </CardContent>
            </Card>
          )}
          {outstandingValue > 0 && (
            <Card className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
              <CardHeader>
                <CardTitle className="text-orange-600 dark:text-orange-400 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Commandes en cours
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {formatCurrency(outstandingValue, "XAF")}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Valeur des commandes non livrées
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Risk Badges */}
      {badges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Indicateurs de risque</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {badges.map((badge) => {
                const config = BADGE_CONFIG[badge] || {
                  label: badge,
                  color: "bg-gray-100 text-gray-800",
                }
                return (
                  <Badge key={badge} variant="secondary" className={config.color}>
                    {config.label}
                  </Badge>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mitigation Actions */}
      {mitigations.length > 0 && (
        <Card className="border-blue-500 bg-blue-50 dark:bg-blue-950/20">
          <CardHeader>
            <CardTitle className="text-blue-600 dark:text-blue-400 flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Actions de mitigation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {mitigations.map((action, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
