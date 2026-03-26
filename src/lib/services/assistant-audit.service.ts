import { Prisma, type AssistantMessageRole, type AssistantType } from "@prisma/client";
import { createHash } from "crypto";

import { prisma } from "@/lib/db";

type EnsureSessionInput = {
  sessionId?: string | null;
  tenantId: string;
  assistantType: AssistantType;
  userId?: string | null;
  publicToken?: string | null;
  title?: string | null;
  role?: string | null;
  module?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

export function hashAssistantPublicToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export class AssistantAuditService {
  static async ensureSession(input: EnsureSessionInput) {
    const publicTokenHash = input.publicToken ? hashAssistantPublicToken(input.publicToken) : null;

    if (input.sessionId) {
      const existing = await prisma.assistantSession.findFirst({
        where: {
          id: input.sessionId,
          tenantId: input.tenantId,
          assistantType: input.assistantType,
          ...(input.userId ? { userId: input.userId } : {}),
          ...(publicTokenHash ? { publicTokenHash } : {}),
        },
      });

      if (existing) {
        return prisma.assistantSession.update({
          where: { id: existing.id },
          data: {
            title: input.title ?? existing.title,
            role: input.role ?? existing.role,
            module: input.module ?? existing.module,
            entityType: input.entityType ?? existing.entityType,
            entityId: input.entityId ?? existing.entityId,
            metadata: toJson({
              ...(existing.metadata && typeof existing.metadata === "object"
                ? (existing.metadata as Record<string, unknown>)
                : {}),
              ...(input.metadata ?? {}),
            }),
          },
        });
      }
    }

    return prisma.assistantSession.create({
      data: {
        tenantId: input.tenantId,
        assistantType: input.assistantType,
        userId: input.userId ?? null,
        publicTokenHash,
        title: input.title ?? null,
        role: input.role ?? null,
        module: input.module ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        metadata: toJson(input.metadata ?? {}),
      },
    });
  }

  static async appendMessage(params: {
    sessionId: string;
    role: AssistantMessageRole;
    content: string;
    toolCallsJson?: Record<string, unknown>;
    sourcesJson?: Array<Record<string, unknown>>;
  }) {
    return prisma.assistantMessage.create({
      data: {
        sessionId: params.sessionId,
        role: params.role,
        content: params.content,
        toolCallsJson: toJson(params.toolCallsJson ?? {}),
        sourcesJson: toJson(params.sourcesJson ?? []),
      },
    });
  }

  static async addFeedback(params: {
    sessionId?: string | null;
    messageId?: string | null;
    rating?: number | null;
    comment?: string | null;
  }) {
    return prisma.assistantFeedback.create({
      data: {
        sessionId: params.sessionId ?? null,
        messageId: params.messageId ?? null,
        rating: params.rating ?? null,
        comment: params.comment?.trim() || null,
      },
    });
  }

  static async log(params: {
    tenantId: string;
    assistantType: AssistantType;
    sessionId?: string | null;
    action: string;
    entityType?: string | null;
    entityId?: string | null;
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    status?: string;
    errorMessage?: string | null;
  }) {
    return prisma.assistantAuditLog.create({
      data: {
        tenantId: params.tenantId,
        assistantType: params.assistantType,
        sessionId: params.sessionId ?? null,
        action: params.action,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        input: toJson(params.input ?? {}),
        output: toJson(params.output ?? {}),
        status: params.status ?? "SUCCESS",
        errorMessage: params.errorMessage ?? null,
      },
    });
  }
}
