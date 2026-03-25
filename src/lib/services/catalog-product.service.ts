import { prisma } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import { buildCatalogMatchingFingerprint, normalizeCatalogText, scoreCatalogSimilarity } from "@/lib/catalog-memory";
import type { ProductStatus, Prisma } from "@prisma/client";

export class CatalogProductService {
  static async create(tenantId: string, data: {
    name: string;
    categoryId?: string;
    status?: ProductStatus;
    aliasesJson?: string[];
    searchKeywordsJson?: string[];
    matchingFingerprint?: string;
    specsJson?: Record<string, unknown>;
    weightEstimate?: number;
    volumeEstimate?: number;
    qcRecommendedLevel?: string;
    moqMin?: number;
    priceMin?: number;
    priceMax?: number;
    priceCurrency?: string;
    preferredPlatform?: string;
    preferredSupplierId?: string;
    preferredSupplierProductId?: string;
    weightedAverageCost?: number;
    estimatedCost?: number;
    lastActualCost?: number;
    recommendedSellPrice?: number;
    averageRealityCoefficient?: number;
    savingsVsIndicatifPct?: number;
    priceVolatilityPct?: number;
    defaultRiskBufferPct?: number;
    defaultHiddenMarginPct?: number;
    historicalOrderCount?: number;
    successfulOrderCount?: number;
    stableOrderCount?: number;
    catalogConfidenceScore?: number;
    isCertified?: boolean;
    certifiedAt?: string;
    lastQuotedAt?: string;
    lastPurchasedAt?: string;
    lastVerifiedAt?: string;
    lastPriceAlertAt?: string;
    shippingHints?: Record<string, unknown>;
    notes?: string;
  }) {
    const aliasList = (data.aliasesJson ?? []).map((value) => value.trim()).filter(Boolean);
    const keywordList = (data.searchKeywordsJson ?? []).map((value) => value.trim()).filter(Boolean);
    const matchingFingerprint =
      data.matchingFingerprint ||
      buildCatalogMatchingFingerprint([data.name, aliasList, keywordList]);
    const estimatedCost = data.estimatedCost ?? data.weightedAverageCost ?? data.priceMin;
    const defaultRiskBufferPct = data.defaultRiskBufferPct ?? 15;
    const defaultHiddenMarginPct = data.defaultHiddenMarginPct ?? 30;
    const recommendedSellPrice =
      data.recommendedSellPrice ??
      (estimatedCost
        ? Number(
            (
              estimatedCost *
              (1 + defaultRiskBufferPct / 100 + defaultHiddenMarginPct / 100)
            ).toFixed(2)
          )
        : undefined);
    const product = await prisma.catalogProduct.create({
      data: {
        tenantId,
        name: data.name,
        categoryId: data.categoryId,
        status: data.status || "TESTING",
        aliasesJson: aliasList,
        searchKeywordsJson: keywordList,
        matchingFingerprint,
        specsJson: data.specsJson ? JSON.parse(JSON.stringify(data.specsJson)) : undefined,
        weightEstimate: data.weightEstimate,
        volumeEstimate: data.volumeEstimate,
        qcRecommendedLevel: data.qcRecommendedLevel,
        moqMin: data.moqMin,
        priceMin: data.priceMin,
        priceMax: data.priceMax,
        priceCurrency: data.priceCurrency || "RMB",
        preferredPlatform: data.preferredPlatform,
        preferredSupplierId: data.preferredSupplierId,
        preferredSupplierProductId: data.preferredSupplierProductId,
        weightedAverageCost: data.weightedAverageCost,
        estimatedCost,
        lastActualCost: data.lastActualCost,
        recommendedSellPrice,
        averageRealityCoefficient: data.averageRealityCoefficient,
        savingsVsIndicatifPct: data.savingsVsIndicatifPct,
        priceVolatilityPct: data.priceVolatilityPct,
        defaultRiskBufferPct: data.defaultRiskBufferPct,
        defaultHiddenMarginPct: data.defaultHiddenMarginPct,
        historicalOrderCount: data.historicalOrderCount,
        successfulOrderCount: data.successfulOrderCount,
        stableOrderCount: data.stableOrderCount,
        catalogConfidenceScore: data.catalogConfidenceScore,
        isCertified: data.isCertified,
        certifiedAt: data.certifiedAt ? new Date(data.certifiedAt) : undefined,
        lastQuotedAt: data.lastQuotedAt ? new Date(data.lastQuotedAt) : undefined,
        lastPurchasedAt: data.lastPurchasedAt ? new Date(data.lastPurchasedAt) : undefined,
        lastVerifiedAt: data.lastVerifiedAt ? new Date(data.lastVerifiedAt) : undefined,
        lastPriceAlertAt: data.lastPriceAlertAt ? new Date(data.lastPriceAlertAt) : undefined,
        shippingHints: data.shippingHints ? JSON.parse(JSON.stringify(data.shippingHints)) : undefined,
        notes: data.notes,
      },
      include: { category: true },
    });

    await emitEvent("catalog_product_created", "product", product.id, {
      name: product.name, status: product.status,
    });

    return product;
  }

  static async update(productId: string, data: Partial<{
    name: string;
    categoryId: string;
    status: ProductStatus;
    aliasesJson: string[];
    searchKeywordsJson: string[];
    matchingFingerprint: string;
    specsJson: Record<string, unknown>;
    weightEstimate: number;
    volumeEstimate: number;
    qcRecommendedLevel: string;
    moqMin: number;
    priceMin: number;
    priceMax: number;
    priceCurrency: string;
    preferredPlatform: string;
    preferredSupplierId: string;
    preferredSupplierProductId: string;
    weightedAverageCost: number;
    estimatedCost: number;
    lastActualCost: number;
    recommendedSellPrice: number;
    averageRealityCoefficient: number;
    savingsVsIndicatifPct: number;
    priceVolatilityPct: number;
    defaultRiskBufferPct: number;
    defaultHiddenMarginPct: number;
    historicalOrderCount: number;
    successfulOrderCount: number;
    stableOrderCount: number;
    catalogConfidenceScore: number;
    isCertified: boolean;
    certifiedAt: string;
    lastQuotedAt: string;
    lastPurchasedAt: string;
    lastVerifiedAt: string;
    lastPriceAlertAt: string;
    shippingHints: Record<string, unknown>;
    marketingPack: Record<string, unknown>;
    notes: string;
  }>) {
    const updateData: Record<string, unknown> = { ...data };
    if (data.aliasesJson) updateData.aliasesJson = data.aliasesJson.map((value) => value.trim()).filter(Boolean);
    if (data.searchKeywordsJson) updateData.searchKeywordsJson = data.searchKeywordsJson.map((value) => value.trim()).filter(Boolean);
    if (data.name || data.aliasesJson || data.searchKeywordsJson || data.matchingFingerprint !== undefined) {
      const existing = await prisma.catalogProduct.findUnique({
        where: { id: productId },
        select: { name: true, aliasesJson: true, searchKeywordsJson: true },
      });
      const aliasList = ((updateData.aliasesJson as string[]) ??
        ((existing?.aliasesJson as string[] | null) ?? []))
        .map((value) => value.trim())
        .filter(Boolean);
      const keywordList = ((updateData.searchKeywordsJson as string[]) ??
        ((existing?.searchKeywordsJson as string[] | null) ?? []))
        .map((value) => value.trim())
        .filter(Boolean);
      updateData.matchingFingerprint =
        data.matchingFingerprint ||
        buildCatalogMatchingFingerprint([
          (data.name as string | undefined) ?? existing?.name ?? "",
          aliasList,
          keywordList,
        ]);
    }
    if (
      data.recommendedSellPrice === undefined &&
      (data.estimatedCost !== undefined ||
        data.weightedAverageCost !== undefined ||
        data.defaultRiskBufferPct !== undefined ||
        data.defaultHiddenMarginPct !== undefined)
    ) {
      const existingPricing = await prisma.catalogProduct.findUnique({
        where: { id: productId },
        select: {
          estimatedCost: true,
          weightedAverageCost: true,
          defaultRiskBufferPct: true,
          defaultHiddenMarginPct: true,
        },
      });
      const baseCost =
        data.estimatedCost ??
        data.weightedAverageCost ??
        (existingPricing?.estimatedCost != null
          ? Number(existingPricing.estimatedCost)
          : existingPricing?.weightedAverageCost != null
            ? Number(existingPricing.weightedAverageCost)
            : undefined);
      const bufferPct =
        data.defaultRiskBufferPct ??
        (existingPricing?.defaultRiskBufferPct != null
          ? Number(existingPricing.defaultRiskBufferPct)
          : 15);
      const marginPct =
        data.defaultHiddenMarginPct ??
        (existingPricing?.defaultHiddenMarginPct != null
          ? Number(existingPricing.defaultHiddenMarginPct)
          : 30);
      if (baseCost && baseCost > 0) {
        updateData.recommendedSellPrice = Number(
          (baseCost * (1 + bufferPct / 100 + marginPct / 100)).toFixed(2)
        );
      }
    }
    if (data.specsJson) updateData.specsJson = JSON.parse(JSON.stringify(data.specsJson));
    if (data.shippingHints) updateData.shippingHints = JSON.parse(JSON.stringify(data.shippingHints));
    if (data.marketingPack) updateData.marketingPack = JSON.parse(JSON.stringify(data.marketingPack));
    if (data.certifiedAt !== undefined) updateData.certifiedAt = data.certifiedAt ? new Date(data.certifiedAt) : null;
    if (data.lastQuotedAt !== undefined) updateData.lastQuotedAt = data.lastQuotedAt ? new Date(data.lastQuotedAt) : null;
    if (data.lastPurchasedAt !== undefined) updateData.lastPurchasedAt = data.lastPurchasedAt ? new Date(data.lastPurchasedAt) : null;
    if (data.lastVerifiedAt !== undefined) updateData.lastVerifiedAt = data.lastVerifiedAt ? new Date(data.lastVerifiedAt) : null;
    if (data.lastPriceAlertAt !== undefined) updateData.lastPriceAlertAt = data.lastPriceAlertAt ? new Date(data.lastPriceAlertAt) : null;

    return prisma.catalogProduct.update({
      where: { id: productId },
      data: updateData as Prisma.CatalogProductUpdateInput,
      include: { category: true },
    });
  }

  static async list(tenantId: string, options: {
    status?: ProductStatus;
    categoryId?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const { status, categoryId, search, page = 1, limit = 20 } = options;

    const where: Prisma.CatalogProductWhereInput = {
      tenantId,
      ...(status && { status }),
      ...(categoryId && { categoryId }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { notes: { contains: search, mode: "insensitive" as const } },
          { matchingFingerprint: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    const [products, total] = await Promise.all([
      prisma.catalogProduct.findMany({
        where,
        include: {
          category: true,
          _count: { select: { supplierProducts: true, orderItems: true, qcReports: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.catalogProduct.count({ where }),
    ]);

    return { products, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  static async getById(productId: string) {
    return prisma.catalogProduct.findUnique({
      where: { id: productId },
      include: {
        category: true,
        supplierProducts: {
          include: { supplier: true },
          orderBy: { isPrimary: "desc" },
        },
        offers: {
          include: { supplier: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        qcReports: {
          include: { qcRequest: { select: { type: true, orderId: true } } },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        media: { orderBy: { createdAt: "desc" } },
        orderItems: {
          include: { order: { select: { id: true, orderNumber: true, status: true, createdAt: true } } },
          orderBy: { order: { createdAt: "desc" } },
          take: 10,
        },
        _count: { select: { supplierProducts: true, orderItems: true, qcReports: true, offers: true, media: true } },
      },
    });
  }

  static async getStatusCounts(tenantId: string) {
    const counts = await prisma.catalogProduct.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: { id: true },
    });
    return counts.reduce(
      (acc, item) => ({ ...acc, [item.status]: item._count.id }),
      {} as Record<string, number>
    );
  }

  static async getTopByDemand(tenantId: string, limit = 5) {
    return prisma.catalogProduct.findMany({
      where: { tenantId, status: { in: ["CURATED", "TESTED"] } },
      orderBy: { demandScore: "desc" },
      take: limit,
      include: { category: true },
    });
  }

  static async getCategoryStats(tenantId: string) {
    return prisma.catalogProduct.groupBy({
      by: ["categoryId"],
      where: { tenantId },
      _count: { id: true },
    });
  }

  static async getCategoryMemoryHint(
    tenantId: string,
    options: { categoryName?: string | null; categoryId?: string | null }
  ) {
    const category = await prisma.productCategory.findFirst({
      where: {
        tenantId,
        ...(options.categoryId
          ? { id: options.categoryId }
          : options.categoryName
            ? { name: { equals: options.categoryName, mode: "insensitive" } }
            : { id: "__none__" }),
      },
      select: {
        id: true,
        name: true,
        averageRealityCoefficient: true,
        averageDensityRatio: true,
        averageBufferedWeightKg: true,
        historicalSampleCount: true,
        lastMemoryUpdatedAt: true,
      },
    });

    if (!category) return null;

    return {
      id: category.id,
      name: category.name,
      averageRealityCoefficient:
        category.averageRealityCoefficient != null ? Number(category.averageRealityCoefficient) : null,
      averageDensityRatio: category.averageDensityRatio != null ? Number(category.averageDensityRatio) : null,
      averageBufferedWeightKg:
        category.averageBufferedWeightKg != null ? Number(category.averageBufferedWeightKg) : null,
      historicalSampleCount: category.historicalSampleCount,
      lastMemoryUpdatedAt: category.lastMemoryUpdatedAt,
    };
  }

  static async searchMemoryMatches(
    tenantId: string,
    options: {
      query: string;
      categoryName?: string;
      weightKg?: number;
      limit?: number;
    }
  ) {
    const limit = Math.max(1, Math.min(8, options.limit ?? 5));
    const normalizedQuery = normalizeCatalogText(options.query);
    const queryTokens = normalizedQuery.split(" ").filter(Boolean);
    if (queryTokens.length === 0) return [];

    const candidates = await prisma.catalogProduct.findMany({
      where: {
        tenantId,
        status: { not: "BLACKLIST" },
        OR: [
          { name: { contains: options.query, mode: "insensitive" } },
          { matchingFingerprint: { contains: normalizedQuery, mode: "insensitive" } },
          ...queryTokens.map((token) => ({ matchingFingerprint: { contains: token, mode: "insensitive" as const } })),
        ],
      },
      select: {
        id: true,
        name: true,
        aliasesJson: true,
        searchKeywordsJson: true,
        priceCurrency: true,
        preferredPlatform: true,
        priceMin: true,
        priceMax: true,
        weightedAverageCost: true,
        estimatedCost: true,
        lastActualCost: true,
        recommendedSellPrice: true,
        averageRealityCoefficient: true,
        savingsVsIndicatifPct: true,
        defaultRiskBufferPct: true,
        defaultHiddenMarginPct: true,
        averageLeadTime: true,
        weightEstimate: true,
        historicalOrderCount: true,
        successfulOrderCount: true,
        catalogConfidenceScore: true,
        isCertified: true,
        category: { select: { name: true } },
        supplierProducts: {
          where: { isPrimary: true },
          take: 1,
          select: {
            supplierId: true,
            supplier: { select: { name: true } },
          },
        },
      },
      take: 40,
      orderBy: [
        { isCertified: "desc" },
        { catalogConfidenceScore: "desc" },
        { demandScore: "desc" },
        { updatedAt: "desc" },
      ],
    });

    return candidates
      .map((candidate) => {
        const aliases = Array.isArray(candidate.aliasesJson) ? candidate.aliasesJson.map(String) : [];
        const keywords = Array.isArray(candidate.searchKeywordsJson)
          ? candidate.searchKeywordsJson.map(String)
          : [];
        const score = scoreCatalogSimilarity({
          query: options.query,
          candidateName: candidate.name,
          candidateAliases: aliases,
          candidateKeywords: keywords,
          categoryName: candidate.category?.name || null,
          requestedCategory: options.categoryName || null,
          candidateWeightKg: candidate.weightEstimate ? Number(candidate.weightEstimate) : null,
          requestedWeightKg: options.weightKg ?? null,
        });

        return {
          id: candidate.id,
          name: candidate.name,
          score,
          categoryName: candidate.category?.name || null,
          priceCurrency: candidate.priceCurrency,
          preferredPlatform: candidate.preferredPlatform,
          priceMin: candidate.priceMin != null ? Number(candidate.priceMin) : null,
          priceMax: candidate.priceMax != null ? Number(candidate.priceMax) : null,
          weightedAverageCost: candidate.weightedAverageCost != null ? Number(candidate.weightedAverageCost) : null,
          estimatedCost: candidate.estimatedCost != null ? Number(candidate.estimatedCost) : null,
          lastActualCost: candidate.lastActualCost != null ? Number(candidate.lastActualCost) : null,
          recommendedSellPrice:
            candidate.recommendedSellPrice != null ? Number(candidate.recommendedSellPrice) : null,
          averageRealityCoefficient:
            candidate.averageRealityCoefficient != null ? Number(candidate.averageRealityCoefficient) : null,
          savingsVsIndicatifPct:
            candidate.savingsVsIndicatifPct != null ? Number(candidate.savingsVsIndicatifPct) : null,
          defaultRiskBufferPct:
            candidate.defaultRiskBufferPct != null ? Number(candidate.defaultRiskBufferPct) : null,
          defaultHiddenMarginPct:
            candidate.defaultHiddenMarginPct != null ? Number(candidate.defaultHiddenMarginPct) : null,
          averageLeadTime: candidate.averageLeadTime,
          weightEstimate: candidate.weightEstimate != null ? Number(candidate.weightEstimate) : null,
          historicalOrderCount: candidate.historicalOrderCount,
          successfulOrderCount: candidate.successfulOrderCount,
          catalogConfidenceScore: candidate.catalogConfidenceScore,
          isCertified: candidate.isCertified,
          aliases,
          keywords,
          primarySupplierId: candidate.supplierProducts[0]?.supplierId ?? null,
          primarySupplierName: candidate.supplierProducts[0]?.supplier?.name ?? null,
        };
      })
      .filter((candidate) => candidate.score >= 45)
      .sort((a, b) => b.score - a.score || b.catalogConfidenceScore - a.catalogConfidenceScore)
      .slice(0, limit);
  }
}
