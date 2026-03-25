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

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-horion-webhook-secret");
  if (!secret || secret !== process.env.LOGISTICS_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await req.json();
    const shipmentId: string | undefined = payload.shipmentId;
    const trackingNumber: string | undefined = payload.trackingNumber;

    const shipment = await prisma.shipment.findFirst({
      where: shipmentId
        ? { id: shipmentId }
        : trackingNumber
          ? {
            OR: [
              { blNumber: trackingNumber },
              { containerNumber: trackingNumber },
            ],
          }
          : undefined,
      include: { order: { select: { id: true, tenantId: true, orderNumber: true } } },
    });

    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    const events = Array.isArray(payload.events)
      ? payload.events
      : payload.event
        ? [payload.event]
        : [];

    if (events.length > 0) {
      await prisma.trackingEvent.createMany({
        data: events.map((event: any) => ({
          shipmentId: shipment.id,
          event: event.event || event.title || "Update",
          location: event.location || null,
          description: event.description || null,
          occurredAt: event.occurredAt ? new Date(event.occurredAt) : new Date(),
        })),
      });
    }

    const incomingStatus = payload.status;
    const incomingEta = payload.estimatedArrival || payload.eta;
    const incomingEtd = payload.estimatedDeparture || payload.etd;
    const etaDate = incomingEta ? new Date(incomingEta) : null;
    const etdDate = incomingEtd ? new Date(incomingEtd) : null;
    const etaValid = etaDate && !Number.isNaN(etaDate.getTime());
    const etdValid = etdDate && !Number.isNaN(etdDate.getTime());
    let updatedShipment: any = shipment;
    if (incomingStatus && ALLOWED_STATUSES.has(incomingStatus)) {
      updatedShipment = await prisma.shipment.update({
        where: { id: shipment.id },
        data: {
          status: incomingStatus as any,
          ...(etaValid && { estimatedArrival: etaDate }),
          ...(etdValid && { estimatedDeparture: etdDate }),
        },
      });
    } else if (etaValid || etdValid) {
      updatedShipment = await prisma.shipment.update({
        where: { id: shipment.id },
        data: {
          ...(etaValid && { estimatedArrival: etaDate }),
          ...(etdValid && { estimatedDeparture: etdDate }),
        },
      });
    }

    const teamIds = await getOrderTeamUserIds(shipment.order.id);
    await NotificationService.notifyMany(teamIds, {
      tenantId: shipment.order.tenantId,
      type: "SHIPMENT_UPDATED",
      title: "Tracking update",
      message: `Shipment ${shipment.order.orderNumber} mis a jour`,
      entityType: "shipment",
      entityId: shipment.id,
    });

    await notifyShipmentSlaIfNeeded({
      shipment: updatedShipment,
      tenantId: shipment.order.tenantId,
      teamIds,
    });

    await refreshShipmentAI(shipment.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook error", error);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}
