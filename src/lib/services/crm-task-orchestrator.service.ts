import type { DemandUrgency, LeadStatus, UserRole } from "@prisma/client";

import { prisma } from "@/lib/db";
import { OperationalTaskService } from "@/lib/services/operational-task.service";
import { LeadSlaService } from "@/lib/services/lead-sla.service";

const CRM_WORKFLOW_TASK_TYPES = [
  "crm_triage_demand",
  "crm_route_demand",
  "crm_contact_lead",
  "crm_qualify_lead",
  "crm_prepare_quote",
  "crm_quote_followup",
] as const;

function demandTiming(urgency: DemandUrgency) {
  switch (urgency) {
    case "CRITICAL":
      return { slaHours: 2, dueInHours: 1, priority: "URGENT" as const };
    case "HIGH":
      return { slaHours: 4, dueInHours: 2, priority: "HIGH" as const };
    default:
      return { slaHours: 8, dueInHours: 4, priority: "NORMAL" as const };
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
      module: "crm",
      taskType: {
        in: CRM_WORKFLOW_TASK_TYPES.filter((taskType) => taskType !== params.keepTaskType),
      },
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    },
    data: {
      status: "CANCELLED",
      blockedBy: null,
    },
  });
}

export class CrmTaskOrchestratorService {
  static async syncDemandWorkflow(tenantId: string, demandId: string) {
    const demand = await prisma.demandIntake.findFirst({
      where: { id: demandId, tenantId },
      select: {
        id: true,
        clientName: true,
        rawDescription: true,
        urgency: true,
        status: true,
        assignedToId: true,
        cmId: true,
      },
    });

    if (!demand) return;

    if (!["RAW", "QUALIFIED"].includes(demand.status)) {
      await cancelWorkflowTasks({ tenantId, entityType: "demand", entityId: demand.id, keepTaskType: null });
      return;
    }

    const timing = demandTiming(demand.urgency);
    const taskType = demand.status === "RAW" ? "crm_triage_demand" : "crm_route_demand";
    const title =
      demand.status === "RAW"
        ? `Qualifier la demande - ${demand.clientName}`
        : `Orienter la demande qualifiee - ${demand.clientName}`;
    const description =
      demand.status === "RAW"
        ? demand.rawDescription
        : `Verifier la meilleure suite pour cette demande qualifiee : lead, sourcing ou devis.\n\n${demand.rawDescription}`;

    await cancelWorkflowTasks({ tenantId, entityType: "demand", entityId: demand.id, keepTaskType: taskType });

    await OperationalTaskService.create({
      tenantId,
      entityType: "demand",
      entityId: demand.id,
      taskType,
      title,
      description,
      module: "crm",
      priority: timing.priority,
      ownerType: "SYSTEM",
      riskLevel: demand.urgency === "CRITICAL" ? "HIGH" : "LOW",
      slaHours: timing.slaHours,
      dueInHours: timing.dueInHours,
      tags: ["crm", "crm-workflow", "demand", demand.status.toLowerCase()],
      assigneeId: demand.assignedToId ?? demand.cmId ?? null,
      assigneeRoles: ["COMMUNITY_MANAGER", "COMMERCIAL"] as UserRole[],
      fallbackRoles: ["CRM_MANAGER", "ADMIN", "DIRECTION", "CEO"] as UserRole[],
      reuseIfOpen: true,
      completionRequirements: {
        requiredComment: true,
      },
    });
  }

  static async syncLeadWorkflow(tenantId: string, leadId: string) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, contact: { tenantId } },
      include: {
        contact: { select: { name: true } },
      },
    });

    if (!lead) return;

    if (["WON", "LOST"].includes(lead.status)) {
      await cancelWorkflowTasks({ tenantId, entityType: "lead", entityId: lead.id, keepTaskType: null });
      return;
    }

    const profile = LeadSlaService.computeProfile({
      status: lead.status,
      source: lead.source,
      score: lead.score,
      winProbability: lead.winProbability,
      estimatedValue: lead.estimatedValue,
      assignedTo: lead.assignedTo,
      ownerId: lead.ownerId,
    });

    const configs: Record<Exclude<LeadStatus, "WON" | "LOST">, { taskType: string; title: string; description: string; priority: "NORMAL" | "HIGH" | "URGENT" }> = {
      NEW: {
        taskType: "crm_contact_lead",
        title: `Prendre contact avec le lead - ${lead.contact?.name || "Lead"}`,
        description: lead.description || "Confirmer le besoin, le budget et la temporalite.",
        priority: profile.slaHours <= 12 ? "HIGH" : "NORMAL",
      },
      CONTACTED: {
        taskType: "crm_qualify_lead",
        title: `Qualifier le besoin - ${lead.contact?.name || "Lead"}`,
        description: lead.description || "Completer la qualification commerciale et cadrer la solution.",
        priority: profile.slaHours <= 24 ? "HIGH" : "NORMAL",
      },
      QUALIFIED: {
        taskType: "crm_prepare_quote",
        title: `Preparer le devis - ${lead.contact?.name || "Lead"}`,
        description: lead.description || "Transformer ce lead qualifie en proposition concrete.",
        priority: "HIGH",
      },
      QUOTED: {
        taskType: "crm_quote_followup",
        title: `Relancer le devis - ${lead.contact?.name || "Lead"}`,
        description: lead.description || "Traiter les objections et obtenir la decision client.",
        priority: profile.slaHours <= 48 ? "HIGH" : "NORMAL",
      },
    };

    const config = configs[lead.status as Exclude<LeadStatus, "WON" | "LOST">];
    if (!config) return;

    await cancelWorkflowTasks({ tenantId, entityType: "lead", entityId: lead.id, keepTaskType: config.taskType });

    await OperationalTaskService.create({
      tenantId,
      entityType: "lead",
      entityId: lead.id,
      taskType: config.taskType,
      title: config.title,
      description: config.description,
      module: "crm",
      priority: config.priority,
      ownerType: "SYSTEM",
      riskLevel: lead.score >= 80 || lead.winProbability >= 70 ? "HIGH" : "LOW",
      slaHours: profile.slaHours,
      dueInHours: profile.dueInHours,
      tags: ["crm", "crm-workflow", "lead", lead.status.toLowerCase()],
      assigneeId: lead.assignedTo ?? lead.ownerId ?? null,
      assigneeRoles: ["COMMERCIAL", "CRM_MANAGER"] as UserRole[],
      fallbackRoles: ["ADMIN", "DIRECTION", "CEO"] as UserRole[],
      reuseIfOpen: true,
      completionRequirements: {
        requiredComment: true,
      },
    });
  }
}
