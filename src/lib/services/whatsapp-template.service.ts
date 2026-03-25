import { prisma } from "@/lib/db";
import { WhatsappAuditService } from "@/lib/services/whatsapp-audit.service";

const prismaAny = prisma as any;

export class WhatsappTemplateService {
  static async createTemplate(tenantId: string, data: { name: string; category?: string; language?: string }) {
    if (!prismaAny.whatsappTemplate) return null;
    const template = await prismaAny.whatsappTemplate.create({
      data: {
        tenantId,
        name: data.name,
        category: data.category ?? null,
        language: data.language ?? "fr",
        status: "DRAFT",
      },
    });
    await WhatsappAuditService.log({
      tenantId,
      action: "whatsapp.template_created",
      entityType: "whatsapp_template",
      entityId: template.id,
      payload: { name: data.name },
    });
    return template;
  }

  static async addVersion(templateId: string, body: string, variables: string[] = []) {
    if (!prismaAny.whatsappTemplateVersion) return null;
    const version = await prismaAny.whatsappTemplateVersion.create({
      data: {
        templateId,
        body,
        variables,
        status: "DRAFT",
      },
    });
    return version;
  }

  static async approveVersion(versionId: string) {
    if (!prismaAny.whatsappTemplateVersion) return null;
    const version = await prismaAny.whatsappTemplateVersion.update({
      where: { id: versionId },
      data: { status: "APPROVED", approvedAt: new Date() },
    });
    return version;
  }
}
