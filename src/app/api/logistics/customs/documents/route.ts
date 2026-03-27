import crypto from "crypto";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { StorageService } from "@/lib/services/storage.service";
import { NotificationService } from "@/lib/services/notification.service";
import { refreshShipmentAI } from "@/lib/services/logistics-ai.service";
import { LogisticsTaskOrchestratorService } from "@/lib/services/logistics-task-orchestrator.service";
import { OrderCustomsSummaryService } from "@/lib/services/order-customs-summary.service";

async function getOrderTeamUserIds(orderId: string): Promise<string[]> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      ownerId: true,
      onboardedById: true,
      collaborators: { select: { userId: true } },
    },
  });
  if (!order) return [];
  const ids = [order.ownerId, order.onboardedById, ...order.collaborators.map((c) => c.userId)];
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
}

export async function POST(req: Request) {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.manage");

    const formData = await req.formData();
    const shipmentId = String(formData.get("shipmentId") || "");
    if (!shipmentId) {
      return NextResponse.json({ error: "shipmentId requis" }, { status: 400 });
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Fichier requis" }, { status: 400 });
    }

    StorageService.assertPrivateUploads();
    StorageService.validateUpload({
      filename: file.name || "document",
      mimeType: file.type,
      size: file.size,
      kind: "document",
    });

    const name = String(formData.get("name") || file.name || "Document");
    const note = String(formData.get("note") || "");

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { order: { select: { id: true, tenantId: true, orderNumber: true } } },
    });
    if (!shipment || shipment.order.tenantId !== user.tenantId) {
      return NextResponse.json({ error: "Expedition introuvable" }, { status: 404 });
    }

    const objectPath = StorageService.buildObjectPath(
      ["tenants", user.tenantId, "customs", shipmentId],
      file.name
    );
    const buffer = Buffer.from(await file.arrayBuffer());
    await StorageService.scanBufferIfEnabled({
      buffer,
      filename: file.name || "document",
      mimeType: file.type,
      size: file.size,
    });

    const upload = await StorageService.upload({
      path: objectPath,
      data: buffer,
      contentType: file.type || "application/octet-stream",
    });

    const doc = {
      id: crypto.randomUUID(),
      name,
      note,
      addedAt: new Date().toISOString(),
      status: "PENDING",
      addedById: user.id,
      storage: {
        bucket: upload.bucket,
        path: upload.path,
        mimeType: file.type || null,
        size: file.size,
      },
    };

    const existing = await prisma.customsClearance.findUnique({
      where: { shipmentId },
      select: { documents: true },
    });
    const docs = Array.isArray(existing?.documents) ? existing?.documents : [];

    await prisma.customsClearance.upsert({
      where: { shipmentId },
      update: { documents: [...docs, doc] },
      create: {
        shipmentId,
        status: "PENDING",
        documents: [doc],
      },
    });
    await OrderCustomsSummaryService.syncFromShipments(shipment.order.id);

    const downloadUrl = await StorageService.createSignedUrl({
      bucket: upload.bucket,
      path: upload.path,
    });

    const teamIds = await getOrderTeamUserIds(shipment.order.id);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "SHIPMENT_UPDATED",
      title: "Document douane ajoute",
      message: `Document douane ajoute pour commande ${shipment.order.orderNumber}`,
      entityType: "shipment",
      entityId: shipment.id,
    });

    await refreshShipmentAI(shipment.id);
    await LogisticsTaskOrchestratorService.syncShipmentWorkflow(shipment.id);

    return NextResponse.json({ data: { ...doc, downloadUrl } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur upload document" },
      { status: 500 }
    );
  }
}
