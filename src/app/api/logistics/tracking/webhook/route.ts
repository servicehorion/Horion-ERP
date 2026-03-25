import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { NotificationService } from "@/lib/services/notification.service";
import { refreshShipmentAI } from "@/lib/services/logistics-ai.service";
import { requireSecretHeader } from "@/lib/api/secret-auth";

type TrackingEventPayload = {
  event: string;
  location?: string | null;
  description?: string | null;
  occurredAt: string | Date;
};

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
    const auth = requireSecretHeader(req, "TRACKING_WEBHOOK_SECRET");
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const payload = await req.json();
    const {
      shipmentId,
      trackingNumber,
      provider,
      tenantId,
      status,
      trackingUrl,
      estimatedArrival,
      events,
    } = payload || {};

    if (!shipmentId && !trackingNumber) {
      return NextResponse.json({ error: "shipmentId ou trackingNumber requis" }, { status: 400 });
    }

    const shipment = shipmentId
      ? await prisma.shipment.findUnique({
          where: { id: shipmentId },
          include: { order: { select: { id: true, tenantId: true, orderNumber: true } } },
        })
      : await prisma.shipment.findFirst({
          where: {
            trackingNumber: String(trackingNumber),
            ...(tenantId ? { order: { tenantId: String(tenantId) } } : {}),
          },
          include: { order: { select: { id: true, tenantId: true, orderNumber: true } } },
        });

    if (!shipment) {
      return NextResponse.json({ error: "Expedition introuvable" }, { status: 404 });
    }

    const parsedEvents: TrackingEventPayload[] = Array.isArray(events) ? events : [];
    const normalizedEvents = parsedEvents
      .filter((e) => e?.event)
      .map((e) => ({
        event: String(e.event),
        location: e.location ? String(e.location) : null,
        description: e.description ? String(e.description) : null,
        occurredAt: new Date(e.occurredAt),
      }));

    const existing = await prisma.trackingEvent.findMany({
      where: { shipmentId: shipment.id },
      select: { event: true, occurredAt: true },
    });
    const existingKey = new Set(
      existing.map((e) => `${e.event}|${new Date(e.occurredAt).toISOString()}`)
    );

    const newEvents = normalizedEvents.filter(
      (e) => !existingKey.has(`${e.event}|${new Date(e.occurredAt).toISOString()}`)
    );

    if (newEvents.length) {
      await prisma.trackingEvent.createMany({
        data: newEvents.map((e) => ({
          shipmentId: shipment.id,
          event: e.event,
          location: e.location || undefined,
          description: e.description || undefined,
          occurredAt: e.occurredAt,
        })),
      });
    }

    const statusChanged = status && status !== shipment.trackingStatus;

    await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        trackingProvider: provider || shipment.trackingProvider,
        trackingStatus: status || shipment.trackingStatus,
        trackingUrl: trackingUrl || shipment.trackingUrl,
        lastTrackingSyncAt: new Date(),
        ...(estimatedArrival ? { estimatedArrival: new Date(estimatedArrival) } : {}),
      },
    });

    await refreshShipmentAI(shipment.id);

    if (statusChanged || newEvents.length) {
      const teamIds = await getOrderTeamUserIds(shipment.order.id);
      await NotificationService.notifyMany(teamIds, {
        tenantId: shipment.order.tenantId,
        type: "SHIPMENT_UPDATED",
        title: "Tracking mis a jour",
        message: `Tracking ${shipment.order.orderNumber} (${status || shipment.trackingStatus || "update"})`,
        entityType: "shipment",
        entityId: shipment.id,
      });
    }

    return NextResponse.json({
      data: { shipmentId: shipment.id, newEvents: newEvents.length },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur webhook tracking" },
      { status: 500 }
    );
  }
}
