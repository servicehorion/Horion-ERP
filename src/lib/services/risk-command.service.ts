import { prisma } from "@/lib/db";
import { NotificationService } from "@/lib/services/notification.service";
import { StrategicIntelligenceService } from "@/lib/services/strategic-intelligence.service";
import type { RiskLevel, StrategicRiskCategory, StrategicRiskStatus, UserRole } from "@prisma/client";

type RiskCandidate = {
  fingerprint: string;
  title: string;
  description: string;
  category: StrategicRiskCategory;
  severity: RiskLevel;
  sourceMetric: string;
  sourceValue: number;
  thresholdValue: number;
  impactAreas: string[];
  linkedHref: string;
  linkedEntityType?: string;
  linkedEntityId?: string;
  mitigationPlan: Array<{ title: string; ownerArea: string; module: string }>;
  escalationRules: Array<{ condition: string; action: string }>;
};

const RISK_CATEGORY_LABELS: Record<StrategicRiskCategory, string> = {
  FINANCIAL: "Financial",
  LOGISTICS: "Logistics",
  SUPPLIER: "Supplier",
  QUALITY: "Quality",
  CRM: "CRM",
  OPERATIONAL: "Operational",
};

const OWNER_ROLE_PRIORITY: Record<StrategicRiskCategory, UserRole[]> = {
  FINANCIAL: ["FINANCE_MANAGER", "FINANCE", "CEO", "ADMIN", "DIRECTION"],
  LOGISTICS: ["LOGISTICS_MANAGER", "OPS", "CEO", "ADMIN", "DIRECTION"],
  SUPPLIER: ["SOURCING_ASSISTANT", "OPS", "CEO", "ADMIN", "DIRECTION"],
  QUALITY: ["OPS", "CEO", "ADMIN", "DIRECTION"],
  CRM: ["CRM_MANAGER", "COMMERCIAL", "CEO", "ADMIN", "DIRECTION"],
  OPERATIONAL: ["OPS", "CEO", "ADMIN", "DIRECTION"],
};

const MODULE_BY_CATEGORY: Record<StrategicRiskCategory, string> = {
  FINANCIAL: "finance",
  LOGISTICS: "logistics",
  SUPPLIER: "sourcing",
  QUALITY: "qc",
  CRM: "crm",
  OPERATIONAL: "orders",
};

const SEVERITY_WEIGHT: Record<RiskLevel, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function severityFromScore(score: number): RiskLevel {
  if (score >= 90) return "CRITICAL";
  if (score >= 70) return "HIGH";
  if (score >= 45) return "MEDIUM";
  return "LOW";
}

function scoreFromRatio(value: number, threshold: number) {
  if (threshold <= 0) return 0;
  return clamp((value / threshold) * 100, 0, 100);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths(date: Date, amount: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount);
  return next;
}

export class RiskCommandService {
  private static readonly REGISTRY_ACTIVITY_WINDOW_HOURS = 24;

  private static async resolveOwnerId(tenantId: string, category: StrategicRiskCategory) {
    const users = await prisma.user.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, role: true },
    });
    const priorities = OWNER_ROLE_PRIORITY[category];

    const sorted = users
      .filter((user) => priorities.includes(user.role))
      .sort((a, b) => priorities.indexOf(a.role) - priorities.indexOf(b.role));

    return sorted[0]?.id ?? null;
  }

  private static async buildCandidates(tenantId: string): Promise<RiskCandidate[]> {
    const now = new Date();
    const snapshot = await StrategicIntelligenceService.getSnapshot(tenantId);

    const [highRiskSuppliers, openIncidents, latestMetrics, fxExposure] = await Promise.all([
      prisma.supplierRiskProfile.findMany({
        where: { globalRiskScore: { gte: 70 } },
        include: { supplier: { select: { id: true, name: true } } },
        orderBy: { globalRiskScore: "desc" },
        take: 3,
      }),
      prisma.shipmentIncident.findMany({
        where: {
          status: "OPEN",
          shipment: { order: { tenantId } },
        },
        include: {
          shipment: {
            select: {
              id: true,
              orderId: true,
              order: { select: { orderNumber: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.riskMetric.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
      prisma.exposure.aggregate({
        where: { tenantId, type: "FX", status: "OPEN" },
        _sum: { amount: true },
      }),
    ]);

    const latestMetricByType = new Map<string, { value: number; status: string }>();
    for (const metric of latestMetrics) {
      if (!latestMetricByType.has(metric.type)) {
        latestMetricByType.set(metric.type, {
          value: Number(metric.value),
          status: metric.status,
        });
      }
    }

    const candidates: RiskCandidate[] = [];

    if (snapshot.kpis.marginPercent < 30) {
      candidates.push({
        fingerprint: "financial-margin-protection",
        title: "Margin protection breached",
        description:
          snapshot.kpis.marginPercent < 20
            ? "Gross margin is below 20%. Protection mode should be activated."
            : "Gross margin is below 30%. Pricing and sourcing controls must tighten.",
        category: "FINANCIAL",
        severity: snapshot.kpis.marginPercent < 20 ? "CRITICAL" : "HIGH",
        sourceMetric: "marginPercent",
        sourceValue: snapshot.kpis.marginPercent,
        thresholdValue: 30,
        impactAreas: ["finance", "orders", "sourcing"],
        linkedHref: "/finance/margins",
        mitigationPlan: [
          { title: "Review low-margin orders under approval threshold", ownerArea: "Finance", module: "finance" },
          { title: "Re-open supplier negotiation on top exposed orders", ownerArea: "Sourcing", module: "sourcing" },
          { title: "Raise pricing floor for new quotes", ownerArea: "Orders", module: "orders" },
        ],
        escalationRules: [
          { condition: "margin < 20%", action: "Escalate to CEO and freeze low-margin approvals" },
        ],
      });
    }

    if (snapshot.kpis.cashPosition < 0) {
      candidates.push({
        fingerprint: "financial-negative-cash",
        title: "Negative cash position",
        description: "Cash position is negative. Cash preservation actions are required immediately.",
        category: "FINANCIAL",
        severity: "CRITICAL",
        sourceMetric: "cashPosition",
        sourceValue: snapshot.kpis.cashPosition,
        thresholdValue: 0,
        impactAreas: ["finance", "orders", "crm"],
        linkedHref: "/finance",
        mitigationPlan: [
          { title: "Pause non-essential outbound payments", ownerArea: "Finance", module: "finance" },
          { title: "Accelerate collection on overdue orders", ownerArea: "CRM", module: "crm" },
          { title: "Review cash-heavy sourcing commitments", ownerArea: "Sourcing", module: "sourcing" },
        ],
        escalationRules: [
          { condition: "cash position < 0", action: "Escalate to finance leadership and CEO" },
        ],
      });
    }

    if (snapshot.kpis.overdueRate > 0.2) {
      candidates.push({
        fingerprint: "financial-receivables-overdue",
        title: "Receivables pressure increasing",
        description:
          snapshot.kpis.overdueRate > 0.35
            ? "Overdue receivables are above 35% of outstanding value."
            : "Overdue receivables are above 20% of outstanding value.",
        category: "FINANCIAL",
        severity: snapshot.kpis.overdueRate > 0.35 ? "CRITICAL" : "HIGH",
        sourceMetric: "overdueRate",
        sourceValue: snapshot.kpis.overdueRate,
        thresholdValue: 0.2,
        impactAreas: ["finance", "crm"],
        linkedHref: "/finance",
        mitigationPlan: [
          { title: "Launch targeted collection campaign", ownerArea: "CRM", module: "crm" },
          { title: "Review payment terms for at-risk accounts", ownerArea: "Finance", module: "finance" },
        ],
        escalationRules: [
          { condition: "overdue rate > 35%", action: "Escalate to cash protection mode" },
        ],
      });
    }

    if (snapshot.kpis.logisticsDelayRate > 0.1 || openIncidents.length >= 3) {
      const severity =
        snapshot.kpis.logisticsDelayRate > 0.2 || openIncidents.length >= 5 ? "CRITICAL" : "HIGH";

      candidates.push({
        fingerprint: "logistics-delay-cluster",
        title: "Logistics execution under stress",
        description:
          `${snapshot.kpis.delayedShipments} delayed shipments and ${openIncidents.length} open incidents require active mitigation.`,
        category: "LOGISTICS",
        severity,
        sourceMetric: "logisticsDelayRate",
        sourceValue: snapshot.kpis.logisticsDelayRate,
        thresholdValue: 0.1,
        impactAreas: ["logistics", "orders", "crm"],
        linkedHref: "/logistics",
        mitigationPlan: [
          { title: "Escalate delayed shipments with freight partners", ownerArea: "Logistics", module: "logistics" },
          { title: "Reprioritize urgent delivery orders", ownerArea: "Orders", module: "orders" },
          { title: "Proactively notify impacted clients", ownerArea: "CRM", module: "crm" },
        ],
        escalationRules: [
          { condition: "delay rate > 20%", action: "Trigger delay recovery plan" },
        ],
      });
    }

    if (snapshot.kpis.qcFailRate > 0.04) {
      candidates.push({
        fingerprint: "quality-qc-failure-rate",
        title: "QC failure rate rising",
        description:
          snapshot.kpis.qcFailRate > 0.08
            ? "QC fail rate is above 8%. Product release should be gated."
            : "QC fail rate is above 4%. Additional supplier controls are required.",
        category: "QUALITY",
        severity: snapshot.kpis.qcFailRate > 0.08 ? "CRITICAL" : "HIGH",
        sourceMetric: "qcFailRate",
        sourceValue: snapshot.kpis.qcFailRate,
        thresholdValue: 0.04,
        impactAreas: ["qc", "sourcing", "logistics"],
        linkedHref: "/qc",
        mitigationPlan: [
          { title: "Block shipment release for failed inspections", ownerArea: "QC", module: "qc" },
          { title: "Force corrective action with suppliers", ownerArea: "Sourcing", module: "sourcing" },
          { title: "Require physical QC for next affected lots", ownerArea: "QC", module: "qc" },
        ],
        escalationRules: [
          { condition: "qc fail rate > 8%", action: "Escalate to sourcing and logistics leadership" },
        ],
      });
    }

    const liquidityMetric = latestMetricByType.get("LIQUIDITY");
    if (liquidityMetric && (liquidityMetric.status !== "OK" || liquidityMetric.value >= 70)) {
      candidates.push({
        fingerprint: "financial-liquidity-metric",
        title: "Liquidity metric outside safe band",
        description: `Liquidity metric is ${liquidityMetric.value.toFixed(1)} with status ${liquidityMetric.status}.`,
        category: "FINANCIAL",
        severity: severityFromScore(liquidityMetric.value),
        sourceMetric: "liquidityMetric",
        sourceValue: liquidityMetric.value,
        thresholdValue: 70,
        impactAreas: ["finance"],
        linkedHref: "/finance/risk",
        mitigationPlan: [
          { title: "Reduce discretionary spending", ownerArea: "Finance", module: "finance" },
          { title: "Validate upcoming large payments", ownerArea: "Finance", module: "finance" },
        ],
        escalationRules: [
          { condition: "liquidity metric >= 85", action: "Escalate to CEO for cash protection" },
        ],
      });
    }

    const fxOpen = Number(fxExposure._sum.amount || 0);
    if (fxOpen > 0) {
      const score = scoreFromRatio(fxOpen, 7_500_000);
      if (score >= 60) {
        candidates.push({
          fingerprint: "financial-fx-exposure",
          title: "FX exposure requires hedging attention",
          description: `Open FX exposure stands at ${Math.round(fxOpen).toLocaleString("fr-FR")} across active commitments.`,
          category: "FINANCIAL",
          severity: severityFromScore(score),
          sourceMetric: "fxExposure",
          sourceValue: fxOpen,
          thresholdValue: 7_500_000,
          impactAreas: ["finance", "sourcing"],
          linkedHref: "/finance/risk",
          mitigationPlan: [
            { title: "Review FX-sensitive orders", ownerArea: "Finance", module: "finance" },
            { title: "Renegotiate supplier currency terms where possible", ownerArea: "Sourcing", module: "sourcing" },
          ],
          escalationRules: [
            { condition: "fx exposure > 10M", action: "Escalate for hedging decision" },
          ],
        });
      }
    }

    for (const supplierRisk of highRiskSuppliers) {
      candidates.push({
        fingerprint: `supplier-risk-${supplierRisk.supplierId}`,
        title: `Supplier risk: ${supplierRisk.supplier.name}`,
        description:
          `Supplier score ${supplierRisk.globalRiskScore}/100, cash at risk ${Number(supplierRisk.cashAtRisk).toLocaleString("fr-FR")}.`,
        category: "SUPPLIER",
        severity: severityFromScore(supplierRisk.globalRiskScore),
        sourceMetric: "supplierRiskScore",
        sourceValue: supplierRisk.globalRiskScore,
        thresholdValue: 70,
        impactAreas: ["sourcing", "qc", "finance"],
        linkedHref: "/sourcing",
        linkedEntityType: "supplier",
        linkedEntityId: supplierRisk.supplierId,
        mitigationPlan: [
          { title: "Source alternate supplier options", ownerArea: "Sourcing", module: "sourcing" },
          { title: "Require reinforced QC before shipment", ownerArea: "QC", module: "qc" },
          { title: "Limit additional cash exposure", ownerArea: "Finance", module: "finance" },
        ],
        escalationRules: [
          { condition: "risk score >= 85", action: "Escalate supplier diversification plan" },
        ],
      });
    }

    if (snapshot.kpis.crmConversionRate < 0.12) {
      candidates.push({
        fingerprint: "crm-conversion-drop",
        title: "Commercial conversion below target",
        description: "CRM conversion is below 12%. Demand generation and follow-up quality must be reviewed.",
        category: "CRM",
        severity: "HIGH",
        sourceMetric: "crmConversionRate",
        sourceValue: snapshot.kpis.crmConversionRate,
        thresholdValue: 0.12,
        impactAreas: ["crm", "marketing"],
        linkedHref: "/crm",
        mitigationPlan: [
          { title: "Review stalled high-value leads", ownerArea: "CRM", module: "crm" },
          { title: "Increase follow-up cadence on hot leads", ownerArea: "CRM", module: "crm" },
        ],
        escalationRules: [
          { condition: "conversion < 10%", action: "Escalate growth recovery plan" },
        ],
      });
    }

    return candidates.map((candidate) => ({
      ...candidate,
      description: `${candidate.description} Snapshot ${monthKey(now)}.`,
    }));
  }

  static async syncRegistry(tenantId: string) {
    const candidates = await this.buildCandidates(tenantId);
    const existingRisks = await prisma.strategicRisk.findMany({
      where: { tenantId },
      include: { owner: { select: { id: true, name: true } } },
    });
    const existingByFingerprint = new Map(existingRisks.map((risk) => [risk.fingerprint, risk]));
    const activeFingerprints = new Set<string>();

    let created = 0;
    let updated = 0;
    let escalated = 0;
    let resolved = 0;

    for (const candidate of candidates) {
      activeFingerprints.add(candidate.fingerprint);
      const existing = existingByFingerprint.get(candidate.fingerprint);
      const ownerId = existing?.ownerId ?? (await this.resolveOwnerId(tenantId, candidate.category));
      const shouldEscalate = candidate.severity === "CRITICAL";

      if (!existing) {
        const createdRisk = await prisma.strategicRisk.create({
          data: {
            tenantId,
            fingerprint: candidate.fingerprint,
            title: candidate.title,
            description: candidate.description,
            category: candidate.category,
            severity: candidate.severity,
            status: shouldEscalate ? "ESCALATED" : "OPEN",
            sourceMetric: candidate.sourceMetric,
            sourceValue: candidate.sourceValue,
            thresholdValue: candidate.thresholdValue,
            impactAreas: candidate.impactAreas,
            linkedHref: candidate.linkedHref,
            linkedEntityType: candidate.linkedEntityType,
            linkedEntityId: candidate.linkedEntityId,
            ownerId: ownerId ?? undefined,
            mitigationPlan: candidate.mitigationPlan,
            escalationRules: candidate.escalationRules,
            lastDetectedAt: new Date(),
            escalatedAt: shouldEscalate ? new Date() : undefined,
          },
        });

        await prisma.riskMitigationEntry.create({
          data: {
            riskId: createdRisk.id,
            type: "DETECTED",
            title: "Risk detected",
            detail: candidate.description,
          },
        });

        if (shouldEscalate) {
          await prisma.riskMitigationEntry.create({
            data: {
              riskId: createdRisk.id,
              type: "ESCALATED",
              title: "Auto-escalated",
              detail: "Severity reached CRITICAL threshold during sync.",
            },
          });
        }

        if (ownerId && shouldEscalate) {
          await NotificationService.notify({
            tenantId,
            userId: ownerId,
            type: "SLA_BREACH",
            title: `Critical risk: ${candidate.title}`,
            message: candidate.description,
            entityType: "strategicRisk",
            entityId: createdRisk.id,
          });
        }

        created += 1;
        if (shouldEscalate) escalated += 1;
        continue;
      }

      const wasEscalated = existing.status === "ESCALATED";
      const nextStatus: StrategicRiskStatus =
        shouldEscalate
          ? "ESCALATED"
          : existing.status === "RESOLVED"
            ? "OPEN"
            : existing.status === "ACCEPTED"
              ? "ACCEPTED"
              : existing.status === "MITIGATING"
                ? "MITIGATING"
                : "OPEN";

      await prisma.strategicRisk.update({
        where: { id: existing.id },
        data: {
          title: candidate.title,
          description: candidate.description,
          category: candidate.category,
          severity: candidate.severity,
          status: nextStatus,
          sourceMetric: candidate.sourceMetric,
          sourceValue: candidate.sourceValue,
          thresholdValue: candidate.thresholdValue,
          impactAreas: candidate.impactAreas,
          linkedHref: candidate.linkedHref,
          linkedEntityType: candidate.linkedEntityType,
          linkedEntityId: candidate.linkedEntityId,
          ownerId: ownerId ?? undefined,
          mitigationPlan: candidate.mitigationPlan,
          escalationRules: candidate.escalationRules,
          lastDetectedAt: new Date(),
          resolvedAt: nextStatus === "ACCEPTED" ? existing.resolvedAt ?? new Date() : null,
          escalatedAt: shouldEscalate ? existing.escalatedAt ?? new Date() : existing.escalatedAt,
        },
      });
      updated += 1;

      if (existing.status === "ACCEPTED") {
        await prisma.riskMitigationEntry.create({
          data: {
            riskId: existing.id,
            type: "DETECTED",
            title: "Risk reopened",
            detail: "Signal threshold breached again after prior resolution.",
          },
        });
      }

      if (shouldEscalate && !wasEscalated) {
        await prisma.riskMitigationEntry.create({
          data: {
            riskId: existing.id,
            type: "ESCALATED",
            title: "Auto-escalated",
            detail: "Severity reached CRITICAL threshold during sync.",
          },
        });
        if (ownerId) {
          await NotificationService.notify({
            tenantId,
            userId: ownerId,
            type: "SLA_BREACH",
            title: `Critical risk: ${candidate.title}`,
            message: candidate.description,
            entityType: "strategicRisk",
            entityId: existing.id,
          });
        }
        escalated += 1;
      }
    }

    const staleRisks = existingRisks.filter(
      (risk) =>
        !activeFingerprints.has(risk.fingerprint) &&
        ["OPEN", "MITIGATING", "ESCALATED"].includes(risk.status)
    );

    for (const staleRisk of staleRisks) {
      await prisma.strategicRisk.update({
        where: { id: staleRisk.id },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
        },
      });
      await prisma.riskMitigationEntry.create({
        data: {
          riskId: staleRisk.id,
          type: "RESOLVED",
          title: "Risk resolved by latest sync",
          detail: "Underlying threshold is back inside the acceptable band.",
        },
      });
      resolved += 1;
    }

    return { created, updated, escalated, resolved };
  }

  static async getDashboard(tenantId: string) {
    const [risks, timeline, owners] = await Promise.all([
      prisma.strategicRisk.findMany({
        where: { tenantId },
        include: {
          owner: { select: { id: true, name: true, role: true } },
          entries: {
            include: { createdBy: { select: { id: true, name: true } } },
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
        orderBy: [{ status: "asc" }, { severity: "desc" }, { updatedAt: "desc" }],
      }),
      prisma.riskMitigationEntry.findMany({
        where: { risk: { tenantId } },
        include: {
          risk: {
            select: {
              id: true,
              title: true,
              category: true,
              severity: true,
              linkedHref: true,
            },
          },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
      prisma.user.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, name: true, role: true, email: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const activityWindowStart = new Date(
      Date.now() - this.REGISTRY_ACTIVITY_WINDOW_HOURS * 3_600_000
    );
    const recentRegistryActivity = {
      created: risks.filter((risk) => risk.createdAt >= activityWindowStart).length,
      updated: risks.filter((risk) => risk.updatedAt >= activityWindowStart).length,
      escalated: risks.filter(
        (risk) => risk.escalatedAt && risk.escalatedAt >= activityWindowStart
      ).length,
      resolved: risks.filter(
        (risk) => risk.resolvedAt && risk.resolvedAt >= activityWindowStart
      ).length,
    };

    const summary = {
      open: risks.filter((risk) => risk.status === "OPEN").length,
      mitigating: risks.filter((risk) => risk.status === "MITIGATING").length,
      escalated: risks.filter((risk) => risk.status === "ESCALATED").length,
      resolved: risks.filter((risk) => risk.status === "RESOLVED").length,
      critical: risks.filter((risk) => risk.severity === "CRITICAL" && risk.status !== "RESOLVED").length,
      byCategory: Object.entries(
        risks.reduce<Record<string, number>>((acc, risk) => {
          acc[risk.category] = (acc[risk.category] || 0) + 1;
          return acc;
        }, {})
      ).map(([category, count]) => ({
        category,
        label: RISK_CATEGORY_LABELS[category as StrategicRiskCategory] || category,
        count,
      })),
      sync: recentRegistryActivity,
    };

    const suggestedActions = risks
      .filter((risk) => risk.status !== "RESOLVED")
      .sort((a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity])
      .slice(0, 5)
      .map((risk) => ({
        id: risk.id,
        title: risk.title,
        reason: risk.description || "Operational threshold exceeded",
        href: risk.linkedHref || `#risk-${risk.id}`,
        severity: risk.severity,
      }));

    const latestRiskTimestamp = risks.reduce<number>(
      (latest, risk) =>
        Math.max(latest, risk.lastDetectedAt?.getTime() ?? 0, risk.updatedAt?.getTime() ?? 0),
      0
    );
    const latestTimelineTimestamp = timeline.reduce<number>(
      (latest, entry) => Math.max(latest, new Date(entry.createdAt).getTime()),
      0
    );
    const syncedAt = Math.max(latestRiskTimestamp, latestTimelineTimestamp, Date.now());

    return {
      syncedAt: new Date(syncedAt).toISOString(),
      summary,
      risks,
      timeline,
      owners,
      suggestedActions,
      assistantNotes: suggestedActions.map((item) => {
        const prefix = item.severity === "CRITICAL" ? "Protect immediately" : "Monitor closely";
        return `${prefix}: ${item.title}`;
      }),
    };
  }

  static moduleForCategory(category: StrategicRiskCategory) {
    return MODULE_BY_CATEGORY[category];
  }
}
