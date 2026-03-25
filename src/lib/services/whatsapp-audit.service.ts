import { prisma } from "@/lib/db";
import { AuditService } from "@/lib/services/audit.service";

export class WhatsappAuditService {
  static async log(params: {
    tenantId: string;
    actorId?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    payload?: Record<string, unknown>;
  }) {
    const prismaAny = prisma as any;
    const payload = params.payload ?? {};

    try {
      if (prismaAny.whatsappAuditLog) {
        await prismaAny.whatsappAuditLog.create({
          data: {
            tenantId: params.tenantId,
            actorId: params.actorId ?? null,
            action: params.action,
            entityType: params.entityType,
            entityId: params.entityId,
            payload: payload as any,
          },
        });
      }
    } catch {
      // ignore logging errors
    }

    try {
      await AuditService.log({
        tenantId: params.tenantId,
        userId: params.actorId ?? undefined,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        newValue: payload as any,
      });
    } catch {
      // ignore logging errors
    }
  }
}
