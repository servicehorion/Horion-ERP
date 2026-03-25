import { prisma } from "@/lib/db";
import { LeadScoringService } from "@/lib/services/lead-scoring.service";
import type { CrmInboundSourceType, Prisma } from "@prisma/client";

type InboundContact = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  country?: string | null;
  city?: string | null;
};

type InboundLead = {
  description?: string | null;
  estimatedValue?: number | null;
  currency?: string | null;
  category?: string | null;
  containerType?: string | null;
  originCountry?: string | null;
  notes?: string | null;
};

type IngestionInput = {
  tenantId: string;
  sourceId?: string | null;
  sourceType: CrmInboundSourceType;
  sourceRef: string;
  payload: Record<string, unknown>;
  contact?: InboundContact;
  lead?: InboundLead;
};

const normalizeString = (value?: string | null) => (value ? value.trim() : null);

const normalizeArray = (value: unknown) =>
  Array.isArray(value) ? value.map((v) => String(v).trim()).filter(Boolean) : [];

export class CrmIngestionService {
  static async matchTerritory(tenantId: string, country?: string | null, city?: string | null) {
    const territories = await prisma.salesTerritory.findMany({
      where: { tenantId },
      select: { id: true, countryCodes: true, cityNames: true },
    });
    const normalizedCountry = normalizeString(country)?.toUpperCase() ?? null;
    const normalizedCity = normalizeString(city)?.toLowerCase() ?? null;

    for (const territory of territories) {
      const countries = normalizeArray(territory.countryCodes).map((c) => c.toUpperCase());
      const cities = normalizeArray(territory.cityNames).map((c) => c.toLowerCase());
      if (normalizedCountry && countries.includes(normalizedCountry)) return territory;
      if (normalizedCity && cities.includes(normalizedCity)) return territory;
    }
    return null;
  }

  static async resolveRouting(tenantId: string, sourceId?: string | null, contact?: InboundContact) {
    const source = sourceId
      ? await prisma.crmInboundSource.findUnique({ where: { id: sourceId } })
      : null;

    const settings = (source?.settings as Record<string, unknown>) || {};
    const defaultAssigneeId = typeof settings.defaultAssigneeId === "string" ? settings.defaultAssigneeId : null;
    const defaultSalesTeamId = typeof settings.salesTeamId === "string" ? settings.salesTeamId : null;
    const pipelineId = typeof settings.pipelineId === "string" ? settings.pipelineId : null;
    const pipelineStageId = typeof settings.pipelineStageId === "string" ? settings.pipelineStageId : null;

    let territory = null;
    if (contact?.country || contact?.city) {
      territory = await this.matchTerritory(tenantId, contact?.country, contact?.city);
    }

    let salesTeam = null;
    if (defaultSalesTeamId) {
      salesTeam = await prisma.salesTeam.findUnique({ where: { id: defaultSalesTeamId } });
    } else if (territory) {
      salesTeam = await prisma.salesTeam.findFirst({
        where: { tenantId, territoryId: territory.id },
        orderBy: { createdAt: "asc" },
      });
    }

    const assignee =
      defaultAssigneeId ||
      salesTeam?.managerId ||
      null;

    const defaultPipeline = await prisma.pipeline.findFirst({
      where: { tenantId, isDefault: true },
      include: { stages: { orderBy: { order: "asc" } } },
    });

    return {
      source,
      assigneeId: assignee,
      salesTeamId: salesTeam?.id ?? null,
      territoryId: territory?.id ?? null,
      pipelineId: pipelineId || defaultPipeline?.id || null,
      pipelineStageId: pipelineStageId || defaultPipeline?.stages?.[0]?.id || null,
    };
  }

  static async upsertContact(tenantId: string, contact?: InboundContact) {
    if (!contact) return null;

    const email = normalizeString(contact.email);
    const phone = normalizeString(contact.phone);
    const name = normalizeString(contact.name) || "Prospect";

    let existing = null as { id: string; ownerId?: string | null } | null;
    if (email || phone) {
      existing = await prisma.contact.findFirst({
        where: {
          tenantId,
          OR: [
            email ? { email } : undefined,
            phone ? { phone } : undefined,
            phone ? { whatsapp: phone } : undefined,
          ].filter(Boolean) as Prisma.ContactWhereInput[],
        },
        select: { id: true, ownerId: true },
      });
    }

    if (existing) {
      await prisma.contact.update({
        where: { id: existing.id },
        data: {
          name,
          email: email || undefined,
          phone: phone || undefined,
          company: normalizeString(contact.company) || undefined,
          country: normalizeString(contact.country) || undefined,
          city: normalizeString(contact.city) || undefined,
        },
      });
      return { id: existing.id, ownerId: existing.ownerId ?? null };
    }

    const created = await prisma.contact.create({
      data: {
        tenantId,
        type: "PROSPECT",
        name,
        email: email || undefined,
        phone: phone || undefined,
        whatsapp: phone || undefined,
        company: normalizeString(contact.company) || undefined,
        country: normalizeString(contact.country) || "CG",
        city: normalizeString(contact.city) || undefined,
      },
      select: { id: true, ownerId: true },
    });

    return { id: created.id, ownerId: created.ownerId ?? null };
  }

  static async ingest(input: IngestionInput) {
    const { tenantId, sourceId, sourceType, sourceRef, payload, contact, lead } = input;

    let event = null;
    try {
      event = await prisma.crmInboundEvent.create({
        data: {
          tenantId,
          sourceId: sourceId || undefined,
          sourceType,
          sourceRef,
          payload: payload as any,
        },
      });
    } catch (error: any) {
      if (error?.code === "P2002") {
        return { status: "duplicate" as const };
      }
      throw error;
    }

    const routing = await this.resolveRouting(tenantId, sourceId, contact);
    const contactInfo = await this.upsertContact(tenantId, contact);
    if (!contactInfo?.id) {
      await prisma.crmInboundEvent.update({
        where: { id: event.id },
        data: { status: "FAILED", processedAt: new Date() },
      });
      return { status: "failed" as const, error: "missing_contact" };
    }

    const pipelineId = routing.pipelineId;
    const pipelineStageId = routing.pipelineStageId;

    const leadRecord = await prisma.lead.create({
      data: {
        contactId: contactInfo.id,
        source: routing.source?.name || sourceType,
        description: normalizeString(lead?.description) || normalizeString(payload?.subject as string) || "Lead inbound",
        estimatedValue: lead?.estimatedValue ?? undefined,
        currency: lead?.currency || "XAF",
        category: normalizeString(lead?.category) || undefined,
        assignedTo: routing.assigneeId || contactInfo?.ownerId || undefined,
        ownerId: routing.assigneeId || contactInfo?.ownerId || undefined,
        containerType: lead?.containerType as any,
        originCountry: lead?.originCountry || "CN",
        notes: normalizeString(lead?.notes) || undefined,
        pipelineId: pipelineId || undefined,
        pipelineStageId: pipelineStageId || undefined,
        salesTeamId: routing.salesTeamId || undefined,
        territoryId: routing.territoryId || undefined,
      },
      select: { id: true, createdAt: true, status: true, estimatedValue: true, description: true, category: true, source: true, assignedTo: true },
    });

    await prisma.crmInboundEvent.update({
      where: { id: event.id },
      data: {
        contactId: contactInfo?.id ?? undefined,
        leadId: leadRecord.id,
        status: "PROCESSED",
        processedAt: new Date(),
      },
    });

    void LeadScoringService.recalculate(leadRecord.id);

    return { status: "processed" as const, leadId: leadRecord.id, contactId: contactInfo.id };
  }
}
