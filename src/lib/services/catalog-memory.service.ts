import { prisma } from "@/lib/db";

const DEFAULT_BUFFER_PCT = 15;
const DEFAULT_HIDDEN_MARGIN_PCT = 30;

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function avg(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stddev(values: number[]) {
  if (values.length <= 1) return 0;
  const mean = avg(values);
  const variance = avg(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function computeVolatilityPct(values: number[]) {
  if (values.length <= 1) return 0;
  const mean = avg(values);
  if (mean === 0) return 0;
  return (stddev(values) / mean) * 100;
}

function computeConfidenceScore(params: {
  historicalOrderCount: number;
  successfulOrderCount: number;
  priceVolatilityPct: number;
  averageRealityCoefficient: number;
  isCertified: boolean;
}) {
  let score = 0;
  score += Math.min(35, params.historicalOrderCount * 7);
  score += Math.min(25, params.successfulOrderCount * 8);
  score += Math.max(0, 20 - Math.round(params.priceVolatilityPct));
  score += params.averageRealityCoefficient > 0 ? Math.min(10, Math.round(params.averageRealityCoefficient * 10)) : 0;
  score += params.isCertified ? 10 : 0;
  return Math.max(0, Math.min(100, score));
}

function normalizeQuoteSnapshotItems(pricingSnapshot: unknown) {
  if (!pricingSnapshot || typeof pricingSnapshot !== "object") return [];
  const snapshot = pricingSnapshot as Record<string, unknown>;
  return Array.isArray(snapshot.items) ? (snapshot.items as Array<Record<string, unknown>>) : [];
}

export class CatalogMemoryService {
  static async recordDeliveredOrder(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        tenantId: true,
        createdAt: true,
        actualDelivery: true,
        qcRequests: {
          orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
          take: 1,
          select: { status: true },
        },
        quotes: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { pricingSnapshot: true },
        },
        items: {
          select: {
            id: true,
            productId: true,
            supplierId: true,
            description: true,
            quantity: true,
            unitPrice: true,
            currency: true,
            unitPriceXAF: true,
            weight: true,
            volume: true,
          },
        },
      },
    });

    if (!order) return;

    const quoteItems = normalizeQuoteSnapshotItems(order.quotes[0]?.pricingSnapshot);
    const leadTimeDays =
      order.actualDelivery && order.createdAt
        ? Math.max(
            0,
            Math.round(
              (new Date(order.actualDelivery).getTime() - new Date(order.createdAt).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          )
        : null;
    const qualityOutcome = order.qcRequests[0]?.status ?? null;

    for (const item of order.items) {
      if (!item.productId) continue;

      const existing = await prisma.catalogSourcingHistory.findFirst({
        where: {
          tenantId: order.tenantId,
          orderId: order.id,
          orderItemId: item.id,
        },
        select: { id: true },
      });
      if (existing) continue;

      const matchingQuoteItem =
        quoteItems.find((quoteItem) => String(quoteItem.catalogProductId || "") === item.productId) ||
        quoteItems.find(
          (quoteItem) =>
            String(quoteItem.description || "").trim().toLowerCase() ===
            item.description.trim().toLowerCase()
        );

      const quotedUnitPrice =
        matchingQuoteItem?.platformUnitPriceRmb != null
          ? Number(matchingQuoteItem.platformUnitPriceRmb)
          : null;
      const quotedCurrency =
        quotedUnitPrice != null
          ? String(matchingQuoteItem?.priceCurrency || matchingQuoteItem?.currency || "RMB")
          : null;
      const quotedSellPriceXAF =
        matchingQuoteItem?.productSellXAF != null
          ? round(Number(matchingQuoteItem.productSellXAF) / Math.max(1, item.quantity))
          : null;
      const actualUnitPrice = Number(item.unitPrice || 0);
      const actualWeightKg = item.weight != null ? Number(item.weight) : null;
      const actualVolumeCbm = item.volume != null ? Number(item.volume) : null;
      const volumetricWeightKg =
        actualVolumeCbm != null && actualVolumeCbm > 0 ? round((actualVolumeCbm * 1_000_000) / 6000, 3) : null;
      const chargeableWeightKg =
        actualWeightKg != null
          ? Math.ceil(Math.max(actualWeightKg, volumetricWeightKg ?? 0))
          : volumetricWeightKg != null
            ? Math.ceil(volumetricWeightKg)
            : null;
      const sameCurrency = quotedCurrency && quotedCurrency === item.currency;
      const realityCoefficient =
        quotedUnitPrice && quotedUnitPrice > 0 && sameCurrency
          ? round(actualUnitPrice / quotedUnitPrice, 4)
          : null;
      const savingsVsIndicatifPct =
        quotedUnitPrice && quotedUnitPrice > 0 && sameCurrency
          ? round(((quotedUnitPrice - actualUnitPrice) / quotedUnitPrice) * 100, 2)
          : null;

      await prisma.catalogSourcingHistory.create({
        data: {
          tenantId: order.tenantId,
          productId: item.productId,
          supplierId: item.supplierId ?? undefined,
          orderId: order.id,
          orderItemId: item.id,
          sourceType: "DELIVERY_FEEDBACK",
          sourcePlatform:
            matchingQuoteItem?.platform != null ? String(matchingQuoteItem.platform) : undefined,
          quotedUnitPrice: quotedUnitPrice ?? undefined,
          quotedCurrency: quotedCurrency ?? undefined,
          actualUnitPrice,
          actualCurrency: item.currency,
          actualUnitPriceXAF: Number(item.unitPriceXAF || 0),
          quotedSellPriceXAF: quotedSellPriceXAF ?? undefined,
          quantity: item.quantity,
          realityCoefficient: realityCoefficient ?? undefined,
          savingsVsIndicatifPct: savingsVsIndicatifPct ?? undefined,
          actualWeightKg: actualWeightKg ?? undefined,
          actualVolumeCbm: actualVolumeCbm ?? undefined,
          volumetricWeightKg: volumetricWeightKg ?? undefined,
          chargeableWeightKg: chargeableWeightKg ?? undefined,
          leadTimeDays: leadTimeDays ?? undefined,
          qualityOutcome: qualityOutcome ?? undefined,
          deliveryOutcome: "DELIVERED",
          wasSuccessful: true,
          notes: `Auto-enregistre depuis la livraison de ${order.id}`,
        },
      });

      await this.refreshProductMemory(order.tenantId, item.productId);
    }
  }

  static async refreshProductMemory(tenantId: string, productId: string) {
    const [product, history] = await Promise.all([
      prisma.catalogProduct.findFirst({
        where: { id: productId, tenantId },
        select: {
          id: true,
          categoryId: true,
          priceCurrency: true,
          defaultRiskBufferPct: true,
          defaultHiddenMarginPct: true,
          certifiedAt: true,
          weightEstimate: true,
          volumeEstimate: true,
        },
      }),
      prisma.catalogSourcingHistory.findMany({
        where: { tenantId, productId },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    if (!product || history.length === 0) return;

    const successful = history.filter((row) => row.wasSuccessful);
    const latest = successful[0] ?? history[0];
    const targetCurrency = latest.actualCurrency || product.priceCurrency || "RMB";
    const currencyRows = successful.filter((row) => (row.actualCurrency || targetCurrency) === targetCurrency);
    const actualPrices = currencyRows
      .map((row) => Number(row.actualUnitPrice || 0))
      .filter((value) => value > 0);
    const weightedBase = currencyRows.reduce(
      (acc, row) => {
        const price = Number(row.actualUnitPrice || 0);
        const quantity = Math.max(1, row.quantity || 1);
        if (price <= 0) return acc;
        acc.total += price * quantity;
        acc.quantity += quantity;
        return acc;
      },
      { total: 0, quantity: 0 }
    );

    const weightedAverageCost =
      weightedBase.quantity > 0 ? round(weightedBase.total / weightedBase.quantity, 2) : null;
    const averageRealityCoefficient = round(
      avg(
        successful
          .map((row) => (row.realityCoefficient != null ? Number(row.realityCoefficient) : 0))
          .filter((value) => value > 0)
      ),
      4
    );
    const avgSavingsPct = round(
      avg(
        successful
          .map((row) => (row.savingsVsIndicatifPct != null ? Number(row.savingsVsIndicatifPct) : 0))
          .filter((value) => Number.isFinite(value))
      ),
      2
    );
    const priceVolatilityPct = round(computeVolatilityPct(actualPrices), 2);
    const successfulOrderCount = successful.length;
    const historicalOrderCount = history.length;
    const stableOrderCount = successful.filter(
      (row) => row.actualUnitPrice != null && Number(row.actualUnitPrice) > 0
    ).length;
    const isCertified = successfulOrderCount >= 3 && priceVolatilityPct <= 12;
    const defaultRiskBufferPct = Number(product.defaultRiskBufferPct || DEFAULT_BUFFER_PCT);
    const defaultHiddenMarginPct = Number(product.defaultHiddenMarginPct || DEFAULT_HIDDEN_MARGIN_PCT);
    const baseCostForSell = weightedAverageCost ?? Number(latest.actualUnitPrice || 0);
    const recommendedSellPrice =
      baseCostForSell > 0
        ? round(
            baseCostForSell *
              (1 + defaultRiskBufferPct / 100 + defaultHiddenMarginPct / 100),
            2
          )
        : null;
    const priceAlertTriggered =
      weightedAverageCost != null &&
      latest.actualUnitPrice != null &&
      Number(latest.actualUnitPrice) > weightedAverageCost * 1.2;
    const supplierFrequency = new Map<string, number>();
    for (const row of successful) {
      if (!row.supplierId) continue;
      supplierFrequency.set(row.supplierId, (supplierFrequency.get(row.supplierId) || 0) + row.quantity);
    }
    const preferredSupplierId = Array.from(supplierFrequency.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const confidenceScore = computeConfidenceScore({
      historicalOrderCount,
      successfulOrderCount,
      priceVolatilityPct,
      averageRealityCoefficient,
      isCertified,
    });
    const weightSamples = successful
      .map((row) => (row.actualWeightKg != null ? Number(row.actualWeightKg) : 0))
      .filter((value) => value > 0);
    const volumeSamples = successful
      .map((row) => (row.actualVolumeCbm != null ? Number(row.actualVolumeCbm) : 0))
      .filter((value) => value > 0);
    const averageWeightEstimate = weightSamples.length > 0 ? round(avg(weightSamples), 2) : null;
    const averageVolumeEstimate = volumeSamples.length > 0 ? round(avg(volumeSamples), 4) : null;

    await prisma.catalogProduct.update({
      where: { id: productId },
      data: {
        priceCurrency: targetCurrency,
        weightedAverageCost: weightedAverageCost ?? undefined,
        estimatedCost: weightedAverageCost ?? undefined,
        lastActualCost: latest.actualUnitPrice != null ? Number(latest.actualUnitPrice) : undefined,
        recommendedSellPrice: recommendedSellPrice ?? undefined,
        averageRealityCoefficient: averageRealityCoefficient || undefined,
        savingsVsIndicatifPct: avgSavingsPct || undefined,
        priceVolatilityPct: priceVolatilityPct || undefined,
        historicalOrderCount,
        successfulOrderCount,
        stableOrderCount,
        catalogConfidenceScore: confidenceScore,
        isCertified,
        weightEstimate: averageWeightEstimate ?? product.weightEstimate ?? undefined,
        volumeEstimate: averageVolumeEstimate ?? product.volumeEstimate ?? undefined,
        certifiedAt: isCertified && !product.certifiedAt ? new Date() : undefined,
        lastOrderedAt: latest.createdAt,
        lastPurchasedAt: latest.createdAt,
        lastVerifiedAt: latest.createdAt,
        lastPriceAlertAt: priceAlertTriggered ? new Date() : undefined,
        preferredPlatform: latest.sourcePlatform ?? undefined,
        preferredSupplierId: preferredSupplierId ?? undefined,
      },
    });

    if (product.categoryId) {
      await this.refreshCategoryMemory(tenantId, product.categoryId);
    }
  }

  static async refreshCategoryMemory(tenantId: string, categoryId: string) {
    const products = await prisma.catalogProduct.findMany({
      where: { tenantId, categoryId },
      select: {
        id: true,
        averageRealityCoefficient: true,
        weightEstimate: true,
        volumeEstimate: true,
        historicalOrderCount: true,
      },
    });

    if (products.length === 0) return;

    const realityCoefficients = products
      .map((product) =>
        product.averageRealityCoefficient != null ? Number(product.averageRealityCoefficient) : 0
      )
      .filter((value) => value > 0);
    const densityRatios = products
      .map((product) => {
        const weight = product.weightEstimate != null ? Number(product.weightEstimate) : 0;
        const volume = product.volumeEstimate != null ? Number(product.volumeEstimate) : 0;
        return weight > 0 && volume > 0 ? weight / volume : 0;
      })
      .filter((value) => value > 0);
    const bufferedWeights = products
      .map((product) => (product.weightEstimate != null ? Number(product.weightEstimate) * 1.1 : 0))
      .filter((value) => value > 0);
    const historicalSampleCount = products.reduce(
      (sum, product) => sum + Math.max(0, product.historicalOrderCount || 0),
      0
    );

    await prisma.productCategory.update({
      where: { id: categoryId },
      data: {
        averageRealityCoefficient:
          realityCoefficients.length > 0 ? round(avg(realityCoefficients), 4) : undefined,
        averageDensityRatio: densityRatios.length > 0 ? round(avg(densityRatios), 4) : undefined,
        averageBufferedWeightKg:
          bufferedWeights.length > 0 ? round(avg(bufferedWeights), 2) : undefined,
        historicalSampleCount,
        lastMemoryUpdatedAt: new Date(),
      },
    });
  }
}
