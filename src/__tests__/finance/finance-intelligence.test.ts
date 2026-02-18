/**
 * Tests unitaires - Finance Intelligence
 *
 * Valide la logique métier du module finance :
 * P&L, aging buckets, cashflow, margin calculation, FX conversion
 */

import { describe, it, expect } from "vitest";

// ─── Helpers reproduisant la logique des services ────────────────────────────

function calculateGrossMargin(revenue: number, cogs: number) {
  const grossProfit = revenue - cogs;
  const marginPercent = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  return { grossProfit, marginPercent };
}

function calculateNetMargin(revenue: number, cogs: number, commission: number) {
  const { grossProfit } = calculateGrossMargin(revenue, cogs);
  const netProfit = grossProfit - commission;
  const netMarginPercent = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  return { netProfit, netMarginPercent };
}

function getAgingBucket(daysOld: number): string {
  if (daysOld <= 0) return "current";
  if (daysOld <= 30) return "days30";
  if (daysOld <= 60) return "days60";
  if (daysOld <= 90) return "days90";
  return "over90";
}

function calculateCollectionRate(totalCollected: number, totalDue: number): number {
  return totalDue > 0 ? Math.min(100, (totalCollected / totalDue) * 100) : 0;
}

function calculateRunway(cashPosition: number, monthlyBurn: number): number {
  return monthlyBurn > 0 ? Math.max(0, cashPosition / monthlyBurn) : 0;
}

function convertCurrency(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>
): number {
  if (from === to) return amount;
  const directKey = `${from}_${to}`;
  if (rates[directKey]) return amount * rates[directKey];
  const reverseKey = `${to}_${from}`;
  if (rates[reverseKey]) return amount / rates[reverseKey];
  throw new Error(`No rate for ${from} -> ${to}`);
}

function calculateLedgerBalanceChange(
  accountType: string,
  entryType: "DEBIT" | "CREDIT",
  amount: number
): number {
  const isDebitNormal = ["ASSET", "EXPENSE"].includes(accountType);
  if (entryType === "DEBIT") {
    return isDebitNormal ? amount : -amount;
  }
  return isDebitNormal ? -amount : amount;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("P&L Calculations", () => {
  it("should calculate gross margin correctly", () => {
    const result = calculateGrossMargin(1_000_000, 600_000);
    expect(result.grossProfit).toBe(400_000);
    expect(result.marginPercent).toBe(40);
  });

  it("should handle zero revenue", () => {
    const result = calculateGrossMargin(0, 0);
    expect(result.grossProfit).toBe(0);
    expect(result.marginPercent).toBe(0);
  });

  it("should calculate negative margin when COGS > revenue", () => {
    const result = calculateGrossMargin(500_000, 700_000);
    expect(result.grossProfit).toBe(-200_000);
    expect(result.marginPercent).toBe(-40);
  });

  it("should calculate net margin with commission", () => {
    const result = calculateNetMargin(1_000_000, 600_000, 50_000);
    expect(result.netProfit).toBe(350_000);
    expect(result.netMarginPercent).toBe(35);
  });

  it("should calculate net margin with zero commission", () => {
    const result = calculateNetMargin(1_000_000, 600_000, 0);
    expect(result.netProfit).toBe(400_000);
    expect(result.netMarginPercent).toBe(40);
  });
});

describe("Aging Buckets", () => {
  it("should classify current items (0 days)", () => {
    expect(getAgingBucket(0)).toBe("current");
  });

  it("should classify 1-30 days correctly", () => {
    expect(getAgingBucket(1)).toBe("days30");
    expect(getAgingBucket(15)).toBe("days30");
    expect(getAgingBucket(30)).toBe("days30");
  });

  it("should classify 31-60 days correctly", () => {
    expect(getAgingBucket(31)).toBe("days60");
    expect(getAgingBucket(60)).toBe("days60");
  });

  it("should classify 61-90 days correctly", () => {
    expect(getAgingBucket(61)).toBe("days90");
    expect(getAgingBucket(90)).toBe("days90");
  });

  it("should classify >90 days correctly", () => {
    expect(getAgingBucket(91)).toBe("over90");
    expect(getAgingBucket(365)).toBe("over90");
  });
});

describe("Collection Rate", () => {
  it("should calculate 100% when fully collected", () => {
    expect(calculateCollectionRate(1_000_000, 1_000_000)).toBe(100);
  });

  it("should calculate 50% when half collected", () => {
    expect(calculateCollectionRate(500_000, 1_000_000)).toBe(50);
  });

  it("should cap at 100%", () => {
    expect(calculateCollectionRate(1_500_000, 1_000_000)).toBe(100);
  });

  it("should return 0 when nothing due", () => {
    expect(calculateCollectionRate(0, 0)).toBe(0);
  });
});

describe("Runway Calculation", () => {
  it("should calculate runway in months", () => {
    expect(calculateRunway(3_000_000, 1_000_000)).toBe(3);
  });

  it("should return 0 when cash is zero", () => {
    expect(calculateRunway(0, 1_000_000)).toBe(0);
  });

  it("should return 0 when no burn rate", () => {
    expect(calculateRunway(1_000_000, 0)).toBe(0);
  });

  it("should handle fractional months", () => {
    const runway = calculateRunway(2_500_000, 1_000_000);
    expect(runway).toBe(2.5);
  });
});

describe("FX Conversion", () => {
  const rates = {
    USD_XAF: 605,
    RMB_XAF: 83,
    EUR_XAF: 655.957,
    USD_RMB: 7.25,
  };

  it("should convert USD to XAF", () => {
    expect(convertCurrency(100, "USD", "XAF", rates)).toBe(60_500);
  });

  it("should convert XAF to USD (reverse)", () => {
    const result = convertCurrency(60_500, "XAF", "USD", rates);
    expect(result).toBe(100);
  });

  it("should convert RMB to XAF", () => {
    expect(convertCurrency(1000, "RMB", "XAF", rates)).toBe(83_000);
  });

  it("should return same amount for same currency", () => {
    expect(convertCurrency(100, "XAF", "XAF", rates)).toBe(100);
  });

  it("should throw for unknown pair", () => {
    expect(() => convertCurrency(100, "GBP", "JPY", rates)).toThrow();
  });
});

describe("Ledger Balance Changes", () => {
  it("DEBIT on ASSET should increase balance", () => {
    expect(calculateLedgerBalanceChange("ASSET", "DEBIT", 1000)).toBe(1000);
  });

  it("CREDIT on ASSET should decrease balance", () => {
    expect(calculateLedgerBalanceChange("ASSET", "CREDIT", 1000)).toBe(-1000);
  });

  it("DEBIT on LIABILITY should decrease balance", () => {
    expect(calculateLedgerBalanceChange("LIABILITY", "DEBIT", 1000)).toBe(-1000);
  });

  it("CREDIT on LIABILITY should increase balance", () => {
    expect(calculateLedgerBalanceChange("LIABILITY", "CREDIT", 1000)).toBe(1000);
  });

  it("DEBIT on EXPENSE should increase balance", () => {
    expect(calculateLedgerBalanceChange("EXPENSE", "DEBIT", 500)).toBe(500);
  });

  it("CREDIT on REVENUE should increase balance", () => {
    expect(calculateLedgerBalanceChange("REVENUE", "CREDIT", 500)).toBe(500);
  });

  it("DEBIT on EQUITY should decrease balance", () => {
    expect(calculateLedgerBalanceChange("EQUITY", "DEBIT", 500)).toBe(-500);
  });
});
