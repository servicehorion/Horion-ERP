"use client"

import type { SupplierPerformanceProfile } from "@prisma/client"
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Truck,
  ArrowDown,
  ArrowUp,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface SupplierPerformanceMeterProps {
  performanceProfile: SupplierPerformanceProfile
}

export function SupplierPerformanceMeter({
  performanceProfile: perf,
}: SupplierPerformanceMeterProps) {
  const reliability = Number(perf.reliabilityIndex)
  const otd = Number(perf.onTimeDeliveryRate)
  const quality = Number(perf.qualityScore)
  const disputeRate = Number(perf.disputeRate)
  const qcPass = Number(perf.qcPassRate)
  const defect = Number(perf.defectRate)

  const getScoreLevel = (score: number) => {
    if (score >= 80) return { label: "Excellent", color: "border-green-500", textColor: "text-green-600" }
    if (score >= 60) return { label: "Bon", color: "border-blue-500", textColor: "text-blue-600" }
    if (score >= 40) return { label: "Moyen", color: "border-yellow-500", textColor: "text-yellow-600" }
    return { label: "Faible", color: "border-red-500", textColor: "text-red-600" }
  }

  const getProgressColor = (score: number) => {
    if (score >= 80) return "bg-green-500"
    if (score >= 60) return "bg-blue-500"
    if (score >= 40) return "bg-yellow-500"
    return "bg-red-500"
  }

  const reliabilityLevel = getScoreLevel(reliability)

  return (
    <div className="space-y-6">
      {/* Reliability Index - Central Gauge */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Indice de Fiabilité
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center">
            <div
              className={cn(
                "w-32 h-32 rounded-full flex items-center justify-center border-8",
                reliabilityLevel.color
              )}
            >
              <div className="text-center">
                <div className="text-3xl font-bold">{reliability.toFixed(0)}</div>
                <div className="text-xs text-muted-foreground">/100</div>
              </div>
            </div>
          </div>
          <div className="text-center">
            <Badge
              variant={reliability >= 60 ? "secondary" : "destructive"}
              className={cn("text-sm", reliabilityLevel.textColor)}
            >
              {reliabilityLevel.label}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">
              OTD 40% + Qualité 40% + Litiges 20%
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Performance Dimensions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* On-Time Delivery */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Livraison à temps
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{otd.toFixed(1)}%</span>
              {otd >= 80 && <CheckCircle2 className="h-5 w-5 text-green-600" />}
              {otd < 60 && <AlertTriangle className="h-5 w-5 text-red-600" />}
            </div>
            <Progress value={otd} className={cn("h-2", getProgressColor(otd))} />
          </CardContent>
        </Card>

        {/* Quality Score */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Score Qualité
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{quality.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">/100</span>
            </div>
            <Progress value={quality} className={cn("h-2", getProgressColor(quality))} />
          </CardContent>
        </Card>

        {/* Dispute Rate */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Taux de litiges
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">
                {(disputeRate * 100).toFixed(0)}%
              </span>
              {disputeRate === 0 && (
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Aucun
                </Badge>
              )}
            </div>
            <Progress
              value={Math.min(disputeRate * 100, 100)}
              className={cn(
                "h-2",
                disputeRate === 0 ? "bg-green-500" : disputeRate < 0.2 ? "bg-yellow-500" : "bg-red-500"
              )}
            />
            <div className="text-xs text-muted-foreground">
              {perf.incidentCount} incident{perf.incidentCount !== 1 ? "s" : ""} total
            </div>
          </CardContent>
        </Card>

        {/* Lead Time */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Délai moyen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">
                {perf.avgLeadTimeDays
                  ? `${Number(perf.avgLeadTimeDays).toFixed(0)}j`
                  : "-"}
              </span>
              {perf.leadTimeVariance && (
                <span className="text-xs text-muted-foreground">
                  ±{Number(perf.leadTimeVariance).toFixed(0)}j variance
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delivery Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Détail livraisons</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border p-3 text-center">
              <ArrowDown className="mx-auto h-5 w-5 text-green-600 mb-1" />
              <p className="text-2xl font-bold text-green-600">
                {perf.earlyDeliveryCount}
              </p>
              <p className="text-xs text-muted-foreground">En avance</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <CheckCircle2 className="mx-auto h-5 w-5 text-blue-600 mb-1" />
              <p className="text-2xl font-bold text-blue-600">
                {perf.earlyDeliveryCount + perf.lateDeliveryCount > 0
                  ? Math.max(
                      0,
                      Math.round(otd / 100 * (perf.earlyDeliveryCount + perf.lateDeliveryCount))
                      - perf.earlyDeliveryCount
                    )
                  : 0}
              </p>
              <p className="text-xs text-muted-foreground">A temps</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <ArrowUp className="mx-auto h-5 w-5 text-red-600 mb-1" />
              <p className="text-2xl font-bold text-red-600">
                {perf.lateDeliveryCount}
              </p>
              <p className="text-xs text-muted-foreground">
                En retard
                {perf.avgDelayDays && (
                  <span> ({Number(perf.avgDelayDays).toFixed(0)}j moy.)</span>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* QC Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Contrôle Qualité</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Taux QC</p>
              <p className="text-2xl font-bold">{qcPass.toFixed(0)}%</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Taux défauts</p>
              <p className="text-2xl font-bold text-orange-600">
                {defect.toFixed(1)}%
              </p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">
                Problèmes QC
              </p>
              <p className="text-2xl font-bold text-red-600">
                {perf.qcIssuesCount}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
