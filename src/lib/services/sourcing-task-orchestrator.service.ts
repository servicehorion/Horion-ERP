import type { DemandUrgency, UserRole } from "@prisma/client";

import { prisma } from "@/lib/db";
import { OperationalTaskService } from "@/lib/services/operational-task.service";
import { SourcingGovernanceService } from "@/lib/services/sourcing-governance.service";
import { SourcingSlaService } from "@/lib/services/sourcing-sla.service";

const SOURCING_WORKFLOW_TASK_TYPES = [
  "sourcing_triage_demand",
  "sourcing_prepare_indicatif",
  "sourcing_find_supplier",
  "sourcing_review_offers",
  "sourcing_negotiate_supplier",
  "sourcing_confirm_selection",
] as const;

function demandTiming(urgency: DemandUrgency) {
  switch (urgency) {
    case "CRITICAL":
      return { slaHours: 2, dueInHours: 1, priority: "URGENT" as const };
    case "HIGH":
      return { slaHours: 6, dueInHours: 3, priority: "HIGH" as const };
    default:
      return { slaHours: 12, dueInHours: 6, priority: "NORMAL" as const };
  }
}

async function cancelWorkflowTasks(params: {
  tenantId: string;
  entityType: string;
  entityId: string;
  keepTaskType?: string | null;
}) {
  await prisma.task.updateMany({
    where: {
      tenantId: params.tenantId,
      entityType: params.entityType,
      entityId: params.entityId,
      module: "sourcing",
      taskType: {
        in: SOURCING_WORKFLOW_TASK_TYPES.filter((taskType) => taskType !== params.keepTaskType),
      },
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    },
    data: {
      status: "CANCELLED",
      blockedBy: null,
    },
  });
}

export class SourcingTaskOrchestratorService {
  static async syncDemandWorkflow(tenantId: string, demandId: string) {
    const demand = await prisma.demandIntake.findFirst({
      where: { id: demandId, tenantId },
      select: {
        id: true,
        clientName: true,
        rawDescription: true,
        urgency: true,
        status: true,
        category: true,
        assignedToId: true,
      },
    });

    if (!demand) return;

    if (!["RAW", "QUALIFIED", "INDICATIF_PENDING"].includes(demand.status)) {
      await cancelWorkflowTasks({ tenantId, entityType: "demand", entityId: demand.id, keepTaskType: null });
      return;
    }

    const timing = demandTiming(demand.urgency);
    const taskType =
      demand.status === "RAW"
        ? "sourcing_triage_demand"
        : "sourcing_prepare_indicatif";
    const title =
      demand.status === "RAW"
        ? `Qualifier la demande sourcing - ${demand.clientName}`
        : `Preparer le sourcing indicatif - ${demand.clientName}`;
    const description =
      demand.status === "RAW"
        ? demand.rawDescription
        : `Transformer cette demande qualifiee en ticket exploitable, chiffrage ou devis.\n\n${demand.rawDescription}`;

    await cancelWorkflowTasks({ tenantId, entityType: "demand", entityId: demand.id, keepTaskType: taskType });

    await OperationalTaskService.create({
      tenantId,
      entityType: "demand",
      entityId: demand.id,
      taskType,
      title,
      description,
      module: "sourcing",
      priority: timing.priority,
      ownerType: "SYSTEM",
      riskLevel: demand.urgency === "CRITICAL" ? "HIGH" : "LOW",
      slaHours: timing.slaHours,
      dueInHours: timing.dueInHours,
      tags: ["sourcing", "workflow", "demand", (demand.category || "uncategorized").toLowerCase()],
      assigneeId: demand.assignedToId ?? null,
      assigneeRoles: ["SOURCING_ASSISTANT", "OPS", "LOGISTICS_MANAGER"] as UserRole[],
      fallbackRoles: ["DIRECTION", "ADMIN", "CEO"] as UserRole[],
      reuseIfOpen: true,
      completionRequirements: {
        requiredComment: true,
      },
    });
  }

  static async syncCaseWorkflow(caseId: string) {
    const sourcingCase = await prisma.sourcingCase.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        status: true,
        level: true,
        pipelineType: true,
        requirement: true,
        category: true,
        platform: true,
        sensitiveProduct: true,
        assignedToId: true,
        order: {
          select: {
            tenantId: true,
            orderNumber: true,
            contact: { select: { name: true } },
          },
        },
      },
    });

    if (!sourcingCase) return;

    if (["CONFIRMED", "CANCELLED"].includes(sourcingCase.status)) {
      await cancelWorkflowTasks({
        tenantId: sourcingCase.order.tenantId,
        entityType: "sourcing_case",
        entityId: sourcingCase.id,
        keepTaskType: null,
      });
      return;
    }

    const workflow = await SourcingGovernanceService.getCaseWorkflowSnapshot(sourcingCase.id);
    const sla = SourcingSlaService.computeProfile({
      status: sourcingCase.status,
      level: sourcingCase.level,
      pipelineType: sourcingCase.pipelineType,
      category: sourcingCase.category,
      platform: sourcingCase.platform,
      sensitiveProduct: sourcingCase.sensitiveProduct,
    });

    const configs: Record<string, { taskType: string; title: string; priority: "NORMAL" | "HIGH" | "URGENT"; roles: UserRole[] }> = {
      SEARCHING: {
        taskType: "sourcing_find_supplier",
        title: `Trouver un fournisseur - ${sourcingCase.order.orderNumber}`,
        priority: "HIGH",
        roles: ["SOURCING_ASSISTANT", "OPS", "LOGISTICS_MANAGER"] as UserRole[],
      },
      OFFERS_RECEIVED: {
        taskType: "sourcing_review_offers",
        title: `Comparer les offres - ${sourcingCase.order.orderNumber}`,
        priority: "HIGH",
        roles: ["SOURCING_ASSISTANT", "LOGISTICS_MANAGER"] as UserRole[],
      },
      NEGOTIATING: {
        taskType: "sourcing_negotiate_supplier",
        title: `Negocier avec le fournisseur - ${sourcingCase.order.orderNumber}`,
        priority: sourcingCase.pipelineType === "VIP" ? "URGENT" : "HIGH",
        roles: ["LOGISTICS_MANAGER", "SOURCING_ASSISTANT", "OPS"] as UserRole[],
      },
      SELECTED: {
        taskType: "sourcing_confirm_selection",
        title: `Confirmer la decision sourcing - ${sourcingCase.order.orderNumber}`,
        priority: "HIGH",
        roles: ["LOGISTICS_MANAGER", "OPS"] as UserRole[],
      },
    };

    const config = configs[sourcingCase.status];
    if (!config) return;

    await cancelWorkflowTasks({
      tenantId: sourcingCase.order.tenantId,
      entityType: "sourcing_case",
      entityId: sourcingCase.id,
      keepTaskType: config.taskType,
    });

    await OperationalTaskService.create({
      tenantId: sourcingCase.order.tenantId,
      entityType: "sourcing_case",
      entityId: sourcingCase.id,
      taskType: config.taskType,
      title: config.title,
      description: workflow?.nextAction || sourcingCase.requirement,
      module: "sourcing",
      priority: config.priority,
      ownerType: "SYSTEM",
      riskLevel: workflow?.businessRisk === "HIGH" ? "HIGH" : "LOW",
      slaHours: sla.slaHours,
      dueInHours: sla.dueInHours,
      tags: [
        "sourcing",
        "workflow",
        sourcingCase.status.toLowerCase(),
        (sourcingCase.category || "uncategorized").toLowerCase(),
      ],
      assigneeId: sourcingCase.assignedToId ?? null,
      assigneeRoles: config.roles,
      fallbackRoles: ["DIRECTION", "ADMIN", "CEO"] as UserRole[],
      reuseIfOpen: true,
      completionRequirements: {
        requiredComment: true,
      },
    });
  }
}
