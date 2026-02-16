"use client"

import { CustomerPipelineIntent } from "@prisma/client"
import { TrendingUp, Plus, Calendar, DollarSign, Target } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency } from "@/config/currencies"
import { formatDate } from "@/lib/utils"
import { cn } from "@/lib/utils"

interface CustomerPipelinePanelProps {
  pipelineIntents: CustomerPipelineIntent[]
  contactId?: string
}

export function CustomerPipelinePanel({
  pipelineIntents,
  contactId,
}: CustomerPipelinePanelProps) {
  const activeIntents = pipelineIntents.filter(
    (intent) => intent.status === "active"
  )

  const totalExpectedRevenue = activeIntents.reduce(
    (sum, intent) => sum + Number(intent.expectedRevenue),
    0
  )

  const getProbabilityBadge = (probability: number) => {
    const prob = Number(probability)
    if (prob >= 0.7) {
      return { variant: "default" as const, label: "Haute", color: "text-green-600" }
    }
    if (prob >= 0.4) {
      return { variant: "secondary" as const, label: "Moyenne", color: "text-yellow-600" }
    }
    return { variant: "outline" as const, label: "Faible", color: "text-red-600" }
  }

  return (
    <div className="space-y-6">
      {/* Total Expected Revenue */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Pipeline Total
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-600">
            {formatCurrency(totalExpectedRevenue, "XAF")}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Revenu attendu ({activeIntents.length} intention
            {activeIntents.length > 1 ? "s" : ""} active{activeIntents.length > 1 ? "s" : ""})
          </p>
        </CardContent>
      </Card>

      {/* Active Intents Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Intentions de Commande</CardTitle>
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Ajouter une intention
          </Button>
        </CardHeader>
        <CardContent>
          {activeIntents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucune intention active
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit/Catégorie</TableHead>
                    <TableHead>Date estimée</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Probabilité</TableHead>
                    <TableHead className="text-right">Revenu attendu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeIntents.map((intent) => {
                    const probability = Number(intent.probability)
                    const probabilityPercent = probability * 100
                    const estimatedSize = Number(intent.estimatedSize || 0)
                    const expectedRevenue = Number(intent.expectedRevenue)
                    const probBadge = getProbabilityBadge(probability)

                    return (
                      <TableRow key={intent.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {intent.productName || "Produit non spécifié"}
                            </div>
                            {intent.productCategory && (
                              <div className="text-xs text-muted-foreground">
                                {intent.productCategory}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {intent.estimatedOrderDate
                              ? formatDate(intent.estimatedOrderDate)
                              : "Non définie"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {estimatedSize > 0
                              ? formatCurrency(estimatedSize, intent.currency)
                              : "—"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <Badge
                              variant={probBadge.variant}
                              className="text-xs"
                            >
                              {probabilityPercent.toFixed(0)}%
                            </Badge>
                            <Progress
                              value={probabilityPercent}
                              className="h-1.5"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="font-semibold">
                              {formatCurrency(expectedRevenue, intent.currency)}
                            </div>
                            <Target className={cn("h-4 w-4", probBadge.color)} />
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
