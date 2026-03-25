import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { notifyShipmentSlaIfNeeded } from "@/lib/services/logistics-sla.service";
import { requireSecretHeader } from "@/lib/api/secret-auth";

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
    const auth = requireSecretHeader(req, "LOGISTICS_SLA_WEBHOOK_SECRET");
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json().catch(() => ({}));
    const tenantId = body?.tenantId ? String(body.tenantId) : null;

    const shipments = await prisma.shipment.findMany({
      where: {
        status: { not: "DELIVERED" },
        ...(tenantId ? { order: { tenantId } } : {}),
      },
      include: { order: { select: { tenantId: true } } },
    });

    let notified = 0;
    for (const shipment of shipments) {
      const teamIds = await getOrderTeamUserIds(shipment.orderId);
      const res = await notifyShipmentSlaIfNeeded({
        shipment,
        tenantId: shipment.order.tenantId,
        teamIds,
      });
      if (res.notified) notified += 1;
    }

    return NextResponse.json({ data: { checked: shipments.length, notified } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur SLA automation" },
      { status: 500 }
    );
  }
}
