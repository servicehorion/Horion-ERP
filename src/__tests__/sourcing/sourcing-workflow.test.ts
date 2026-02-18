/**
 * Tests unitaires - Sourcing workflow
 *
 * Valide la logique métier du workflow sourcing :
 * transitions de statut, comparaison d'offres, sélection fournisseur
 */

import { describe, it, expect } from "vitest";

// ─── Helpers reproduisant la logique du service ──────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  SEARCHING: ["OFFERS_RECEIVED", "CANCELLED"],
  OFFERS_RECEIVED: ["NEGOTIATING", "SELECTED", "CANCELLED"],
  NEGOTIATING: ["SELECTED", "OFFERS_RECEIVED", "CANCELLED"],
  SELECTED: ["CONFIRMED", "NEGOTIATING", "CANCELLED"],
  CONFIRMED: [],
  CANCELLED: ["SEARCHING"],
};

function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

interface Offer {
  id: string;
  supplierId: string;
  unitPrice: number;
  currency: string;
  moq: number | null;
  leadTimeDays: number | null;
  sampleAvailable: boolean;
}

function rankOffersByPrice(offers: Offer[]): Offer[] {
  return [...offers].sort((a, b) => a.unitPrice - b.unitPrice);
}

function rankOffersByLeadTime(offers: Offer[]): Offer[] {
  return [...offers]
    .filter((o) => o.leadTimeDays != null)
    .sort((a, b) => a.leadTimeDays! - b.leadTimeDays!);
}

function calculateOfferScore(offer: Offer, budget: number): number {
  // Price score (40%): how close to budget
  const priceRatio = offer.unitPrice / budget;
  const priceScore = priceRatio <= 1 ? 100 : Math.max(0, 100 - (priceRatio - 1) * 200);

  // Lead time score (30%): shorter is better
  const leadScore = offer.leadTimeDays
    ? Math.max(0, 100 - (offer.leadTimeDays / 60) * 100)
    : 50;

  // MOQ score (20%): lower is better
  const moqScore = offer.moq ? Math.max(0, 100 - (offer.moq / 1000) * 100) : 50;

  // Sample score (10%)
  const sampleScore = offer.sampleAvailable ? 100 : 0;

  return Math.round(
    priceScore * 0.4 + leadScore * 0.3 + moqScore * 0.2 + sampleScore * 0.1
  );
}

function escapeCSV(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Sourcing Workflow - Status Transitions", () => {
  it("should allow SEARCHING → OFFERS_RECEIVED", () => {
    expect(isValidTransition("SEARCHING", "OFFERS_RECEIVED")).toBe(true);
  });

  it("should allow SEARCHING → CANCELLED", () => {
    expect(isValidTransition("SEARCHING", "CANCELLED")).toBe(true);
  });

  it("should NOT allow SEARCHING → CONFIRMED", () => {
    expect(isValidTransition("SEARCHING", "CONFIRMED")).toBe(false);
  });

  it("should NOT allow SEARCHING → SELECTED", () => {
    expect(isValidTransition("SEARCHING", "SELECTED")).toBe(false);
  });

  it("should allow OFFERS_RECEIVED → NEGOTIATING", () => {
    expect(isValidTransition("OFFERS_RECEIVED", "NEGOTIATING")).toBe(true);
  });

  it("should allow OFFERS_RECEIVED → SELECTED (skip negotiation)", () => {
    expect(isValidTransition("OFFERS_RECEIVED", "SELECTED")).toBe(true);
  });

  it("should allow NEGOTIATING → SELECTED", () => {
    expect(isValidTransition("NEGOTIATING", "SELECTED")).toBe(true);
  });

  it("should allow NEGOTIATING → OFFERS_RECEIVED (back to review)", () => {
    expect(isValidTransition("NEGOTIATING", "OFFERS_RECEIVED")).toBe(true);
  });

  it("should allow SELECTED → CONFIRMED", () => {
    expect(isValidTransition("SELECTED", "CONFIRMED")).toBe(true);
  });

  it("should allow SELECTED → NEGOTIATING (re-negotiate)", () => {
    expect(isValidTransition("SELECTED", "NEGOTIATING")).toBe(true);
  });

  it("should NOT allow CONFIRMED → anything", () => {
    expect(isValidTransition("CONFIRMED", "SEARCHING")).toBe(false);
    expect(isValidTransition("CONFIRMED", "CANCELLED")).toBe(false);
    expect(isValidTransition("CONFIRMED", "NEGOTIATING")).toBe(false);
  });

  it("should allow CANCELLED → SEARCHING (reopen)", () => {
    expect(isValidTransition("CANCELLED", "SEARCHING")).toBe(true);
  });

  it("should NOT allow CANCELLED → CONFIRMED", () => {
    expect(isValidTransition("CANCELLED", "CONFIRMED")).toBe(false);
  });
});

describe("Offer Ranking", () => {
  const offers: Offer[] = [
    { id: "1", supplierId: "s1", unitPrice: 15.50, currency: "RMB", moq: 100, leadTimeDays: 14, sampleAvailable: true },
    { id: "2", supplierId: "s2", unitPrice: 12.00, currency: "RMB", moq: 500, leadTimeDays: 21, sampleAvailable: false },
    { id: "3", supplierId: "s3", unitPrice: 18.00, currency: "RMB", moq: 50, leadTimeDays: 7, sampleAvailable: true },
  ];

  it("should rank by price ascending", () => {
    const ranked = rankOffersByPrice(offers);
    expect(ranked[0].id).toBe("2");
    expect(ranked[1].id).toBe("1");
    expect(ranked[2].id).toBe("3");
  });

  it("should rank by lead time ascending", () => {
    const ranked = rankOffersByLeadTime(offers);
    expect(ranked[0].id).toBe("3");
    expect(ranked[1].id).toBe("1");
    expect(ranked[2].id).toBe("2");
  });

  it("should handle offers without lead time in lead time ranking", () => {
    const withNull = [...offers, { id: "4", supplierId: "s4", unitPrice: 10, currency: "RMB", moq: null, leadTimeDays: null, sampleAvailable: false }];
    const ranked = rankOffersByLeadTime(withNull);
    expect(ranked.length).toBe(3); // null filtered out
  });
});

describe("Offer Scoring", () => {
  it("should give high score to cheap, fast, low-MOQ offer with sample", () => {
    const score = calculateOfferScore(
      { id: "1", supplierId: "s1", unitPrice: 10, currency: "RMB", moq: 50, leadTimeDays: 7, sampleAvailable: true },
      20
    );
    expect(score).toBeGreaterThan(70);
  });

  it("should give low score to expensive, slow, high-MOQ offer without sample", () => {
    const score = calculateOfferScore(
      { id: "2", supplierId: "s2", unitPrice: 50, currency: "RMB", moq: 2000, leadTimeDays: 90, sampleAvailable: false },
      20
    );
    expect(score).toBeLessThan(30);
  });

  it("should give higher score to offer at budget vs over budget", () => {
    const atBudget = calculateOfferScore(
      { id: "1", supplierId: "s1", unitPrice: 20, currency: "RMB", moq: 100, leadTimeDays: 14, sampleAvailable: true },
      20
    );
    const overBudget = calculateOfferScore(
      { id: "2", supplierId: "s2", unitPrice: 30, currency: "RMB", moq: 100, leadTimeDays: 14, sampleAvailable: true },
      20
    );
    expect(atBudget).toBeGreaterThan(overBudget);
  });

  it("should give bonus for sample availability", () => {
    const withSample = calculateOfferScore(
      { id: "1", supplierId: "s1", unitPrice: 15, currency: "RMB", moq: 100, leadTimeDays: 14, sampleAvailable: true },
      20
    );
    const noSample = calculateOfferScore(
      { id: "2", supplierId: "s2", unitPrice: 15, currency: "RMB", moq: 100, leadTimeDays: 14, sampleAvailable: false },
      20
    );
    expect(withSample).toBeGreaterThan(noSample);
  });
});

describe("Sourcing CSV Export", () => {
  it("should escape double quotes in CSV fields", () => {
    expect(escapeCSV('Test "value"')).toBe('"Test ""value"""');
  });

  it("should wrap commas in quotes", () => {
    expect(escapeCSV("Guangzhou, Chine")).toBe('"Guangzhou, Chine"');
  });

  it("should handle empty strings", () => {
    expect(escapeCSV("")).toBe('""');
  });
});
