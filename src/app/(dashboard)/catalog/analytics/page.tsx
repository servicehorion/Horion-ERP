import Link from "next/link";
import {
  ArrowLeft, BarChart3, TrendingUp, Star, DollarSign, Package,
  Layers, CheckCircle2, AlertTriangle, ShoppingCart, Target, Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getCatalogAnalytics } from "@/lib/actions/catalog.actions";
import { formatCurrency } from "@/config/currencies";

export const metadata = {
  title: "Analytics Catalogue | Horion ERP",
  description: "Intelligence catalogue — revenus, performance, prix",
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  TESTING: { label: "En test", color: "bg-yellow-100 text-yellow-800" },
  TESTED: { label: "Testé", color: "bg-blue-100 text-blue-800" },
  CURATED: { label: "Curé", color: "bg-green-100 text-green-800" },
  BLACKLIST: { label: "Blacklisté", color: "bg-red-100 text-red-800" },
};

export default async function CatalogAnalyticsPage() {
  const result = await getCatalogAnalytics();

  if (result.error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
        {result.error}
      </div>
    );
  }

  const { categoryPerformance, topByRevenue, priceSpread, healthMetrics } = result.data!;

  const h = healthMetrics;

  // Catalog health score (0-100) = weighted average
  const healthScore = Math.round(
    h.curatedPct * 0.35 +
    Math.min(100, h.avgDemandScore) * 0.25 +
    (h.totalProducts > 0 ? Math.min(100, (h.productsWithSuppliers / h.totalProducts) * 100) : 0) * 0.20 +
    (h.totalProducts > 0 ? Math.min(100, (h.productsWithRevenue / h.totalProducts) * 100) : 0) * 0.20
  );

  const healthColor =
    healthScore >= 70 ? "text-green-600" :
    healthScore >= 40 ? "text-orange-600" : "text-red-600";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/catalog"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-blue-600" />
            Analytics Catalogue
          </h1>
          <p className="text-muted-foreground">
            Intelligence revenus, performance catégories, écarts de prix
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/catalog/products">
            <Package className="mr-2 h-4 w-4" />
            Voir les produits
          </Link>
        </Button>
      </div>

      {/* Catalog Health Score + KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Health Score */}
        <Card className="border-2">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Score santé catalogue</p>
              <Target className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className={`text-4xl font-bold ${healthColor}`}>{healthScore}</div>
            <p className="text-xs text-muted-foreground">/100</p>
            <Progress value={healthScore} className="h-2 mt-3" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">CA catalogue total</p>
              <DollarSign className="h-4 w-4 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(h.totalRevenue, "XAF")}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(h.avgRevenuePerProduct, "XAF")} / produit
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Score demande moyen</p>
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </div>
            <div className="text-2xl font-bold">{h.avgDemandScore}</div>
            <Progress value={Math.min(100, h.avgDemandScore)} className="h-1.5 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Couverture fournisseurs</p>
              <Layers className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold">
              {h.totalProducts > 0 ? Math.round((h.productsWithSuppliers / h.totalProducts) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {h.productsWithSuppliers} / {h.totalProducts} produits
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Catalog Health Detail */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Santé du catalogue — détail
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase">Statut produits</p>
              {[
                { label: "Curés", pct: h.curatedPct, color: "bg-green-500" },
                { label: "Testés", pct: h.testedPct, color: "bg-blue-500" },
                { label: "En test", pct: h.testingPct, color: "bg-yellow-500" },
                { label: "Blacklistés", pct: h.blacklistPct, color: "bg-red-500" },
              ].map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>{item.label}</span>
                    <span className="font-bold">{item.pct}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full">
                    <div className={`h-1.5 rounded-full ${item.color}`} style={{ width: `${item.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase">Couverture données</p>
              {[
                { label: "Avec fournisseurs", count: h.productsWithSuppliers, total: h.totalProducts },
                { label: "Avec offres prix", count: h.productsWithOffers, total: h.totalProducts },
                { label: "Avec commandes", count: h.productsWithRevenue, total: h.totalProducts },
                { label: "Avec QC", count: h.productsWithQC, total: h.totalProducts },
              ].map((item) => {
                const pct = item.total > 0 ? Math.round((item.count / item.total) * 100) : 0;
                return (
                  <div key={item.label} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>{item.label}</span>
                      <span className="font-bold">{item.count} ({pct}%)</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                );
              })}
            </div>

            <div className="md:col-span-2 grid grid-cols-2 gap-4">
              {[
                { label: "Total produits", value: h.totalProducts.toLocaleString("fr-FR"), icon: Package, color: "text-blue-600" },
                { label: "Avec revenus", value: h.productsWithRevenue.toLocaleString("fr-FR"), icon: DollarSign, color: "text-green-600" },
                { label: "Avec QC", value: h.productsWithQC.toLocaleString("fr-FR"), icon: CheckCircle2, color: "text-purple-600" },
                { label: "Blacklistés", value: `${h.blacklistPct}%`, icon: AlertTriangle, color: "text-red-600" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="flex items-center gap-3 border rounded-lg p-3">
                  <Icon className={`h-5 w-5 ${color}`} />
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className={`text-lg font-bold ${color}`}>{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Row 3: Top by Revenue + Top by Demand */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Products by Revenue */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              Top produits par CA généré
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topByRevenue.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">
                Aucun produit avec revenus enregistrés
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">CA XAF</TableHead>
                    <TableHead className="text-right">Commandes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topByRevenue.map((p: any, idx: number) => {
                    const sc = STATUS_CONFIG[p.status] || { label: p.status, color: "bg-gray-100 text-gray-800" };
                    const maxRev = topByRevenue[0]?.totalRevenue || 1;
                    return (
                      <TableRow key={p.productId}>
                        <TableCell className="text-muted-foreground text-sm">{idx + 1}</TableCell>
                        <TableCell>
                          <div>
                            <Link
                              href={`/catalog/products/${p.productId}`}
                              className="font-medium text-blue-600 hover:underline text-sm"
                            >
                              {p.name}
                            </Link>
                            {p.categoryName && (
                              <p className="text-xs text-muted-foreground">{p.categoryName}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${sc.color} text-xs`}>{sc.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div>
                            <div className="font-bold text-green-700 text-sm">
                              {formatCurrency(p.totalRevenue, "XAF")}
                            </div>
                            <div className="h-1 bg-muted rounded-full mt-1">
                              <div
                                className="h-1 bg-green-500 rounded-full"
                                style={{ width: `${Math.round((p.totalRevenue / maxRev) * 100)}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {p.orderCount}
                          <p className="text-xs text-muted-foreground">{p.totalQty.toLocaleString("fr-FR")} unités</p>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Price Spread Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-orange-500" />
              Opportunités de négociation — Écarts de prix
            </CardTitle>
          </CardHeader>
          <CardContent>
            {priceSpread.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">
                Pas assez d&apos;offres pour analyser les écarts
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead className="text-right">Min</TableHead>
                    <TableHead className="text-right">Max</TableHead>
                    <TableHead className="text-right">Écart %</TableHead>
                    <TableHead className="text-right">Offres</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {priceSpread.map((p: any) => {
                    const sc = STATUS_CONFIG[p.status] || { label: p.status, color: "bg-gray-100 text-gray-800" };
                    const spreadColor = p.spread >= 50 ? "text-red-600 font-bold" : p.spread >= 20 ? "text-orange-600 font-bold" : "text-muted-foreground";
                    return (
                      <TableRow key={p.productId}>
                        <TableCell>
                          <Link href={`/catalog/products/${p.productId}`} className="font-medium text-blue-600 hover:underline text-sm">
                            {p.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right text-sm font-mono text-green-700">
                          {p.minPrice.toFixed(2)} {p.currency}
                        </TableCell>
                        <TableCell className="text-right text-sm font-mono text-red-700">
                          {p.maxPrice.toFixed(2)} {p.currency}
                        </TableCell>
                        <TableCell className={`text-right text-sm ${spreadColor}`}>
                          +{p.spread}%
                        </TableCell>
                        <TableCell className="text-right text-sm">{p.offerCount}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Category Performance Table */}
      {categoryPerformance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Performance par catégorie
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Catégorie</TableHead>
                  <TableHead className="text-right">Produits</TableHead>
                  <TableHead className="text-right">Actifs</TableHead>
                  <TableHead className="text-right">Curés</TableHead>
                  <TableHead className="text-right">Score demande</TableHead>
                  <TableHead className="text-right">CA total</TableHead>
                  <TableHead className="text-right">Commandes</TableHead>
                  <TableHead className="text-right">QC pass</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoryPerformance.map((cat: any) => {
                  const curatedPct = cat.productCount > 0 ? Math.round((cat.curatedCount / cat.productCount) * 100) : 0;
                  return (
                    <TableRow key={cat.id ?? "uncategorized"}>
                      <TableCell>
                        <span className="font-medium">{cat.name}</span>
                      </TableCell>
                      <TableCell className="text-right">{cat.productCount}</TableCell>
                      <TableCell className="text-right text-sm">{cat.activeCount}</TableCell>
                      <TableCell className="text-right">
                        <span className={curatedPct >= 50 ? "text-green-600 font-bold" : "text-muted-foreground"}>
                          {cat.curatedCount} <span className="text-xs">({curatedPct}%)</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Progress value={Math.min(100, cat.avgDemandScore)} className="h-1.5 w-10" />
                          <span className="text-sm font-bold">{cat.avgDemandScore}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-700 text-sm">
                        {cat.totalRevenue > 0 ? formatCurrency(cat.totalRevenue, "XAF") : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm">{cat.totalOrders}</TableCell>
                      <TableCell className="text-right">
                        {cat.qcPassRate > 0 ? (
                          <span className={`font-bold text-sm ${cat.qcPassRate >= 80 ? "text-green-600" : cat.qcPassRate >= 50 ? "text-orange-600" : "text-red-600"}`}>
                            {cat.qcPassRate}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">N/A</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Cross-Module Connections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingCart className="h-4 w-4 text-blue-600" />
              <p className="text-sm font-medium">Sourcing</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Créez des cas sourcing pour les produits en test et comparez les offres fournisseurs.
            </p>
            <Button size="sm" variant="outline" className="mt-3 w-full" asChild>
              <Link href="/sourcing/cases">Voir le sourcing</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <p className="text-sm font-medium">Finance</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Analysez les marges par produit et la contribution au cashflow dans le module Finance.
            </p>
            <Button size="sm" variant="outline" className="mt-3 w-full" asChild>
              <Link href="/finance/margins">Voir les marges</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <p className="text-sm font-medium">Fournisseurs</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Évaluez la fiabilité de vos fournisseurs et leur score de risque dans Supplier Intelligence.
            </p>
            <Button size="sm" variant="outline" className="mt-3 w-full" asChild>
              <Link href="/catalog/suppliers">Voir les fournisseurs</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
