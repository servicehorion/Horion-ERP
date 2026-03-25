import { ForecastService } from "@/lib/services/forecast.service";
import { prisma } from "@/lib/db";
import { FinanceIntelligenceService } from "@/lib/services/finance-intelligence.service";
import { StrategicIntelligenceService } from "@/lib/services/strategic-intelligence.service";

type HistoryPoint = {
  month: string;
  revenue: number;
  grossMargin: number;
  marginPercent: number;
  volumeKg: number;
  shipmentCount: number;
  cashNet: number;
  cashBalance: number;
};

type ForecastPoint = {
  month: string;
  revenue: number;
  marginPercent: number;
  grossMargin: number;
  volumeKg: number;
  shipmentCount: number;
  cashIn: number;
  cashOut: number;
  cashNet: number;
  cashBalance: number;
};

type ScenarioSummary = {
  revenue90d: number;
  grossMargin90d: number;
  marginPercent90d: number;
  importVolume90d: number;
  runwayMonths: number;
  riskLevel: "green" | "orange" | "red";
};

type Scenario = {
  key: string;
  name: string;
  type: "AUTO" | "MANUAL";
  assumptions: string[];
  points: ForecastPoint[];
  summary: ScenarioSummary;
};

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Avr", "Mai", "Jun", "Jul", "Aou", "Sep", "Oct", "Nov", "Dec"];

function addMonths(date: Date, amount: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount);
  return next;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string) {
  const [year, rawMonth] = month.split("-");
  const index = Math.max(0, Math.min(11, Number(rawMonth) - 1));
  return `${MONTH_LABELS[index]} ${year.slice(2)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function avg(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function computeSummary(points: ForecastPoint[], currentCash: number): ScenarioSummary {
  const firstQuarter = points.slice(0, 3);
  const revenue90d = firstQuarter.reduce((sum, point) => sum + point.revenue, 0);
  const grossMargin90d = firstQuarter.reduce((sum, point) => sum + point.grossMargin, 0);
  const importVolume90d = firstQuarter.reduce((sum, point) => sum + point.volumeKg, 0);
  const marginPercent90d = revenue90d > 0 ? (grossMargin90d / revenue90d) * 100 : 0;

  const negativeNets = points.map((point) => point.cashNet).filter((value) => value < 0);
  const avgBurn = negativeNets.length > 0 ? Math.abs(avg(negativeNets)) : 0;
  const runwayMonths = avgBurn > 0 ? round(Math.max(0, currentCash) / avgBurn, 1) : 12;

  const riskLevel =
    runwayMonths < 3 || marginPercent90d < 20
      ? "red"
      : runwayMonths < 6 || marginPercent90d < 28
        ? "orange"
        : "green";

  return {
    revenue90d: round(revenue90d),
    grossMargin90d: round(grossMargin90d),
    marginPercent90d: round(marginPercent90d, 1),
    importVolume90d: round(importVolume90d, 1),
    runwayMonths,
    riskLevel,
  };
}

export class StrategicForecastService {
  private static buildAutoScenario(params: {
    key: string;
    name: string;
    startMonth: Date;
    currentCash: number;
    baseRevenue: number;
    baseMarginPercent: number;
    baseVolume: number;
    baseShipmentCount: number;
    cashInRatio: number;
    cashOutRatio: number;
    revenueGrowth: number;
    volumeGrowth: number;
    growthDelta?: number;
    marginDelta?: number;
    cashInDelta?: number;
    cashOutDelta?: number;
    volumeDelta?: number;
    assumptions: string[];
  }): Scenario {
    const points: ForecastPoint[] = [];
    let rollingCash = params.currentCash;

    for (let index = 0; index < 6; index += 1) {
      const month = monthKey(addMonths(params.startMonth, index + 1));
      const revenueGrowth = params.revenueGrowth + (params.growthDelta ?? 0);
      const volumeGrowth = params.volumeGrowth + (params.volumeDelta ?? 0);
      const revenue = params.baseRevenue * Math.pow(1 + revenueGrowth, index + 1);
      const volumeKg = params.baseVolume * Math.pow(1 + volumeGrowth, index + 1);
      const shipmentCount = Math.max(1, Math.round(params.baseShipmentCount * Math.pow(1 + volumeGrowth, index + 1)));
      const marginPercent = clamp(params.baseMarginPercent + (params.marginDelta ?? 0), 8, 55);
      const grossMargin = revenue * (marginPercent / 100);
      const cashIn = revenue * clamp(params.cashInRatio + (params.cashInDelta ?? 0), 0.2, 1.2);
      const cashOut = revenue * clamp(params.cashOutRatio + (params.cashOutDelta ?? 0), 0.1, 1.1);
      const cashNet = cashIn - cashOut;
      rollingCash += cashNet;

      points.push({
        month,
        revenue: round(revenue),
        marginPercent: round(marginPercent, 1),
        grossMargin: round(grossMargin),
        volumeKg: round(volumeKg, 1),
        shipmentCount,
        cashIn: round(cashIn),
        cashOut: round(cashOut),
        cashNet: round(cashNet),
        cashBalance: round(rollingCash),
      });
    }

    return {
      key: params.key,
      name: params.name,
      type: "AUTO",
      assumptions: params.assumptions,
      summary: computeSummary(points, params.currentCash),
      points,
    };
  }

  static async getSnapshot(tenantId: string) {
    const now = new Date();
    const windowStart = addMonths(new Date(now.getFullYear(), now.getMonth(), 1), -5);

    const [orders, shipments, cashflow, intelligence, manualScenarios] = await Promise.all([
      prisma.order.findMany({
        where: { tenantId, createdAt: { gte: windowStart } },
        select: {
          createdAt: true,
          totalClient: true,
          marginReport: { select: { grossMargin: true, revenue: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.shipment.findMany({
        where: {
          order: { tenantId },
          createdAt: { gte: windowStart },
        },
        select: {
          createdAt: true,
          actualDeparture: true,
          estimatedDeparture: true,
          weight: true,
          volume: true,
        },
      }),
      FinanceIntelligenceService.getCashflowAnalysis(tenantId, 6),
      StrategicIntelligenceService.getSnapshot(tenantId),
      ForecastService.list(tenantId),
    ]);

    const historyMap = new Map<string, HistoryPoint>();
    for (let index = 0; index < 6; index += 1) {
      const month = monthKey(addMonths(windowStart, index));
      historyMap.set(month, {
        month,
        revenue: 0,
        grossMargin: 0,
        marginPercent: 0,
        volumeKg: 0,
        shipmentCount: 0,
        cashNet: 0,
        cashBalance: 0,
      });
    }

    for (const order of orders) {
      const key = monthKey(order.createdAt);
      const bucket = historyMap.get(key);
      if (!bucket) continue;
      const revenue = Number(order.marginReport?.revenue || order.totalClient || 0);
      const grossMargin = Number(order.marginReport?.grossMargin || 0);
      bucket.revenue += revenue;
      bucket.grossMargin += grossMargin;
    }

    for (const shipment of shipments) {
      const key = monthKey(shipment.actualDeparture || shipment.estimatedDeparture || shipment.createdAt);
      const bucket = historyMap.get(key);
      if (!bucket) continue;
      bucket.volumeKg += Number(shipment.weight || 0);
      bucket.shipmentCount += 1;
    }

    const cashByMonth = new Map(
      cashflow.map((point) => [
        point.month,
        { net: Number(point.net || 0), balance: Number(point.balance || 0) },
      ])
    );

    const history = Array.from(historyMap.values()).map((point) => {
      const cash = cashByMonth.get(point.month);
      const marginPercent = point.revenue > 0 ? (point.grossMargin / point.revenue) * 100 : 0;
      return {
        ...point,
        marginPercent: round(marginPercent, 1),
        cashNet: round(cash?.net || 0),
        cashBalance: round(cash?.balance || 0),
      };
    });

    const recentHistory = history.slice(-3);
    const previousHistory = history.slice(-6, -3);

    const baseRevenue = Math.max(avg(recentHistory.map((point) => point.revenue)), 1_000_000);
    const previousRevenue = Math.max(avg(previousHistory.map((point) => point.revenue)), baseRevenue);
    const baseMarginPercent = clamp(avg(recentHistory.map((point) => point.marginPercent)) || intelligence.kpis.marginPercent || 25, 8, 55);
    const baseVolume = Math.max(avg(recentHistory.map((point) => point.volumeKg)), avg(history.map((point) => point.volumeKg)), 100);
    const baseShipmentCount = Math.max(Math.round(avg(recentHistory.map((point) => point.shipmentCount))), 1);

    const revenueGrowth = clamp(previousRevenue > 0 ? (baseRevenue - previousRevenue) / previousRevenue : 0.05, -0.15, 0.2);
    const baseVolumePrevious = Math.max(avg(previousHistory.map((point) => point.volumeKg)), baseVolume);
    const volumeGrowth = clamp(baseVolumePrevious > 0 ? (baseVolume - baseVolumePrevious) / baseVolumePrevious : 0.05, -0.2, 0.2);

    const avgCashIn = Math.max(avg(cashflow.map((point) => point.inbound)), 1);
    const avgCashOut = Math.max(avg(cashflow.map((point) => point.outbound)), 1);
    const cashInRatio = clamp(avgCashIn / baseRevenue, 0.25, 1.1);
    const cashOutRatio = clamp(avgCashOut / baseRevenue, 0.2, 1.0);
    const currentCash = round(intelligence.kpis.cashPosition);

    const autoScenarios: Scenario[] = [
      this.buildAutoScenario({
        key: "base",
        name: "Base case",
        startMonth: now,
        currentCash,
        baseRevenue,
        baseMarginPercent,
        baseVolume,
        baseShipmentCount,
        cashInRatio,
        cashOutRatio,
        revenueGrowth,
        volumeGrowth,
        assumptions: [
          `Revenue trend ${round(revenueGrowth * 100, 1)}%/month`,
          `Margin anchored at ${round(baseMarginPercent, 1)}%`,
          "No structural change in payment behavior",
        ],
      }),
      this.buildAutoScenario({
        key: "growth-push",
        name: "Growth push",
        startMonth: now,
        currentCash,
        baseRevenue,
        baseMarginPercent,
        baseVolume,
        baseShipmentCount,
        cashInRatio,
        cashOutRatio,
        revenueGrowth,
        volumeGrowth,
        growthDelta: 0.08,
        marginDelta: -2,
        cashOutDelta: 0.04,
        volumeDelta: 0.08,
        assumptions: [
          "More aggressive commercial push",
          "Higher logistics and acquisition cost",
          "Margin compression accepted for growth",
        ],
      }),
      this.buildAutoScenario({
        key: "cash-preservation",
        name: "Cash preservation",
        startMonth: now,
        currentCash,
        baseRevenue,
        baseMarginPercent,
        baseVolume,
        baseShipmentCount,
        cashInRatio,
        cashOutRatio,
        revenueGrowth,
        volumeGrowth,
        growthDelta: -0.03,
        marginDelta: 3,
        cashInDelta: 0.04,
        cashOutDelta: -0.08,
        volumeDelta: -0.02,
        assumptions: [
          "Tighter payment discipline",
          "Focus on margin protection and cash collection",
          "Selective sourcing volume",
        ],
      }),
    ];

    const manualScenarioViews: Scenario[] = manualScenarios
      .filter((scenario: any) => scenario.lines.length > 0)
      .slice(0, 3)
      .map((scenario: any) => {
        let rollingCash = currentCash;
        const points = [...scenario.lines]
          .sort((left, right) => left.month.localeCompare(right.month))
          .map((line) => {
            const revenue = Number(line.revenue);
            const cogs = Number(line.cogs);
            const expenses = Number(line.expenses);
            const cashIn = Number(line.cashIn);
            const cashOut = Number(line.cashOut);
            const grossMargin = revenue - cogs - expenses;
            const marginPercent = revenue > 0 ? (grossMargin / revenue) * 100 : 0;
            const cashNet = cashIn - cashOut;
            rollingCash += cashNet;

            return {
              month: line.month,
              revenue: round(revenue),
              marginPercent: round(marginPercent, 1),
              grossMargin: round(grossMargin),
              volumeKg: 0,
              shipmentCount: 0,
              cashIn: round(cashIn),
              cashOut: round(cashOut),
              cashNet: round(cashNet),
              cashBalance: round(rollingCash),
            };
          });

        return {
          key: `manual-${scenario.id}`,
          name: scenario.name,
          type: "MANUAL" as const,
          assumptions: [`Manual finance scenario (${scenario.type})`, "Maintained from Finance OS"],
          points,
          summary: computeSummary(points, currentCash),
        };
      });

    const scenarios = [...autoScenarios, ...manualScenarioViews];
    const baseScenario = scenarios[0];

    const forecastRisks = [
      baseScenario.summary.runwayMonths < 3
        ? {
            title: "Cash runway below 3 months",
            severity: "red" as const,
            description: "Base scenario projects a critical treasury window.",
          }
        : null,
      baseScenario.summary.marginPercent90d < 20
        ? {
            title: "Projected margin below 20%",
            severity: "red" as const,
            description: "Margin protection would be breached in the base scenario.",
          }
        : null,
      autoScenarios[1].summary.marginPercent90d < autoScenarios[0].summary.marginPercent90d
        ? {
            title: "Growth push compresses margin",
            severity: "orange" as const,
            description: "Growth scenario adds volume but erodes margin and cash efficiency.",
          }
        : null,
      autoScenarios[2].summary.revenue90d < autoScenarios[0].summary.revenue90d
        ? {
            title: "Cash preservation slows topline",
            severity: "orange" as const,
            description: "Conservative scenario protects cash but reduces revenue momentum.",
          }
        : null,
    ].filter(Boolean) as Array<{ title: string; severity: "red" | "orange"; description: string }>;

    return {
      generatedAt: new Date().toISOString(),
      history: history.map((point) => ({
        ...point,
        label: monthLabel(point.month),
      })),
      scenarios: scenarios.map((scenario) => ({
        ...scenario,
        points: scenario.points.map((point) => ({
          ...point,
          label: monthLabel(point.month),
        })),
      })),
      kpis: {
        forecastRevenue90d: baseScenario.summary.revenue90d,
        forecastMarginPercent: baseScenario.summary.marginPercent90d,
        forecastImportVolume90d: baseScenario.summary.importVolume90d,
        cashRunwayMonths: baseScenario.summary.runwayMonths,
      },
      forecastRisks,
      analystNotes: [
        `Base scenario projects ${round(baseScenario.summary.revenue90d).toLocaleString("fr-FR")} over 90 days.`,
        `Cash runway is estimated at ${baseScenario.summary.runwayMonths} months in the base case.`,
        `Growth push changes margin to ${round(autoScenarios[1].summary.marginPercent90d, 1)}%.`,
      ],
    };
  }
}
