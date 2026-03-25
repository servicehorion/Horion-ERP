import { prisma } from "@/lib/db";
import { FinanceIntelligenceService } from "@/lib/services/finance-intelligence.service";

export type StrategicKpis = {
  marginPercent: number;
  cashPosition: number;
  overdueRate: number;
  crmConversionRate: number;
  pipelineValue: number;
  sourcingSlaBreachRate: number;
  logisticsDelayRate: number;
  delayedShipments: number;
  qcPassRate: number;
  qcFailRate: number;
};

export type HealthRadarPoint = {
  module: string;
  score: number;
  status: "green" | "orange" | "red";
  details: string;
  href: string;
};

export type SignalItem = {
  id: string;
  severity: "red" | "orange" | "green";
  title: string;
  description: string;
  metric: string;
  value: number;
  href: string;
  createdAt: string;
};

export type StrategicIntelligenceSnapshot = {
  generatedAt: string;
  kpis: StrategicKpis;
  healthRadar: HealthRadarPoint[];
  anomalies: SignalItem[];
  signals: {
    red: SignalItem[];
    orange: SignalItem[];
    green: SignalItem[];
  };
  operationalHealth: { score: number; status: "green" | "orange" | "red" };
  suggestedPriorities: Array<{ title: string; reason: string; href: string; severity: "high" | "medium" | "low" }>;
  objectives: Array<{ id: string; title: string; progress: number; status: string; targetDate?: string | null }>;
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const scoreFromRate = (rate: number, penalty = 120) => clamp(100 - rate * penalty);

const statusFromScore = (score: number): "green" | "orange" | "red" => {
  if (score >= 75) return "green";
  if (score >= 55) return "orange";
  return "red";
};

export class StrategicIntelligenceService {
  static async getSnapshot(tenantId: string): Promise<StrategicIntelligenceSnapshot> {
    const now = new Date();

    const [leadGroups, leadPipeline, marginAvg, aging, delayedShipments, shipmentsTotal, qcReports, sourcingTasksTotal, sourcingTasksBreach, cashPositionRaw, goals] = await Promise.all([
      prisma.lead.groupBy({
        by: ["status"],
        where: { isArchived: false, contact: { tenantId } },
        _count: { status: true },
      }),
      prisma.lead.aggregate({
        where: { isArchived: false, contact: { tenantId }, status: { notIn: ["WON", "LOST"] } },
        _sum: { estimatedValue: true },
      }),
      prisma.marginReport.aggregate({
        where: { order: { tenantId } },
        _avg: { marginPercent: true },
      }),
      FinanceIntelligenceService.getAgingReport(tenantId),
      prisma.shipment.count({
        where: { order: { tenantId }, estimatedArrival: { lt: now }, actualArrival: null },
      }),
      prisma.shipment.count({
        where: { order: { tenantId }, actualArrival: null },
      }),
      prisma.qCReport.findMany({
        where: { qcRequest: { is: { order: { tenantId } } } },
        select: { overallResult: true },
      }),
      prisma.task.count({
        where: { tenantId, module: "sourcing", status: { notIn: ["COMPLETED", "CANCELLED"] } },
      }),
      prisma.task.count({
        where: { tenantId, module: "sourcing", slaBreach: true, status: { notIn: ["COMPLETED", "CANCELLED"] } },
      }),
      prisma.payment.groupBy({
        by: ["direction"],
        where: { status: "CONFIRMED", order: { tenantId } },
        _sum: { amountXAF: true },
      }),
      prisma.goal.findMany({
        where: { tenantId, isArchived: false },
        select: { id: true, title: true, progress: true, status: true, targetDate: true },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
    ]);

    const totalLeads = leadGroups.reduce((s, g) => s + g._count.status, 0);
    const wonLeads = leadGroups.find((g) => g.status === "WON")?._count.status || 0;
    const crmConversionRate = totalLeads ? wonLeads / totalLeads : 0;
    const pipelineValue = Number(leadPipeline._sum?.estimatedValue || 0);

    const marginPercent = Number(marginAvg._avg?.marginPercent || 0);

    const totalOutstanding = aging.totalOutstanding || 0;
    const overdue = (aging.totals?.days60 || 0) + (aging.totals?.days90 || 0) + (aging.totals?.over90 || 0);
    const overdueRate = totalOutstanding ? overdue / totalOutstanding : 0;

    const delayRate = shipmentsTotal ? delayedShipments / shipmentsTotal : 0;

    const qcTotal = qcReports.length;
    const qcPassed = qcReports.filter((r) => ["PASS", "PASS_WITH_WARNING", "PASS_WITH_WARNINGS"].includes((r.overallResult || "").toUpperCase())).length;
    const qcFailed = qcTotal - qcPassed;
    const qcPassRate = qcTotal ? qcPassed / qcTotal : 1;
    const qcFailRate = qcTotal ? qcFailed / qcTotal : 0;

    const sourcingSlaBreachRate = sourcingTasksTotal ? sourcingTasksBreach / sourcingTasksTotal : 0;

    const cashPosition = cashPositionRaw.reduce((acc, item) => {
      const amount = Number(item._sum?.amountXAF || 0);
      return item.direction === "INBOUND" ? acc + amount : acc - amount;
    }, 0);

    const kpis: StrategicKpis = {
      marginPercent,
      cashPosition,
      overdueRate,
      crmConversionRate,
      pipelineValue,
      sourcingSlaBreachRate,
      logisticsDelayRate: delayRate,
      delayedShipments,
      qcPassRate,
      qcFailRate,
    };

    const healthRadar: HealthRadarPoint[] = [
      {
        module: "CRM",
        score: scoreFromRate(1 - crmConversionRate, 120),
        status: statusFromScore(scoreFromRate(1 - crmConversionRate, 120)),
        details: `Conversion ${(crmConversionRate * 100).toFixed(1)}%`,
        href: "/crm",
      },
      {
        module: "Sourcing",
        score: scoreFromRate(sourcingSlaBreachRate, 130),
        status: statusFromScore(scoreFromRate(sourcingSlaBreachRate, 130)),
        details: `SLA breach ${(sourcingSlaBreachRate * 100).toFixed(1)}%`,
        href: "/sourcing",
      },
      {
        module: "Logistics",
        score: scoreFromRate(delayRate, 140),
        status: statusFromScore(scoreFromRate(delayRate, 140)),
        details: `Delays ${(delayRate * 100).toFixed(1)}%`,
        href: "/logistics",
      },
      {
        module: "Finance",
        score: scoreFromRate(overdueRate, 150),
        status: statusFromScore(scoreFromRate(overdueRate, 150)),
        details: `Overdue ${(overdueRate * 100).toFixed(1)}%`,
        href: "/finance",
      },
      {
        module: "QC",
        score: scoreFromRate(qcFailRate, 160),
        status: statusFromScore(scoreFromRate(qcFailRate, 160)),
        details: `Pass ${(qcPassRate * 100).toFixed(1)}%`,
        href: "/qc",
      },
    ];

    const operationalHealthScore = Math.round(
      healthRadar.reduce((s, m) => s + m.score, 0) / healthRadar.length
    );

    const anomalies: SignalItem[] = [];
    const pushSignal = (signal: Omit<SignalItem, "id" | "createdAt">) => {
      anomalies.push({
        id: `${signal.metric}-${anomalies.length + 1}`,
        createdAt: now.toISOString(),
        ...signal,
      });
    };

    if (marginPercent < 20) {
      pushSignal({
        severity: "red",
        title: "Margin below 20%",
        description: "Gross margin has dropped under the protection threshold.",
        metric: "marginPercent",
        value: marginPercent,
        href: "/finance/margins",
      });
    } else if (marginPercent < 30) {
      pushSignal({
        severity: "orange",
        title: "Margin under 30%",
        description: "Margin is trending down; review pricing and sourcing cost.",
        metric: "marginPercent",
        value: marginPercent,
        href: "/finance/margins",
      });
    }

    if (delayRate > 0.2) {
      pushSignal({
        severity: "red",
        title: "High logistics delays",
        description: "More than 20% of active shipments are late.",
        metric: "logisticsDelayRate",
        value: delayRate,
        href: "/logistics",
      });
    } else if (delayRate > 0.1) {
      pushSignal({
        severity: "orange",
        title: "Rising logistics delays",
        description: "Delays above 10% on active shipments.",
        metric: "logisticsDelayRate",
        value: delayRate,
        href: "/logistics",
      });
    }

    if (qcFailRate > 0.08) {
      pushSignal({
        severity: "red",
        title: "QC failures increasing",
        description: "Fail rate above 8% in recent reports.",
        metric: "qcFailRate",
        value: qcFailRate,
        href: "/qc",
      });
    } else if (qcFailRate > 0.04) {
      pushSignal({
        severity: "orange",
        title: "QC warnings",
        description: "Fail rate above 4%.",
        metric: "qcFailRate",
        value: qcFailRate,
        href: "/qc",
      });
    }

    if (cashPosition < 0) {
      pushSignal({
        severity: "red",
        title: "Negative cash position",
        description: "Immediate cash preservation actions required.",
        metric: "cashPosition",
        value: cashPosition,
        href: "/finance",
      });
    }

    if (overdueRate > 0.35) {
      pushSignal({
        severity: "red",
        title: "Receivables overdue",
        description: "Overdue receivables above 35%.",
        metric: "overdueRate",
        value: overdueRate,
        href: "/finance/tax",
      });
    } else if (overdueRate > 0.2) {
      pushSignal({
        severity: "orange",
        title: "Overdue receivables rising",
        description: "Receivables above 20% overdue.",
        metric: "overdueRate",
        value: overdueRate,
        href: "/finance/tax",
      });
    }

    if (crmConversionRate < 0.12) {
      pushSignal({
        severity: "red",
        title: "CRM conversion low",
        description: "Win rate below 12%.",
        metric: "crmConversionRate",
        value: crmConversionRate,
        href: "/crm",
      });
    } else if (crmConversionRate < 0.2) {
      pushSignal({
        severity: "orange",
        title: "CRM conversion soft",
        description: "Win rate below 20%.",
        metric: "crmConversionRate",
        value: crmConversionRate,
        href: "/crm",
      });
    }

    if (sourcingSlaBreachRate > 0.2) {
      pushSignal({
        severity: "red",
        title: "Sourcing SLA breached",
        description: "More than 20% of sourcing tasks breach SLA.",
        metric: "sourcingSlaBreachRate",
        value: sourcingSlaBreachRate,
        href: "/sourcing",
      });
    } else if (sourcingSlaBreachRate > 0.1) {
      pushSignal({
        severity: "orange",
        title: "Sourcing SLA warning",
        description: "Sourcing SLA breach rate above 10%.",
        metric: "sourcingSlaBreachRate",
        value: sourcingSlaBreachRate,
        href: "/sourcing",
      });
    }

    if (marginPercent >= 30) {
      pushSignal({
        severity: "green",
        title: "Margin healthy",
        description: "Margin is above the protection threshold.",
        metric: "marginPercent",
        value: marginPercent,
        href: "/finance/margins",
      });
    }

    if (qcPassRate >= 0.95) {
      pushSignal({
        severity: "green",
        title: "QC under control",
        description: "QC pass rate is above 95%.",
        metric: "qcPassRate",
        value: qcPassRate,
        href: "/qc",
      });
    }

    if (crmConversionRate >= 0.2) {
      pushSignal({
        severity: "green",
        title: "CRM conversion solid",
        description: "Sales conversion is above 20%.",
        metric: "crmConversionRate",
        value: crmConversionRate,
        href: "/crm",
      });
    }

    const signals = {
      red: anomalies.filter((a) => a.severity === "red"),
      orange: anomalies.filter((a) => a.severity === "orange"),
      green: anomalies.filter((a) => a.severity === "green"),
    };

    const suggestedPriorities = anomalies
      .filter((a) => a.severity === "red" || a.severity === "orange")
      .map((a) => ({
        title: a.title,
        reason: a.description,
        href: a.href,
        severity: (a.severity === "red" ? "high" : "medium") as "high" | "medium" | "low",
      }));

    return {
      generatedAt: now.toISOString(),
      kpis,
      healthRadar,
      anomalies,
      signals,
      operationalHealth: {
        score: operationalHealthScore,
        status: statusFromScore(operationalHealthScore),
      },
      suggestedPriorities,
      objectives: goals.map((g) => ({
        id: g.id,
        title: g.title,
        progress: g.progress,
        status: g.status,
        targetDate: g.targetDate ? g.targetDate.toISOString() : null,
      })),
    };
  }
}
