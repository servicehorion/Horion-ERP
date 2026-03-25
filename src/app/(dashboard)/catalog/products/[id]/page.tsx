import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, Star, Image, ShoppingCart, CheckCircle2,
  XCircle, Layers, FileText, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { getProductById, getProductIntelligence } from "@/lib/actions/catalog.actions";
import { ProductStatusSelect } from "@/components/catalog/product-status-select";
import { formatCurrency } from "@/config/currencies";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const res = await getProductById(params.id);
  return { title: `${res.data?.name || "Produit"} | Horion ERP` };
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  TESTING: { label: "En test", color: "bg-yellow-100 text-yellow-800" },
  TESTED: { label: "Testé", color: "bg-blue-100 text-blue-800" },
  CURATED: { label: "Curé", color: "bg-green-100 text-green-800" },
  BLACKLIST: { label: "Blacklisté", color: "bg-red-100 text-red-800" },
};

const QC_RESULT_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  PASS: { label: "PASS", color: "text-green-600", icon: CheckCircle2 },
  FAIL: { label: "FAIL", color: "text-red-600", icon: XCircle },
  CONDITIONAL_PASS: { label: "PASS conditionnel", color: "text-orange-600", icon: CheckCircle2 },
};

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const [res, intelRes] = await Promise.all([
    getProductById(params.id),
    getProductIntelligence(params.id),
  ]);
  if (!res.data) notFound();
  const intel = intelRes.data;

  const p = res.data as any;
  const statusConfig = STATUS_CONFIG[p.status] || { label: p.status, color: "bg-gray-100 text-gray-800" };

  const priceMin = p.priceMin != null ? Number(p.priceMin) : null;
  const priceMax = p.priceMax != null ? Number(p.priceMax) : null;
  const avgMargin = p.averageMargin != null ? Number(p.averageMargin) : null;

  // Analytics
  const qcPassCount = p.qcReports.filter((r: any) => r.overallResult === "PASS" || r.overallResult === "CONDITIONAL_PASS").length;
  const qcTotal = p.qcReports.length;
  const qcPassRate = qcTotal > 0 ? Math.round((qcPassCount / qcTotal) * 100) : 0;

  const totalOrderedQty = p.orderItems.reduce((sum: number, oi: any) => sum + (Number(oi.quantity) || 0), 0);
  const supplierCount = p._count.supplierProducts;
  const primarySupplier = p.supplierProducts.find((sp: any) => sp.isPrimary);

  // Price range from offers
  const offerPrices = p.offers.map((o: any) => Number(o.unitPrice)).filter((v: number) => v > 0);
  const offerMin = offerPrices.length > 0 ? Math.min(...offerPrices) : null;
  const offerMax = offerPrices.length > 0 ? Math.max(...offerPrices) : null;
  const weightedAverageCost = p.weightedAverageCost != null ? Number(p.weightedAverageCost) : null;
  const estimatedCost = p.estimatedCost != null ? Number(p.estimatedCost) : null;
  const recommendedSellPrice = p.recommendedSellPrice != null ? Number(p.recommendedSellPrice) : null;
  const avgReality = p.averageRealityCoefficient != null ? Number(p.averageRealityCoefficient) : null;
  const savingsVsIndicatif = p.savingsVsIndicatifPct != null ? Number(p.savingsVsIndicatifPct) : null;
  const volatility = p.priceVolatilityPct != null ? Number(p.priceVolatilityPct) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/catalog/products"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold">{p.name}</h1>
            <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
            {p.category && (
              <Badge variant="outline">{p.category.name}</Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            {p.qcRecommendedLevel ? `QC recommandé : ${p.qcRecommendedLevel}` : "Aucune recommandation QC"}
            {avgMargin != null && ` · Marge moy. ${avgMargin.toFixed(1)}%`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ProductStatusSelect productId={p.id} currentStatus={p.status} />
          <Button variant="outline" size="sm" asChild>
            <Link href={`/catalog/products/${p.id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Éditer
            </Link>
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Score demande</span>
            </div>
            <div className="text-2xl font-bold">{p.demandScore}</div>
            <Progress value={Math.min(100, p.demandScore)} className="h-1 mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Fournisseurs</span>
            </div>
            <div className="text-2xl font-bold">{supplierCount}</div>
            <p className="text-xs text-muted-foreground">{p._count.offers} offre(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Commandé</span>
            </div>
            <div className="text-2xl font-bold">{totalOrderedQty}</div>
            <p className="text-xs text-muted-foreground">{p._count.orderItems} commande(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-purple-500" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">QC Pass Rate</span>
            </div>
            <div className={`text-2xl font-bold ${qcPassRate >= 80 ? "text-green-600" : qcPassRate >= 50 ? "text-orange-600" : "text-red-600"}`}>
              {qcTotal > 0 ? `${qcPassRate}%` : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">{qcTotal} rapport(s)</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Vue d&apos;ensemble</TabsTrigger>
          <TabsTrigger value="suppliers">Fournisseurs ({supplierCount})</TabsTrigger>
          <TabsTrigger value="offers">Offres/Prix ({p._count.offers})</TabsTrigger>
          <TabsTrigger value="orders">Commandes ({p._count.orderItems})</TabsTrigger>
          <TabsTrigger value="qc">QC ({qcTotal})</TabsTrigger>
          <TabsTrigger value="media">Médias ({p._count.media})</TabsTrigger>
          <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
        </TabsList>

        {/* Tab: Overview */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Pricing */}
            <Card>
              <CardHeader><CardTitle className="text-base">Tarification</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Prix catalogue min</p>
                    <p className="font-semibold">{priceMin != null ? `${priceMin} ${p.priceCurrency}` : "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Prix catalogue max</p>
                    <p className="font-semibold">{priceMax != null ? `${priceMax} ${p.priceCurrency}` : "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Meilleure offre</p>
                    <p className="font-semibold text-green-600">{offerMin != null ? `${offerMin} ${p.offers[0]?.currency || p.priceCurrency}` : "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Offre max</p>
                    <p className="font-semibold">{offerMax != null ? `${offerMax} ${p.offers[0]?.currency || p.priceCurrency}` : "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">MOQ minimum</p>
                    <p className="font-semibold">{p.moqMin != null ? `${p.moqMin} unités` : "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Délai moyen</p>
                    <p className="font-semibold">{p.averageLeadTime != null ? `${p.averageLeadTime} jours` : "N/A"}</p>
                  </div>
                </div>
                {primarySupplier && (
                  <div className="border-t pt-3">
                    <p className="text-xs text-muted-foreground mb-1">Fournisseur principal</p>
                    <Link href={`/catalog/suppliers/${primarySupplier.supplierId}`} className="text-sm font-medium hover:underline text-blue-600">
                      {primarySupplier.supplier.name}
                    </Link>
                    <span className="text-xs text-muted-foreground ml-2">
                      {primarySupplier.priceMin != null ? `${Number(primarySupplier.priceMin)}–${Number(primarySupplier.priceMax)} ${primarySupplier.currency}` : ""}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Specs */}
            <Card>
              <CardHeader><CardTitle className="text-base">Caractéristiques</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Poids estimé</p>
                    <p className="font-semibold">{p.weightEstimate != null ? `${Number(p.weightEstimate)} kg` : "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Volume estimé</p>
                    <p className="font-semibold">{p.volumeEstimate != null ? `${Number(p.volumeEstimate)} m³` : "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Catégorie</p>
                    <p className="font-semibold">{p.category?.name || "Non catégorisé"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">QC recommandé</p>
                    <p className="font-semibold">{p.qcRecommendedLevel || "N/A"}</p>
                  </div>
                </div>
                {p.specsJson && Object.keys(p.specsJson).length > 0 && (
                  <div className="border-t pt-3">
                    <p className="text-xs text-muted-foreground mb-2">Specs techniques</p>
                    <div className="space-y-1">
                      {Object.entries(p.specsJson as Record<string, unknown>).map(([k, v]) => (
                        <div key={k} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{k}</span>
                          <span className="font-medium">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Mémoire historique</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Coût moyen pondéré</p>
                <p className="font-semibold">
                  {weightedAverageCost != null ? `${weightedAverageCost} ${p.priceCurrency}` : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Coût estimé maison</p>
                <p className="font-semibold">
                  {estimatedCost != null ? `${estimatedCost} ${p.priceCurrency}` : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Prix Horion recommandé</p>
                <p className="font-semibold text-green-600">
                  {recommendedSellPrice != null ? `${recommendedSellPrice} ${p.priceCurrency}` : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Confiance mémoire</p>
                <p className="font-semibold">
                  {p.catalogConfidenceScore ?? 0}/100 {p.isCertified ? "• Certifié" : ""}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Commandes réussies</p>
                <p className="font-semibold">
                  {p.successfulOrderCount ?? 0} / {p.historicalOrderCount ?? 0}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Coefficient de réalité</p>
                <p className="font-semibold">{avgReality != null ? avgReality.toFixed(2) : "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Économie vs indicatif</p>
                <p className="font-semibold">{savingsVsIndicatif != null ? `${savingsVsIndicatif}%` : "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Volatilité prix</p>
                <p className="font-semibold">{volatility != null ? `${volatility}%` : "N/A"}</p>
              </div>
              <div className="md:col-span-2 xl:col-span-4">
                <p className="text-xs text-muted-foreground">Alias & mots-clés</p>
                <p className="text-sm">
                  {[
                    ...(Array.isArray(p.aliasesJson) ? p.aliasesJson : []),
                    ...(Array.isArray(p.searchKeywordsJson) ? p.searchKeywordsJson : []),
                  ]
                    .filter(Boolean)
                    .join(", ") || "Aucun mot-clé mémoire renseigné"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Logistics + Notes */}
          <div className="grid gap-4 md:grid-cols-2">
            {p.shippingHints && Object.keys(p.shippingHints).length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Logistique</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {Object.entries(p.shippingHints as Record<string, unknown>).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="font-medium">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {p.notes && (
              <Card>
                <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{p.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Tab: Suppliers */}
        <TabsContent value="suppliers" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Fournisseurs référencés</CardTitle></CardHeader>
            <CardContent>
              {p.supplierProducts.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">Aucun fournisseur référencé</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fournisseur</TableHead>
                      <TableHead>Plateforme</TableHead>
                      <TableHead>Prix (min–max)</TableHead>
                      <TableHead>Devise</TableHead>
                      <TableHead className="text-right">MOQ</TableHead>
                      <TableHead className="text-right">Délai (j)</TableHead>
                      <TableHead>Principal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {p.supplierProducts.map((sp: any) => (
                      <TableRow key={sp.id}>
                        <TableCell>
                          <Link href={`/catalog/suppliers/${sp.supplierId}`} className="font-medium hover:underline text-blue-600">
                            {sp.supplier.name}
                          </Link>
                          {sp.reliabilityNotes && (
                            <p className="text-xs text-muted-foreground">{sp.reliabilityNotes}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{sp.supplier.platform || "-"}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {sp.priceMin != null ? `${Number(sp.priceMin)}–${Number(sp.priceMax)}` : "-"}
                        </TableCell>
                        <TableCell className="text-sm">{sp.currency || "RMB"}</TableCell>
                        <TableCell className="text-right text-sm">{sp.moq ?? "-"}</TableCell>
                        <TableCell className="text-right text-sm">{sp.leadTimeDays ?? "-"}</TableCell>
                        <TableCell>
                          {sp.isPrimary && <Badge className="bg-green-100 text-green-800">Principal</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Offers */}
        <TabsContent value="offers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Historique des offres de prix</CardTitle>
            </CardHeader>
            <CardContent>
              {p.offers.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">Aucune offre enregistrée</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fournisseur</TableHead>
                      <TableHead className="text-right">Prix unitaire</TableHead>
                      <TableHead>Devise</TableHead>
                      <TableHead className="text-right">MOQ</TableHead>
                      <TableHead className="text-right">Délai (j)</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Validité</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {p.offers.map((o: any) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-medium">
                          <Link href={`/catalog/suppliers/${o.supplierId}`} className="hover:underline text-blue-600">
                            {o.supplier?.name || "N/A"}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          {Number(o.unitPrice).toFixed(2)}
                        </TableCell>
                        <TableCell>{o.currency}</TableCell>
                        <TableCell className="text-right">{o.moq ?? "-"}</TableCell>
                        <TableCell className="text-right">{o.leadTimeDays ?? "-"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">{o.sourceType || "manual"}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {o.validFrom ? new Date(o.validFrom).toLocaleDateString("fr-FR") : ""}
                          {o.validTo ? ` → ${new Date(o.validTo).toLocaleDateString("fr-FR")}` : ""}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(o.createdAt).toLocaleDateString("fr-FR")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Orders */}
        <TabsContent value="orders" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Historique des commandes</CardTitle></CardHeader>
            <CardContent>
              {p.orderItems.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">Aucune commande pour ce produit</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Commande</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Quantité</TableHead>
                      <TableHead className="text-right">Prix unitaire</TableHead>
                      <TableHead className="text-right">Total XAF</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {p.orderItems.map((oi: any) => (
                      <TableRow key={oi.id}>
                        <TableCell>
                          <Link href={`/orders/${oi.order.id}`} className="font-mono font-medium hover:underline text-blue-600">
                            {oi.order.orderNumber}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{oi.order.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{Number(oi.quantity)}</TableCell>
                        <TableCell className="text-right font-mono">
                          {oi.unitPrice != null ? `${Number(oi.unitPrice).toFixed(2)} ${oi.currency || "RMB"}` : "-"}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {oi.totalXAF != null ? formatCurrency(Number(oi.totalXAF), "XAF") : "-"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(oi.order.createdAt).toLocaleDateString("fr-FR")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: QC */}
        <TabsContent value="qc" className="mt-4">
          <div className="space-y-4">
            {/* QC Summary */}
            {qcTotal > 0 && (
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground">Taux de réussite</p>
                    <p className={`text-2xl font-bold ${qcPassRate >= 80 ? "text-green-600" : qcPassRate >= 50 ? "text-orange-600" : "text-red-600"}`}>
                      {qcPassRate}%
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground">Rapports PASS</p>
                    <p className="text-2xl font-bold text-green-600">{qcPassCount}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground">Rapports FAIL</p>
                    <p className="text-2xl font-bold text-red-600">{qcTotal - qcPassCount}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card>
              <CardHeader><CardTitle>Rapports QC</CardTitle></CardHeader>
              <CardContent>
                {p.qcReports.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">Aucun rapport QC</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Résultat</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                        <TableHead className="text-right">Défauts</TableHead>
                        <TableHead className="text-right">Corrigés</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Rapport</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {p.qcReports.map((r: any) => {
                        const rc = QC_RESULT_CONFIG[r.overallResult] || { label: r.overallResult, color: "text-gray-600", icon: FileText };
                        const Icon = rc.icon;
                        return (
                          <TableRow key={r.id}>
                            <TableCell>
                              <div className={`flex items-center gap-1 font-bold ${rc.color}`}>
                                <Icon className="h-4 w-4" />
                                {rc.label}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {r.overallScore != null ? `${Number(r.overallScore)}/100` : "-"}
                            </TableCell>
                            <TableCell className="text-right">{r.defectsFound ?? "-"}</TableCell>
                            <TableCell className="text-right">{r.correctedCount ?? "-"}</TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="secondary">{r.qcRequest?.type || "N/A"}</Badge>
                            </TableCell>
                            <TableCell>
                              {r.reportUrl ? (
                                <a href={r.reportUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                                  Voir
                                </a>
                              ) : "-"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(r.createdAt).toLocaleDateString("fr-FR")}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Media */}
        <TabsContent value="media" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Médiathèque</CardTitle></CardHeader>
            <CardContent>
              {p.media.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">Aucun média associé</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {p.media.map((m: any) => (
                    <div key={m.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Image className="h-4 w-4 text-muted-foreground" />
                        <Badge variant="secondary" className="text-xs">{m.type}</Badge>
                      </div>
                      <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate block">
                        {m.filename || "Voir"}
                      </a>
                      <p className="text-xs text-muted-foreground">
                        {new Date(m.createdAt).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Intelligence */}
        <TabsContent value="intelligence" className="mt-4">
          {!intel ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Intelligence non disponible</CardContent></Card>
          ) : (
            <div className="space-y-4">
              {/* Revenue Intelligence */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">CA total généré</p>
                    <p className="text-xl font-bold text-green-600">
                      {intel.revenue.totalRevenue > 0 ? formatCurrency(intel.revenue.totalRevenue, "XAF") : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">{intel.revenue.orderCount} commande(s)</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">Quantité totale</p>
                    <p className="text-xl font-bold">{intel.revenue.totalQty.toLocaleString("fr-FR")}</p>
                    <p className="text-xs text-muted-foreground">unités commandées</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">Prix moyen (XAF)</p>
                    <p className="text-xl font-bold">
                      {intel.revenue.avgUnitPriceXAF > 0
                        ? formatCurrency(intel.revenue.avgUnitPriceXAF, "XAF")
                        : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">par unité</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">Cas sourcing liés</p>
                    <p className="text-xl font-bold">{intel.crossModule.sourcingCases.length}</p>
                    <p className="text-xs text-muted-foreground">
                      {intel.crossModule.linkedOrders.length} commande(s) liée(s)
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Cross-Module: Orders */}
              {intel.crossModule.linkedOrders.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Commandes liées</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {intel.crossModule.linkedOrders.map((o: any) => (
                        <Link
                          key={o.id}
                          href={`/orders/${o.id}`}
                          className="inline-flex items-center gap-1.5 border rounded-md px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                        >
                          <span className="font-mono font-bold text-blue-600">{o.orderNumber}</span>
                          <Badge variant="secondary" className="text-xs">{o.status}</Badge>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Cross-Module: Sourcing Cases */}
              {intel.crossModule.sourcingCases.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Cas de sourcing liés</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {intel.crossModule.sourcingCases.map((sc: any) => (
                        <Link
                          key={sc.id}
                          href={`/sourcing/cases/${sc.id}`}
                          className="inline-flex items-center gap-1.5 border rounded-md px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                        >
                          <span className="text-blue-600 font-medium">Sourcing #{sc.id.slice(-6)}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(sc.createdAt).toLocaleDateString("fr-FR")}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Quick Links to Other OS */}
              <Card>
                <CardHeader><CardTitle className="text-base">Interconnexions OS</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Link href={`/sourcing/cases/new`} className="border rounded-lg p-3 text-center hover:bg-muted transition-colors">
                      <p className="text-xs text-muted-foreground">Sourcing OS</p>
                      <p className="text-sm font-medium mt-1">Créer cas</p>
                    </Link>
                    <Link href={`/catalog/suppliers`} className="border rounded-lg p-3 text-center hover:bg-muted transition-colors">
                      <p className="text-xs text-muted-foreground">Supplier Intelligence</p>
                      <p className="text-sm font-medium mt-1">Voir fournisseurs</p>
                    </Link>
                    <Link href={`/finance/margins`} className="border rounded-lg p-3 text-center hover:bg-muted transition-colors">
                      <p className="text-xs text-muted-foreground">Finance OS</p>
                      <p className="text-sm font-medium mt-1">Voir les marges</p>
                    </Link>
                    <Link href={`/catalog/analytics`} className="border rounded-lg p-3 text-center hover:bg-muted transition-colors">
                      <p className="text-xs text-muted-foreground">Catalogue Analytics</p>
                      <p className="text-sm font-medium mt-1">Vue d&apos;ensemble</p>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
