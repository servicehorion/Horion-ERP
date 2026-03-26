"use server";

import { revalidatePath } from "next/cache";
import type { DemandSource, DemandStatus, DemandUrgency, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import { OperationalTaskService } from "@/lib/services/operational-task.service";
import { SourcingTicketService } from "@/lib/services/sourcing-ticket.service";

// ─── Types ───────────────────────────────────────────────────────────────────

type DemandIntakeFilters = {
  status?: string;
  source?: string;
  cmId?: string;
  contactId?: string;
  assignedToId?: string;
  q?: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function findCmUser(tenantId: string) {
  return prisma.user.findFirst({
    where: { tenantId, role: "COMMUNITY_MANAGER" },
    select: { id: true },
  });
}

async function createSourcingIndicatifTask(
  tenantId: string,
  demandId: string,
  orderNumber: string,
  description: string,
  assigneeId?: string
) {
  const result = await OperationalTaskService.create({
    tenantId,
    entityType: "demand",
    entityId: demandId,
    taskType: "sourcing_indicatif",
    title: `Sourcing indicatif - ${orderNumber || "nouvelle demande"}`,
    description,
    module: "sourcing",
    priority: "HIGH",
    ownerType: "SYSTEM",
    riskLevel: "LOW",
    slaHours: 4,
    tags: ["indicatif", "auto-demand"],
    assigneeId: assigneeId ?? null,
    completionRequirements: {
      requiredComment: true,
    },
    reuseIfOpen: true,
  });

  return prisma.task.findUnique({ where: { id: result.taskId } });
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function getDemandIntakes(filters: DemandIntakeFilters = {}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.view");

    const where: Prisma.DemandIntakeWhereInput = {
      tenantId: user.tenantId,
      ...(filters.status && filters.status !== "all"
        ? { status: filters.status as DemandStatus }
        : {}),
      ...(filters.source && filters.source !== "all"
        ? { source: filters.source as DemandSource }
        : {}),
      ...(filters.cmId ? { cmId: filters.cmId } : {}),
      ...(filters.contactId ? { contactId: filters.contactId } : {}),
      ...(filters.assignedToId ? { assignedToId: filters.assignedToId } : {}),
      ...(filters.q
        ? {
            OR: [
              { clientName: { contains: filters.q, mode: "insensitive" } },
              { rawDescription: { contains: filters.q, mode: "insensitive" } },
              { category: { contains: filters.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const demands = await prisma.demandIntake.findMany({
      where,
      include: {
        contact: { select: { id: true, name: true, type: true, phone: true, whatsapp: true } },
        lead: { select: { id: true, status: true, estimatedValue: true } },
        cm: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        qualifiedBy: { select: { id: true, name: true } },
        order: { select: { id: true, orderNumber: true, status: true } },
      },
      orderBy: [{ receivedAt: "desc" }],
    });

    const kpis = {
      total: demands.length,
      raw: demands.filter((d) => d.status === "RAW").length,
      qualified: demands.filter((d) => d.status === "QUALIFIED").length,
      indicatifPending: demands.filter((d) => d.status === "INDICATIF_PENDING").length,
      quoteFlow: demands.filter((d) =>
        ["QUOTE_DRAFT", "QUOTE_PENDING_APPROVAL", "QUOTE_APPROVED", "QUOTE_SENT"].includes(d.status)
      ).length,
      paymentFlow: demands.filter((d) =>
        ["CLIENT_ACCEPTED", "PAYMENT_SUBMITTED", "PAYMENT_VALIDATED"].includes(d.status)
      ).length,
      converted: demands.filter((d) => d.status === "CONVERTED").length,
      lost: demands.filter((d) => d.status === "LOST").length,
    };

    return { data: { demands, kpis } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur chargement demandes" };
  }
}

export async function getDemandIntakeById(id: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.view");

    const demand = await prisma.demandIntake.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        contact: true,
        lead: { select: { id: true, status: true, estimatedValue: true, currency: true, score: true } },
        cm: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        qualifiedBy: { select: { id: true, name: true } },
        convertedCase: { select: { id: true, status: true, level: true, requirement: true } },
        order: { select: { id: true, orderNumber: true, status: true } },
        attachments: true,
      },
    });

    if (!demand) return { error: "Demande introuvable" };
    return { data: demand };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur chargement demande" };
  }
}

export async function createDemandIntake(data: {
  source: DemandSource;
  sourceRef?: string;
  clientName: string;
  rawDescription: string;
  category?: string;
  quantity?: number;
  targetPrice?: number;
  currency?: string;
  urgency?: DemandUrgency;
  country?: string;
  estimatedRevenue?: number;
  contactId?: string;
  leadId?: string;
  cmId?: string;
  sourcePayload?: Record<string, unknown>;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.edit");

    // Resolve CM — default to current user if CM role, else find CM
    const cmId =
      data.cmId ??
      (user.role === "COMMUNITY_MANAGER"
        ? user.id
        : (await findCmUser(user.tenantId))?.id ?? undefined);

    const demand = await prisma.demandIntake.create({
      data: {
        tenantId: user.tenantId,
        source: data.source,
        sourceRef: data.sourceRef,
        sourcePayload: data.sourcePayload as Prisma.InputJsonValue | undefined,
        clientName: data.clientName,
        rawDescription: data.rawDescription,
        category: data.category,
        quantity: data.quantity,
        targetPrice: data.targetPrice,
        currency: data.currency ?? "XAF",
        urgency: data.urgency ?? "NORMAL",
        country: data.country,
        estimatedRevenue: data.estimatedRevenue,
        status: "RAW",
        contactId: data.contactId,
        leadId: data.leadId,
        cmId,
      },
    });

    await SourcingTicketService.ensureFromDemand(demand.id);

    revalidatePath("/sourcing");
    revalidatePath("/tasks");
    return { data: demand };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur création demande" };
  }
}

export async function qualifyDemandIntake(
  id: string,
  qualification: {
    category?: string;
    estimatedRevenue?: number;
    contactId?: string;
    leadId?: string;
    notes?: string;
  }
) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.edit");

    const demand = await prisma.demandIntake.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!demand) return { error: "Demande introuvable" };
    if (demand.status !== "RAW") return { error: "Seules les demandes RAW peuvent être qualifiées" };

    const updated = await prisma.demandIntake.update({
      where: { id },
      data: {
        status: "QUALIFIED",
        qualifiedById: user.id,
        category: qualification.category ?? demand.category,
        estimatedRevenue: qualification.estimatedRevenue ?? demand.estimatedRevenue,
        contactId: qualification.contactId ?? demand.contactId,
        leadId: qualification.leadId ?? demand.leadId,
      },
    });

    await SourcingTicketService.ensureFromDemand(updated.id);

    revalidatePath("/sourcing");
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur qualification" };
  }
}

export async function assignSourcingTask(id: string, assigneeId?: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.edit");

    const demand = await prisma.demandIntake.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!demand) return { error: "Demande introuvable" };
    if (!["QUALIFIED", "RAW"].includes(demand.status)) {
      return { error: "La demande doit être qualifiée pour assigner un sourcing" };
    }

    // Find sourcing assistant if no assigneeId provided
    const resolvedAssignee =
      assigneeId ??
      (
        await prisma.user.findFirst({
          where: {
            tenantId: user.tenantId,
            role: { in: ["SOURCING_ASSISTANT", "COMMUNITY_MANAGER"] },
          },
          select: { id: true },
        })
      )?.id;

    const updated = await prisma.demandIntake.update({
      where: { id },
      data: {
        status: "INDICATIF_PENDING",
        assignedToId: resolvedAssignee,
      },
    });

    // Create sourcing indicatif task
    await createSourcingIndicatifTask(
      user.tenantId,
      id,
      demand.clientName,
      demand.rawDescription,
      resolvedAssignee
    );

    await SourcingTicketService.ensureFromDemand(updated.id);

    revalidatePath("/sourcing");
    revalidatePath("/tasks");
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur assignation sourcing" };
  }
}

export async function linkQuoteToDemand(demandId: string, quoteId: string, orderId?: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.edit");

    const demand = await prisma.demandIntake.findFirst({
      where: { id: demandId, tenantId: user.tenantId },
    });
    if (!demand) return { error: "Demande introuvable" };

    const updated = await prisma.demandIntake.update({
      where: { id: demandId },
      data: {
        status: "QUOTE_DRAFT",
        quoteId,
        orderId: orderId ?? demand.orderId,
      },
    });

    await SourcingTicketService.ensureFromDemand(updated.id);

    revalidatePath("/sourcing");
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur liaison devis" };
  }
}

export async function markDemandLost(id: string, reason: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.edit");

    const demand = await prisma.demandIntake.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!demand) return { error: "Demande introuvable" };
    if (demand.status === "CONVERTED") return { error: "Une demande convertie ne peut pas être perdue" };

    const updated = await prisma.demandIntake.update({
      where: { id },
      data: { status: "LOST", rejectionReason: reason },
    });

    await SourcingTicketService.ensureFromDemand(updated.id);

    revalidatePath("/sourcing");
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur mise à jour statut" };
  }
}

export async function convertDemand(demandId: string, orderId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.edit");

    const demand = await prisma.demandIntake.findFirst({
      where: { id: demandId, tenantId: user.tenantId },
    });
    if (!demand) return { error: "Demande introuvable" };

    const updated = await prisma.demandIntake.update({
      where: { id: demandId },
      data: { status: "CONVERTED", orderId },
    });

    await SourcingTicketService.ensureFromDemand(updated.id);

    revalidatePath("/sourcing");
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur conversion" };
  }
}

export async function advanceDemandStatus(demandId: string, newStatus: DemandStatus) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.edit");

    const demand = await prisma.demandIntake.findFirst({
      where: { id: demandId, tenantId: user.tenantId },
    });
    if (!demand) return { error: "Demande introuvable" };

    const updated = await prisma.demandIntake.update({
      where: { id: demandId },
      data: { status: newStatus },
    });

    revalidatePath("/sourcing");
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur avancement statut" };
  }
}

/**
 * Called from WhatsApp intent qualification service when intent score is HIGH/URGENT.
 * Creates a DemandIntake in RAW state and notifies the CM.
 */
export async function createDemandFromWhatsAppIntent(params: {
  tenantId: string;
  contactId?: string;
  leadId?: string;
  clientName: string;
  rawDescription: string;
  sourceRef: string;
  estimatedRevenue?: number;
  urgency?: DemandUrgency;
  sourcePayload?: Record<string, unknown>;
}) {
  try {
    const cm = await findCmUser(params.tenantId);

    // Avoid duplicate — same sourceRef per tenant
    const existing = await prisma.demandIntake.findFirst({
      where: {
        tenantId: params.tenantId,
        source: "WHATSAPP",
        sourceRef: params.sourceRef,
      },
    });
    if (existing) return { data: existing, created: false };

    const demand = await prisma.demandIntake.create({
      data: {
        tenantId: params.tenantId,
        source: "WHATSAPP",
        sourceRef: params.sourceRef,
        sourcePayload: params.sourcePayload as Prisma.InputJsonValue | undefined,
        clientName: params.clientName,
        rawDescription: params.rawDescription,
        currency: "XAF",
        urgency: params.urgency ?? "HIGH",
        status: "RAW",
        contactId: params.contactId,
        leadId: params.leadId,
        estimatedRevenue: params.estimatedRevenue,
        cmId: cm?.id,
        aiScore: params.urgency === "CRITICAL" ? 90 : 75,
      },
    });

    await SourcingTicketService.ensureFromDemand(demand.id);

    // Notify CM
    if (cm) {
      await prisma.notification.create({
        data: {
          tenantId: params.tenantId,
          userId: cm.id,
          type: "TASK_ASSIGNED",
          title: "Nouvelle intention d'achat WhatsApp",
          message: `${params.clientName} : "${params.rawDescription.slice(0, 120)}"`,
          entityType: "demand",
          entityId: demand.id,
        },
      });
    }

    return { data: demand, created: true };
  } catch (error) {
    console.error("[createDemandFromWhatsAppIntent]", error);
    return { error: error instanceof Error ? error.message : "Erreur création demande WhatsApp" };
  }
}

