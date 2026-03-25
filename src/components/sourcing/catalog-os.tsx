"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Bot,
  Brain,
  Package,
  Sparkles,
  TrendingUp,
  Users,
  Wand2,
  Zap,
  FolderOpen,
  Filter,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const fmt = (n: number) => n.toLocaleString("fr-FR");

const statusLabel: Record<string, string> = {
  CURATED: "Cure",
  TESTED: "Teste",
  TESTING: "En test",
  BLACKLIST: "Blacklist",
};

const statusBadge: Record<string, string> = {
  CURATED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  TESTED: "bg-blue-50 text-blue-700 border-blue-200",
  TESTING: "bg-amber-50 text-amber-700 border-amber-200",
  BLACKLIST: "bg-red-50 text-red-700 border-red-200",
};

type CatalogStats = {
  productCounts: Record<string, number>;
  supplierCounts: Record<string, number>;
  topProducts: Array<{
    id: string;
    name: string;
    demandScore?: number | null;
    status?: string | null;
    category?: { name?: string | null } | null;
    priceMin?: number | null;
    priceMax?: number | null;
    priceCurrency?: string | null;
  }>;
  topSuppliers: Array<{
    id: string;
    name: string;
    rating?: number | null;
    country?: string | null;
    status?: string | null;
    _count?: { supplierProducts?: number | null; sourcingCases?: number | null } | null;
  }>;
  recentOffers: Array<{
    id: string;
    productId: string;
    supplierId: string;
    price?: number | null;
    currency?: string | null;
    leadTimeDays?: number | null;
  }>;
  mediaCounts: Record<string, number>;
  categoryStats: Array<{ categoryId: string | null; _count: { id: number } }>;
  avgDemandScore: number;
};

type CatalogAnalytics = {
  categoryPerformance: Array<{
    id: string | null;
    name: string;
    productCount: number;
    activeCount: number;
    curatedCount: number;
    avgDemandScore: number;
    totalRevenue: number;
    totalOrders: number;
    qcPassRate: number;
  }>;
  topByRevenue: Array<{
    productId: string;
    name: string;
    categoryName: string | null;
    status: string;
    totalRevenue: number;
    orderCount: number;
    totalQty: number;
    demandScore: number;
  }>;
  priceSpread: Array<{
    productId: string;
    name: string;
    status: string;
    offerCount: number;
    minPrice: number;
    maxPrice: number;
    spread: number;
    currency: string;
  }>;
  healthMetrics: {
    totalProducts: number;
    curatedPct: number;
    testedPct: number;
    testingPct: number;
    blacklistPct: number;
    avgDemandScore: number;
    productsWithSuppliers: number;
    productsWithOffers: number;
    productsWithRevenue: number;
    productsWithQC: number;
    totalRevenue: number;
    avgRevenuePerProduct: number;
  };
};

type Props = {
  stats: CatalogStats;
  analytics: CatalogAnalytics;
};

const zeliaActions = [
  {
    id: "scrape-suppliers",
    title: "Scraper nouveaux fournisseurs",
    impact: "Eleve",
    detail: "Elargir le pool sur les categories a forte demande",
  },
  {
    id: "auto-nego",
    title: "Lancer la sequence de negociation",
    impact: "Moyen",
    detail: "Pousser le prix cible et MOQ sur les top 5 fournisseurs",
  },
  {
    id: "price-refresh",
    title: "Rafraichir le price intel",
    impact: "Moyen",
    detail: "Mettre a jour les prix marche et volatilite",
  },
];

export function SourcingCatalogOS({ stats, analytics }: Props) {
  const [search, setSearch] = useState("");
  const [autoMode, setAutoMode] = useState(false);
  const [autoActions, setAutoActions] = useState<Record<string, boolean>>({
    "scrape-suppliers": true,
    "auto-nego": false,
    "price-refresh": true,
  });
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");

  const totals = useMemo(() => {
    const pc = stats.productCounts || {};
    const sc = stats.supplierCounts || {};
    const nProducts = Object.values(pc).reduce((s: number, v: number) => s + v, 0);
    const nSuppliers = Object.values(sc).reduce((s: number, v: number) => s + v, 0);
    return {
      totalProducts: nProducts,
      totalSuppliers: nSuppliers,
      activeSuppliers: nSuppliers - (sc.BLACKLIST ?? 0) - (sc.SUSPENDED ?? 0),
      curated: pc.CURATED ?? 0,
      tested: pc.TESTED ?? 0,
      testing: pc.TESTING ?? 0,
      blacklisted: pc.BLACKLIST ?? 0,
    };
  }, [stats]);

  const categoryOptions = useMemo(() => {
    const names = new Set<string>();
    (stats.topProducts ?? []).forEach((p) => {
      if (p.category?.name) names.add(p.category.name);
    });
    (analytics.categoryPerformance ?? []).forEach((c) => {
      if (c.name) names.add(c.name);
    });
    (analytics.topByRevenue ?? []).forEach((p) => {
      if (p.categoryName) names.add(p.categoryName);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [stats.topProducts, analytics.categoryPerformance, analytics.topByRevenue]);

  const statusOptions = useMemo(() => {
    const names = new Set<string>();
    (stats.topProducts ?? []).forEach((p) => {
      if (p.status) names.add(p.status);
    });
    (analytics.topByRevenue ?? []).forEach((p) => {
      if (p.status) names.add(p.status);
    });
    (analytics.priceSpread ?? []).forEach((p) => {
      if (p.status) names.add(p.status);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [stats.topProducts, analytics.topByRevenue, analytics.priceSpread]);

  const countryOptions = useMemo(() => {
    const names = new Set<string>();
    (stats.topSuppliers ?? []).forEach((s) => {
      if (s.country) names.add(s.country);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [stats.topSuppliers]);

  const filteredTopProducts = useMemo(() => {
    const list = stats.topProducts ?? [];
    const s = search.toLowerCase();
    const status = statusFilter === "all" ? null : statusFilter;
    const category = categoryFilter === "all" ? null : categoryFilter;
    return list.filter((p) =>
      (!s || [p.name, p.category?.name, p.status].some((v) => String(v ?? "").toLowerCase().includes(s))) &&
      (!status || p.status === status) &&
      (!category || p.category?.name === category)
    );
  }, [stats.topProducts, search, statusFilter, categoryFilter]);

  const filteredSuppliers = useMemo(() => {
    const list = stats.topSuppliers ?? [];
    const s = search.toLowerCase();
    const country = countryFilter === "all" ? null : countryFilter;
    return list.filter((p) =>
      (!s || [p.name, p.country, p.status].some((v) => String(v ?? "").toLowerCase().includes(s))) &&
      (!country || p.country === country)
    );
  }, [stats.topSuppliers, search, countryFilter]);

  const filteredRevenue = useMemo(() => {
    const list = analytics.topByRevenue ?? [];
    const s = search.toLowerCase();
    const status = statusFilter === "all" ? null : statusFilter;
    const category = categoryFilter === "all" ? null : categoryFilter;
    return list.filter((p) =>
      (!s || [p.name, p.categoryName, p.status].some((v) => String(v ?? "").toLowerCase().includes(s))) &&
      (!status || p.status === status) &&
      (!category || p.categoryName === category)
    );
  }, [analytics.topByRevenue, search, statusFilter, categoryFilter]);

  const categoryByProductId = useMemo(() => {
    const map = new Map<string, string>();
    (analytics.topByRevenue ?? []).forEach((p) => {
      if (p.categoryName) map.set(p.productId, p.categoryName);
    });
    return map;
  }, [analytics.topByRevenue]);

  const filteredSpread = useMemo(() => {
    const list = analytics.priceSpread ?? [];
    const s = search.toLowerCase();
    const status = statusFilter === "all" ? null : statusFilter;
    const category = categoryFilter === "all" ? null : categoryFilter;
    return list.filter((p) =>
      (!s || String(p.name ?? "").toLowerCase().includes(s)) &&
      (!status || p.status === status) &&
      (!category || categoryByProductId.get(p.productId) === category)
    );
  }, [analytics.priceSpread, search, statusFilter, categoryFilter, categoryByProductId]);

  const aiPulse = useMemo(() => {
    const totalProducts = analytics.healthMetrics.totalProducts || 1;
    const coverage = Math.round((analytics.healthMetrics.productsWithSuppliers / totalProducts) * 100);
    const revenueAvg = Math.round(analytics.healthMetrics.avgRevenuePerProduct || 0);
    const demand = Math.round(stats.avgDemandScore || 0);
    return { coverage, revenueAvg, demand };
  }, [analytics.healthMetrics, stats.avgDemandScore]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">Sourcing Catalog OS</h1>
            <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-200">Marketplace</Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Intelligence catalogue niveau marketplace pour Horion.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button asChild variant="outline" size="sm">
            <Link href="/catalog">Ouvrir Catalog OS</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/catalog/products">Produits</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/catalog/products/new">Ajouter un produit</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher produits, fournisseurs, categories..."
            className="border-0 bg-transparent p-0 h-6 text-sm focus-visible:ring-0"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              {statusOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabel[s] ?? s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="Categorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes categories</SelectItem>
              {categoryOptions.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={countryFilter} onValueChange={setCountryFilter}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="Pays" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous pays</SelectItem>
              {countryOptions.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setStatusFilter("all");
              setCategoryFilter("all");
              setCountryFilter("all");
              setSearch("");
            }}
          >
            <Filter className="mr-2 h-4 w-4" />
            Reinitialiser
          </Button>
          <Button variant="outline" size="sm">
            <FolderOpen className="mr-2 h-4 w-4" />
            Carte categories
          </Button>
        </div>
      </div>

      {(statusFilter !== "all" || categoryFilter !== "all" || countryFilter !== "all") && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {statusFilter !== "all" && (
            <Badge variant="outline">
              Statut: {statusLabel[statusFilter] ?? statusFilter}
            </Badge>
          )}
          {categoryFilter !== "all" && (
            <Badge variant="outline">Categorie: {categoryFilter}</Badge>
          )}
          {countryFilter !== "all" && (
            <Badge variant="outline">Pays: {countryFilter}</Badge>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="transition-all hover:shadow-md hover:-translate-y-0.5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total produits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(totals.totalProducts)}</div>
            <p className="text-xs text-muted-foreground">Cure {fmt(totals.curated)}</p>
          </CardContent>
        </Card>
        <Card className="transition-all hover:shadow-md hover:-translate-y-0.5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Fournisseurs actifs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(totals.activeSuppliers)}</div>
            <p className="text-xs text-muted-foreground">Total {fmt(totals.totalSuppliers)}</p>
          </CardContent>
        </Card>
        <Card className="transition-all hover:shadow-md hover:-translate-y-0.5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Score demande moyen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{fmt(stats.avgDemandScore)}</div>
            <p className="text-xs text-muted-foreground">Top produits cures</p>
          </CardContent>
        </Card>
        <Card className="transition-all hover:shadow-md hover:-translate-y-0.5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Sante catalogue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(Math.round(analytics.healthMetrics.curatedPct))}%</div>
            <p className="text-xs text-muted-foreground">Part curee</p>
          </CardContent>
        </Card>
        <Card className="transition-all hover:shadow-md hover:-translate-y-0.5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">CA total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(Math.round(analytics.healthMetrics.totalRevenue))} XAF</div>
            <p className="text-xs text-muted-foreground">Moy {fmt(Math.round(analytics.healthMetrics.avgRevenuePerProduct))} / produit</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="overview">Vue generale</TabsTrigger>
          <TabsTrigger value="products">Produits</TabsTrigger>
          <TabsTrigger value="suppliers">Fournisseurs</TabsTrigger>
          <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
          <TabsTrigger value="ai">Zelia AI</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="transition-all hover:shadow-md hover:-translate-y-0.5">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Produits a forte demande
                </CardTitle>
                <CardDescription>Liste basee sur le score de demande</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {filteredTopProducts.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Aucun produit en tete.</div>
                ) : (
                  filteredTopProducts.slice(0, 5).map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-muted/40 transition-colors">
                      <div>
                        <Link
                          href={`/catalog/products/${p.id}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {p.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {p.category?.name ?? "Sans categorie"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{p.demandScore ?? 0}</Badge>
                        {p.status && (
                          <Badge
                            variant="outline"
                            className={statusBadge[p.status] ?? ""}
                          >
                            {statusLabel[p.status] ?? p.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="transition-all hover:shadow-md hover:-translate-y-0.5">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Top fournisseurs
                </CardTitle>
                <CardDescription>Partenaires les mieux notes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {filteredSuppliers.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Aucun fournisseur en tete.</div>
                ) : (
                  filteredSuppliers.slice(0, 5).map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-muted/40 transition-colors">
                      <div>
                        <Link
                          href={`/catalog/suppliers/${s.id}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {s.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {s.country ?? "-"} · Produits {s._count?.supplierProducts ?? 0}
                        </p>
                      </div>
                      <Badge variant="outline">{Number(s.rating ?? 0).toFixed(1)}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="transition-all hover:shadow-md hover:-translate-y-0.5">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Sante catalogue
                </CardTitle>
                <CardDescription>Couverture des produits cures et testes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Cure</span>
                    <span>{Math.round(analytics.healthMetrics.curatedPct)}%</span>
                  </div>
                  <Progress value={analytics.healthMetrics.curatedPct} />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Teste</span>
                    <span>{Math.round(analytics.healthMetrics.testedPct)}%</span>
                  </div>
                  <Progress value={analytics.healthMetrics.testedPct} />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>En test</span>
                    <span>{Math.round(analytics.healthMetrics.testingPct)}%</span>
                  </div>
                  <Progress value={analytics.healthMetrics.testingPct} />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Blacklist</span>
                    <span>{Math.round(analytics.healthMetrics.blacklistPct)}%</span>
                  </div>
                  <Progress value={analytics.healthMetrics.blacklistPct} />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card className="transition-all hover:shadow-md hover:-translate-y-0.5">
            <CardHeader>
              <CardTitle className="text-base">Top produits par revenu</CardTitle>
              <CardDescription>Leaders de revenus du catalogue</CardDescription>
            </CardHeader>
            <CardContent>
              <Table className="text-sm [&_td]:py-2 [&_th]:py-2">
                <TableHeader>
                  <TableRow className="hover:bg-muted/40 transition-colors">
                    <TableHead>Produit</TableHead>
                    <TableHead>Categorie</TableHead>
                    <TableHead>Revenu</TableHead>
                    <TableHead>Commandes</TableHead>
                    <TableHead>Demande</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRevenue.length === 0 ? (
                    <TableRow className="hover:bg-muted/40 transition-colors">
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Aucune donnee.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRevenue.map((p) => (
                      <TableRow key={p.productId}>
                        <TableCell className="font-medium">
                          <Link href={`/catalog/products/${p.productId}`} className="hover:underline">
                            {p.name}
                          </Link>
                        </TableCell>
                        <TableCell>{p.categoryName ?? "-"}</TableCell>
                        <TableCell>{fmt(Math.round(p.totalRevenue))} XAF</TableCell>
                        <TableCell>{fmt(p.orderCount)}</TableCell>
                        <TableCell>{p.demandScore}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="transition-all hover:shadow-md hover:-translate-y-0.5">
            <CardHeader>
              <CardTitle className="text-base">Radar de spread prix</CardTitle>
              <CardDescription>Opportunites d expansion de marge</CardDescription>
            </CardHeader>
            <CardContent>
              <Table className="text-sm [&_td]:py-2 [&_th]:py-2">
                <TableHeader>
                  <TableRow className="hover:bg-muted/40 transition-colors">
                    <TableHead>Produit</TableHead>
                    <TableHead>Offres</TableHead>
                    <TableHead>Min</TableHead>
                    <TableHead>Max</TableHead>
                    <TableHead>Spread</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSpread.length === 0 ? (
                    <TableRow className="hover:bg-muted/40 transition-colors">
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Aucune donnee.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSpread.map((p) => (
                      <TableRow key={p.productId}>
                        <TableCell className="font-medium">
                          <Link href={`/catalog/products/${p.productId}`} className="hover:underline">
                            {p.name}
                          </Link>
                        </TableCell>
                        <TableCell>{fmt(p.offerCount)}</TableCell>
                        <TableCell>{fmt(Math.round(p.minPrice ?? 0))} {p.currency}</TableCell>
                        <TableCell>{fmt(Math.round(p.maxPrice ?? 0))} {p.currency}</TableCell>
                        <TableCell>{Math.round(p.spread ?? 0)}%</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers" className="space-y-4">
          <Card className="transition-all hover:shadow-md hover:-translate-y-0.5">
            <CardHeader>
              <CardTitle className="text-base">Performance fournisseurs</CardTitle>
              <CardDescription>Fiabilite, volume, risque</CardDescription>
            </CardHeader>
            <CardContent>
              <Table className="text-sm [&_td]:py-2 [&_th]:py-2">
                <TableHeader>
                  <TableRow className="hover:bg-muted/40 transition-colors">
                    <TableHead>Fournisseur</TableHead>
                    <TableHead>Pays</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>Produits</TableHead>
                    <TableHead>Cas sourcing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.length === 0 ? (
                    <TableRow className="hover:bg-muted/40 transition-colors">
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Aucun fournisseur.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSuppliers.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">
                          <Link href={`/catalog/suppliers/${s.id}`} className="hover:underline">
                            {s.name}
                          </Link>
                        </TableCell>
                        <TableCell>{s.country ?? "-"}</TableCell>
                        <TableCell>{Number(s.rating ?? 0).toFixed(1)}</TableCell>
                        <TableCell>{s._count?.supplierProducts ?? 0}</TableCell>
                        <TableCell>{s._count?.sourcingCases ?? 0}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="intelligence" className="space-y-4">
          {analytics.categoryPerformance.length === 0 ? (
            <Card className="transition-all hover:shadow-md hover:-translate-y-0.5">
              <CardContent className="py-10 text-center text-muted-foreground">
                Aucune categorie disponible.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              {analytics.categoryPerformance.map((cat) => (
                <Card key={cat.id ?? cat.name} className="transition-all hover:shadow-md hover:-translate-y-0.5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{cat.name}</CardTitle>
                    <CardDescription>{cat.productCount} produits</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Score demande</span>
                      <span>{Math.round(cat.avgDemandScore)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">QC pass rate</span>
                      <span>{Math.round(cat.qcPassRate)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Revenu</span>
                      <span>{fmt(Math.round(cat.totalRevenue))} XAF</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Commandes</span>
                      <span>{fmt(cat.totalOrders)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ai" className="space-y-4">
          <Card className="transition-all hover:shadow-md hover:-translate-y-0.5">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Zelia AI control center
              </CardTitle>
              <CardDescription>
                Actions recommandees, automation, et workflows de negociation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border bg-muted/30 p-3 transition-colors hover:bg-muted/40">
                  <p className="text-xs text-muted-foreground">Couverture fournisseurs</p>
                  <p className="text-2xl font-bold">{aiPulse.coverage}%</p>
                  <p className="text-[11px] text-muted-foreground">Produits avec fournisseurs</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3 transition-colors hover:bg-muted/40">
                  <p className="text-xs text-muted-foreground">Revenu moyen produit</p>
                  <p className="text-2xl font-bold">{fmt(aiPulse.revenueAvg)} XAF</p>
                  <p className="text-[11px] text-muted-foreground">Signal de rentabilite</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3 transition-colors hover:bg-muted/40">
                  <p className="text-xs text-muted-foreground">Signal demande</p>
                  <p className="text-2xl font-bold">{aiPulse.demand}</p>
                  <p className="text-[11px] text-muted-foreground">Score moyen demande</p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Auto-exec des actions approuvees</p>
                  <p className="text-xs text-muted-foreground">
                    Zelia peut executer automatiquement apres validation.
                  </p>
                </div>
                <Switch checked={autoMode} onCheckedChange={setAutoMode} />
              </div>

              <div className="space-y-3">
                {zeliaActions.map((action) => (
                  <div key={action.id} className="flex flex-col gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/20">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold">{action.title}</p>
                        <p className="text-xs text-muted-foreground">{action.detail}</p>
                      </div>
                      <Badge variant="outline">{action.impact}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Bot className="h-3 w-3" />
                        Auto pour cette action
                        <Switch
                          checked={autoActions[action.id] ?? false}
                          onCheckedChange={(val) =>
                            setAutoActions((prev) => ({ ...prev, [action.id]: val }))
                          }
                        />
                      </div>
                      <Button
                        size="sm"
                        onClick={() => toast.success(`Zelia demarre: ${action.title}`)}
                      >
                        Executer
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <Card className="border-dashed transition-all hover:shadow-md hover:-translate-y-0.5">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Wand2 className="h-4 w-4" />
                      Auto-negociation
                    </CardTitle>
                    <CardDescription>Envoyer prix cible et MOQ</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => toast.success("Workflow negociation lance")}
                    >
                      Demarrer negociation
                    </Button>
                  </CardContent>
                </Card>
                <Card className="border-dashed transition-all hover:shadow-md hover:-translate-y-0.5">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Brain className="h-4 w-4" />
                      Market insights
                    </CardTitle>
                    <CardDescription>Mettre a jour les signaux prix</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => toast.success("Market insights rafraichis")}
                    >
                      Rafraichir insights
                    </Button>
                  </CardContent>
                </Card>
                <Card className="border-dashed transition-all hover:shadow-md hover:-translate-y-0.5">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Outreach fournisseurs
                    </CardTitle>
                    <CardDescription>WhatsApp + email</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => toast.success("Outreach lance pour top fournisseurs")}
                    >
                      Envoyer outreach
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}






