import {
  ArrowLeft,
  Phone,
  Mail,
  MessageCircle,
  MapPin,
  User,
  Factory,
  Clock,
  Package,
  FileText,
  Image as ImageIcon,
  Video,
  File,
  RefreshCw,
  Link as LinkIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { getSupplierIntelligence } from "@/lib/actions/supplier-intelligence.actions";
import { RecalculateSupplierButton } from "@/components/sourcing/recalculate-supplier-button";
import { SupplierFinancialPanel } from "@/components/sourcing/supplier-financial-panel";
import { SupplierPerformanceMeter } from "@/components/sourcing/supplier-performance-meter";
import { SupplierRiskGauge } from "@/components/sourcing/supplier-risk-gauge";
import { SupplierAIBrain } from "@/components/sourcing/supplier-ai-brain";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Intelligence Fournisseur | Horion ERP" };

interface Props {
  params: Promise<{ id: string }>;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  TESTING: "bg-yellow-100 text-yellow-800",
  SUSPENDED: "bg-orange-100 text-orange-800",
  BLACKLIST: "bg-red-100 text-red-800",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Actif",
  TESTING: "En test",
  SUSPENDED: "Suspendu",
  BLACKLIST: "Blacklisté",
};

const SEGMENT_COLORS: Record<string, string> = {
  STRATEGIC_PARTNER: "bg-purple-100 text-purple-800",
  LEVERAGE_SUPPLIER: "bg-blue-100 text-blue-800",
  BOTTLENECK: "bg-orange-100 text-orange-800",
  ROUTINE: "bg-gray-100 text-gray-800",
  A_SUPPLIER: "bg-emerald-100 text-emerald-800",
  B_SUPPLIER: "bg-teal-100 text-teal-800",
  C_SUPPLIER: "bg-slate-100 text-slate-800",
  AT_RISK: "bg-red-100 text-red-800",
  PREFERRED: "bg-green-100 text-green-800",
  DEVELOPING: "bg-yellow-100 text-yellow-800",
  EXITING: "bg-rose-100 text-rose-800",
};

const SEGMENT_LABELS: Record<string, string> = {
  STRATEGIC_PARTNER: "Partenaire stratégique",
  LEVERAGE_SUPPLIER: "Fournisseur levier",
  BOTTLENECK: "Goulot",
  ROUTINE: "Routine",
  A_SUPPLIER: "Fournisseur A",
  B_SUPPLIER: "Fournisseur B",
  C_SUPPLIER: "Fournisseur C",
  AT_RISK: "À risque",
  PREFERRED: "Préféré",
  DEVELOPING: "En développement",
  EXITING: "En sortie",
};

const MEDIA_ICONS: Record<string, React.ReactNode> = {
  image: <ImageIcon className="h-5 w-5" />,
  video: <Video className="h-5 w-5" />,
  pdf: <FileText className="h-5 w-5" />,
  document: <File className="h-5 w-5" />,
};

export default async function SupplierIntelligencePage({ params }: Props) {
  const { id } = await params;
  const result = await getSupplierIntelligence(id);

  if (result.error || !result.data) notFound();

  const supplier = result.data;
  const {
    financialMetrics,
    performanceProfile,
    riskProfile,
    aiProfile,
    segmentations,
  } = supplier;

  const negotiatedTerms =
    supplier.negotiatedTermsJson &&
    typeof supplier.negotiatedTermsJson === "object"
      ? (supplier.negotiatedTermsJson as Record<string, unknown>)
      : {};

  const hasIntelligence = !!(financialMetrics && performanceProfile && riskProfile);
  const globalRisk = riskProfile?.globalRiskScore ?? null;

  return (
    <div className="space-y-6">
      {/* Back + recalculate */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/catalog/suppliers">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <RecalculateSupplierButton supplierId={supplier.id} />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{supplier.name}</h1>
          {supplier.category && (
            <p className="text-lg text-muted-foreground">{supplier.category}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Badge
            variant="secondary"
            className={STATUS_COLORS[supplier.status] || ""}
          >
            {STATUS_LABELS[supplier.status] || supplier.status}
          </Badge>
          {supplier.isVerified && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              Vérifié
            </Badge>
          )}
          {globalRisk !== null && globalRisk >= 60 && (
            <Badge variant="destructive">
              Risque {globalRisk >= 80 ? "élevé" : "moyen"} ({globalRisk})
            </Badge>
          )}
          {globalRisk !== null && globalRisk < 30 && (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              Faible risque
            </Badge>
          )}
        </div>
      </div>

      {/* Segment Badges Row */}
      {segmentations && segmentations.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {segmentations.map((seg) => (
            <Badge
              key={seg.id}
              variant="secondary"
              className={SEGMENT_COLORS[seg.segment] || "bg-gray-100 text-gray-800"}
            >
              {SEGMENT_LABELS[seg.segment] || seg.segment}
            </Badge>
          ))}
        </div>
      )}

      {/* Quick Stats Bar */}
      {hasIntelligence && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Volume total</p>
              <p className="text-xl font-bold">
                {Number(financialMetrics!.lifetimeSpend).toLocaleString("fr-FR")} XAF
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Fiabilité</p>
              <p className="text-xl font-bold">
                {Number(performanceProfile!.reliabilityIndex).toFixed(0)}/100
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Score risque</p>
              <p className="text-xl font-bold">
                {riskProfile!.globalRiskScore}/100
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Livraison à temps</p>
              <p className="text-xl font-bold">
                {Number(performanceProfile!.onTimeDeliveryRate).toFixed(0)}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Vue d&apos;ensemble</TabsTrigger>
          <TabsTrigger value="financier" disabled={!financialMetrics}>
            Financier
          </TabsTrigger>
          <TabsTrigger value="performance" disabled={!performanceProfile}>
            Performance
          </TabsTrigger>
          <TabsTrigger value="risque" disabled={!riskProfile}>
            Risque
          </TabsTrigger>
          <TabsTrigger value="ia" disabled={!aiProfile}>
            IA
          </TabsTrigger>
          <TabsTrigger value="produits">
            Produits ({supplier._count.supplierProducts})
          </TabsTrigger>
          <TabsTrigger value="offres">
            Offres ({supplier._count.offers})
          </TabsTrigger>
          <TabsTrigger value="historique">
            Historique ({supplier._count.sourcingCases})
          </TabsTrigger>
        </TabsList>

        {/* Vue d'ensemble */}
        <TabsContent value="overview">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Identité</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Factory className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Plateforme :</span>
                  {supplier.platform || "-"}
                </div>
                {supplier.city && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {supplier.city}, {supplier.country}
                  </div>
                )}
                {supplier.category && (
                  <div className="flex items-center gap-2 text-sm">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    {supplier.category}
                  </div>
                )}
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  Créé le {formatDate(supplier.createdAt)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contacts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {supplier.contactName && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {supplier.contactName}
                  </div>
                )}
                {supplier.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {supplier.phone}
                  </div>
                )}
                {supplier.wechat && (
                  <div className="flex items-center gap-2 text-sm">
                    <MessageCircle className="h-4 w-4 text-muted-foreground" />
                    {supplier.wechat}
                  </div>
                )}
                {supplier.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {supplier.email}
                  </div>
                )}
                {!supplier.contactName &&
                  !supplier.phone &&
                  !supplier.wechat &&
                  !supplier.email && (
                    <p className="text-sm text-muted-foreground">
                      Aucun contact renseigné
                    </p>
                  )}
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Capacités</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border p-3 text-center">
                    <Clock className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
                    <p className="text-xs text-muted-foreground">Délai production</p>
                    <p className="text-lg font-semibold">
                      {supplier.leadTimeDays ? `${supplier.leadTimeDays} jours` : "-"}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <Package className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
                    <p className="text-xs text-muted-foreground">MOQ</p>
                    <p className="text-lg font-semibold">{supplier.moq || "-"}</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <FileText className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
                    <p className="text-xs text-muted-foreground">Conditions paiement</p>
                    <p className="text-lg font-semibold">{supplier.paymentTerms || "-"}</p>
                  </div>
                </div>
                {supplier.notes && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">{supplier.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Intelligence CTA if not yet calculated */}
            {!hasIntelligence && (
              <Card className="md:col-span-2 border-dashed">
                <CardContent className="py-8 text-center text-muted-foreground space-y-3">
                  <p className="font-medium">Intelligence non calculée</p>
                  <p className="text-sm">
                    Cliquez sur &quot;Recalculer Intelligence&quot; en haut de page pour
                    générer le profil complet : financier, performance, risque et IA.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Financier */}
        <TabsContent value="financier">
          {financialMetrics ? (
            <SupplierFinancialPanel financialMetrics={financialMetrics} />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Recalculez l&apos;intelligence pour voir les métriques financières.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Performance */}
        <TabsContent value="performance">
          {performanceProfile ? (
            <SupplierPerformanceMeter performanceProfile={performanceProfile} />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Recalculez l&apos;intelligence pour voir le profil de performance.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Risque */}
        <TabsContent value="risque">
          {riskProfile ? (
            <SupplierRiskGauge riskProfile={riskProfile} />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Recalculez l&apos;intelligence pour voir le profil de risque.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* IA */}
        <TabsContent value="ia">
          {aiProfile ? (
            <SupplierAIBrain aiProfile={aiProfile} />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Recalculez l&apos;intelligence pour voir le profil IA.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Produits */}
        <TabsContent value="produits">
          <Card>
            <CardHeader>
              <CardTitle>Produits liés</CardTitle>
            </CardHeader>
            <CardContent>
              {supplier.supplierProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun produit lié</p>
              ) : (
                <div className="space-y-3">
                  {supplier.supplierProducts.map((sp) => (
                    <div
                      key={sp.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <Link
                          href={`/catalog/products/${sp.productId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {sp.product.name}
                        </Link>
                        {sp.isPrimary && (
                          <Badge
                            variant="secondary"
                            className="ml-2 bg-blue-100 text-blue-800"
                          >
                            Principal
                          </Badge>
                        )}
                        {sp.reliabilityNotes && (
                          <p className="text-xs text-muted-foreground">
                            {sp.reliabilityNotes}
                          </p>
                        )}
                      </div>
                      <div className="text-right text-sm">
                        {sp.priceMin && sp.priceMax ? (
                          <p>
                            {Number(sp.priceMin)} - {Number(sp.priceMax)} {sp.currency}
                          </p>
                        ) : sp.priceMin ? (
                          <p>
                            {Number(sp.priceMin)} {sp.currency}
                          </p>
                        ) : null}
                        {sp.moq && (
                          <p className="text-xs text-muted-foreground">MOQ: {sp.moq}</p>
                        )}
                        {sp.leadTimeDays && (
                          <p className="text-xs text-muted-foreground">
                            {sp.leadTimeDays} jours
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Offres */}
        <TabsContent value="offres">
          <Card>
            <CardHeader>
              <CardTitle>Historique des offres</CardTitle>
            </CardHeader>
            <CardContent>
              {supplier.offers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune offre</p>
              ) : (
                <div className="space-y-3">
                  {supplier.offers.map((offer) => (
                    <div
                      key={offer.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-medium text-sm">
                          {offer.product?.name || "Produit non lié"}
                        </p>
                        {offer.leadTimeDays && (
                          <p className="text-xs text-muted-foreground">
                            Délai: {offer.leadTimeDays} jours
                          </p>
                        )}
                        {offer.moq && (
                          <p className="text-xs text-muted-foreground">MOQ: {offer.moq}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-bold">
                          {Number(offer.unitPrice)} {offer.currency}
                        </p>
                        {offer.isSelected && (
                          <Badge
                            variant="secondary"
                            className="bg-green-100 text-green-800 text-xs"
                          >
                            Sélectionné
                          </Badge>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {formatDate(offer.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Historique */}
        <TabsContent value="historique">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Dossiers de sourcing</CardTitle>
              </CardHeader>
              <CardContent>
                {supplier.sourcingCases.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun dossier</p>
                ) : (
                  <div className="space-y-3">
                    {supplier.sourcingCases.map((sc) => (
                      <div
                        key={sc.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div>
                          <Link
                            href={`/orders/${sc.orderId}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {sc.order.orderNumber}
                          </Link>
                          <p className="text-xs text-muted-foreground">{sc.requirement}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary">{sc.status}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(sc.createdAt)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Items History */}
            {supplier.orderItems.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Lignes de commandes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {supplier.orderItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div>
                          <Link
                            href={`/orders/${item.orderId}`}
                            className="font-medium text-primary hover:underline text-sm"
                          >
                            {item.order.orderNumber}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {item.description} · qté {item.quantity}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-sm">
                            {Number(item.totalXAF).toLocaleString("fr-FR")} XAF
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(item.order.createdAt)}
                          </p>
                          <Badge variant="outline" className="text-xs">
                            {item.order.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Scores history */}
            {supplier.supplierScores.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Historique des scores</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {supplier.supplierScores.map((score) => (
                      <div
                        key={score.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div>
                          <p className="font-medium">{score.dimension}</p>
                          {score.notes && (
                            <p className="text-xs text-muted-foreground">{score.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-16 rounded-full bg-muted">
                              <div
                                className="h-2 rounded-full bg-primary"
                                style={{ width: `${score.score}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">{score.score}/100</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(score.createdAt)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
