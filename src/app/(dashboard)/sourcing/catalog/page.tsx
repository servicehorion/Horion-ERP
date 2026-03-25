import { redirect } from "next/navigation";

import { SourcingCatalogOS } from "@/components/sourcing/catalog-os";
import { getCatalogAnalytics, getCatalogDashboardStats } from "@/lib/actions/catalog.actions";
import { isAuthErrorMessage } from "@/lib/auth-error";
import { serializeDecimals } from "@/lib/utils";

export const metadata = { title: "Sourcing Catalog | Horion ERP" };

const emptyStats = {
  productCounts: {},
  supplierCounts: {},
  topProducts: [],
  topSuppliers: [],
  recentOffers: [],
  mediaCounts: {},
  categoryStats: [],
  avgDemandScore: 0,
};

const emptyAnalytics = {
  categoryPerformance: [],
  topByRevenue: [],
  priceSpread: [],
  healthMetrics: {
    totalProducts: 0,
    curatedPct: 0,
    testedPct: 0,
    testingPct: 0,
    blacklistPct: 0,
    avgDemandScore: 0,
    productsWithSuppliers: 0,
    productsWithOffers: 0,
    productsWithRevenue: 0,
    productsWithQC: 0,
    totalRevenue: 0,
    avgRevenuePerProduct: 0,
  },
};

export default async function SourcingCatalogPage() {
  const [statsRes, analyticsRes] = await Promise.all([
    getCatalogDashboardStats(),
    getCatalogAnalytics(),
  ]);

  const firstError = statsRes.error ?? analyticsRes.error;
  if (isAuthErrorMessage(firstError)) {
    redirect("/login?callbackUrl=%2Fsourcing%2Fcatalog");
  }

  if (firstError) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
        {firstError}
      </div>
    );
  }

  const stats = serializeDecimals(statsRes.data ?? emptyStats);
  const analytics = serializeDecimals(analyticsRes.data ?? emptyAnalytics);

  return (
    <div className="space-y-6">
      <SourcingCatalogOS stats={stats as any} analytics={analytics as any} />
    </div>
  );
}
