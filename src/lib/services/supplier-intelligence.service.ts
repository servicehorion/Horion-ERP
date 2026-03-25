import { prisma } from "@/lib/db";
import type { SupplierSegment } from "@prisma/client";

export class SupplierIntelligenceService {
  /**
   * Calculate and update all financial metrics for a supplier
   */
  static async calculateFinancialMetrics(supplierId: string) {
    // Get all OrderItems for this supplier with their orders
    const orderItems = await prisma.orderItem.findMany({
      where: { supplierId },
      include: {
        order: {
          select: {
            id: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    // Unique completed order IDs
    const completedOrderIds = [
      ...new Set(
        orderItems
          .filter((item) => ["LIVRE", "CLOTURE"].includes(item.order.status))
          .map((item) => item.order.id)
      ),
    ];

    // Lifetime spend: sum of order items totalXAF for completed orders
    const lifetimeSpend = orderItems
      .filter((item) => completedOrderIds.includes(item.order.id))
      .reduce((sum, item) => sum + Number(item.totalXAF), 0);

    // Get supplier payments - allocate proportionally when order has multiple suppliers
    const payments = await prisma.payment.findMany({
      where: {
        type: "SUPPLIER_PAYMENT",
        status: "CONFIRMED",
        order: {
          items: { some: { supplierId } },
        },
      },
      include: {
        order: {
          select: {
            items: {
              select: { supplierId: true, totalXAF: true },
            },
          },
        },
      },
    });

    let totalPaymentsOut = 0;
    for (const payment of payments) {
      const allItems = payment.order.items;
      const totalOrderValue = allItems.reduce((s, i) => s + Number(i.totalXAF), 0);
      const supplierValue = allItems
        .filter((i) => i.supplierId === supplierId)
        .reduce((s, i) => s + Number(i.totalXAF), 0);
      const proportion = totalOrderValue > 0 ? supplierValue / totalOrderValue : 0;
      totalPaymentsOut += Number(payment.amountXAF) * proportion;
    }

    const totalOrdersCount = completedOrderIds.length;
    const avgOrderValue = totalOrdersCount > 0 ? lifetimeSpend / totalOrdersCount : 0;

    const allOrderIds = [...new Set(orderItems.map((i) => i.order.id))];
    const lastItem = orderItems.sort(
      (a, b) => b.order.createdAt.getTime() - a.order.createdAt.getTime()
    )[0];
    const lastOrderDate = lastItem?.order.createdAt || null;

    // Spend concentration: supplier spend / total procurement spend
    const totalProcurement = await prisma.orderItem.aggregate({
      where: {
        order: { status: { in: ["LIVRE", "CLOTURE"] } },
        supplierId: { not: null },
      },
      _sum: { totalXAF: true },
    });
    const totalProcurementSpend = Number(totalProcurement._sum.totalXAF || 0);
    const spendConcentration =
      totalProcurementSpend > 0 ? (lifetimeSpend / totalProcurementSpend) * 100 : 0;
    const supplierDependency = Math.min(spendConcentration * 2, 100);

    // Price trend: compare recent offers vs older offers
    const recentOffers = await prisma.offer.findMany({
      where: { supplierId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { unitPrice: true, createdAt: true },
    });

    let priceTrendDirection: string | null = null;
    let priceTrendPercent: number | null = null;

    if (recentOffers.length >= 4) {
      const half = Math.floor(recentOffers.length / 2);
      const recent = recentOffers.slice(0, half);
      const older = recentOffers.slice(half);
      const recentAvg = recent.reduce((s, o) => s + Number(o.unitPrice), 0) / recent.length;
      const olderAvg = older.reduce((s, o) => s + Number(o.unitPrice), 0) / older.length;

      if (olderAvg > 0) {
        const change = ((recentAvg - olderAvg) / olderAvg) * 100;
        priceTrendPercent = Math.round(change * 100) / 100;
        priceTrendDirection = change > 2 ? "INCREASING" : change < -2 ? "DECREASING" : "STABLE";
      }
    }

    // Cost efficiency score
    const costEfficiencyScore = Math.min(
      100,
      50 +
        (totalOrdersCount > 0 ? 10 : 0) +
        (priceTrendDirection === "DECREASING" ? 20 : 0) +
        (priceTrendDirection === "STABLE" ? 10 : 0) +
        (spendConcentration < 30 ? 10 : 0)
    );

    return prisma.supplierFinancialMetrics.upsert({
      where: { supplierId },
      create: {
        supplierId,
        totalOrdersCount,
        lifetimeSpend,
        totalPaymentsOut,
        avgOrderValue,
        lastOrderDate,
        spendConcentration,
        supplierDependency,
        priceTrendDirection,
        priceTrendPercent,
        savingsRealized: 0,
        avgNegotiationDiscount: 0,
        costEfficiencyScore,
        totalCostOfOwnership: lifetimeSpend,
      },
      update: {
        totalOrdersCount,
        lifetimeSpend,
        totalPaymentsOut,
        avgOrderValue,
        lastOrderDate,
        spendConcentration,
        supplierDependency,
        priceTrendDirection,
        priceTrendPercent,
        costEfficiencyScore,
        totalCostOfOwnership: lifetimeSpend,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Calculate and update performance profile for a supplier
   */
  static async calculatePerformanceProfile(supplierId: string) {
    // Get completed orders containing items from this supplier
    const orders = await prisma.order.findMany({
      where: {
        items: { some: { supplierId } },
        status: { in: ["LIVRE", "CLOTURE"] },
      },
      include: {
        disputes: true,
      },
    });

    // On-time delivery analysis
    const deliveredOrders = orders.filter(
      (o) => o.actualDelivery && o.estimatedDelivery
    );

    const onTimeOrders = deliveredOrders.filter(
      (o) => o.actualDelivery! <= o.estimatedDelivery!
    );
    const earlyOrders = deliveredOrders.filter(
      (o) => o.actualDelivery! < o.estimatedDelivery!
    );
    const lateOrders = deliveredOrders.filter(
      (o) => o.actualDelivery! > o.estimatedDelivery!
    );

    const onTimeDeliveryRate =
      deliveredOrders.length > 0
        ? (onTimeOrders.length / deliveredOrders.length) * 100
        : 0;

    // Lead time analysis (creation → delivery)
    const leadTimes = deliveredOrders.map(
      (o) =>
        (o.actualDelivery!.getTime() - o.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    const avgLeadTimeDays =
      leadTimes.length > 0
        ? leadTimes.reduce((s, lt) => s + lt, 0) / leadTimes.length
        : null;

    const leadTimeVariance =
      leadTimes.length > 1 && avgLeadTimeDays !== null
        ? Math.sqrt(
            leadTimes.reduce((s, lt) => s + Math.pow(lt - avgLeadTimeDays, 2), 0) /
              leadTimes.length
          )
        : null;

    // Average delay for late orders
    const avgDelayDays =
      lateOrders.length > 0
        ? lateOrders.reduce(
            (s, o) =>
              s +
              (o.actualDelivery!.getTime() - o.estimatedDelivery!.getTime()) /
                (1000 * 60 * 60 * 24),
            0
          ) / lateOrders.length
        : null;

    // Quality from QC reports
    const qcReports = await prisma.qCReport.findMany({
      where: { supplierId },
    });

    const qcPassCount = qcReports.filter((r) => r.overallResult === "PASSED").length;
    const qcPassRate = qcReports.length > 0 ? (qcPassCount / qcReports.length) * 100 : 0;
    const defectRate =
      qcReports.length > 0
        ? qcReports.reduce((s, r) => s + Number(r.defectRate || 0), 0) / qcReports.length
        : 0;
    const qcIssuesCount = qcReports.filter((r) => r.overallResult !== "PASSED").length;

    // Disputes
    const totalDisputes = orders.reduce((s, o) => s + o.disputes.length, 0);
    const disputeRate = orders.length > 0 ? totalDisputes / orders.length : 0;

    // Composite scores
    const qualityScore = qcReports.length > 0
      ? Math.max(0, Math.min(100, qcPassRate * 0.7 + (100 - defectRate) * 0.3))
      : 50;

    // Communication score derived from dispute rate + on-time rate
    const communicationScore = Math.max(0, Math.min(100, Math.round(
      (100 - Math.min(disputeRate * 200, 50)) * 0.5 +
      onTimeDeliveryRate * 0.5
    )));

    const reliabilityIndex = Math.round(
      onTimeDeliveryRate * 0.4 +
        qualityScore * 0.4 +
        Math.max(0, 100 - Math.min(disputeRate * 100, 100)) * 0.2
    );

    return prisma.supplierPerformanceProfile.upsert({
      where: { supplierId },
      create: {
        supplierId,
        onTimeDeliveryRate,
        avgLeadTimeDays,
        leadTimeVariance,
        earlyDeliveryCount: earlyOrders.length,
        lateDeliveryCount: lateOrders.length,
        avgDelayDays,
        qualityScore,
        qcPassRate,
        defectRate,
        qcIssuesCount,
        disputeRate,
        incidentCount: totalDisputes,
        communicationScore,
        reliabilityIndex,
      },
      update: {
        onTimeDeliveryRate,
        avgLeadTimeDays,
        leadTimeVariance,
        earlyDeliveryCount: earlyOrders.length,
        lateDeliveryCount: lateOrders.length,
        avgDelayDays,
        qualityScore,
        qcPassRate,
        defectRate,
        qcIssuesCount,
        disputeRate,
        incidentCount: totalDisputes,
        communicationScore,
        reliabilityIndex,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Calculate and update risk profile for a supplier
   */
  static async calculateRiskProfile(supplierId: string) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });
    if (!supplier) throw new Error("Supplier not found");

    const financialMetrics = await prisma.supplierFinancialMetrics.findUnique({
      where: { supplierId },
    });
    const perfProfile = await prisma.supplierPerformanceProfile.findUnique({
      where: { supplierId },
    });

    // Concentration risk
    const concentrationRisk = financialMetrics
      ? Math.min(Math.round(Number(financialMetrics.spendConcentration) * 2), 100)
      : 50;

    // Quality risk
    const qualityRisk = perfProfile
      ? Math.round(100 - Number(perfProfile.qualityScore))
      : 50;

    // Delivery risk
    const deliveryRisk = perfProfile
      ? Math.round(100 - Number(perfProfile.onTimeDeliveryRate))
      : 50;

    // Financial risk based on supplier status
    const financialRisk =
      supplier.status === "BLACKLIST" ? 100 :
      supplier.status === "SUSPENDED" ? 80 :
      supplier.status === "TESTING" ? 50 :
      30;

    // Geopolitical risk by country
    const geoRiskMap: Record<string, number> = {
      CN: 40, VN: 45, IN: 45, TR: 50, TH: 40,
    };
    const geopoliticalRisk = geoRiskMap[supplier.country] || 50;

    // Global risk score (weighted average)
    const globalRiskScore = Math.round(
      concentrationRisk * 0.25 +
        qualityRisk * 0.25 +
        deliveryRisk * 0.25 +
        financialRisk * 0.15 +
        geopoliticalRisk * 0.1
    );

    // Risk badges
    const riskBadges: string[] = [];
    if (concentrationRisk > 60) riskBadges.push("CONCENTRATION_RISK");
    if (qualityRisk > 60) riskBadges.push("QUALITY_RISK");
    if (deliveryRisk > 60) riskBadges.push("DELIVERY_RISK");
    if (supplier.status === "BLACKLIST") riskBadges.push("BLACKLISTED");
    if (supplier.status === "SUSPENDED") riskBadges.push("SUSPENDED");
    if (globalRiskScore < 30) riskBadges.push("LOW_RISK");

    // Outstanding orders value
    const outstandingOrders = await prisma.order.findMany({
      where: {
        items: { some: { supplierId } },
        status: { notIn: ["LIVRE", "CLOTURE", "ANNULE"] },
      },
      include: { items: { where: { supplierId } } },
    });

    const outstandingOrdersValue = outstandingOrders.reduce(
      (sum, o) => sum + o.items.reduce((s, i) => s + Number(i.totalXAF), 0),
      0
    );

    // Cash at risk: paid but not yet delivered
    const riskPayments = await prisma.payment.findMany({
      where: {
        type: "SUPPLIER_PAYMENT",
        status: "CONFIRMED",
        order: {
          items: { some: { supplierId } },
          status: { notIn: ["LIVRE", "CLOTURE", "ANNULE"] },
        },
      },
    });
    const cashAtRisk = riskPayments.reduce((s, p) => s + Number(p.amountXAF), 0);

    // Compliance risk: based on QC failures + dispute history
    const qcReports = await prisma.qCReport.findMany({
      where: { supplierId },
      select: { overallResult: true },
    });
    const disputes = await prisma.dispute.findMany({
      where: { order: { items: { some: { supplierId } } } },
      select: { id: true },
    });
    const qcFailRate = qcReports.length > 0
      ? (qcReports.filter((r) => r.overallResult !== "PASSED").length / qcReports.length) * 100
      : 0;
    const complianceRisk = Math.min(100, Math.round(
      qcFailRate * 0.6 +
      Math.min(disputes.length * 10, 40)
    ));

    // Mitigation actions
    const mitigationActions: string[] = [];
    if (concentrationRisk > 60) mitigationActions.push("Identifier des fournisseurs alternatifs");
    if (qualityRisk > 60) mitigationActions.push("Renforcer les inspections QC");
    if (deliveryRisk > 60) mitigationActions.push("Négocier des pénalités de retard");
    if (complianceRisk > 60) mitigationActions.push("Audit de conformité requis");
    if (globalRiskScore > 70) mitigationActions.push("Plan de contingence urgent");

    // Check for last incident
    const lastDispute = await prisma.dispute.findFirst({
      where: {
        order: { items: { some: { supplierId } } },
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    return prisma.supplierRiskProfile.upsert({
      where: { supplierId },
      create: {
        supplierId,
        globalRiskScore,
        concentrationRisk,
        qualityRisk,
        deliveryRisk,
        financialRisk,
        geopoliticalRisk,
        complianceRisk,
        outstandingOrdersValue,
        cashAtRisk,
        riskBadges: JSON.parse(JSON.stringify(riskBadges)),
        riskFactors: JSON.parse(JSON.stringify({
          concentrationRisk,
          qualityRisk,
          deliveryRisk,
          financialRisk,
          geopoliticalRisk,
          outstandingOrders: outstandingOrders.length,
        })),
        mitigationActions: JSON.parse(JSON.stringify(mitigationActions)),
        blacklistHistory: supplier.status === "BLACKLIST",
        suspensionCount: supplier.status === "SUSPENDED" ? 1 : 0,
        lastIncidentDate: lastDispute?.createdAt || null,
      },
      update: {
        globalRiskScore,
        concentrationRisk,
        qualityRisk,
        deliveryRisk,
        financialRisk,
        geopoliticalRisk,
        outstandingOrdersValue,
        cashAtRisk,
        riskBadges: JSON.parse(JSON.stringify(riskBadges)),
        riskFactors: JSON.parse(JSON.stringify({
          concentrationRisk,
          qualityRisk,
          deliveryRisk,
          financialRisk,
          geopoliticalRisk,
          outstandingOrders: outstandingOrders.length,
        })),
        mitigationActions: JSON.parse(JSON.stringify(mitigationActions)),
        blacklistHistory: supplier.status === "BLACKLIST",
        lastIncidentDate: lastDispute?.createdAt || null,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Generate AI profile based on historical behavior and patterns
   */
  static async generateAIProfile(supplierId: string) {
    const financialMetrics = await prisma.supplierFinancialMetrics.findUnique({
      where: { supplierId },
    });
    const perfProfile = await prisma.supplierPerformanceProfile.findUnique({
      where: { supplierId },
    });
    const riskProfile = await prisma.supplierRiskProfile.findUnique({
      where: { supplierId },
    });

    if (!financialMetrics) {
      return prisma.supplierAIProfile.upsert({
        where: { supplierId },
        create: { supplierId, supplierPersonality: "NEW_SUPPLIER" },
        update: { supplierPersonality: "NEW_SUPPLIER", updatedAt: new Date() },
      });
    }

    // Supplier personality analysis
    const priceTrend = financialMetrics.priceTrendDirection;
    const qualityScore = Number(perfProfile?.qualityScore || 50);
    const supplierPersonality =
      priceTrend === "DECREASING" ? "PRICE_FLEXIBLE" :
      priceTrend === "INCREASING" ? "RIGID" :
      qualityScore > 70 ? "QUALITY_FOCUSED" :
      "VOLUME_DRIVEN";

    // Negotiation leverage (our leverage over them)
    const spendConc = Number(financialMetrics.spendConcentration);
    const negotiationLeverage =
      spendConc > 30 && qualityScore < 60 ? "HIGH" :
      spendConc < 10 || qualityScore > 80 ? "LOW" :
      "MEDIUM";

    // Strategic value via Kraljic matrix
    const spendValue = Number(financialMetrics.lifetimeSpend);
    const supplyRisk = riskProfile?.globalRiskScore || 50;

    let strategicValue = "COMMODITY";
    if (spendValue > 50000 && supplyRisk > 60) strategicValue = "STRATEGIC_PARTNER";
    else if (spendValue > 50000 && supplyRisk <= 60) strategicValue = "LEVERAGE";
    else if (spendValue <= 50000 && supplyRisk > 60) strategicValue = "BOTTLENECK";

    // Recommended strategy
    const recommendedStrategy =
      strategicValue === "STRATEGIC_PARTNER" ? "DEVELOP" :
      strategicValue === "LEVERAGE" ? "NEGOTIATE" :
      strategicValue === "BOTTLENECK" ? "DIVERSIFY" :
      "AUTOMATE";

    // Supplier power score (inverse of our leverage)
    const supplierPowerScore =
      negotiationLeverage === "HIGH" ? 30 :
      negotiationLeverage === "MEDIUM" ? 50 :
      70;

    // Find alternative suppliers (same products, different supplier)
    const supplierProducts = await prisma.supplierProduct.findMany({
      where: { supplierId },
      select: { productId: true },
    });
    const productIds = supplierProducts.map((sp) => sp.productId);

    const alternatives = productIds.length > 0
      ? await prisma.supplierProduct.findMany({
          where: {
            productId: { in: productIds },
            supplierId: { not: supplierId },
          },
          include: { supplier: { select: { id: true, name: true, rating: true } } },
          take: 5,
        })
      : [];

    const alternativeSuggestions = alternatives.map((a) => ({
      supplierId: a.supplierId,
      supplierName: a.supplier.name,
      rating: a.supplier.rating,
      productId: a.productId,
    }));

    // Strength & weakness factors
    const strengthFactors: string[] = [];
    const weaknessFactors: string[] = [];

    if (qualityScore > 70) strengthFactors.push("Qualité constante");
    if (Number(perfProfile?.onTimeDeliveryRate || 0) > 80) strengthFactors.push("Livraisons à temps");
    if (priceTrend === "DECREASING") strengthFactors.push("Prix en baisse");
    if (Number(perfProfile?.disputeRate || 0) === 0) strengthFactors.push("Aucun litige");

    if (qualityScore < 50) weaknessFactors.push("Problèmes de qualité récurrents");
    if (Number(perfProfile?.onTimeDeliveryRate || 0) < 60) weaknessFactors.push("Retards de livraison fréquents");
    if (priceTrend === "INCREASING") weaknessFactors.push("Prix en hausse");
    if (Number(perfProfile?.disputeRate || 0) > 0.3) weaknessFactors.push("Litiges fréquents");

    // Optimal order frequency
    const orderCount = financialMetrics.totalOrdersCount;
    const optimalOrderFrequency =
      orderCount > 12 ? "MONTHLY" :
      orderCount > 4 ? "QUARTERLY" :
      "SEMI_ANNUAL";

    // --- SUPPLIER CHURN RISK (0.0 = stable, 1.0 = likely to exit) ---
    const lastOrderDate = financialMetrics.lastOrderDate;
    const daysSinceLastOrder = lastOrderDate
      ? Math.floor((Date.now() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24))
      : 365;

    const onTimeRate = Number(perfProfile?.onTimeDeliveryRate || 0);
    const disputeRate = Number(perfProfile?.disputeRate || 0);

    // Churn signals (0-1 each)
    const recencySignal = Math.min(1, daysSinceLastOrder / 180);    // 0 if recent, 1 if >6 months
    const qualitySignal = Math.max(0, (100 - qualityScore) / 100);   // 0 if high quality, 1 if poor
    const deliverySignal = Math.max(0, (100 - onTimeRate) / 100);    // 0 if on-time, 1 if late
    const disputeSignal = Math.min(1, disputeRate * 3);               // amplified dispute rate
    const alternativeSignal = alternativeSuggestions.length > 3 ? 0.3 : 0; // many alternatives = we may switch

    const churnRiskScore = Math.min(1,
      recencySignal * 0.30 +
      qualitySignal * 0.25 +
      deliverySignal * 0.20 +
      disputeSignal * 0.15 +
      alternativeSignal * 0.10
    );

    // --- SUPPLIER LTV (Valeur Vie Fournisseur en XAF) ---
    // Estimated based on current spend trend + expected relationship duration
    const observedDays = lastOrderDate && financialMetrics.lastOrderDate
      ? Math.max(30, Math.floor((Date.now() - new Date(Math.min(
          ...([financialMetrics.lastOrderDate] as Date[]).map(d => d.getTime())
        )).getTime()) / (1000 * 60 * 60 * 24)))
      : 365;
    const spendPerMonth = observedDays > 0 ? (spendValue / observedDays) * 30 : 0;

    const expectedLifetimeMonths =
      churnRiskScore < 0.3 ? 60 :
      churnRiskScore < 0.6 ? 36 :
      churnRiskScore < 0.8 ? 12 :
      6;

    const estimatedAnnualValue = Math.round(spendPerMonth * 12);
    const supplierLTV = Math.round(spendPerMonth * expectedLifetimeMonths);

    // Responsiveness derived from on-time + dispute rate
    const responsiveness =
      onTimeRate > 80 && disputeRate < 0.1 ? "FAST" :
      onTimeRate < 50 || disputeRate > 0.3 ? "SLOW" :
      "MEDIUM";

    const profileData = {
      supplierPersonality,
      negotiationLeverage,
      responsiveness,
      strategicValue,
      supplierPowerScore,
      recommendedStrategy,
      alternativeSuggestions: JSON.parse(JSON.stringify(alternativeSuggestions)),
      predictedPriceDirection: priceTrend || "STABLE",
      predictedPriceChange: financialMetrics.priceTrendPercent,
      churnRiskScore,
      optimalOrderFrequency,
      estimatedAnnualValue: estimatedAnnualValue > 0 ? estimatedAnnualValue : null,
      strengthFactors: JSON.parse(JSON.stringify(strengthFactors)),
      weaknessFactors: JSON.parse(JSON.stringify(weaknessFactors)),
      behavioralInsights: JSON.parse(JSON.stringify({
        avgOrderValue: Number(financialMetrics.avgOrderValue),
        totalOrders: financialMetrics.totalOrdersCount,
        qualityScore,
        onTimeRate,
        daysSinceLastOrder,
        spendPerMonth: Math.round(spendPerMonth),
        expectedLifetimeMonths,
        supplierLTV,
      })),
    };

    return prisma.supplierAIProfile.upsert({
      where: { supplierId },
      create: {
        supplierId,
        consolidationOpportunities: JSON.parse(JSON.stringify([])),
        ...profileData,
      },
      update: {
        ...profileData,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Auto-assign supplier segments based on calculated metrics
   */
  static async assignSegments(supplierId: string) {
    const financialMetrics = await prisma.supplierFinancialMetrics.findUnique({
      where: { supplierId },
    });
    const riskProfile = await prisma.supplierRiskProfile.findUnique({
      where: { supplierId },
    });
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { status: true },
    });

    if (!financialMetrics) return;

    const segments: Array<{ segment: SupplierSegment; score: number; notes?: string }> = [];
    const spendValue = Number(financialMetrics.lifetimeSpend);
    const riskScore = riskProfile?.globalRiskScore || 50;

    // Kraljic Matrix classification
    if (spendValue > 50000 && riskScore > 60) {
      segments.push({
        segment: "STRATEGIC_PARTNER",
        score: 90,
        notes: "Haute valeur + haut risque → développer le partenariat",
      });
    } else if (spendValue > 50000 && riskScore <= 60) {
      segments.push({
        segment: "LEVERAGE_SUPPLIER",
        score: 80,
        notes: "Haute valeur + faible risque → négocier les prix",
      });
    } else if (spendValue <= 50000 && riskScore > 60) {
      segments.push({
        segment: "BOTTLENECK",
        score: 70,
        notes: "Faible valeur + haut risque → sécuriser l'approvisionnement",
      });
    } else {
      segments.push({
        segment: "ROUTINE",
        score: 50,
        notes: "Faible valeur + faible risque → automatiser",
      });
    }

    // ABC Classification
    if (spendValue > 100000) {
      segments.push({ segment: "A_SUPPLIER", score: 95, notes: "Top 20% par volume d'achat" });
    } else if (spendValue > 30000) {
      segments.push({ segment: "B_SUPPLIER", score: 70, notes: "30% intermédiaire" });
    } else {
      segments.push({ segment: "C_SUPPLIER", score: 40, notes: "Fournisseur à faible volume" });
    }

    // Risk-based segments
    if (riskScore > 70) {
      segments.push({ segment: "AT_RISK", score: riskScore, notes: "Risque élevé, action requise" });
    }

    if (riskScore < 30 && financialMetrics.totalOrdersCount > 5) {
      segments.push({ segment: "PREFERRED", score: 90, notes: "Haute performance, faible risque" });
    }

    if (supplier?.status === "TESTING") {
      segments.push({ segment: "DEVELOPING", score: 50, notes: "En cours d'évaluation" });
    }

    // Delete existing + create new
    await prisma.supplierSegmentation.deleteMany({ where: { supplierId } });

    if (segments.length > 0) {
      await prisma.supplierSegmentation.createMany({
        data: segments.map((s) => ({
          supplierId,
          segment: s.segment,
          score: s.score,
          notes: s.notes,
        })),
      });
    }
  }

  /**
   * Recalculate ALL intelligence for a supplier (full refresh)
   */
  static async recalculateAll(supplierId: string) {
    // Phase 1: independent calculations
    await Promise.all([
      this.calculateFinancialMetrics(supplierId),
      this.calculatePerformanceProfile(supplierId),
    ]);
    // Phase 2: depends on phase 1
    await this.calculateRiskProfile(supplierId);
    // Phase 3: depends on all above
    await this.generateAIProfile(supplierId);
    await this.assignSegments(supplierId);
  }

  /**
   * Get full intelligence profile for a supplier
   */
  static async getFullProfile(supplierId: string) {
    return prisma.supplier.findUnique({
      where: { id: supplierId },
      include: {
        financialMetrics: true,
        performanceProfile: true,
        riskProfile: true,
        aiProfile: true,
        segmentations: true,
        sourcingCases: {
          include: { order: { select: { orderNumber: true, status: true } } },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        offers: {
          include: { product: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        supplierScores: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        supplierProducts: {
          include: { product: { select: { name: true, category: true } } },
        },
        catalogMedia: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        documents: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        orderItems: {
          include: {
            order: {
              select: { orderNumber: true, status: true, createdAt: true, totalClient: true },
            },
          },
          orderBy: { order: { createdAt: "desc" } },
          take: 20,
        },
        _count: {
          select: {
            sourcingCases: true,
            supplierProducts: true,
            catalogMedia: true,
            orderItems: true,
            offers: true,
          },
        },
      },
    });
  }
}
