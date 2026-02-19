import Link from "next/link";
import {
  Plus, Package, ChevronLeft, ChevronRight, BarChart3,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getProductsPageData } from "@/lib/actions/catalog.actions";
import { ExportProductsButton } from "@/components/catalog/export-products-button";
import { ProductsFilters } from "@/components/catalog/products-filters";

export const metadata = {
  title: "Produits | Horion ERP",
  description: "Bibliothèque produits — 5 000+ références",
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  TESTING: { label: "En test", color: "bg-yellow-100 text-yellow-800" },
  TESTED: { label: "Testé", color: "bg-blue-100 text-blue-800" },
  CURATED: { label: "Curé", color: "bg-green-100 text-green-800" },
  BLACKLIST: { label: "Blacklisté", color: "bg-red-100 text-red-800" },
};

interface PageProps {
  searchParams: {
    page?: string;
    status?: string;
    category?: string;
    q?: string;
  };
}

export default async function ProductsPage({ searchParams }: PageProps) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const status = searchParams.status === "all" ? undefined : searchParams.status;
  const categoryId = searchParams.category;
  const search = searchParams.q;

  const result = await getProductsPageData({ page, status, categoryId, search, limit: 50 });

  if (result.error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
        {result.error}
      </div>
    );
  }

  const { products, total, totalPages, statusCounts, categories } = result.data!;

  const totalAll = Object.values(statusCounts).reduce((s, c) => s + c, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Produits</h1>
          <p className="text-muted-foreground">
            {total.toLocaleString("fr-FR")} produit{total !== 1 ? "s" : ""} au total
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
          <Button asChild size="sm">
            <Link href="/catalog/products/new">
              <Plus className="mr-2 h-4 w-4" />
              Nouveau produit
            </Link>
          </Button>
        </div>
      </div>

      {/* Status KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(STATUS_CONFIG).map(([status, config]) => {
          const count = statusCounts[status] || 0;
          const pct = totalAll > 0 ? Math.round((count / totalAll) * 100) : 0;
          return (
            <Link key={status} href={`/catalog/products?status=${status}`}>
              <Card className="cursor-pointer hover:border-primary/50 transition-colors">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <Badge className={`${config.color} text-xs`}>{config.label}</Badge>
                    <span className="text-xs text-muted-foreground">{pct}%</span>
                  </div>
                  <div className="text-xl font-bold mt-1">{count.toLocaleString("fr-FR")}</div>
                  <Progress value={pct} className="h-1 mt-1" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Filters (client component) */}
      <ProductsFilters
        categories={categories}
        currentStatus={searchParams.status}
        currentCategory={categoryId}
        currentSearch={search}
      />

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          {products.length === 0 ? (
            <div className="py-16 text-center">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-semibold">Aucun produit trouvé</h3>
              <p className="text-muted-foreground text-sm mt-1">
                Essayez de modifier vos filtres ou{" "}
                <Link href="/catalog/products/new" className="text-blue-600 hover:underline">
                  créez un nouveau produit
                </Link>
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom du produit</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">MOQ min</TableHead>
                  <TableHead>Prix range</TableHead>
                  <TableHead className="text-right">Score demande</TableHead>
                  <TableHead className="text-right">Fournisseurs</TableHead>
                  <TableHead className="text-right">Commandes</TableHead>
                  <TableHead className="text-right">QC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product: any) => {
                  const sc = STATUS_CONFIG[product.status] || { label: product.status, color: "bg-gray-100 text-gray-800" };
                  const priceMin = product.priceMin != null ? Number(product.priceMin) : null;
                  const priceMax = product.priceMax != null ? Number(product.priceMax) : null;

                  return (
                    <TableRow key={product.id} className="group">
                      <TableCell>
                        <Link
                          href={`/catalog/products/${product.id}`}
                          className="font-medium hover:underline text-blue-600 group-hover:underline"
                        >
                          {product.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {product.category?.name || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${sc.color} text-xs`}>{sc.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {product.moqMin != null ? Number(product.moqMin).toLocaleString("fr-FR") : "—"}
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {priceMin != null || priceMax != null
                          ? `${priceMin ?? "?"}–${priceMax ?? "?"} ${product.priceCurrency}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Progress value={Math.min(100, product.demandScore)} className="h-1.5 w-12" />
                          <span className="text-sm font-bold w-5 text-right">{product.demandScore}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {product._count?.supplierProducts ?? 0}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {product._count?.orderItems ?? 0}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {product._count?.qcReports ?? 0}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} sur {totalPages} ({total.toLocaleString("fr-FR")} produits)
          </p>
          <div className="flex items-center gap-2">
            {page > 1 && (
              <Button variant="outline" size="sm" asChild>
                <Link href={buildUrl(searchParams, { page: page - 1 })}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Précédent
                </Link>
              </Button>
            )}
            {/* Page numbers — show 5 around current */}
            <div className="flex items-center gap-1">
              {buildPageNumbers(page, totalPages).map((p) =>
                p === "..." ? (
                  <span key={`ellipsis-${Math.random()}`} className="px-2 text-muted-foreground">…</span>
                ) : (
                  <Button
                    key={p}
                    variant={p === page ? "default" : "outline"}
                    size="sm"
                    className="w-9 h-8 p-0"
                    asChild
                  >
                    <Link href={buildUrl(searchParams, { page: p as number })}>{p}</Link>
                  </Button>
                )
              )}
            </div>
            {page < totalPages && (
              <Button variant="outline" size="sm" asChild>
                <Link href={buildUrl(searchParams, { page: page + 1 })}>
                  Suivant
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function buildUrl(
  current: Record<string, string | undefined>,
  overrides: Record<string, string | number | undefined>
): string {
  const params = new URLSearchParams();
  const merged = { ...current, ...overrides };
  for (const [k, v] of Object.entries(merged)) {
    if (v != null && v !== "" && v !== "all") params.set(k, String(v));
  }
  return `/catalog/products?${params.toString()}`;
}

function buildPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p);
  }
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}
