"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import { createWarehouseReceipt } from "@/lib/actions/logistics.actions";
import { WarehouseBridgeService } from "@/lib/services/warehouse-bridge.service";

function getParsedPayload(draft: { parsedPayload: unknown; photoUrls: unknown }) {
  const payload =
    draft.parsedPayload && typeof draft.parsedPayload === "object"
      ? (draft.parsedPayload as Record<string, unknown>)
      : {};

  const dimensions =
    payload.dimensionsCm && typeof payload.dimensionsCm === "object"
      ? (payload.dimensionsCm as Record<string, unknown>)
      : {};

  return {
    weightKg: Number(payload.weightKg ?? 0),
    lengthCm: Number(dimensions.L ?? 0),
    widthCm: Number(dimensions.W ?? 0),
    heightCm: Number(dimensions.H ?? 0),
    photoUrls: Array.isArray(draft.photoUrls) ? (draft.photoUrls as string[]) : [],
  };
}

async function ensureShipmentForDraft(orderId: string, shipmentId?: string | null) {
  if (shipmentId) return shipmentId;

  const latestShipment = await prisma.shipment.findFirst({
    where: { orderId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (latestShipment) return latestShipment.id;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      destinationCity: true,
    },
  });
  if (!order) return null;

  const created = await prisma.shipment.create({
    data: {
      orderId: order.id,
      mode: "AIR",
      status: "PENDING",
      origin: "Guangzhou",
      destination: order.destinationCity || "Brazzaville",
    },
    select: { id: true },
  });

  return created.id;
}

export async function getWarehouseIntakeDrafts(status?: "PENDING_REVIEW" | "CONFIRMED" | "REJECTED") {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.view");

    const drafts = await WarehouseBridgeService.listDrafts(user.tenantId, status as any);
    return { data: drafts };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur chargement brouillons entrepot" };
  }
}

export async function confirmWarehouseIntakeDraft(draftId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.manage");

    const draft = await prisma.warehouseIntakeDraft.findFirst({
      where: { id: draftId, tenantId: user.tenantId },
      select: {
        id: true,
        orderId: true,
        shipmentId: true,
        parsedPayload: true,
        photoUrls: true,
      },
    });

    if (!draft) return { error: "Brouillon introuvable" };
    if (!draft.orderId) return { error: "Le brouillon doit etre relie a une commande avant validation" };

    const parsed = getParsedPayload(draft);
    if (!parsed.weightKg || !parsed.lengthCm || !parsed.widthCm || !parsed.heightCm) {
      return { error: "Poids et dimensions complets sont requis pour confirmer le brouillon" };
    }

    const shipmentId = await ensureShipmentForDraft(draft.orderId, draft.shipmentId);
    if (!shipmentId) {
      return { error: "Impossible de resoudre ou creer l'expedition pour ce brouillon" };
    }

    const receiptResult = await createWarehouseReceipt({
      shipmentId,
      orderId: draft.orderId,
      actualWeightKg: parsed.weightKg,
      actualLengthCm: parsed.lengthCm,
      actualWidthCm: parsed.widthCm,
      actualHeightCm: parsed.heightCm,
      photoUrls: parsed.photoUrls,
      readyToShip: false,
    });

    if ("error" in receiptResult && receiptResult.error) {
      return { error: receiptResult.error };
    }

    await prisma.warehouseIntakeDraft.update({
      where: { id: draft.id },
      data: {
        shipmentId,
        status: "CONFIRMED",
        validatedById: user.id,
        validatedAt: new Date(),
        rejectionReason: null,
      },
    });

    await prisma.task.updateMany({
      where: {
        entityType: "order",
        entityId: draft.orderId,
        taskType: "warehouse_intake_review",
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    revalidatePath("/logistics/warehouse-bridge");
    revalidatePath("/logistics");
    revalidatePath(`/orders/${draft.orderId}`);
    return { data: { draftId, shipmentId } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur confirmation brouillon entrepot" };
  }
}

export async function rejectWarehouseIntakeDraft(draftId: string, rejectionReason: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.manage");

    const draft = await prisma.warehouseIntakeDraft.findFirst({
      where: { id: draftId, tenantId: user.tenantId },
      select: { id: true, orderId: true },
    });
    if (!draft) return { error: "Brouillon introuvable" };

    await prisma.warehouseIntakeDraft.update({
      where: { id: draft.id },
      data: {
        status: "REJECTED",
        validatedById: user.id,
        validatedAt: new Date(),
        rejectionReason: rejectionReason.trim() || "Brouillon rejete par les operations.",
      },
    });

    revalidatePath("/logistics/warehouse-bridge");
    if (draft.orderId) revalidatePath(`/orders/${draft.orderId}`);
    return { data: { draftId } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur rejet brouillon entrepot" };
  }
}
