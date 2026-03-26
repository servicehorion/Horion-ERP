import type { WarehouseIntakeDraftStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { OperationalTaskService } from "@/lib/services/operational-task.service";
import { WarehouseMessageParserService } from "@/lib/services/warehouse-message-parser.service";

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

async function resolveOrderAndShipment(tenantId: string, reference?: string | null) {
  if (!reference) {
    return { orderId: null as string | null, shipmentId: null as string | null };
  }

  const normalized = reference.trim();
  if (!normalized) {
    return { orderId: null as string | null, shipmentId: null as string | null };
  }

  const order = await prisma.order.findFirst({
    where: {
      tenantId,
      OR: [{ id: normalized }, { orderNumber: normalized }],
    },
    select: {
      id: true,
      shipments: {
        orderBy: [{ createdAt: "desc" }],
        take: 1,
        select: { id: true },
      },
    },
  });
  if (order) {
    return {
      orderId: order.id,
      shipmentId: order.shipments[0]?.id ?? null,
    };
  }

  const shipment = await prisma.shipment.findFirst({
    where: {
      OR: [{ id: normalized }, { trackingNumber: normalized }],
      order: { tenantId },
    },
    select: { id: true, orderId: true },
  });

  return {
    orderId: shipment?.orderId ?? null,
    shipmentId: shipment?.id ?? null,
  };
}

export class WarehouseBridgeService {
  static async captureInbound(params: {
    tenantId: string;
    conversationId?: string | null;
    waContactId?: string | null;
    sourceMessageId?: string | null;
    rawText?: string | null;
    photoUrls?: string[];
  }) {
    const rawText = String(params.rawText || "").trim();
    const photoUrls = uniqueStrings(params.photoUrls ?? []);

    const existingDraft =
      params.sourceMessageId
        ? await prisma.warehouseIntakeDraft.findFirst({
            where: { tenantId: params.tenantId, sourceMessageId: params.sourceMessageId },
          })
        : null;

    const latestPendingDraft =
      !existingDraft && params.conversationId
        ? await prisma.warehouseIntakeDraft.findFirst({
            where: {
              tenantId: params.tenantId,
              conversationId: params.conversationId,
              status: "PENDING_REVIEW",
            },
            orderBy: { createdAt: "desc" },
          })
        : null;

    if (!rawText && photoUrls.length > 0 && latestPendingDraft) {
      return prisma.warehouseIntakeDraft.update({
        where: { id: latestPendingDraft.id },
        data: {
          photoUrls: uniqueStrings([
            ...(Array.isArray(latestPendingDraft.photoUrls) ? (latestPendingDraft.photoUrls as string[]) : []),
            ...photoUrls,
          ]) as any,
        },
      });
    }

    if (!rawText || !WarehouseMessageParserService.looksLikeWarehouseMessage(rawText)) {
      return null;
    }

    const parsed = await WarehouseMessageParserService.parse({ text: rawText, photoUrls });
    const resolution = await resolveOrderAndShipment(params.tenantId, parsed.orderId);
    const payload = {
      ...parsed,
      resolvedOrderId: resolution.orderId,
      resolvedShipmentId: resolution.shipmentId,
    };

    const draft =
      existingDraft
        ? await prisma.warehouseIntakeDraft.update({
            where: { id: existingDraft.id },
            data: {
              conversationId: params.conversationId ?? existingDraft.conversationId,
              waContactId: params.waContactId ?? existingDraft.waContactId,
              rawText,
              photoUrls: photoUrls as any,
              parsedPayload: payload as any,
              parsedAt: new Date(),
              orderId: resolution.orderId,
              shipmentId: resolution.shipmentId,
              status: "PENDING_REVIEW",
              rejectionReason: null,
            },
          })
        : await prisma.warehouseIntakeDraft.create({
            data: {
              tenantId: params.tenantId,
              conversationId: params.conversationId ?? null,
              waContactId: params.waContactId ?? null,
              sourceMessageId: params.sourceMessageId ?? null,
              rawText,
              photoUrls: photoUrls as any,
              parsedPayload: payload as any,
              parsedAt: new Date(),
              orderId: resolution.orderId,
              shipmentId: resolution.shipmentId,
              status: "PENDING_REVIEW",
            },
          });

    if (resolution.orderId) {
      await OperationalTaskService.create({
        tenantId: params.tenantId,
        entityType: "order",
        entityId: resolution.orderId,
        taskType: "warehouse_intake_review",
        title: "Verifier le brouillon de reception entrepot Chine",
        description: `Un message WhatsApp partenaire a ete parse pour la commande ${parsed.orderId ?? resolution.orderId}. Merci de confirmer les donnees avant creation du WarehouseReceipt.`,
        module: "logistics",
        priority: parsed.status === "complete" ? "HIGH" : "URGENT",
        ownerType: "SYSTEM",
        riskLevel: parsed.status === "complete" ? "MEDIUM" : "HIGH",
        slaHours: parsed.status === "complete" ? 8 : 4,
        tags: ["warehouse-bridge", "whatsapp", parsed.status],
        customFields: {
          warehouseIntakeDraftId: draft.id,
          parsedStatus: parsed.status,
          missingFields: parsed.missingFields,
        },
        completionRequirements: {
          requireAllSubtasks: true,
          requiredFieldKeys: ["warehouseIntakeDraftId"],
          requiredComment: parsed.status !== "complete",
        },
        assigneeRoles: ["LOGISTICS_ASSISTANT", "LOGISTICS_MANAGER", "OPS", "ADMIN"],
        reuseIfOpen: true,
        subtasks: [
          {
            title: "Verifier l'identification commande / expedition",
            slaHours: 2,
            assigneeRoles: ["LOGISTICS_ASSISTANT", "OPS"],
          },
          {
            title: "Confirmer poids, dimensions et photos",
            slaHours: parsed.status === "complete" ? 8 : 4,
            assigneeRoles: ["LOGISTICS_MANAGER", "LOGISTICS_ASSISTANT"],
            dependsOnPrevious: true,
          },
        ],
      });
    }

    return draft;
  }

  static async listDrafts(tenantId: string, status?: WarehouseIntakeDraftStatus) {
    return prisma.warehouseIntakeDraft.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
      },
      include: {
        conversation: {
          select: {
            id: true,
            contact: { select: { id: true, name: true, phone: true } },
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            contact: { select: { name: true } },
          },
        },
        shipment: {
          select: {
            id: true,
            trackingNumber: true,
            mode: true,
          },
        },
        validatedBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
  }
}
