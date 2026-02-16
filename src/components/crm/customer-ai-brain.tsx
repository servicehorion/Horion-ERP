"use client"

import { CustomerAIProfile } from "@prisma/client"
import {
  Brain,
  Target,
  TrendingUp,
  Sparkles,
  User,
  MessageSquare,
  Clock,
  CreditCard,
  Truck,
  AlertCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/utils"
import { cn } from "@/lib/utils"

interface CustomerAIBrainProps {
  aiProfile: CustomerAIProfile
}

export function CustomerAIBrain({ aiProfile }: CustomerAIBrainProps) {
  const upsellSuggestions = (aiProfile.upsellSuggestions as string[]) || []
  const crossSellSuggestions = (aiProfile.crossSellSuggestions as string[]) || []
  const behavioralInsights = (aiProfile.behavioralInsights as any) || {}

  const getPersonalityIcon = (personality: string | null) => {
    if (!personality) return User
    if (personality.includes("price")) return TrendingUp
    if (personality.includes("quality")) return Target
    if (personality.includes("urgent")) return Clock
    return User
  }

  const getPersonalityColor = (personality: string | null) => {
    if (!personality) return "bg-gray-500"
    if (personality.includes("price")) return "bg-blue-500"
    if (personality.includes("quality")) return "bg-purple-500"
    if (personality.includes("urgent")) return "bg-red-500"
    return "bg-gray-500"
  }

  const PersonalityIcon = getPersonalityIcon(aiProfile.buyingPersonality)

  return (
    <div className="space-y-6">
      {/* AI Profile Header */}
      <Card className="bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-cyan-500/10 border-purple-300 dark:border-purple-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-600" />
            Profil Intelligence Client
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

      {/* Personality & Style Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Buying Personality */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <PersonalityIcon className="h-4 w-4" />
              Personnalité d'achat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge
              className={cn(
                "text-white",
                getPersonalityColor(aiProfile.buyingPersonality)
              )}
            >
              {aiProfile.buyingPersonality || "Non définie"}
            </Badge>
          </CardContent>
        </Card>

        {/* Negotiation Style */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Style de négociation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {aiProfile.negotiationStyle || "Non défini"}
            </div>
          </CardContent>
        </Card>

        {/* Sensitivity to Delays */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Sensibilité aux délais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge
              variant={
                aiProfile.sensitivityToDelays === "high"
                  ? "destructive"
                  : aiProfile.sensitivityToDelays === "medium"
                  ? "secondary"
                  : "outline"
              }
            >
              {aiProfile.sensitivityToDelays === "high"
                ? "Élevée"
                : aiProfile.sensitivityToDelays === "medium"
                ? "Moyenne"
                : aiProfile.sensitivityToDelays === "low"
                ? "Faible"
                : "Non définie"}
            </Badge>
            {aiProfile.sensitivityToDelays === "high" && (
              <div className="flex items-center gap-1 mt-2 text-xs text-red-600">
                <AlertCircle className="h-3 w-3" />
                Priorité absolue aux délais
              </div>
            )}
          </CardContent>
        </Card>

        {/* Price Elasticity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Élasticité prix
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {aiProfile.priceElasticity === "high"
                ? "Haute - Sensible au prix"
                : aiProfile.priceElasticity === "medium"
                ? "Moyenne - Équilibré"
                : aiProfile.priceElasticity === "low"
                ? "Faible - Privilégie qualité"
                : "Non définie"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recommended Strategies */}
      <Card className="bg-gradient-to-br from-blue-500/5 to-cyan-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-600" />
            Stratégies Recommandées
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Pricing Strategy */}
          <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-md">
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">Stratégie de Prix</div>
              <div className="text-sm text-muted-foreground mt-1">
                {aiProfile.recommendedPricingStrategy ||
                  "Aucune recommandation"}
              </div>
            </div>
          </div>

          {/* Payment Terms */}
          <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-md">
              <CreditCard className="h-4 w-4 text-green-600" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">Conditions de Paiement</div>
              <div className="text-sm text-muted-foreground mt-1">
                {aiProfile.recommendedPaymentTerms ||
                  "Aucune recommandation"}
              </div>
            </div>
          </div>

          {/* Logistics Strategy */}
          <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border">
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-md">
              <Truck className="h-4 w-4 text-purple-600" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">Stratégie Logistique</div>
              <div className="text-sm text-muted-foreground mt-1">
                {aiProfile.recommendedLogisticsStrategy ||
                  "Aucune recommandation"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upsell & Cross-sell Suggestions */}
      {(upsellSuggestions.length > 0 || crossSellSuggestions.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Upsell */}
          {upsellSuggestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  Opportunités Upsell
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {upsellSuggestions.map((suggestion, index) => (
                    <li
                      key={index}
                      className="text-sm flex items-start gap-2"
                    >
                      <div className="h-1.5 w-1.5 rounded-full bg-green-600 mt-1.5 shrink-0" />
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Cross-sell */}
          {crossSellSuggestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="h-4 w-4 text-purple-600" />
                  Opportunités Cross-sell
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {crossSellSuggestions.map((suggestion, index) => (
                    <li
                      key={index}
                      className="text-sm flex items-start gap-2"
                    >
                      <div className="h-1.5 w-1.5 rounded-full bg-purple-600 mt-1.5 shrink-0" />
                      <span>{suggestion}</span>
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
              Insights Comportementaux
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

      {/* Predictive Metrics */}
      {(aiProfile.predictedChurnRisk || aiProfile.predictedLTV) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {aiProfile.predictedChurnRisk && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Risque de Churn</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {(Number(aiProfile.predictedChurnRisk) * 100).toFixed(0)}%
                </div>
              </CardContent>
            </Card>
          )}

          {aiProfile.predictedLTV && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">LTV Prédite</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {Number(aiProfile.predictedLTV).toLocaleString("fr-FR")} FCFA
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
