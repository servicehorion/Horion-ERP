import { prisma } from "@/lib/db";
import { NotificationService } from "@/lib/services/notification.service";
import type { NotificationType, Shipment, ShipmentMode } from "@prisma/client";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const SLA_DAYS_BY_MODE: Record<ShipmentMode, number> = {
  SEA: 45,
  AIR: 10,
  ROAD: 12,
  RAIL: 20,
  MULTIMODAL: 30,
};

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function diffDays(from: Date, to: Date) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY));
}

export function computeShipmentSla(shipment: Shipment, now = new Date()) {
  const baseDate = shipment.actualDeparture || shipment.createdAt;
  const fallbackDue = addDays(baseDate, SLA_DAYS_BY_MODE[shipment.mode] || 20);
  const dueAt = shipment.estimatedArrival || fallbackDue;
  const daysLate = now > dueAt ? diffDays(dueAt, now) : 0;
  const level: NotificationType | null =
    daysLate >= 7 ? "SLA_BREACH" : daysLate >= 1 ? "SLA_WARNING" : null;
  return { dueAt, daysLate, level };
}

export async function notifyShipmentSlaIfNeeded(params: {
  shipment: Shipment;
  tenantId: string;
  teamIds: string[];
  now?: Date;
}) {
  const { shipment, tenantId, teamIds, now = new Date() } = params;
  const sla = computeShipmentSla(shipment, now);
  if (!sla.level || teamIds.length === 0) return { notified: false, sla };

  const existing = await prisma.notification.findFirst({
    where: {
      entityType: "shipment",
      entityId: shipment.id,
      type: sla.level,
      createdAt: { gt: new Date(now.getTime() - 24 * MS_PER_DAY) },
    },
    select: { id: true },
  });
  if (existing) return { notified: false, sla };

  const title = sla.level === "SLA_BREACH" ? "SLA depasse" : "SLA en risque";
  const message = `Shipment ${shipment.id} en retard de ${sla.daysLate} jour(s)`;

  await NotificationService.notifyMany(teamIds, {
    tenantId,
    type: sla.level,
    title,
    message,
    entityType: "shipment",
    entityId: shipment.id,
  });

  return { notified: true, sla };
}
