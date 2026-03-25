import { prisma } from "@/lib/db";
import { WhatsappAuditService } from "@/lib/services/whatsapp-audit.service";

const prismaAny = prisma as any;

function mergeTags(existing: any, tags: string[]) {
  const current = Array.isArray(existing) ? existing : [];
  return Array.from(new Set([...current, ...tags]));
}

export class WhatsappLeadQualificationService {
  static async ensureCrmLink(intentId: string) {
    if (!prismaAny.whatsappIntent) return null;
    const intent = await prismaAny.whatsappIntent.findUnique({
      where: { id: intentId },
      include: { whatsappContact: true, conversation: true },
    });
    if (!intent) return null;

    let contactId = intent.contactId as string | null;
    if (!contactId) {
      contactId = await this.ensureCrmContact(intent);
      if (contactId) {
        await prismaAny.whatsappIntent.update({
          where: { id: intentId },
          data: { contactId },
        });
      }
    }

    return contactId;
  }

  static async ensureCrmContact(intent: any): Promise<string | null> {
    const waContact = intent.whatsappContact;
    const tenantId = intent.tenantId;
    const phone = waContact?.phone;

    if (!phone) return null;

    const existing = await prisma.contact.findFirst({
      where: {
        tenantId,
        OR: [
          { whatsapp: phone },
          { phone },
        ],
      },
      select: { id: true, tags: true, ownerId: true },
    });

    if (existing) {
      if (prismaAny.whatsappContact && intent.waContactId) {
        await prismaAny.whatsappContact.update({
          where: { id: intent.waContactId },
          data: {
            linkedContactId: existing.id,
            name: waContact?.name ?? undefined,
          },
        });
      }
      return existing.id;
    }

    const created = await prisma.contact.create({
      data: {
        tenantId,
        type: "PROSPECT",
        name: waContact?.name || phone,
        phone,
        whatsapp: phone,
      },
    });

    if (prismaAny.whatsappContact && intent.waContactId) {
      await prismaAny.whatsappContact.update({
        where: { id: intent.waContactId },
        data: { linkedContactId: created.id },
      });
    }

    return created.id;
  }

  static async qualifyIntent(intentId: string, actorId?: string | null) {
    if (!prismaAny.whatsappIntent) return null;
    const intent = await prismaAny.whatsappIntent.findUnique({
      where: { id: intentId },
      include: {
        whatsappContact: true,
        conversation: true,
      },
    });
    if (!intent) return null;

    const contactId = intent.contactId || (await this.ensureCrmContact(intent));
    if (!contactId) return null;

    const lead = await prisma.lead.create({
      data: {
        contactId,
        status: "NEW",
        source: "whatsapp",
        description: intent.summary ?? undefined,
        assignedTo: intent.conversation?.assignedToId ?? undefined,
        ownerId: intent.conversation?.ownerId ?? undefined,
        onboardedById: actorId ?? undefined,
      },
    });

    const pipelineIntent = await prisma.customerPipelineIntent.create({
      data: {
        contactId,
        productName: intent.summary?.slice(0, 120),
        source: "whatsapp",
        probability: intent.score === "URGENT" || intent.score === "HIGH" ? 0.8 : 0.6,
        currency: "XAF",
      },
    });

    await prismaAny.whatsappIntent.update({
      where: { id: intentId },
      data: {
        crmIntentId: pipelineIntent.id,
        contactId,
        status: "QUALIFIED",
        qualifiedById: actorId ?? null,
      },
    });

    // Sync tags/owner/collaborators
    const convo = intent.conversation;
    if (convo) {
      const contactRecord = await prisma.contact.findUnique({
        where: { id: contactId },
        select: { tags: true },
      });
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          ...(convo.assignedToId ? { ownerId: convo.assignedToId } : {}),
          tags: mergeTags(contactRecord?.tags, Array.isArray(convo.tags) ? convo.tags : []),
        },
      });

      const collaboratorIds = [convo.ownerId, convo.assignedToId].filter(Boolean) as string[];
      for (const userId of collaboratorIds) {
        await prisma.contactCollaborator.upsert({
          where: { contactId_userId: { contactId, userId } },
          update: {},
          create: { contactId, userId },
        });
      }

      // Basic segment sync based on tags
      const tags = Array.isArray(convo.tags) ? convo.tags.map((t: unknown) => String(t).toLowerCase()) : [];
      const segmentMap: Record<string, string> = {
        vip: "KEY_ACCOUNT",
        strategic: "STRATEGIC_GROWTH",
        risk: "AT_RISK",
      };
      for (const tag of tags) {
        const segment = segmentMap[tag];
        if (!segment) continue;
        await prisma.customerSegmentation.upsert({
          where: {
            contactId_segment: {
              contactId,
              segment: segment as any,
            },
          },
          update: {},
          create: {
            contactId,
            segment: segment as any,
            notes: "Synchronisé depuis WhatsApp",
          },
        });
      }
    }

    // Create/Update WhatsApp lead pipeline entry
    if (prismaAny.whatsappLeadPipeline && intent.waContactId) {
      await prismaAny.whatsappLeadPipeline.upsert({
        where: {
          tenantId_waContactId: {
            tenantId: intent.tenantId,
            waContactId: intent.waContactId,
          },
        },
        update: {
          stage: "QUALIFIED",
          assignedToId: convo?.assignedToId ?? null,
        },
        create: {
          tenantId: intent.tenantId,
          waContactId: intent.waContactId,
          stage: "QUALIFIED",
          assignedToId: convo?.assignedToId ?? null,
        },
      });
    }

    await WhatsappAuditService.log({
      tenantId: intent.tenantId,
      actorId: actorId ?? undefined,
      action: "whatsapp.intent_qualified",
      entityType: "whatsapp_intent",
      entityId: intentId,
      payload: { leadId: lead.id, crmIntentId: pipelineIntent.id },
    });

    return { leadId: lead.id, crmIntentId: pipelineIntent.id };
  }
}
