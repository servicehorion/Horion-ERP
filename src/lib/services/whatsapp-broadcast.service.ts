import { prisma } from "@/lib/db";
import { WhatsappAuditService } from "@/lib/services/whatsapp-audit.service";

const prismaAny = prisma as any;

export class WhatsappBroadcastService {
  static async createCampaign(tenantId: string, data: {
    name: string;
    objective?: string;
    segment?: string;
    scheduledAt?: Date;
    createdById?: string;
  }) {
    if (!prismaAny.whatsappCampaign) return null;
    const campaign = await prismaAny.whatsappCampaign.create({
      data: {
        tenantId,
        name: data.name,
        objective: data.objective ?? null,
        segment: data.segment ?? null,
        status: data.scheduledAt ? "SCHEDULED" : "DRAFT",
        scheduledAt: data.scheduledAt ?? null,
        createdById: data.createdById ?? null,
      },
    });

    await WhatsappAuditService.log({
      tenantId,
      actorId: data.createdById,
      action: "whatsapp.campaign_created",
      entityType: "whatsapp_campaign",
      entityId: campaign.id,
      payload: { name: data.name },
    });

    return campaign;
  }

  static async scheduleSends(params: {
    campaignId: string;
    waContactIds: string[];
    templateVersionId?: string;
  }) {
    if (!prismaAny.whatsappCampaignSend) return null;
    const sends = await prismaAny.whatsappCampaignSend.createMany({
      data: params.waContactIds.map((id) => ({
        campaignId: params.campaignId,
        waContactId: id,
        templateVersionId: params.templateVersionId ?? null,
        status: "PENDING",
      })),
    });
    return sends;
  }
}
