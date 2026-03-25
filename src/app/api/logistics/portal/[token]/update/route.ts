import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { NotificationService } from "@/lib/services/notification.service";
import { notifyShipmentSlaIfNeeded } from "@/lib/services/logistics-sla.service";
import { refreshShipmentAI } from "@/lib/services/logistics-ai.service";

const ALLOWED_STATUSES = new Set([
  "PENDING",
  "BOOKED",
  "PICKED_UP",
  "IN_TRANSIT",
  "ARRIVED_PORT",
  "CUSTOMS",
  "CLEARED",
  "IN_DELIVERY",
  "DELIVERED",
]);

function uniqueIds(ids: Array<string | null | undefined>) {
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
}

async function getOrderTeamUserIds(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      ownerId: true,
      onboardedById: true,
      collaborators: { select: { userId: true } },
    },
  });
  if (!order) return [];
  return uniqueIds([
    order.ownerId,
    order.onboardedById,
    ...order.collaborators.map((c) => c.userId),
  ]);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const portal = await prisma.shipmentPortalToken.findUnique({
    where: { token },
    include: {
      shipment: { include: { order: { select: { id: true, tenantId: true, orderNumber: true } } } },
    },
  });
  if (!portal || portal.role !== "CARRIER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (portal.expiresAt && portal.expiresAt < new Date()) {
    return NextResponse.json({ error: "Token expired" }, { status: 401 });
  }

  const body = await req.json();
  const status = body.status;
  const event = body.event;
  const location = body.location || null;
  const estimatedArrival = body.estimatedArrival;
  const estimatedDeparture = body.estimatedDeparture;
  const etaDate = estimatedArrival ? new Date(estimatedArrival) : null;
  const etdDate = estimatedDeparture ? new Date(estimatedDeparture) : null;
  const etaValid = etaDate && !Number.isNaN(etaDate.getTime());
  const etdValid = etdDate && !Number.isNaN(etdDate.getTime());

  if (!event || typeof event !== "string") {
    return NextResponse.json({ error: "Event required" }, { status: 400 });
  }

  let updatedShipment: any = portal.shipment;
  if (status && ALLOWED_STATUSES.has(status)) {
    updatedShipment = await prisma.shipment.update({
      where: { id: portal.shipmentId },
      data: {
        status: status as any,
        ...(etaValid && { estimatedArrival: etaDate }),
        ...(etdValid && { estimatedDeparture: etdDate }),
      },
    });
  } else if (etaValid || etdValid) {
    updatedShipment = await prisma.shipment.update({
      where: { id: portal.shipmentId },
      data: {
        ...(etaValid && { estimatedArrival: etaDate }),
        ...(etdValid && { estimatedDeparture: etdDate }),
      },
    });
  }

  await prisma.trackingEvent.create({
    data: {
      shipmentId: portal.shipmentId,
      event,
      location,
      occurredAt: new Date(),
    },
  });

  const teamIds = await getOrderTeamUserIds(portal.shipment.order.id);
  await NotificationService.notifyMany(teamIds, {
    tenantId: portal.shipment.order.tenantId,
    type: "SHIPMENT_UPDATED",
    title: "Tracking transporteur",
    message: event,
    entityType: "shipment",
    entityId: portal.shipmentId,
  });

  await notifyShipmentSlaIfNeeded({
    shipment: updatedShipment,
    tenantId: portal.shipment.order.tenantId,
    teamIds,
  });

  await refreshShipmentAI(portal.shipmentId);

  return NextResponse.json({ ok: true });
}
