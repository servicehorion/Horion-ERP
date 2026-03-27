import { prisma } from "@/lib/db";
import { SourcingAssignmentService } from "@/lib/services/sourcing-assignment.service";
import { SourcingTaskOrchestratorService } from "@/lib/services/sourcing-task-orchestrator.service";
import { SourcingTicketService } from "@/lib/services/sourcing-ticket.service";

const prismaAny = prisma as any;

type IngestionResult = { created: number; skipped: number };

function mapIntentScoreToUrgency(score: string | null | undefined) {
  switch (score) {
    case "URGENT":
      return "CRITICAL";
    case "HIGH":
      return "HIGH";
    case "MEDIUM":
      return "HIGH";
    default:
      return "NORMAL";
  }
}

function mapIntentScoreToAiScore(score: string | null | undefined) {
  switch (score) {
    case "URGENT":
      return 95;
    case "HIGH":
      return 80;
    case "MEDIUM":
      return 65;
    default:
      return 45;
  }
}

function inferSegmentFromTags(tags: unknown): "VIP" | "STANDARD" | "RISK" {
  const list = Array.isArray(tags) ? tags.map((t) => String(t).toLowerCase()) : [];
  if (list.includes("vip") || list.includes("strategic")) return "VIP";
  if (list.includes("risk") || list.includes("blacklist")) return "RISK";
  return "STANDARD";
}

export class SourcingIngestionService {
  static async ingestFromWhatsappIntent(
    tenantId: string,
    intentId: string,
    options?: { autoAssign?: boolean }
  ): Promise<IngestionResult> {
    if (!prismaAny.whatsappIntent) return { created: 0, skipped: 0 };

    const intent = await prismaAny.whatsappIntent.findUnique({
      where: { id: intentId },
      include: { whatsappContact: true, conversation: true },
    });
    if (!intent || intent.tenantId !== tenantId) return { created: 0, skipped: 0 };

    const existing = await prisma.demandIntake.findFirst({
      where: { tenantId, source: "WHATSAPP", sourceRef: intent.id },
      select: { id: true },
    });
    if (existing) return { created: 0, skipped: 1 };

    let assignedToId = intent.conversation?.assignedToId ?? null;
    if (!assignedToId && options?.autoAssign) {
      const assignee = await SourcingAssignmentService.pickAssignee(tenantId, {
        entityType: "demand",
        urgency: mapIntentScoreToUrgency(intent.score),
      });
      assignedToId = assignee?.id ?? null;
    }

    const waContact = intent.whatsappContact;
    const clientName = waContact?.name || waContact?.phone || "WhatsApp";
    const tags = intent.conversation?.tags;

    const demand = await prisma.demandIntake.create({
      data: {
        tenantId,
        source: "WHATSAPP",
        sourceRef: intent.id,
        sourcePayload: {
          conversationId: intent.conversationId,
          waContactId: intent.waContactId,
          score: intent.score,
          tags,
        },
        clientName,
        clientSegment: inferSegmentFromTags(tags),
        rawDescription: intent.summary || "Demande WhatsApp",
        urgency: mapIntentScoreToUrgency(intent.score),
        aiScore: mapIntentScoreToAiScore(intent.score),
        assignedToId: assignedToId ?? undefined,
        receivedAt: intent.createdAt ?? new Date(),
      },
    });

    await SourcingTicketService.ensureFromDemand(demand.id);
    await SourcingTaskOrchestratorService.syncDemandWorkflow(tenantId, demand.id);

    return { created: 1, skipped: 0 };
  }

  static async ingestFromWhatsappIntents(params: {
    tenantId: string;
    limit?: number;
    autoAssign?: boolean;
  }): Promise<IngestionResult> {
    if (!prismaAny.whatsappIntent) return { created: 0, skipped: 0 };

    const intents = await prismaAny.whatsappIntent.findMany({
      where: {
        tenantId: params.tenantId,
        status: { in: ["DETECTED", "QUALIFIED"] },
      },
      include: { whatsappContact: true, conversation: true },
      orderBy: { createdAt: "desc" },
      take: params.limit ?? 100,
    });

    let created = 0;
    let skipped = 0;

    for (const intent of intents) {
      const result = await this.ingestFromWhatsappIntent(params.tenantId, intent.id, {
        autoAssign: params.autoAssign,
      });
      created += result.created;
      skipped += result.skipped;
    }

    return { created, skipped };
  }

  static async ingestFromCrmLeads(params: {
    tenantId: string;
    limit?: number;
    autoAssign?: boolean;
  }): Promise<IngestionResult> {
    const leads = await prisma.lead.findMany({
      where: {
        contact: { tenantId: params.tenantId },
        isArchived: false,
        status: { in: ["NEW", "QUALIFIED"] },
      },
      include: { contact: true },
      orderBy: { createdAt: "desc" },
      take: params.limit ?? 100,
    });

    let created = 0;
    let skipped = 0;

    for (const lead of leads) {
      const existing = await prisma.demandIntake.findFirst({
        where: { tenantId: params.tenantId, source: "CRM", sourceRef: lead.id },
        select: { id: true },
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      let assignedToId = lead.assignedTo || lead.ownerId;
      if (!assignedToId && params.autoAssign) {
        const assignee = await SourcingAssignmentService.pickAssignee(params.tenantId, {
          entityType: "demand",
          category: lead.category,
        });
        assignedToId = assignee?.id ?? null;
      }

      const demand = await prisma.demandIntake.create({
        data: {
          tenantId: params.tenantId,
          source: "CRM",
          sourceRef: lead.id,
          sourcePayload: {
            leadStatus: lead.status,
            leadSource: lead.source,
          },
          clientName: lead.contact?.name || "Lead CRM",
          clientSegment: "STANDARD",
          rawDescription: lead.description || "Demande CRM",
          category: lead.category ?? undefined,
          targetPrice: lead.estimatedValue ?? undefined,
          currency: lead.currency ?? "XAF",
          estimatedRevenue: lead.estimatedValue ?? undefined,
          urgency: "NORMAL",
          aiScore: 55,
          assignedToId: assignedToId ?? undefined,
          receivedAt: lead.createdAt ?? new Date(),
        },
      });
      await SourcingTicketService.ensureFromDemand(demand.id);
      await SourcingTaskOrchestratorService.syncDemandWorkflow(params.tenantId, demand.id);
      created += 1;
    }

    return { created, skipped };
  }
}
