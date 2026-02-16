import { Package, Users, Tag, Image, Plus } from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCatalogDashboardStats } from "@/lib/actions/catalog.actions";

export const metadata = {
  title: "Catalogue | Horion ERP",
  description: "Vue d'ensemble du catalogue produits et fournisseurs",
};

const STATUS_COLOR: Record<string, string> = {
  TESTING: "bg-yellow-100 text-yellow-800",
  TESTED: "bg-blue-100 text-blue-800",
  CURATED: "bg-green-100 text-green-800",
  BLACKLIST: "bg-red-100 text-red-800",
};

export default async function CatalogDashboardPage() {
  const result = await getCatalogDashboardStats();

  if (result.error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
        {result.error}
      </div>
    );
  }

  const stats = result.data!;

  const activeProducts = Object.entries(stats.productCounts)
    .filter(([status]) => status !== "BLACKLIST")
    .reduce((sum, [, count]) => sum + count, 0);

  const activeSuppliers = Object.entries(stats.supplierCounts)
    .filter(([status]) => status !== "BLACKLIST" && status !== "SUSPENDED")
    .reduce((sum, [, count]) => sum + count, 0);

  const recentOffersCount = stats.recentOffers.length;

  const totalMedia = Object.values(stats.mediaCounts).reduce(
    (sum, count) => sum + count,
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Catalogue</h1>
          <p className="text-muted-foreground">
            Vue d'ensemble du catalogue produits et fournisseurs
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/catalog/products/new">
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un produit
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/catalog/suppliers/new">
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un fournisseur
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Produits actifs
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeProducts}</div>
            <p className="text-xs text-muted-foreground">
              Hors blacklist
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Fournisseurs actifs
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSuppliers}</div>
            <p className="text-xs text-muted-foreground">
              Actifs et en test
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Offres recentes
            </CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentOffersCount}</div>
            <p className="text-xs text-muted-foreground">
              Dernieres offres
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Medias</CardTitle>
            <Image className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMedia}</div>
            <p className="text-xs text-muted-foreground">
              Photos, videos, documents
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Products */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Top produits</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/catalog/products">Voir tout</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {stats.topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun produit pour le moment
              </p>
            ) : (
              <div className="space-y-4">
                {stats.topProducts.map((product: any) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <Link
                        href={`/catalog/products/${product.id}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {product.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        Score demande : {product.demandScore ?? 0}
                      </p>
                    </div>
                    <Badge
                      className={
                        STATUS_COLOR[product.status] || "bg-gray-100 text-gray-800"
                      }
                    >
                      {product.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Suppliers */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Top fournisseurs</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/catalog/suppliers">Voir tout</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {stats.topSuppliers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun fournisseur pour le moment
              </p>
            ) : (
              <div className="space-y-4">
                {stats.topSuppliers.map((supplier: any) => (
                  <div
                    key={supplier.id}
                    className="flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{supplier.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {supplier.platform || "N/A"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{
                            width: `${Math.min(
                              100,
                              (Number(supplier.rating) / 5) * 100
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium">
                        {Number(supplier.rating).toFixed(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
