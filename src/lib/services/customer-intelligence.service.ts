import { prisma } from "@/lib/db";
import type { CustomerSegment, Prisma } from "@prisma/client";

export class CustomerIntelligenceService {
  /**
   * Calculate and update all financial metrics for a customer
   */
  static async calculateFinancialMetrics(contactId: string) {
    // Get all completed orders for this contact
    const orders = await prisma.order.findMany({
      where: {
        contactId,
        status: { in: ["LIVRE", "CLOTURE"] },
      },
      include: {
        payments: { where: { status: "CONFIRMED" } },
        marginReport: true,
      },
    });

    // Get orders in transit/customs (cash at risk)
    const ordersAtRisk = await prisma.order.findMany({
      where: {
        contactId,
        status: { in: ["EN_PRODUCTION", "EN_TRANSIT", "DEDOUANE", "QC_EN_COURS"] },
      },
      select: { totalClient: true, createdAt: true },
    });

    // Calculate metrics
    const lifetimeGrossRevenue = orders.reduce((sum, o) => sum + Number(o.totalClient), 0);

    const lifetimeNetProfit = orders.reduce((sum, o) => {
      if (o.marginReport) {
        return sum + Number(o.marginReport.grossMargin);
      }
      return sum;
    }, 0);

    const averageMarginPercent = orders.length > 0 && lifetimeGrossRevenue > 0
      ? (lifetimeNetProfit / lifetimeGrossRevenue) * 100
      : 0;

    const cashAtRisk = ordersAtRisk.reduce((sum, o) => sum + Number(o.totalClient), 0);

    const daysOfCashImmobil = ordersAtRisk.length > 0
      ? Math.round(
          ordersAtRisk.reduce((sum, o) => {
            const daysOld = Math.floor(
              (Date.now() - o.createdAt.getTime()) / (1000 * 60 * 60 * 24)
            );
            return sum + daysOld;
          }, 0) / ordersAtRisk.length
        )
      : 0;

    const totalOrdersCount = orders.length;
    const avgOrderValue = totalOrdersCount > 0 ? lifetimeGrossRevenue / totalOrdersCount : 0;

    const lastOrder = orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    const lastOrderDate = lastOrder?.createdAt;

    // Contribution score: weighted by revenue + margin + frequency
    const revenueScore = Math.min((lifetimeGrossRevenue / 100000) * 30, 30); // max 30 pts
    const marginScore = Math.min(averageMarginPercent * 0.3, 30); // max 30 pts
    const frequencyScore = Math.min(totalOrdersCount * 2, 40); // max 40 pts
    const contributionScore = Math.min(revenueScore + marginScore + frequencyScore, 100);

    // Upsert metrics
    return prisma.customerFinancialMetrics.upsert({
      where: { contactId },
      create: {
        contactId,
        lifetimeGrossRevenue,
        lifetimeNetProfit,
        averageMarginPercent,
        cashAtRisk,
        daysOfCashImmobil,
        contributionScore,
        totalOrdersCount,
        avgOrderValue,
        lastOrderDate,
      },
      update: {
        lifetimeGrossRevenue,
        lifetimeNetProfit,
        averageMarginPercent,
        cashAtRisk,
        daysOfCashImmobil,
        contributionScore,
        totalOrdersCount,
        avgOrderValue,
        lastOrderDate,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Calculate and update risk profile for a customer
   */
  static async calculateRiskProfile(contactId: string) {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        orders: {
          include: {
            payments: true,
            disputes: true,
            shipments: { include: { customsClearance: true } },
          },
        },
      },
    });

    if (!contact) throw new Error("Contact not found");

    const orders = contact.orders;
    const totalOrders = orders.length;

    // Payment risk: late/failed payments
    const latePayments = orders.filter((o) =>
      o.payments.some((p) => p.status === "FAILED" || p.status === "CANCELLED")
    ).length;
    const paymentRisk = totalOrders > 0
      ? Math.min(100, (latePayments / totalOrders) * 100)
      : 50;

    // Logistics risk: delays
    const delayedShipments = orders.filter((o) =>
      o.shipments.some((s) => {
        if (!s.actualArrival || !s.estimatedArrival) return false;
        return s.actualArrival > s.estimatedArrival;
      })
    ).length;
    const logisticsRisk = totalOrders > 0
      ? Math.min(100, (delayedShipments / totalOrders) * 100)
      : 50;

    // Customs risk: held/rejected
    const customsIssues = orders.filter((o) =>
      o.shipments.some((s) =>
        s.customsClearance?.status === "HELD" || s.customsClearance?.status === "REJECTED"
      )
    ).length;
    const customsRisk = totalOrders > 0
      ? Math.min(100, (customsIssues / totalOrders) * 100)
      : 50;

    // Dispute frequency
    const totalDisputes = orders.reduce((sum, o) => sum + o.disputes.length, 0);
    const disputeFrequency = totalOrders > 0 ? totalDisputes / totalOrders : 0;

    // Country risk (simple mapping)
    const countryRiskMap: Record<string, number> = {
      CG: 30, CD: 50, CM: 40, GA: 35, AO: 45,
    };
    const countryRegulatoryRisk = countryRiskMap[contact.country] || 50;

    // Global risk score (weighted average)
    const globalRiskScore = Math.round(
      (paymentRisk * 0.3) +
      (logisticsRisk * 0.2) +
      (customsRisk * 0.2) +
      (disputeFrequency * 10 * 0.2) +
      (countryRegulatoryRisk * 0.1)
    );

    // Risk badges
    const riskBadges: string[] = [];
    if (globalRiskScore < 30) riskBadges.push("LOW_RISK");
    if (paymentRisk > 60) riskBadges.push("PAYMENT_RISK");
    if (logisticsRisk > 60) riskBadges.push("SUPPLY_RISK");
    if (customsRisk > 60) riskBadges.push("CUSTOMS_RISK");
    if (disputeFrequency > 0.3) riskBadges.push("OPERATIONAL_RISK");

    // Cash exposure: orders in progress
    const ordersInProgress = await prisma.order.findMany({
      where: {
        contactId,
        status: { notIn: ["LIVRE", "CLOTURE", "ANNULE"] },
      },
      select: { totalClient: true },
    });
    const cashExposure = ordersInProgress.reduce((sum, o) => sum + Number(o.totalClient), 0);

    return prisma.customerRiskProfile.upsert({
      where: { contactId },
      create: {
        contactId,
        globalRiskScore,
        paymentRisk: Math.round(paymentRisk),
        logisticsRisk: Math.round(logisticsRisk),
        customsRisk: Math.round(customsRisk),
        disputeFrequency,
        supplierReliability: 50, // placeholder
        countryRegulatoryRisk,
        cashExposure,
        riskBadges: JSON.parse(JSON.stringify(riskBadges)),
        riskFactors: JSON.parse(JSON.stringify({
          latePayments,
          delayedShipments,
          customsIssues,
          totalDisputes,
        })),
      },
      update: {
        globalRiskScore,
        paymentRisk: Math.round(paymentRisk),
        logisticsRisk: Math.round(logisticsRisk),
        customsRisk: Math.round(customsRisk),
        disputeFrequency,
        countryRegulatoryRisk,
        cashExposure,
        riskBadges: JSON.parse(JSON.stringify(riskBadges)),
        riskFactors: JSON.parse(JSON.stringify({
          latePayments,
          delayedShipments,
          customsIssues,
          totalDisputes,
        })),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Generate AI profile based on historical behavior
   */
  static async generateAIProfile(contactId: string) {
    const orders = await prisma.order.findMany({
      where: { contactId },
      include: {
        items: true,
        payments: true,
        marginReport: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    if (orders.length === 0) {
      return prisma.customerAIProfile.upsert({
        where: { contactId },
        create: { contactId, buyingPersonality: "NEW_CUSTOMER" },
        update: { buyingPersonality: "NEW_CUSTOMER", updatedAt: new Date() },
      });
    }

    // Analyze buying personality
    const avgMargin = orders.reduce((sum, o) => {
      return sum + (o.marginReport ? Number(o.marginReport.marginPercent) : 0);
    }, 0) / orders.length;

    const buyingPersonality =
      avgMargin < 5 ? "PRICE_DRIVEN" :
      avgMargin > 15 ? "QUALITY_DRIVEN" :
      "BALANCED";

    // Negotiation style (based on margin variance)
    const marginVariance = orders.reduce((sum, o) => {
      const margin = o.marginReport ? Number(o.marginReport.marginPercent) : 0;
      return sum + Math.abs(margin - avgMargin);
    }, 0) / orders.length;

    const negotiationStyle =
      marginVariance > 5 ? "AGGRESSIVE" :
      marginVariance < 2 ? "PASSIVE" :
      "COLLABORATIVE";

    // Delay sensitivity (urgent orders)
    const urgentOrders = orders.filter((o) => o.priority === "URGENT" || o.priority === "HIGH").length;
    const sensitivityToDelays = urgentOrders > orders.length * 0.5 ? "HIGH" : "MEDIUM";

    // Recommended strategies
    const recommendedPricingStrategy =
      buyingPersonality === "PRICE_DRIVEN" ? "Competitive pricing, volume discounts" :
      buyingPersonality === "QUALITY_DRIVEN" ? "Premium pricing, emphasize quality" :
      "Value-based pricing";

    const recommendedPaymentTerms =
      orders.some((o) => o.payments.some((p) => p.status === "FAILED"))
        ? "50% deposit required"
        : "30% deposit, balance before shipping";

    const recommendedLogisticsStrategy =
      sensitivityToDelays === "HIGH"
        ? "Express air freight, priority handling"
        : "Standard sea freight";

    // --- PREDICTIVE CHURN RISK (0.0 = fidèle, 1.0 = churné) ---
    const sortedOrders = [...orders].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const lastOrderDate = sortedOrders[0]?.createdAt;
    const daysSinceLastOrder = lastOrderDate
      ? Math.floor((Date.now() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24))
      : 365;

    const firstOrderDate = sortedOrders[sortedOrders.length - 1]?.createdAt;
    const observedDays = firstOrderDate
      ? Math.max(1, Math.floor((Date.now() - firstOrderDate.getTime()) / (1000 * 60 * 60 * 24)))
      : 30;
    const ordersPerMonth = (orders.length / observedDays) * 30;

    const paymentFailureRate = orders.length > 0
      ? orders.filter((o) => o.payments.some((p) => p.status === "FAILED")).length / orders.length
      : 0;

    // Composantes churn (0-1 chacune)
    const recencyScore = Math.min(1, daysSinceLastOrder / 180);    // 0 si récent, 1 si >6 mois
    const frequencyScore = Math.max(0, 1 - ordersPerMonth / 2);    // 0 si >2/mois, 1 si inactif
    const paymentRiskScore = Math.min(1, paymentFailureRate * 2);
    const singleOrderPenalty = orders.length === 1 ? 0.2 : 0;

    const predictedChurnRisk = Math.min(1,
      recencyScore * 0.45 +
      frequencyScore * 0.30 +
      paymentRiskScore * 0.15 +
      singleOrderPenalty * 0.10
    );

    // --- PREDICTIVE LTV (Valeur Vie Client en XAF) ---
    const lifetimeGrossRevenue = orders.reduce((sum, o) => sum + Number(o.totalClient), 0);
    const avgOrderValue = lifetimeGrossRevenue / orders.length;

    // Durée de vie client attendue selon le risque de churn
    const expectedLifetimeMonths =
      predictedChurnRisk < 0.3 ? 60 :
      predictedChurnRisk < 0.6 ? 36 :
      predictedChurnRisk < 0.8 ? 12 :
      6;

    // LTV = valeur moy × fréquence mensuelle × durée vie × facteur marge
    const predictedLTV = Math.round(
      avgOrderValue * ordersPerMonth * expectedLifetimeMonths * (1 + avgMargin / 100)
    );

    return prisma.customerAIProfile.upsert({
      where: { contactId },
      create: {
        contactId,
        buyingPersonality,
        negotiationStyle,
        sensitivityToDelays,
        recommendedPricingStrategy,
        recommendedPaymentTerms,
        recommendedLogisticsStrategy,
        predictedChurnRisk,
        predictedLTV,
        behavioralInsights: JSON.parse(JSON.stringify({
          avgMargin,
          marginVariance,
          urgentOrders,
          daysSinceLastOrder,
          ordersPerMonth: Math.round(ordersPerMonth * 100) / 100,
          expectedLifetimeMonths,
        })),
      },
      update: {
        buyingPersonality,
        negotiationStyle,
        sensitivityToDelays,
        recommendedPricingStrategy,
        recommendedPaymentTerms,
        recommendedLogisticsStrategy,
        predictedChurnRisk,
        predictedLTV,
        behavioralInsights: JSON.parse(JSON.stringify({
          avgMargin,
          marginVariance,
          urgentOrders,
          daysSinceLastOrder,
          ordersPerMonth: Math.round(ordersPerMonth * 100) / 100,
          expectedLifetimeMonths,
        })),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Auto-assign customer segments based on metrics
   */
  static async assignSegments(contactId: string) {
    const metrics = await prisma.customerFinancialMetrics.findUnique({
      where: { contactId },
    });
    const riskProfile = await prisma.customerRiskProfile.findUnique({
      where: { contactId },
    });

    if (!metrics) return;

    const manualSegments = await prisma.customerSegmentation.findMany({
      where: {
        contactId,
        notes: { contains: "[manual]" },
      },
    });

    const manualSet = new Set(manualSegments.map((s) => s.segment));

    const segments: Array<{ segment: CustomerSegment; score: number; notes?: string }> = [];

    // CASHFLOW_DRIVER: high revenue + frequent orders
    if (!manualSet.has("CASHFLOW_DRIVER" as CustomerSegment) && Number(metrics.lifetimeGrossRevenue) > 50000 && metrics.totalOrdersCount > 5) {
      segments.push({
        segment: "CASHFLOW_DRIVER",
        score: Number(metrics.contributionScore),
        notes: "High revenue, frequent buyer",
      });
    }

    // KEY_ACCOUNT: high contribution score
    if (!manualSet.has("KEY_ACCOUNT" as CustomerSegment) && Number(metrics.contributionScore) > 70) {
      segments.push({
        segment: "KEY_ACCOUNT",
        score: Number(metrics.contributionScore),
        notes: "Top contributor to business",
      });
    }

    // HIGH_RISK_HIGH_REWARD: high revenue + high risk
    if (
      !manualSet.has("HIGH_RISK_HIGH_REWARD" as CustomerSegment) &&
      Number(metrics.lifetimeGrossRevenue) > 30000 &&
      riskProfile &&
      riskProfile.globalRiskScore > 60
    ) {
      segments.push({
        segment: "HIGH_RISK_HIGH_REWARD",
        score: 50,
        notes: "High revenue but elevated risk",
      });
    }

    // AT_RISK: no recent orders
    if (
      !manualSet.has("AT_RISK" as CustomerSegment) &&
      metrics.lastOrderDate &&
      Date.now() - metrics.lastOrderDate.getTime() > 90 * 24 * 60 * 60 * 1000
    ) {
      segments.push({
        segment: "AT_RISK",
        score: 60,
        notes: "No orders in 90+ days",
      });
    }

    // ONE_TIME_BUYER: only 1 order
    if (!manualSet.has("ONE_TIME_BUYER" as CustomerSegment) && metrics.totalOrdersCount === 1) {
      segments.push({
        segment: "ONE_TIME_BUYER",
        score: 30,
        notes: "Single purchase only",
      });
    }

    // LOW_MARGIN_VOLUME: low margin but high volume
    if (!manualSet.has("LOW_MARGIN_VOLUME" as CustomerSegment) && Number(metrics.averageMarginPercent) < 8 && metrics.totalOrdersCount > 10) {
      segments.push({
        segment: "LOW_MARGIN_VOLUME",
        score: 50,
        notes: "Volume player, low margins",
      });
    }

    // Delete existing non-manual segments
    await prisma.customerSegmentation.deleteMany({
      where: {
        contactId,
        NOT: { notes: { contains: "[manual]" } },
      },
    });

    // Create new segments
    if (segments.length > 0) {
      await prisma.customerSegmentation.createMany({
        data: segments.map((s) => ({
          contactId,
          segment: s.segment,
          score: s.score,
          notes: s.notes,
        })),
      });
    }
  }

  /**
   * Recalculate ALL intelligence for a customer (full refresh)
   */
  static async recalculateAll(contactId: string) {
    await Promise.all([
      this.calculateFinancialMetrics(contactId),
      this.calculateRiskProfile(contactId),
      this.generateAIProfile(contactId),
    ]);
    await this.assignSegments(contactId);
  }

  /**
   * Get full intelligence profile for a customer
   */
  static async getFullProfile(contactId: string) {
    return prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        financialMetrics: true,
        riskProfile: true,
        aiProfile: true,
        pipelineIntents: { orderBy: { estimatedOrderDate: "asc" } },
        segmentations: true,
        supplyChains: {
          include: {
            supplier: { select: { name: true, city: true, rating: true } },
            transitPartner: { select: { name: true, type: true } },
          },
          orderBy: { lastUsedAt: "desc" },
        },
        orders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalClient: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        leads: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });
  }
}
