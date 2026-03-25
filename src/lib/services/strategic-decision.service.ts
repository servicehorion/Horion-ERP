import { prisma } from "@/lib/db";
import { NotificationService } from "@/lib/services/notification.service";
import { StrategicIntelligenceService } from "@/lib/services/strategic-intelligence.service";

type ActivationRule = {
  metric: string;
  operator: "LT" | "LTE" | "GT" | "GTE";
  value: number;
  severity?: "red" | "orange";
  note?: string;
};

export class StrategicDecisionService {
  static async evaluateRulesForTenant(tenantId: string) {
    const snapshot = await StrategicIntelligenceService.getSnapshot(tenantId);
    const metricMap: Record<string, number> = {
      marginPercent: snapshot.kpis.marginPercent,
      cashPosition: snapshot.kpis.cashPosition,
      overdueRate: snapshot.kpis.overdueRate,
      crmConversionRate: snapshot.kpis.crmConversionRate,
      pipelineValue: snapshot.kpis.pipelineValue,
      sourcingSlaBreachRate: snapshot.kpis.sourcingSlaBreachRate,
      logisticsDelayRate: snapshot.kpis.logisticsDelayRate,
      qcFailRate: snapshot.kpis.qcFailRate,
      qcPassRate: snapshot.kpis.qcPassRate,
    };

    const decisions = await prisma.strategicDecision.findMany({
      where: { tenantId, status: { in: ["DRAFT", "ACTIVE"] } },
      select: { id: true, title: true, ownerId: true, status: true, activationRules: true },
    });

    let activated = 0;

    for (const decision of decisions) {
      const rules = (decision.activationRules as ActivationRule[]) || [];
      if (rules.length === 0) continue;

      const matches = rules.some((rule) => {
        const metricValue = metricMap[rule.metric];
        if (metricValue === undefined || metricValue === null) return false;
        if (rule.operator === "LT") return metricValue < rule.value;
        if (rule.operator === "LTE") return metricValue <= rule.value;
        if (rule.operator === "GT") return metricValue > rule.value;
        if (rule.operator === "GTE") return metricValue >= rule.value;
        return false;
      });

      if (!matches || decision.status !== "DRAFT") continue;

      activated += 1;

      await prisma.$transaction(async (tx) => {
        await tx.strategicDecision.update({
          where: { id: decision.id },
          data: { status: "ACTIVE" },
        });
        await tx.decisionAction.create({
          data: {
            decisionId: decision.id,
            type: "ACTIVATE_DECISION",
            status: "EXECUTED",
            payload: { triggeredBy: "rule", rules },
            executedAt: new Date(),
          },
        });
      });

      if (decision.ownerId) {
        await NotificationService.notify({
          tenantId,
          userId: decision.ownerId,
          type: "APPROVAL_REQUIRED",
          title: `Decision activated: ${decision.title}`,
          message: "A strategic decision has been activated by its trigger rules.",
          entityType: "strategicDecision",
          entityId: decision.id,
        });
      }
    }

    return { activated, total: decisions.length, snapshot };
  }
}
