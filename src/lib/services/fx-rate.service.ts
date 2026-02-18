import { prisma } from "@/lib/db";

export class FXRateService {
  static async create(data: {
    fromCurrency: string;
    toCurrency: string;
    rate: number;
    source?: string;
    effectiveAt?: Date;
  }) {
    return prisma.fXRate.create({
      data: {
        fromCurrency: data.fromCurrency,
        toCurrency: data.toCurrency,
        rate: data.rate,
        source: data.source || "manual",
        effectiveAt: data.effectiveAt || new Date(),
      },
    });
  }

  static async getLatestRate(fromCurrency: string, toCurrency: string) {
    return prisma.fXRate.findFirst({
      where: { fromCurrency, toCurrency },
      orderBy: { effectiveAt: "desc" },
    });
  }

  static async getLatestRates() {
    // Get the most recent rate for each pair
    const pairs = [
      { from: "USD", to: "XAF" },
      { from: "RMB", to: "XAF" },
      { from: "EUR", to: "XAF" },
      { from: "USD", to: "RMB" },
    ];

    const rates = await Promise.all(
      pairs.map(async (p) => {
        const rate = await prisma.fXRate.findFirst({
          where: { fromCurrency: p.from, toCurrency: p.to },
          orderBy: { effectiveAt: "desc" },
        });
        return { pair: `${p.from}/${p.to}`, ...rate };
      })
    );

    return rates;
  }

  static async getHistory(
    fromCurrency: string,
    toCurrency: string,
    options: { limit?: number } = {}
  ) {
    return prisma.fXRate.findMany({
      where: { fromCurrency, toCurrency },
      orderBy: { effectiveAt: "desc" },
      take: options.limit || 30,
    });
  }

  static async convert(amount: number, fromCurrency: string, toCurrency: string): Promise<number> {
    if (fromCurrency === toCurrency) return amount;

    // Try direct rate
    const direct = await this.getLatestRate(fromCurrency, toCurrency);
    if (direct) return amount * Number(direct.rate);

    // Try reverse rate
    const reverse = await this.getLatestRate(toCurrency, fromCurrency);
    if (reverse) return amount / Number(reverse.rate);

    // Fallback to hardcoded rates
    const FALLBACK: Record<string, number> = {
      USD_XAF: 605,
      RMB_XAF: 83,
      EUR_XAF: 655.957,
      USD_RMB: 7.25,
    };

    const directKey = `${fromCurrency}_${toCurrency}`;
    if (FALLBACK[directKey]) return amount * FALLBACK[directKey];

    const reverseKey = `${toCurrency}_${fromCurrency}`;
    if (FALLBACK[reverseKey]) return amount / FALLBACK[reverseKey];

    throw new Error(`Pas de taux de change pour ${fromCurrency} → ${toCurrency}`);
  }
}
