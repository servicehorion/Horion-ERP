import { prisma } from "@/lib/db";

export class WhatsappSlaService {
  static async computeSlaDueAt(tenantId: string, baseTime: Date) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    const hours = Number((tenant?.settings as any)?.whatsappSlaHours ?? 4);
    return new Date(baseTime.getTime() + hours * 3600 * 1000);
  }

  static async applySla(conversationId: string, tenantId: string, baseTime: Date) {
    const slaDueAt = await this.computeSlaDueAt(tenantId, baseTime);
    await prisma.whatsappConversation.update({
      where: { id: conversationId },
      data: { slaDueAt },
    });
  }
}
