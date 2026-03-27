import { prisma } from "@/lib/db";
import type {
  CatalogDashboardProjection,
  CatalogMetricProvenance,
  CatalogProductProvenanceProjection,
  CatalogPriorityAction,
} from "@/lib/catalog/types";
import { CatalogIntelligenceService } from "@/lib/services/catalog-intelligence.service";

function formatPercent(value: number | null | undefined, digits = 1) {
  if (value == null || Number.isNaN(value)) return "-";
  return `${value.toFixed(digits)}%`;
}

function formatMoney(value: number | null | undefined, currency = "RMB") {
  if (value == null || Number.isNaN(value)) return "-";
  return `${value.toFixed(2)} ${currency}`;
}

function buildPriorityActions(input: {
  hotLowConfidenceProducts: number;
  weakLogisticsMemoryProducts: number;
  priceSpreadAlerts: number;
  riskySupplierProducts: number;
}): CatalogPriorityAction[] {
  const actions: CatalogPriorityAction[] = [];

  if (input.hotLowConfidenceProducts > 0) {
    actions.push({
      id: "hot_low_confidence_products",
      title: "Curer les produits chauds a faible confiance",
      description: `${input.hotLowConfidenceProducts} produit(s) ont une forte traction mais une memoire encore trop faible pour etre quotes sereinement.`,
      severity: "critical",
      href: "/catalog/products",
      count: input.hotLowConfidenceProducts,
    });
  }

  if (input.weakLogisticsMemoryProducts > 0) {
    actions.push({
      id: "weak_logistics_memory",
      title: "Renforcer la memoire logistique produit",
      description: `${input.weakLogisticsMemoryProducts} produit(s) manquent encore de poids/volume reels ou d'echantillons terrain solides.`,
      severity: "warning",
      href: "/catalog/products",
      count: input.weakLogisticsMemoryProducts,
    });
  }

  if (input.priceSpreadAlerts > 0) {
    actions.push({
      id: "price_spread_alerts",
      title: "Negocier les produits a spread eleve",
      description: `${input.priceSpreadAlerts} produit(s) montrent un spread fournisseur suffisamment large pour justifier une action sourcing ciblee.`,
      severity: "warning",
      href: "/catalog/analytics",
      count: input.priceSpreadAlerts,
    });
  }

  if (input.riskySupplierProducts > 0) {
    actions.push({
      id: "risky_supplier_products",
      title: "Revoir les dependances fournisseurs fragiles",
      description: `${input.riskySupplierProducts} produit(s) importants restent relies a des fournisseurs trop faibles ou suspendus.`,
      severity: "critical",
      href: "/catalog/suppliers",
      count: input.riskySupplierProducts,
    });
  }

  return actions;
}

export class CatalogDashboardProjectionService {
  static async get(tenantId: string): Promise<CatalogDashboardProjection> {
    const [hotProducts, priceSpread] = await Promise.all([
      prisma.catalogProduct.findMany({
        where: {
          tenantId,
          status: { not: "BLACKLIST" },
        },
        orderBy: [{ demandScore: "desc" }, { updatedAt: "desc" }],
        take: 60,
        select: {
          id: true,
          demandScore: true,
          catalogConfidenceScore: true,
          samplesCount: true,
          avgActualWeightKg: true,
          avgVolumetricKg: true,
          supplierProducts: {
            where: { isPrimary: true },
            take: 3,
            select: {
              supplier: {
                select: {
                  status: true,
                  rating: true,
                },
              },
            },
          },
        },
      }),
      CatalogIntelligenceService.getPriceSpread(tenantId, 12),
    ]);

    const hotLowConfidenceProducts = hotProducts.filter(
      (product) => product.demandScore >= 70 && (product.catalogConfidenceScore ?? 0) < 60
    ).length;

    const weakLogisticsMemoryProducts = hotProducts.filter((product) => {
      const hotEnough = product.demandScore >= 60;
      const missingObservedWeight = product.avgActualWeightKg == null || product.avgVolumetricKg == null;
      const weakSamples = (product.samplesCount ?? 0) < 2;
      return hotEnough && (missingObservedWeight || weakSamples);
    }).length;

    const riskySupplierProducts = hotProducts.filter((product) =>
      product.supplierProducts.some((item) => {
        const rating = Number(item.supplier.rating || 0);
        return item.supplier.status !== "ACTIVE" || rating < 45;
      })
    ).length;

    const priceSpreadAlerts = priceSpread.filter((item) => item.spread >= 25).length;

    return {
      positioning: {
        title: "Catalogue = memoire d'approvisionnement",
        description:
          "Le Catalog OS sert a memoriser ce que le terrain nous apprend sur les produits et fournisseurs, pas a jouer le role d'un stock vivant.",
        disclaimer:
          "Les couts, poids et scores affiches ici melangent volontairement 4 natures de donnees : saisie manuelle, observation terrain, calcul memory et recommandation Horion.",
      },
      counters: {
        hotLowConfidenceProducts,
        weakLogisticsMemoryProducts,
        priceSpreadAlerts,
        riskySupplierProducts,
      },
      priorityActions: buildPriorityActions({
        hotLowConfidenceProducts,
        weakLogisticsMemoryProducts,
        priceSpreadAlerts,
        riskySupplierProducts,
      }),
    };
  }

  static async getProductProvenance(
    tenantId: string,
    productId: string
  ): Promise<CatalogProductProvenanceProjection | null> {
    const product = await prisma.catalogProduct.findFirst({
      where: { id: productId, tenantId },
      select: {
        id: true,
        priceCurrency: true,
        defaultRiskBufferPct: true,
        defaultHiddenMarginPct: true,
        weightEstimate: true,
        volumeEstimate: true,
        weightedAverageCost: true,
        estimatedCost: true,
        lastActualCost: true,
        recommendedSellPrice: true,
        averageRealityCoefficient: true,
        savingsVsIndicatifPct: true,
        priceVolatilityPct: true,
        avgActualWeightKg: true,
        avgVolumetricKg: true,
        historicalOrderCount: true,
        successfulOrderCount: true,
        samplesCount: true,
        catalogConfidenceScore: true,
        isCertified: true,
      },
    });

    if (!product) return null;

    const currency = product.priceCurrency || "RMB";
    const samples = product.samplesCount ?? 0;
    const orders = product.historicalOrderCount ?? 0;
    const success = product.successfulOrderCount ?? 0;

    const items: CatalogMetricProvenance[] = [
      {
        key: "defaultRiskBufferPct",
        label: "Buffer risque",
        category: "manual",
        value: formatPercent(product.defaultRiskBufferPct != null ? Number(product.defaultRiskBufferPct) : null),
        provenance: "Parametre metier saisi a la main et utilise pour cadrer le pricing recommande.",
      },
      {
        key: "defaultHiddenMarginPct",
        label: "Marge cachee",
        category: "manual",
        value: formatPercent(product.defaultHiddenMarginPct != null ? Number(product.defaultHiddenMarginPct) : null),
        provenance: "Parametre commercial interne conserve comme choix Horion, pas comme observation terrain.",
      },
      {
        key: "weightedAverageCost",
        label: "Cout moyen pondere",
        category: "observed",
        value: formatMoney(product.weightedAverageCost != null ? Number(product.weightedAverageCost) : null, currency),
        provenance: `${samples} echantillon(s) sourcing/livraison consolides dans la memoire catalogue.`,
      },
      {
        key: "estimatedCost",
        label: "Cout estime maison",
        category: "computed",
        value: formatMoney(product.estimatedCost != null ? Number(product.estimatedCost) : null, currency),
        provenance: "Calcule a partir de la memoire historique disponible; sert de base de travail tant qu'un nouveau reel n'est pas observe.",
      },
      {
        key: "recommendedSellPrice",
        label: "Prix Horion recommande",
        category: "recommended",
        value: formatMoney(product.recommendedSellPrice != null ? Number(product.recommendedSellPrice) : null, currency),
        provenance: "Formule derivee du cout estime + buffer risque + marge cachee du produit.",
      },
      {
        key: "avgActualWeightKg",
        label: "Poids reel moyen",
        category: "observed",
        value:
          product.avgActualWeightKg != null
            ? `${Number(product.avgActualWeightKg).toFixed(3)} kg`
            : "-",
        provenance: `${samples} observation(s) terrain issues des receptions entrepot / livraisons capitalisees.`,
      },
      {
        key: "avgVolumetricKg",
        label: "Poids volumetrique moyen",
        category: "observed",
        value:
          product.avgVolumetricKg != null
            ? `${Number(product.avgVolumetricKg).toFixed(3)} kg`
            : "-",
        provenance: "Observation logistique consolidee pour mieux anticiper le chargeable weight futur.",
      },
      {
        key: "averageRealityCoefficient",
        label: "Coefficient de realite",
        category: "computed",
        value:
          product.averageRealityCoefficient != null
            ? Number(product.averageRealityCoefficient).toFixed(2)
            : "-",
        provenance: "Rapport moyen entre l'indicatif amont et le reel aval observe sur les cas passes.",
      },
      {
        key: "priceVolatilityPct",
        label: "Volatilite prix",
        category: "computed",
        value: formatPercent(product.priceVolatilityPct != null ? Number(product.priceVolatilityPct) : null),
        provenance: "Mesure statistique derivee des variations de couts reels dans l'historique.",
      },
      {
        key: "catalogConfidenceScore",
        label: "Score de confiance",
        category: "computed",
        value: `${product.catalogConfidenceScore ?? 0}/100`,
        provenance: `${orders} commande(s) historiques, ${success} succes, ${samples} echantillon(s) et la volatilite globale. ${product.isCertified ? "Produit certifie." : "Produit non certifie."}`,
      },
    ];

    return { items };
  }
}
