import { randomUUID } from "crypto";

import { prisma } from "@/lib/db";
import { NotificationService } from "@/lib/services/notification.service";
import { EmailNotificationChannel } from "@/lib/services/notification-channels.service";
import { FXRateService } from "@/lib/services/fx-rate.service";
import type { ApprovalStatus, UserRole } from "@prisma/client";

const DEFAULT_APPROVER_ROLE: UserRole = "FINANCE_MANAGER";

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

async function convertToXaf(amount: number, currency: string): Promise<number> {
  if (!amount || Number.isNaN(amount)) return 0;
  if (!currency || currency.toUpperCase() === "XAF") return amount;
  try {
    return await FXRateService.convert(amount, currency.toUpperCase(), "XAF");
  } catch {
    return amount;
  }
}

export class FinanceApprovalService {
  static async resolveEntityAmountXaf(params: {
    tenantId: string;
    entityType: string;
    entityId: string;
  }): Promise<number> {
    const entityType = params.entityType.toLowerCase();

    if (entityType === "invoice") {
      const invoice = await prisma.invoice.findFirst({
        where: { id: params.entityId, tenantId: params.tenantId },
        select: { total: true, currency: true },
      });
      if (!invoice) return 0;
      return convertToXaf(Number(invoice.total), invoice.currency || "XAF");
    }

    if (entityType === "payment") {
      const payment = await prisma.payment.findFirst({
        where: { id: params.entityId, order: { tenantId: params.tenantId } },
        select: { amountXAF: true },
      });
      return payment ? Number(payment.amountXAF) : 0;
    }

    if (entityType === "budget" || entityType === "budget_plan") {
      const budget = await prisma.budgetPlan.findFirst({
        where: { id: params.entityId, tenantId: params.tenantId },
        select: { total: true, currency: true },
      });
      if (!budget) return 0;
      return convertToXaf(Number(budget.total), budget.currency || "XAF");
    }

    if (entityType === "cash_plan") {
      const plan = await prisma.cashPlan.findFirst({
        where: { id: params.entityId, tenantId: params.tenantId },
        select: { currency: true },
      });
      if (!plan) return 0;
      const lines = await prisma.cashPlanLine.findMany({
        where: { planId: params.entityId },
        select: { amount: true, direction: true },
      });
      const net = lines.reduce((sum, line) => {
        const value = Number(line.amount);
        return sum + (line.direction === "IN" ? value : -value);
      }, 0);
      return convertToXaf(Math.abs(net), plan.currency || "XAF");
    }

    return 0;
  }

  static async getApplicableRules(params: {
    tenantId: string;
    entityType: string;
    amountXaf: number;
  }) {
    const rules = await prisma.financeApprovalRule.findMany({
      where: {
        tenantId: params.tenantId,
        isActive: true,
        entityType: { in: [params.entityType, "*"] },
        minAmountXAF: { lte: params.amountXaf },
      },
      orderBy: [{ sequence: "asc" }, { minAmountXAF: "desc" }],
    });

    if (rules.length > 0) return rules;

    return [
      {
        id: "default",
        tenantId: params.tenantId,
        entityType: params.entityType,
        name: "Default Finance Manager Approval",
        minAmountXAF: 0,
        sequence: 1,
        requiredRole: DEFAULT_APPROVER_ROLE,
        slaHours: 24,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  }

  static async requestApproval(params: {
    tenantId: string;
    entityType: string;
    entityId: string;
    requestedById: string;
    notes?: string;
  }) {
    const amountXaf = await this.resolveEntityAmountXaf({
      tenantId: params.tenantId,
      entityType: params.entityType,
      entityId: params.entityId,
    });

    const rules = await this.getApplicableRules({
      tenantId: params.tenantId,
      entityType: params.entityType,
      amountXaf,
    });

    const workflowId = randomUUID();
    const createdAt = new Date();

    const chain = await prisma.$transaction(async (tx) => {
      return Promise.all(
        rules.map((rule) =>
          tx.financeApproval.create({
            data: {
              tenantId: params.tenantId,
              workflowId,
              sequence: rule.sequence,
              entityType: params.entityType,
              entityId: params.entityId,
              ruleId: rule.id === "default" ? undefined : rule.id,
              requiredRole: rule.requiredRole,
              status: "PENDING",
              requestedById: params.requestedById,
              dueAt: addHours(createdAt, rule.slaHours),
              notes: params.notes,
            },
          })
        )
      );
    });

    const firstStep = [...chain].sort((a, b) => a.sequence - b.sequence)[0];
    await this.notifyStepApprovers({
      tenantId: params.tenantId,
      workflowId,
      entityType: params.entityType,
      entityId: params.entityId,
      step: firstStep,
      amountXaf,
    });

    return {
      workflowId,
      amountXaf,
      steps: chain,
    };
  }

  static async decideApproval(params: {
    tenantId: string;
    approvalId: string;
    userId: string;
    decision: Extract<ApprovalStatus, "APPROVED" | "REJECTED">;
    note?: string;
  }) {
    const approval = await prisma.financeApproval.findUnique({
      where: { id: params.approvalId },
      include: { requestedBy: true },
    });

    if (!approval || approval.tenantId !== params.tenantId) {
      throw new Error("Approbation introuvable");
    }

    if (approval.status !== "PENDING") {
      throw new Error("Cette etape est deja traitee");
    }

    const actor = await prisma.user.findFirst({
      where: { id: params.userId, tenantId: params.tenantId, isActive: true },
      select: { id: true, role: true, name: true, email: true },
    });
    if (!actor) throw new Error("Utilisateur introuvable");

    if (approval.requiredRole && approval.requiredRole !== actor.role && actor.role !== "ADMIN" && actor.role !== "CEO") {
      throw new Error("Role insuffisant pour cette approbation");
    }

    const pendingSteps = await prisma.financeApproval.findMany({
      where: {
        tenantId: params.tenantId,
        workflowId: approval.workflowId,
        status: "PENDING",
      },
      orderBy: { sequence: "asc" },
    });

    const currentStep = pendingSteps[0];
    if (!currentStep || currentStep.id !== params.approvalId) {
      throw new Error("Validation hors sequence interdite");
    }

    const updated = await prisma.financeApproval.update({
      where: { id: params.approvalId },
      data: {
        status: params.decision,
        approvedById: params.userId,
        approvedAt: new Date(),
        notes: params.note || approval.notes,
      },
    });

    if (params.decision === "REJECTED") {
      await prisma.financeApproval.updateMany({
        where: {
          tenantId: params.tenantId,
          workflowId: approval.workflowId,
          status: "PENDING",
          sequence: { gt: approval.sequence },
        },
        data: {
          status: "REJECTED",
          notes: "Auto-rejected after previous step rejection",
        },
      });

      return { step: updated, completed: true, rejected: true };
    }

    const nextStep = await prisma.financeApproval.findFirst({
      where: {
        tenantId: params.tenantId,
        workflowId: approval.workflowId,
        status: "PENDING",
      },
      orderBy: { sequence: "asc" },
    });

    if (!nextStep) {
      return { step: updated, completed: true, rejected: false };
    }

    const amountXaf = await this.resolveEntityAmountXaf({
      tenantId: params.tenantId,
      entityType: approval.entityType,
      entityId: approval.entityId,
    });

    await this.notifyStepApprovers({
      tenantId: params.tenantId,
      workflowId: approval.workflowId,
      entityType: approval.entityType,
      entityId: approval.entityId,
      step: nextStep,
      amountXaf,
    });

    return { step: updated, completed: false, rejected: false, nextStep };
  }

  static async escalateOverdue(params: { tenantId: string; escalatedById?: string }) {
    const now = new Date();

    const overdue = await prisma.financeApproval.findMany({
      where: {
        tenantId: params.tenantId,
        status: "PENDING",
        dueAt: { lt: now },
        escalatedAt: null,
      },
      orderBy: { dueAt: "asc" },
      take: 200,
    });

    let escalated = 0;
    for (const step of overdue) {
      await prisma.financeApproval.update({
        where: { id: step.id },
        data: {
          escalatedAt: now,
          escalatedById: params.escalatedById || undefined,
        },
      });

      const escalatedToRoles: UserRole[] = ["FINANCE_MANAGER", "DIRECTION", "CEO", "ADMIN"];
      const approvers = await prisma.user.findMany({
        where: { tenantId: params.tenantId, isActive: true, role: { in: escalatedToRoles } },
        select: { id: true, email: true },
      });

      await NotificationService.notifyMany(
        approvers.map((a) => a.id),
        {
          tenantId: params.tenantId,
          type: "APPROVAL_REQUIRED",
          title: `Escalade approval ${step.entityType}`,
          message: `Workflow ${step.workflowId} depasse son SLA`,
          entityType: step.entityType,
          entityId: step.entityId,
        }
      );

      await Promise.all(
        approvers
          .map((a) => a.email)
          .filter(Boolean)
          .map((email) =>
            EmailNotificationChannel.send({
              to: email as string,
              type: "APPROVAL_REQUIRED",
              title: `Escalade approval ${step.entityType}`,
              message: `Une approbation est en retard sur ${step.entityType} (${step.entityId})`,
              entityType: step.entityType,
              entityId: step.entityId,
              urgency: "critical",
            })
          )
      );

      escalated += 1;
    }

    return { escalated, scanned: overdue.length };
  }

  private static async notifyStepApprovers(params: {
    tenantId: string;
    workflowId: string;
    entityType: string;
    entityId: string;
    step: { id: string; sequence: number; requiredRole: UserRole | null };
    amountXaf: number;
  }) {
    const role = params.step.requiredRole || DEFAULT_APPROVER_ROLE;

    const approvers = await prisma.user.findMany({
      where: {
        tenantId: params.tenantId,
        isActive: true,
        role: { in: [role, "ADMIN", "CEO"] },
      },
      select: { id: true, email: true },
    });

    if (approvers.length === 0) return;

    await NotificationService.notifyMany(
      approvers.map((a) => a.id),
      {
        tenantId: params.tenantId,
        type: "APPROVAL_REQUIRED",
        title: `Approval requise: ${params.entityType}`,
        message: `Etape ${params.step.sequence} (${role}) - Montant ${Math.round(params.amountXaf).toLocaleString("fr-FR")} XAF`,
        entityType: params.entityType,
        entityId: params.entityId,
      }
    );

    await Promise.all(
      approvers
        .map((a) => a.email)
        .filter(Boolean)
        .map((email) =>
          EmailNotificationChannel.send({
            to: email as string,
            type: "APPROVAL_REQUIRED",
            title: `Approval requise: ${params.entityType}`,
            message: `Workflow ${params.workflowId} - etape ${params.step.sequence}. Ouvrez /finance/approvals.`,
            entityType: params.entityType,
            entityId: params.entityId,
            urgency: "high",
          })
        )
    );
  }
}
