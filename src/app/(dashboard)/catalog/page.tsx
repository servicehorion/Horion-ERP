import {
  Package, Users, Tag, Image, Plus, TrendingUp, Star,
  CheckCircle2, BarChart3, Layers,
} from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  getCatalogDashboardProjection,
  getCatalogDashboardStats,
} from "@/lib/actions/catalog.actions";
import { ExportProductsButton } from "@/components/catalog/export-products-button";
import { CatalogDashboardOverview } from "@/components/catalog/catalog-dashboard-overview";

export const metadata = {
  title: "Catalogue OS | Horion ERP",
  description: "Intelligence catalogue produits et fournisseurs",
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  TESTING: { label: "En test", color: "bg-yellow-100 text-yellow-800" },
  TESTED: { label: "Testé", color: "bg-blue-100 text-blue-800" },
  CURATED: { label: "Curé", color: "bg-green-100 text-green-800" },
  BLACKLIST: { label: "Blacklisté", color: "bg-red-100 text-red-800" },
};

const SUPPLIER_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "Actif", color: "bg-green-100 text-green-800" },
  TESTING: { label: "En test", color: "bg-yellow-100 text-yellow-800" },
  SUSPENDED: { label: "Suspendu", color: "bg-orange-100 text-orange-800" },
  BLACKLIST: { label: "Blacklisté", color: "bg-red-100 text-red-800" },
};

export default async function CatalogDashboardPage() {
  const [result, projectionResult] = await Promise.all([
    getCatalogDashboardStats(),
    getCatalogDashboardProjection(),
  ]);

  if (result.error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
        {result.error}
      </div>
    );
  }

  const stats = result.data!;

  const totalProducts = Object.values(stats.productCounts).reduce((sum, count) => sum + count, 0);
  const activeProducts = Object.entries(stats.productCounts)
    .filter(([status]) => status !== "BLACKLIST")
    .reduce((sum, [, count]) => sum + count, 0);
  const curatedProducts = stats.productCounts["CURATED"] || 0;
  const blacklistedProducts = stats.productCounts["BLACKLIST"] || 0;

  const totalSuppliers = Object.values(stats.supplierCounts).reduce((sum, count) => sum + count, 0);
  const activeSuppliers = Object.entries(stats.supplierCounts)
    .filter(([status]) => status !== "BLACKLIST" && status !== "SUSPENDED")
    .reduce((sum, [, count]) => sum + count, 0);

  const totalMedia = Object.values(stats.mediaCounts).reduce((sum, count) => sum + count, 0);
  const totalOffers = stats.recentOffers.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Catalogue OS</h1>
          <p className="text-muted-foreground">
            Intelligence produits — qualité, sourcing, performance
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <ExportProductsButton />
          <Button variant="outline" size="sm" asChild>
            <Link href="/catalog/analytics">
              <BarChart3 className="mr-2 h-4 w-4" />
              Analytics
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/catalog/products">
              <Package className="mr-2 h-4 w-4" />
              Produits
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/catalog/suppliers">
              <Users className="mr-2 h-4 w-4" />
              Fournisseurs
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/catalog/offers">
              <Tag className="mr-2 h-4 w-4" />
              Offres
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/catalog/products/new">
              <Plus className="mr-2 h-4 w-4" />
              Nouveau produit
            </Link>
          </Button>
        </div>
      </div>

      {projectionResult.data ? (
        <CatalogDashboardOverview projection={projectionResult.data} />
      ) : null}

      {/* Bloomberg KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
            <CardTitle className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Produits actifs
            </CardTitle>
            <Package className="h-3.5 w-3.5 text-blue-600" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-lg font-bold text-blue-600">{activeProducts}</div>
            <p className="text-[10px] text-muted-foreground">{totalProducts} au total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
            <CardTitle className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Curés
            </CardTitle>
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-lg font-bold text-green-600">{curatedProducts}</div>
            <p className="text-[10px] text-muted-foreground">
              {totalProducts > 0 ? Math.round((curatedProducts / totalProducts) * 100) : 0}% du catalogue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
            <CardTitle className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Score demande moy.
            </CardTitle>
            <TrendingUp className="h-3.5 w-3.5 text-purple-600" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-lg font-bold">{stats.avgDemandScore}</div>
            <Progress value={Math.min(100, stats.avgDemandScore)} className="h-1 mt-1" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
            <CardTitle className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Fournisseurs actifs
            </CardTitle>
            <Users className="h-3.5 w-3.5 text-teal-600" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-lg font-bold text-teal-600">{activeSuppliers}</div>
            <p className="text-[10px] text-muted-foreground">{totalSuppliers} au total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
            <CardTitle className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Offres récentes
            </CardTitle>
            <Tag className="h-3.5 w-3.5 text-orange-600" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-lg font-bold text-orange-600">{totalOffers}</div>
            <p className="text-[10px] text-muted-foreground">dernières offres prix</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
            <CardTitle className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Médias vault
            </CardTitle>
            <Image className="h-3.5 w-3.5 text-cyan-600" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-lg font-bold text-cyan-600">{totalMedia}</div>
            <p className="text-[10px] text-muted-foreground">photos, docs, vidéos</p>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Product Status Distribution + Supplier Status */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Product Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Distribution produits par statut
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(STATUS_CONFIG).map(([status, config]) => {
              const count = stats.productCounts[status] || 0;
              const pct = totalProducts > 0 ? Math.round((count / totalProducts) * 100) : 0;
              return (
                <div key={status} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={`${config.color} text-xs`}>{config.label}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-bold">{count}</span>
                      <span className="text-muted-foreground">({pct}%)</span>
                    </div>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              );
            })}
            {blacklistedProducts > 0 && (
              <p className="text-xs text-red-600 pt-1">
                {blacklistedProducts} produit(s) blacklisté(s) — à réviser
              </p>
            )}
          </CardContent>
        </Card>

        {/* Supplier Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Distribution fournisseurs par statut
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(SUPPLIER_STATUS_CONFIG).map(([status, config]) => {
              const count = stats.supplierCounts[status] || 0;
              const pct = totalSuppliers > 0 ? Math.round((count / totalSuppliers) * 100) : 0;
              return (
                <div key={status} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={`${config.color} text-xs`}>{config.label}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-bold">{count}</span>
                      <span className="text-muted-foreground">({pct}%)</span>
                    </div>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Top Products + Top Suppliers */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Top Products by Demand */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                Top produits par score de demande
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/catalog/products">Voir tout</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {stats.topProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Aucun produit pour le moment
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.topProducts.map((product: any) => {
                      const sc = STATUS_CONFIG[product.status] || { label: product.status, color: "bg-gray-100 text-gray-800" };
                      return (
                        <TableRow key={product.id}>
                          <TableCell>
                            <Link
                              href={`/catalog/products/${product.id}`}
                              className="font-medium hover:underline text-blue-600"
                            >
                              {product.name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {product.category?.name || "-"}
                          </TableCell>
                          <TableCell>
                            <Badge className={`${sc.color} text-xs`}>{sc.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Progress value={Math.min(100, product.demandScore)} className="h-1.5 w-16" />
                              <span className="font-bold text-sm w-6 text-right">{product.demandScore}</span>
                            </div>
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

        {/* Top Suppliers */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Top fournisseurs
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/catalog/suppliers">Voir tout</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {stats.topSuppliers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Aucun fournisseur
              </p>
            ) : (
              <div className="space-y-4">
                {stats.topSuppliers.map((supplier: any) => {
                  const rating = Number(supplier.rating);
                  return (
                    <div key={supplier.id} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/catalog/suppliers/${supplier.id}`}
                          className="text-sm font-medium hover:underline text-blue-600 truncate block"
                        >
                          {supplier.name}
                        </Link>
                        <p className="text-xs text-muted-foreground truncate">
                          {supplier.platform || "N/A"} · {supplier.country || "N/A"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="h-1.5 w-16 rounded-full bg-muted">
                          <div
                            className="h-1.5 rounded-full bg-yellow-500"
                            style={{ width: `${Math.min(100, (rating / 5) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold w-6 text-right">{rating.toFixed(1)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Recent Offers */}
      {stats.recentOffers.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Offres de prix récentes
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/catalog/offers">Voir tout</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead className="text-right">Prix unitaire</TableHead>
                  <TableHead>Devise</TableHead>
                  <TableHead className="text-right">MOQ</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recentOffers.map((offer: any) => (
                  <TableRow key={offer.id}>
                    <TableCell className="font-medium">
                      {offer.product ? (
                        <Link href={`/catalog/products/${offer.productId}`} className="hover:underline text-blue-600">
                          {offer.product.name}
                        </Link>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {offer.supplier ? (
                        <Link href={`/catalog/suppliers/${offer.supplierId}`} className="hover:underline">
                          {offer.supplier.name}
                        </Link>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      {Number(offer.unitPrice).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-sm">{offer.currency}</TableCell>
                    <TableCell className="text-right text-sm">{offer.moq ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{offer.sourceType || "manual"}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(offer.createdAt).toLocaleDateString("fr-FR")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Button variant="outline" className="h-16 flex-col gap-1" asChild>
          <Link href="/catalog/products/new">
            <Package className="h-5 w-5" />
            <span className="text-xs">Nouveau produit</span>
          </Link>
        </Button>
        <Button variant="outline" className="h-16 flex-col gap-1" asChild>
          <Link href="/catalog/suppliers/new">
            <Users className="h-5 w-5" />
            <span className="text-xs">Nouveau fournisseur</span>
          </Link>
        </Button>
        <Button variant="outline" className="h-16 flex-col gap-1" asChild>
          <Link href="/catalog/offers">
            <Tag className="h-5 w-5" />
            <span className="text-xs">Gérer offres</span>
          </Link>
        </Button>
        <Button variant="outline" className="h-16 flex-col gap-1" asChild>
          <Link href="/catalog/vault">
            <Image className="h-5 w-5" />
            <span className="text-xs">Vault médias</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
