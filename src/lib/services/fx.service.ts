import { prisma } from "@/lib/db";
import { DEFAULT_FX_RATES } from "@/config/currencies";

const PAIRS = [
  { from: "USD", to: "XAF", key: "USD_XAF" },
  { from: "EUR", to: "XAF", key: "EUR_XAF" },
  { from: "RMB", to: "XAF", key: "RMB_XAF" },
  { from: "USD", to: "RMB", key: "USD_RMB" },
];

export type FxRateMap = Record<string, number>;

export class FxService {
  static async getLatestRates(): Promise<FxRateMap> {
    const rates: FxRateMap = { ...DEFAULT_FX_RATES };

    const latestRates = await prisma.fXRate.findMany({
      where: {
        OR: PAIRS.map((p) => ({ fromCurrency: p.from, toCurrency: p.to })),
      },
      orderBy: { effectiveAt: "desc" },
      take: PAIRS.length * 2,
    });

    for (const pair of PAIRS) {
      const rate = latestRates.find(
        (r) => r.fromCurrency === pair.from && r.toCurrency === pair.to
      );
      if (rate) {
        rates[pair.key] = Number(rate.rate);
      }
    }

    return rates;
  }

  static buildSnapshot(rates: FxRateMap): FxRateMap {
    return { ...rates };
  }
}
