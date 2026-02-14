import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export class AuditService {
  static async log(params: {
    tenantId: string;
    userId?: string;
    action: string;
    entityType: string;
    entityId: string;
    oldValue?: Prisma.InputJsonValue;
    newValue?: Prisma.InputJsonValue;
  }) {
    return prisma.auditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        oldValue: params.oldValue || undefined,
        newValue: params.newValue || undefined,
      },
    });
  }
}
