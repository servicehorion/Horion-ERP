import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notifyShipmentSlaIfNeeded } from "@/lib/services/logistics-sla.service";
import { LeadSlaService } from "@/lib/services/lead-sla.service";
import { TaskWorkflowService } from "@/lib/services/task-workflow.service";
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
    const auth = requireSecretHeader(req, "CRON_SECRET");
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

    const leads = await prisma.lead.findMany({
      where: {
        status: { in: ["NEW", "CONTACTED", "QUALIFIED", "QUOTED"] },
        ...(tenantId ? { contact: { tenantId } } : {}),
      },
      select: { id: true, status: true },
    });

    for (const lead of leads) {
      await LeadSlaService.updateSla(lead.id, lead.status);
    }

    let tasksEscalated = 0;
    const tenantIds = tenantId
      ? [tenantId]
      : (
          await prisma.task.findMany({
            where: {
              status: { notIn: ["COMPLETED", "CANCELLED"] },
              slaDeadline: { lt: new Date() },
              slaBreach: false,
            },
            select: { tenantId: true },
            distinct: ["tenantId"],
          })
        ).map((task) => task.tenantId);

    for (const currentTenantId of tenantIds) {
      tasksEscalated += await TaskWorkflowService.checkSLABreachesWithConsequences(currentTenantId);
    }

    return NextResponse.json({
      data: {
        shipmentsChecked: shipments.length,
        shipmentsNotified: notified,
        leadsChecked: leads.length,
        tasksEscalated,
        criticalTasksEscalated: tasksEscalated,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron SLA error" },
      { status: 500 }
    );
  }
}
