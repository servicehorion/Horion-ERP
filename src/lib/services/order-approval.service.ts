import { prisma } from "@/lib/db";
import type { UserRole } from "@prisma/client";

const DEFAULT_THRESHOLD = 50_000_000;

export class OrderApprovalService {
  static async ensureDefaultRules(tenantId: string) {
    const count = await prisma.orderApprovalRule.count({ where: { tenantId } });
    if (count > 0) return;
    await prisma.orderApprovalRule.create({
      data: {
        tenantId,
        name: "Validation CEO > 50M XAF",
        minAmountXAF: DEFAULT_THRESHOLD,
        sequence: 1,
        requiredRole: "CEO" as UserRole,
      },
    });
  }

  static async getRequiredRules(tenantId: string, totalClient: number) {
    await this.ensureDefaultRules(tenantId);
    return prisma.orderApprovalRule.findMany({
      where: {
        tenantId,
        minAmountXAF: { lte: totalClient },
      },
      orderBy: { sequence: "asc" },
    });
  }

  static async syncOrderApprovals(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, tenantId: true, totalClient: true, approvalStatus: true },
    });
    if (!order) throw new Error("Commande introuvable");

    const rules = await this.getRequiredRules(order.tenantId, Number(order.totalClient));

    if (rules.length === 0) {
      await prisma.orderApproval.deleteMany({ where: { orderId } });
      await prisma.order.update({
        where: { id: orderId },
        data: { approvalStatus: "NOT_REQUIRED", approvedAt: null, approvedById: null },
      });
      return { status: "NOT_REQUIRED" as const, steps: [] };
    }

    const existing = await prisma.orderApproval.findMany({
      where: { orderId },
      include: { rule: true },
      orderBy: { createdAt: "asc" },
    });
    const existingRuleIds = new Set(existing.map((e) => e.ruleId));
    const missingRules = rules.filter((r) => !existingRuleIds.has(r.id));
    if (missingRules.length > 0) {
      await prisma.orderApproval.createMany({
        data: missingRules.map((r) => ({ orderId, ruleId: r.id })),
      });
    }

    const allSteps = await prisma.orderApproval.findMany({
      where: { orderId },
      include: { rule: true, decidedBy: true },
      orderBy: [{ rule: { sequence: "asc" } }, { createdAt: "asc" }],
    });

    const rejected = allSteps.some((s) => s.status === "REJECTED");
    const approved = allSteps.length > 0 && allSteps.every((s) => s.status === "APPROVED");
    const status = rejected ? "REJECTED" : approved ? "APPROVED" : "PENDING";
    const lastApproved = approved
      ? allSteps.slice().reverse().find((s) => s.decidedById)
      : null;

    await prisma.order.update({
      where: { id: orderId },
      data: {
        approvalStatus: status,
        ...(approved ? { approvedAt: new Date(), approvedById: lastApproved?.decidedById ?? null } : {}),
      },
    });

    return { status, steps: allSteps };
  }

  static async approveStep(params: { stepId: string; userId: string }) {
    const currentStep = await prisma.orderApproval.findUnique({
      where: { id: params.stepId },
      include: { rule: true, order: true },
    });
    if (!currentStep) throw new Error("Etape d'approbation introuvable");
    if (currentStep.status !== "PENDING") {
      throw new Error("Cette étape d'approbation a déjà été traitée");
    }

    const blockingStep = await prisma.orderApproval.findFirst({
      where: {
        orderId: currentStep.orderId,
        status: "PENDING",
        rule: {
          sequence: { lt: currentStep.rule.sequence },
        },
      },
      include: { rule: true },
      orderBy: [{ rule: { sequence: "asc" } }, { createdAt: "asc" }],
    });

    if (blockingStep) {
      throw new Error(
        `L'étape ${blockingStep.rule.name} doit être approuvée avant celle-ci.`
      );
    }

    const step = await prisma.orderApproval.update({
      where: { id: params.stepId },
      data: {
        status: "APPROVED",
        decidedById: params.userId,
        decidedAt: new Date(),
      },
      include: { order: true },
    });

    await this.syncOrderApprovals(step.orderId);
    return step;
  }

  static async rejectStep(params: { stepId: string; userId: string; note?: string }) {
    const step = await prisma.orderApproval.update({
      where: { id: params.stepId },
      data: {
        status: "REJECTED",
        decidedById: params.userId,
        decidedAt: new Date(),
        note: params.note,
      },
      include: { order: true },
    });

    await this.syncOrderApprovals(step.orderId);
    return step;
  }
}
