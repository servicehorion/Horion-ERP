"use client"

import type { SupplierAIProfile } from "@prisma/client"
import {
  Brain,
  Target,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Handshake,
  Scale,
  Zap,
  ArrowRightLeft,
  Users,
  CheckCircle2,
  XCircle,
  Minus,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { formatDate, cn } from "@/lib/utils"

interface SupplierAIBrainProps {
  aiProfile: SupplierAIProfile
}

const PERSONALITY_CONFIG: Record<string, { label: string; icon: typeof Brain; color: string }> = {
  PRICE_FLEXIBLE: { label: "Flexible sur les prix", icon: TrendingDown, color: "bg-green-500" },
  RIGID: { label: "Rigide", icon: Scale, color: "bg-red-500" },
  QUALITY_FOCUSED: { label: "Orienté qualité", icon: Target, color: "bg-purple-500" },
  VOLUME_DRIVEN: { label: "Orienté volume", icon: Zap, color: "bg-blue-500" },
  NEW_SUPPLIER: { label: "Nouveau fournisseur", icon: Sparkles, color: "bg-gray-500" },
}

const STRATEGY_CONFIG: Record<string, { label: string; description: string; color: string }> = {
  DEVELOP: {
    label: "Développer",
    description: "Investir dans la relation, partager les plans, co-développer",
    color: "from-purple-500/10 to-blue-500/10",
  },
  NEGOTIATE: {
    label: "Négocier",
    description: "Mettre en concurrence, demander des remises volume, benchmark prix",
    color: "from-green-500/10 to-teal-500/10",
  },
  DIVERSIFY: {
    label: "Diversifier",
    description: "Identifier des alternatives, réduire la dépendance, backup plan",
    color: "from-orange-500/10 to-yellow-500/10",
  },
  AUTOMATE: {
    label: "Automatiser",
    description: "Standardiser les commandes, minimiser le temps de gestion",
    color: "from-gray-500/10 to-slate-500/10",
  },
  EXIT: {
    label: "Sortir",
    description: "Planifier la transition vers un fournisseur alternatif",
    color: "from-red-500/10 to-pink-500/10",
  },
  CONSOLIDATE: {
    label: "Consolider",
    description: "Regrouper les achats pour obtenir de meilleures conditions",
    color: "from-blue-500/10 to-indigo-500/10",
  },
}

const LEVERAGE_CONFIG: Record<string, { label: string; color: string }> = {
  HIGH: { label: "Fort", color: "bg-green-100 text-green-800" },
  MEDIUM: { label: "Moyen", color: "bg-yellow-100 text-yellow-800" },
  LOW: { label: "Faible", color: "bg-red-100 text-red-800" },
}

const STRATEGIC_VALUE_CONFIG: Record<string, { label: string; color: string }> = {
  STRATEGIC_PARTNER: { label: "Partenaire stratégique", color: "bg-purple-100 text-purple-800" },
  LEVERAGE: { label: "Levier", color: "bg-blue-100 text-blue-800" },
  BOTTLENECK: { label: "Goulot", color: "bg-orange-100 text-orange-800" },
  COMMODITY: { label: "Standard", color: "bg-gray-100 text-gray-800" },
}

export function SupplierAIBrain({ aiProfile }: SupplierAIBrainProps) {
  const strengthFactors = (aiProfile.strengthFactors as string[]) || []
  const weaknessFactors = (aiProfile.weaknessFactors as string[]) || []
  const alternatives = (aiProfile.alternativeSuggestions as Array<{
    supplierId: string
    supplierName: string
    rating: number
    productId: string
  }>) || []
  const behavioralInsights = (aiProfile.behavioralInsights as Record<string, unknown>) || {}

  const personalityConfig = PERSONALITY_CONFIG[aiProfile.supplierPersonality || ""] || {
    label: aiProfile.supplierPersonality || "Non défini",
    icon: Brain,
    color: "bg-gray-500",
  }
  const PersonalityIcon = personalityConfig.icon

  const strategyConfig = STRATEGY_CONFIG[aiProfile.recommendedStrategy || ""] || {
    label: aiProfile.recommendedStrategy || "Non définie",
    description: "",
    color: "from-gray-500/10 to-slate-500/10",
  }

  const leverageConfig = LEVERAGE_CONFIG[aiProfile.negotiationLeverage || ""] || {
    label: aiProfile.negotiationLeverage || "Non défini",
    color: "bg-gray-100 text-gray-800",
  }

  const strategicConfig = STRATEGIC_VALUE_CONFIG[aiProfile.strategicValue || ""] || {
    label: aiProfile.strategicValue || "Non défini",
    color: "bg-gray-100 text-gray-800",
  }

  const supplierPower = Number(aiProfile.supplierPowerScore)

  return (
    <div className="space-y-6">
      {/* AI Profile Header */}
      <Card className="bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-cyan-500/10 border-purple-300 dark:border-purple-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-600" />
            Intelligence Fournisseur
            <Badge variant="secondary" className="ml-auto">
              <Sparkles className="h-3 w-3 mr-1" />
              IA
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground">
            Calculé le {formatDate(aiProfile.calculatedAt, true)}
          </div>
        </CardContent>
      </Card>

      {/* Personality & Strategy Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Supplier Personality */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <PersonalityIcon className="h-4 w-4" />
              Personnalité fournisseur
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={cn("text-white", personalityConfig.color)}>
              {personalityConfig.label}
            </Badge>
          </CardContent>
        </Card>

        {/* Negotiation Leverage */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Handshake className="h-4 w-4" />
              Levier de négociation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary" className={leverageConfig.color}>
              {leverageConfig.label}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">
              Notre pouvoir de négociation
            </p>
          </CardContent>
        </Card>

        {/* Strategic Value (Kraljic) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4" />
              Valeur stratégique
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary" className={strategicConfig.color}>
              {strategicConfig.label}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">
              Position matrice Kraljic
            </p>
          </CardContent>
        </Card>

        {/* Supplier Power Score */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Pouvoir fournisseur
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold">{supplierPower.toFixed(0)}/100</span>
            </div>
            <Progress value={supplierPower} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {supplierPower > 70 ? "Ils ont le pouvoir" :
               supplierPower < 40 ? "Nous avons le pouvoir" :
               "Équilibre des forces"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recommended Strategy */}
      <Card className={cn("bg-gradient-to-br", strategyConfig.color)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-600" />
            Stratégie Recommandée
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-md">
              <ArrowRightLeft className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="font-medium">{strategyConfig.label}</div>
              <div className="text-sm text-muted-foreground mt-1">
                {strategyConfig.description}
              </div>
            </div>
          </div>

          {/* Price prediction */}
          <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-md">
              {aiProfile.predictedPriceDirection === "UP" ? (
                <TrendingUp className="h-4 w-4 text-red-600" />
              ) : aiProfile.predictedPriceDirection === "DOWN" ? (
                <TrendingDown className="h-4 w-4 text-green-600" />
              ) : (
                <Minus className="h-4 w-4 text-gray-600" />
              )}
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">Prédiction de prix</div>
              <div className="text-sm text-muted-foreground mt-1">
                {aiProfile.predictedPriceDirection === "UP" ? "Hausse prévue" :
                 aiProfile.predictedPriceDirection === "DOWN" ? "Baisse prévue" :
                 "Stable"}
                {aiProfile.predictedPriceChange && (
                  <span> ({Number(aiProfile.predictedPriceChange) > 0 ? "+" : ""}
                    {Number(aiProfile.predictedPriceChange).toFixed(1)}%)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Optimal frequency */}
          {aiProfile.optimalOrderFrequency && (
            <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-md">
                <Zap className="h-4 w-4 text-purple-600" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">Fréquence optimale</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {aiProfile.optimalOrderFrequency === "MONTHLY" ? "Mensuelle" :
                   aiProfile.optimalOrderFrequency === "QUARTERLY" ? "Trimestrielle" :
                   "Semestrielle"}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alternative Suppliers */}
      {alternatives.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              Fournisseurs alternatifs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alternatives.map((alt, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="text-sm font-medium">{alt.supplierName}</div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-12 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${alt.rating}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {alt.rating}/100
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Strengths & Weaknesses */}
      {(strengthFactors.length > 0 || weaknessFactors.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {strengthFactors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Points forts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {strengthFactors.map((factor, index) => (
                    <li key={index} className="text-sm flex items-start gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-green-600 mt-1.5 shrink-0" />
                      <span>{factor}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {weaknessFactors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  Points faibles
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {weaknessFactors.map((factor, index) => (
                    <li key={index} className="text-sm flex items-start gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-red-600 mt-1.5 shrink-0" />
                      <span>{factor}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Behavioral Insights */}
      {Object.keys(behavioralInsights).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="h-4 w-4 text-indigo-600" />
              Insights comportementaux
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(behavioralInsights).map(([key, value]) => (
                <div key={key} className="text-sm">
                  <span className="font-medium">{key}:</span>{" "}
                  <span className="text-muted-foreground">{String(value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
