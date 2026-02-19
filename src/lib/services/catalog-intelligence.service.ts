/**
 * CATALOG INTELLIGENCE SERVICE
 * Enterprise-scale analytics for 5000+ products.
 * Powers the analytics dashboard, product rankings, price intelligence,
 * and cross-module interconnections (CRM, Sourcing, Finance).
 */

import { prisma } from "@/lib/db";

// ============================================================
// TYPES
// ============================================================

export interface CategoryPerformance {
  id: string | null;
  name: string;
  productCount: number;
  activeCount: number; // non-blacklisted
  curatedCount: number;
  avgDemandScore: number;
  totalRevenue: number; // XAF
  totalOrders: number;
  qcPassRate: number; // 0-100
}

export interface ProductRevenueRank {
  productId: string;
  name: string;
  categoryName: string | null;
  status: string;
  totalRevenue: number; // XAF
  orderCount: number;
  totalQty: number;
  demandScore: number;
}

export interface PriceSpreadProduct {
  productId: string;
  name: string;
  status: string;
  offerCount: number;
  minPrice: number;
  maxPrice: number;
  spread: number; // (max-min)/min * 100
  currency: string;
}

export interface CatalogHealthMetrics {
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
  totalRevenue: number; // XAF
  avgRevenuePerProduct: number;
}

export interface CrossModuleProductData {
  sourcingCases: { id: string; orderId: string; createdAt: Date }[];
  linkedOrders: { id: string; orderNumber: string; status: string }[];
}

// ============================================================
// SERVICE
// ============================================================

export class CatalogIntelligenceService {

  /**
   * Category-level performance analytics.
   * Aggregates: product count, demand, revenue, QC pass rate.
   */
  static async getCategoryPerformance(tenantId: string): Promise<CategoryPerformance[]> {
    // 1. All categories for this tenant
    const categories = await prisma.productCategory.findMany({
      where: { tenantId },
      include: {
        products: {
          select: {
            id: true,
            demandScore: true,
            status: true,
          },
        },
      },
    });

    // 2. Revenue + order counts per product (from orderItems)
    const orderAgg = await prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        order: { tenantId },
        productId: { not: null },
      },
      _sum: { totalXAF: true, quantity: true },
      _count: { id: true },
    });

    const revenueMap = new Map<string, { revenue: number; orders: number; qty: number }>();
    for (const row of orderAgg) {
      if (row.productId) {
        revenueMap.set(row.productId, {
          revenue: Number(row._sum.totalXAF ?? 0),
          orders: row._count.id,
          qty: Number(row._sum.quantity ?? 0),
        });
      }
    }

    // 3. QC pass counts per product
    const qcAgg = await prisma.qCReport.groupBy({
      by: ["productId"],
      where: {
        productId: { not: null },
        overallResult: { in: ["PASS", "CONDITIONAL_PASS"] },
      },
      _count: { id: true },
    });
    const qcPassMap = new Map<string, number>();
    for (const row of qcAgg) {
      if (row.productId) qcPassMap.set(row.productId, row._count.id);
    }

    const qcTotalAgg = await prisma.qCReport.groupBy({
      by: ["productId"],
      where: { productId: { not: null } },
      _count: { id: true },
    });
    const qcTotalMap = new Map<string, number>();
    for (const row of qcTotalAgg) {
      if (row.productId) qcTotalMap.set(row.productId, row._count.id);
    }

    // 4. Build result
    const result: CategoryPerformance[] = categories.map((cat) => {
      const products = cat.products;
      const totalRevenue = products.reduce((s, p) => s + (revenueMap.get(p.id)?.revenue ?? 0), 0);
      const totalOrders = products.reduce((s, p) => s + (revenueMap.get(p.id)?.orders ?? 0), 0);
      const avgDemand = products.length > 0
        ? Math.round(products.reduce((s, p) => s + p.demandScore, 0) / products.length)
        : 0;

      const qcTotal = products.reduce((s, p) => s + (qcTotalMap.get(p.id) ?? 0), 0);
      const qcPass = products.reduce((s, p) => s + (qcPassMap.get(p.id) ?? 0), 0);

      return {
        id: cat.id,
        name: cat.name,
        productCount: products.length,
        activeCount: products.filter((p) => p.status !== "BLACKLIST").length,
        curatedCount: products.filter((p) => p.status === "CURATED").length,
        avgDemandScore: avgDemand,
        totalRevenue,
        totalOrders,
        qcPassRate: qcTotal > 0 ? Math.round((qcPass / qcTotal) * 100) : 0,
      };
    });

    // Also include "Uncategorized" bucket
    const uncategorizedProducts = await prisma.catalogProduct.findMany({
      where: { tenantId, categoryId: null },
      select: { id: true, demandScore: true, status: true },
    });

    if (uncategorizedProducts.length > 0) {
      const totalRevenue = uncategorizedProducts.reduce((s, p) => s + (revenueMap.get(p.id)?.revenue ?? 0), 0);
      const totalOrders = uncategorizedProducts.reduce((s, p) => s + (revenueMap.get(p.id)?.orders ?? 0), 0);
      const avgDemand = Math.round(
        uncategorizedProducts.reduce((s, p) => s + p.demandScore, 0) / uncategorizedProducts.length
      );
      const qcTotal = uncategorizedProducts.reduce((s, p) => s + (qcTotalMap.get(p.id) ?? 0), 0);
      const qcPass = uncategorizedProducts.reduce((s, p) => s + (qcPassMap.get(p.id) ?? 0), 0);

      result.push({
        id: null,
        name: "Non catégorisé",
        productCount: uncategorizedProducts.length,
        activeCount: uncategorizedProducts.filter((p) => p.status !== "BLACKLIST").length,
        curatedCount: uncategorizedProducts.filter((p) => p.status === "CURATED").length,
        avgDemandScore: avgDemand,
        totalRevenue,
        totalOrders,
        qcPassRate: qcTotal > 0 ? Math.round((qcPass / qcTotal) * 100) : 0,
      });
    }

    return result.sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  /**
   * Top products by revenue generated (from orderItems.totalXAF).
   * Efficient: single groupBy + single findMany.
   */
  static async getTopByRevenue(tenantId: string, limit = 10): Promise<ProductRevenueRank[]> {
    const orderAgg = await prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        order: { tenantId },
        productId: { not: null },
      },
      _sum: { totalXAF: true, quantity: true },
      _count: { id: true },
      orderBy: { _sum: { totalXAF: "desc" } },
      take: limit,
    });

    if (orderAgg.length === 0) return [];

    const productIds = orderAgg.map((r) => r.productId!).filter(Boolean);
    const products = await prisma.catalogProduct.findMany({
      where: { id: { in: productIds } },
      include: { category: { select: { name: true } } },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    return orderAgg
      .filter((r) => r.productId && productMap.has(r.productId!))
      .map((r) => {
        const p = productMap.get(r.productId!)!;
        return {
          productId: p.id,
          name: p.name,
          categoryName: p.category?.name ?? null,
          status: p.status,
          totalRevenue: Number(r._sum.totalXAF ?? 0),
          orderCount: r._count.id,
          totalQty: Number(r._sum.quantity ?? 0),
          demandScore: p.demandScore,
        };
      });
  }

  /**
   * Products with largest price spread across supplier offers.
   * Identifies products where negotiation can save the most.
   */
  static async getPriceSpread(tenantId: string, limit = 10): Promise<PriceSpreadProduct[]> {
    // Get products for this tenant
    const productIds = await prisma.catalogProduct.findMany({
      where: { tenantId },
      select: { id: true },
    }).then((ps) => ps.map((p) => p.id));

    if (productIds.length === 0) return [];

    const priceAgg = await prisma.offer.groupBy({
      by: ["productId", "currency"],
      where: {
        productId: { in: productIds },
        unitPrice: { gt: 0 },
      },
      _min: { unitPrice: true },
      _max: { unitPrice: true },
      _count: { id: true },
      having: {
        unitPrice: { _count: { gt: 1 } }, // only products with 2+ offers
      },
    });

    if (priceAgg.length === 0) return [];

    const relevantIds = priceAgg
      .filter((r) => r.productId != null)
      .map((r) => r.productId!)
      .filter((v, i, a) => a.indexOf(v) === i); // unique

    const products = await prisma.catalogProduct.findMany({
      where: { id: { in: relevantIds } },
      select: { id: true, name: true, status: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const result: PriceSpreadProduct[] = priceAgg
      .filter((r) => r.productId && productMap.has(r.productId!))
      .map((r) => {
        const minP = Number(r._min.unitPrice ?? 0);
        const maxP = Number(r._max.unitPrice ?? 0);
        const spread = minP > 0 ? Math.round(((maxP - minP) / minP) * 100) : 0;
        const prod = productMap.get(r.productId!)!;
        return {
          productId: prod.id,
          name: prod.name,
          status: prod.status,
          offerCount: r._count.id,
          minPrice: minP,
          maxPrice: maxP,
          spread,
          currency: r.currency,
        };
      })
      .sort((a, b) => b.spread - a.spread)
      .slice(0, limit);

    return result;
  }

  /**
   * Catalog health metrics — high-level health score for the dashboard.
   */
  static async getCatalogHealthMetrics(tenantId: string): Promise<CatalogHealthMetrics> {
    const [
      totalProducts,
      statusCounts,
      avgDemand,
      withSuppliers,
      withOffers,
      withQC,
      revenueAgg,
    ] = await Promise.all([
      prisma.catalogProduct.count({ where: { tenantId } }),
      prisma.catalogProduct.groupBy({
        by: ["status"],
        where: { tenantId },
        _count: { id: true },
      }),
      prisma.catalogProduct.aggregate({
        where: { tenantId },
        _avg: { demandScore: true },
      }),
      prisma.catalogProduct.count({
        where: { tenantId, supplierProducts: { some: {} } },
      }),
      prisma.catalogProduct.count({
        where: { tenantId, offers: { some: {} } },
      }),
      prisma.catalogProduct.count({
        where: { tenantId, qcReports: { some: {} } },
      }),
      prisma.orderItem.aggregate({
        where: { order: { tenantId }, productId: { not: null } },
        _sum: { totalXAF: true },
        _count: { id: true },
      }),
    ]);

    const statusMap = statusCounts.reduce(
      (acc, r) => ({ ...acc, [r.status]: r._count.id }),
      {} as Record<string, number>
    );

    const totalRevenue = Number(revenueAgg._sum.totalXAF ?? 0);

    // Count distinct products with revenue
    const withRevenue = await prisma.orderItem.groupBy({
      by: ["productId"],
      where: { order: { tenantId }, productId: { not: null } },
    }).then((rows) => rows.length);

    return {
      totalProducts,
      curatedPct: totalProducts > 0 ? Math.round(((statusMap.CURATED ?? 0) / totalProducts) * 100) : 0,
      testedPct: totalProducts > 0 ? Math.round(((statusMap.TESTED ?? 0) / totalProducts) * 100) : 0,
      testingPct: totalProducts > 0 ? Math.round(((statusMap.TESTING ?? 0) / totalProducts) * 100) : 0,
      blacklistPct: totalProducts > 0 ? Math.round(((statusMap.BLACKLIST ?? 0) / totalProducts) * 100) : 0,
      avgDemandScore: Math.round(Number(avgDemand._avg.demandScore ?? 0)),
      productsWithSuppliers: withSuppliers,
      productsWithOffers: withOffers,
      productsWithRevenue: withRevenue,
      productsWithQC: withQC,
      totalRevenue,
      avgRevenuePerProduct: totalProducts > 0 ? Math.round(totalRevenue / totalProducts) : 0,
    };
  }

  /**
   * Cross-module data for a product: linked sourcing cases and orders.
   */
  static async getCrossModuleData(productId: string): Promise<CrossModuleProductData> {
    const [sourcingCases, linkedOrders] = await Promise.all([
      // Sourcing cases that have offers for this product
      prisma.sourcingCase.findMany({
        where: { offers: { some: { productId } } },
        select: { id: true, orderId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      // Orders containing this product
      prisma.order.findMany({
        where: { items: { some: { productId } } },
        select: { id: true, orderNumber: true, status: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    return { sourcingCases, linkedOrders };
  }

  /**
   * Product revenue details (for product detail intelligence tab).
   */
  static async getProductRevenue(productId: string) {
    const agg = await prisma.orderItem.aggregate({
      where: { productId },
      _sum: { totalXAF: true, quantity: true },
      _count: { id: true },
      _avg: { unitPriceXAF: true },
    });

    return {
      totalRevenue: Number(agg._sum.totalXAF ?? 0),
      totalQty: Number(agg._sum.quantity ?? 0),
      orderCount: agg._count.id,
      avgUnitPriceXAF: Number(agg._avg.unitPriceXAF ?? 0),
    };
  }
}
