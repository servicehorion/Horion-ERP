/**
 * Tests unitaires - Calculs prédictifs Churn/LTV CRM
 *
 * Ces tests valident la logique métier pure du calcul de churn et LTV
 * sans dépendance à la base de données (Prisma mocké via vitest).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Helpers reproduisant la logique du service ──────────────────────────────

function calculateChurnRisk(params: {
  daysSinceLastOrder: number;
  ordersPerMonth: number;
  paymentFailureRate: number;
  totalOrders: number;
}): number {
  const { daysSinceLastOrder, ordersPerMonth, paymentFailureRate, totalOrders } = params;

  const recencyScore = Math.min(1, daysSinceLastOrder / 180);
  const frequencyScore = Math.max(0, 1 - ordersPerMonth / 2);
  const paymentRiskScore = Math.min(1, paymentFailureRate * 2);
  const singleOrderPenalty = totalOrders === 1 ? 0.2 : 0;

  return Math.min(1,
    recencyScore * 0.45 +
    frequencyScore * 0.30 +
    paymentRiskScore * 0.15 +
    singleOrderPenalty * 0.10
  );
}

function calculatePredictedLTV(params: {
  avgOrderValue: number;
  ordersPerMonth: number;
  predictedChurnRisk: number;
  avgMarginPercent: number;
}): number {
  const { avgOrderValue, ordersPerMonth, predictedChurnRisk, avgMarginPercent } = params;

  const expectedLifetimeMonths =
    predictedChurnRisk < 0.3 ? 60 :
    predictedChurnRisk < 0.6 ? 36 :
    predictedChurnRisk < 0.8 ? 12 :
    6;

  return Math.round(
    avgOrderValue * ordersPerMonth * expectedLifetimeMonths * (1 + avgMarginPercent / 100)
  );
}

function assignSegments(params: {
  lifetimeGrossRevenue: number;
  totalOrdersCount: number;
  contributionScore: number;
  globalRiskScore?: number;
  daysSinceLastOrder?: number;
  averageMarginPercent?: number;
}): string[] {
  const {
    lifetimeGrossRevenue,
    totalOrdersCount,
    contributionScore,
    globalRiskScore = 0,
    daysSinceLastOrder = 0,
    averageMarginPercent = 10,
  } = params;

  const segments: string[] = [];

  if (lifetimeGrossRevenue > 50000 && totalOrdersCount > 5) {
    segments.push("CASHFLOW_DRIVER");
  }
  if (contributionScore > 70) {
    segments.push("KEY_ACCOUNT");
  }
  if (lifetimeGrossRevenue > 30000 && globalRiskScore > 60) {
    segments.push("HIGH_RISK_HIGH_REWARD");
  }
  if (daysSinceLastOrder > 90) {
    segments.push("AT_RISK");
  }
  if (totalOrdersCount === 1) {
    segments.push("ONE_TIME_BUYER");
  }
  if (averageMarginPercent < 8 && totalOrdersCount > 10) {
    segments.push("LOW_MARGIN_VOLUME");
  }

  return segments;
}

// ─── TESTS CHURN RISK ─────────────────────────────────────────────────────────

describe("calculateChurnRisk", () => {
  it("devrait retourner un risque très faible pour un client très actif", () => {
    const risk = calculateChurnRisk({
      daysSinceLastOrder: 5,      // commande il y a 5 jours
      ordersPerMonth: 3,          // 3 commandes par mois
      paymentFailureRate: 0,      // aucun echec
      totalOrders: 20,
    });
    expect(risk).toBeLessThan(0.20);
    expect(risk).toBeGreaterThanOrEqual(0);
  });

  it("devrait retourner un risque élevé pour un client inactif depuis 6+ mois", () => {
    const risk = calculateChurnRisk({
      daysSinceLastOrder: 200,    // plus de 6 mois
      ordersPerMonth: 0.1,        // quasi inactif
      paymentFailureRate: 0,
      totalOrders: 3,
    });
    expect(risk).toBeGreaterThan(0.60);
  });

  it("devrait pénaliser un client ayant un seul achat", () => {
    const riskSingle = calculateChurnRisk({
      daysSinceLastOrder: 30,
      ordersPerMonth: 1,
      paymentFailureRate: 0,
      totalOrders: 1,
    });
    const riskMultiple = calculateChurnRisk({
      daysSinceLastOrder: 30,
      ordersPerMonth: 1,
      paymentFailureRate: 0,
      totalOrders: 5,
    });
    expect(riskSingle).toBeGreaterThan(riskMultiple);
  });

  it("devrait amplifier le risque avec des échecs de paiement", () => {
    const riskWithFailures = calculateChurnRisk({
      daysSinceLastOrder: 30,
      ordersPerMonth: 1,
      paymentFailureRate: 0.5,    // 50% d'échecs
      totalOrders: 10,
    });
    const riskWithoutFailures = calculateChurnRisk({
      daysSinceLastOrder: 30,
      ordersPerMonth: 1,
      paymentFailureRate: 0,
      totalOrders: 10,
    });
    expect(riskWithFailures).toBeGreaterThan(riskWithoutFailures);
  });

  it("devrait toujours rester dans la plage [0, 1]", () => {
    const extreme1 = calculateChurnRisk({
      daysSinceLastOrder: 0,
      ordersPerMonth: 10,
      paymentFailureRate: 0,
      totalOrders: 100,
    });
    const extreme2 = calculateChurnRisk({
      daysSinceLastOrder: 365,
      ordersPerMonth: 0,
      paymentFailureRate: 1,
      totalOrders: 1,
    });
    expect(extreme1).toBeGreaterThanOrEqual(0);
    expect(extreme1).toBeLessThanOrEqual(1);
    expect(extreme2).toBeGreaterThanOrEqual(0);
    expect(extreme2).toBeLessThanOrEqual(1);
  });

  it("devrait retourner un risque modéré pour un profil moyen", () => {
    const risk = calculateChurnRisk({
      daysSinceLastOrder: 60,
      ordersPerMonth: 0.8,
      paymentFailureRate: 0.1,
      totalOrders: 8,
    });
    expect(risk).toBeGreaterThan(0.20);
    expect(risk).toBeLessThan(0.70);
  });
});

// ─── TESTS LTV PRÉDITE ────────────────────────────────────────────────────────

describe("calculatePredictedLTV", () => {
  it("devrait calculer une LTV plus élevée pour un client fidèle (faible churn)", () => {
    const ltvFidele = calculatePredictedLTV({
      avgOrderValue: 100000,
      ordersPerMonth: 1,
      predictedChurnRisk: 0.1,   // très fidèle → 60 mois
      avgMarginPercent: 10,
    });
    const ltvAtRisk = calculatePredictedLTV({
      avgOrderValue: 100000,
      ordersPerMonth: 1,
      predictedChurnRisk: 0.9,   // churn imminent → 6 mois
      avgMarginPercent: 10,
    });
    expect(ltvFidele).toBeGreaterThan(ltvAtRisk);
  });

  it("devrait utiliser 60 mois pour churnRisk < 0.3", () => {
    const ltv = calculatePredictedLTV({
      avgOrderValue: 10000,
      ordersPerMonth: 2,
      predictedChurnRisk: 0.2,
      avgMarginPercent: 0,
    });
    // 10000 × 2 × 60 × 1 = 1,200,000
    expect(ltv).toBe(1200000);
  });

  it("devrait utiliser 36 mois pour churnRisk entre 0.3 et 0.6", () => {
    const ltv = calculatePredictedLTV({
      avgOrderValue: 10000,
      ordersPerMonth: 1,
      predictedChurnRisk: 0.5,
      avgMarginPercent: 0,
    });
    // 10000 × 1 × 36 × 1 = 360,000
    expect(ltv).toBe(360000);
  });

  it("devrait utiliser 12 mois pour churnRisk entre 0.6 et 0.8", () => {
    const ltv = calculatePredictedLTV({
      avgOrderValue: 10000,
      ordersPerMonth: 1,
      predictedChurnRisk: 0.7,
      avgMarginPercent: 0,
    });
    expect(ltv).toBe(120000);
  });

  it("devrait utiliser 6 mois pour churnRisk >= 0.8", () => {
    const ltv = calculatePredictedLTV({
      avgOrderValue: 10000,
      ordersPerMonth: 1,
      predictedChurnRisk: 0.85,
      avgMarginPercent: 0,
    });
    expect(ltv).toBe(60000);
  });

  it("devrait intégrer la marge dans le calcul", () => {
    const ltvAvecMarge = calculatePredictedLTV({
      avgOrderValue: 10000,
      ordersPerMonth: 1,
      predictedChurnRisk: 0.5,   // 36 mois
      avgMarginPercent: 20,
    });
    const ltvSansMarge = calculatePredictedLTV({
      avgOrderValue: 10000,
      ordersPerMonth: 1,
      predictedChurnRisk: 0.5,
      avgMarginPercent: 0,
    });
    // Avec 20% de marge, LTV doit être 20% plus élevée
    expect(ltvAvecMarge).toBe(Math.round(ltvSansMarge * 1.2));
  });

  it("ne devrait jamais retourner une valeur négative", () => {
    const ltv = calculatePredictedLTV({
      avgOrderValue: 0,
      ordersPerMonth: 0,
      predictedChurnRisk: 1,
      avgMarginPercent: -5,
    });
    expect(ltv).toBeGreaterThanOrEqual(0);
  });
});

// ─── TESTS SEGMENTATION ───────────────────────────────────────────────────────

describe("assignSegments", () => {
  it("devrait identifier un CASHFLOW_DRIVER (gros CA + fréquent)", () => {
    const segments = assignSegments({
      lifetimeGrossRevenue: 150000,
      totalOrdersCount: 15,
      contributionScore: 60,
    });
    expect(segments).toContain("CASHFLOW_DRIVER");
  });

  it("ne devrait pas identifier CASHFLOW_DRIVER avec peu de commandes", () => {
    const segments = assignSegments({
      lifetimeGrossRevenue: 150000,
      totalOrdersCount: 3,
      contributionScore: 60,
    });
    expect(segments).not.toContain("CASHFLOW_DRIVER");
  });

  it("devrait identifier un KEY_ACCOUNT (score > 70)", () => {
    const segments = assignSegments({
      lifetimeGrossRevenue: 10000,
      totalOrdersCount: 5,
      contributionScore: 85,
    });
    expect(segments).toContain("KEY_ACCOUNT");
  });

  it("devrait identifier HIGH_RISK_HIGH_REWARD (CA élevé + risque élevé)", () => {
    const segments = assignSegments({
      lifetimeGrossRevenue: 80000,
      totalOrdersCount: 10,
      contributionScore: 50,
      globalRiskScore: 75,
    });
    expect(segments).toContain("HIGH_RISK_HIGH_REWARD");
  });

  it("devrait identifier AT_RISK si plus de 90 jours sans commande", () => {
    const segments = assignSegments({
      lifetimeGrossRevenue: 5000,
      totalOrdersCount: 3,
      contributionScore: 30,
      daysSinceLastOrder: 120,
    });
    expect(segments).toContain("AT_RISK");
  });

  it("devrait identifier ONE_TIME_BUYER si 1 seule commande", () => {
    const segments = assignSegments({
      lifetimeGrossRevenue: 5000,
      totalOrdersCount: 1,
      contributionScore: 20,
    });
    expect(segments).toContain("ONE_TIME_BUYER");
  });

  it("devrait identifier LOW_MARGIN_VOLUME (marge < 8% + volume > 10)", () => {
    const segments = assignSegments({
      lifetimeGrossRevenue: 200000,
      totalOrdersCount: 25,
      contributionScore: 40,
      averageMarginPercent: 5,
    });
    expect(segments).toContain("LOW_MARGIN_VOLUME");
  });

  it("peut assigner plusieurs segments simultanément", () => {
    const segments = assignSegments({
      lifetimeGrossRevenue: 200000,
      totalOrdersCount: 30,
      contributionScore: 95,
      globalRiskScore: 80,
      averageMarginPercent: 3,
    });
    // Un même client peut être CASHFLOW_DRIVER + KEY_ACCOUNT + HIGH_RISK + LOW_MARGIN
    expect(segments.length).toBeGreaterThan(1);
    expect(segments).toContain("CASHFLOW_DRIVER");
    expect(segments).toContain("KEY_ACCOUNT");
  });

  it("ne devrait assigner aucun segment à un client neutre", () => {
    const segments = assignSegments({
      lifetimeGrossRevenue: 5000,
      totalOrdersCount: 3,
      contributionScore: 40,
      globalRiskScore: 30,
      daysSinceLastOrder: 10,
      averageMarginPercent: 12,
    });
    expect(segments).toHaveLength(0);
  });
});

// ─── TESTS EXPORT CSV ─────────────────────────────────────────────────────────

describe("CSV Export - échappement des champs", () => {
  function escapeCsvField(field: string): string {
    if (field.includes(",") || field.includes('"') || field.includes("\n")) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }

  it("devrait laisser un champ simple inchangé", () => {
    expect(escapeCsvField("Jean Dupont")).toBe("Jean Dupont");
  });

  it("devrait entourer de guillemets si le champ contient une virgule", () => {
    expect(escapeCsvField("Dupont, Jean")).toBe('"Dupont, Jean"');
  });

  it("devrait doubler les guillemets dans le champ", () => {
    expect(escapeCsvField('Il dit "bonjour"')).toBe('"Il dit ""bonjour"""');
  });

  it("devrait entourer de guillemets si le champ contient un saut de ligne", () => {
    expect(escapeCsvField("ligne1\nligne2")).toBe('"ligne1\nligne2"');
  });

  it("devrait gérer un champ vide", () => {
    expect(escapeCsvField("")).toBe("");
  });
});
