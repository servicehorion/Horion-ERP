import { NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";

import { prisma } from "@/lib/db";
import { notifyShipmentSlaIfNeeded } from "@/lib/services/logistics-sla.service";
import { LeadSlaService } from "@/lib/services/lead-sla.service";
import { requireSecretHeader } from "@/lib/api/secret-auth";

// Task types that are time-critical and must escalate to OS managers on breach
const CRITICAL_TASK_TYPES = ["ceo_payment_validation", "quote_approval", "client_notification"];

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

    // ── Escalade SLA tâches critiques (CEO validation, COO approval, notification client) ──
    const overdueTasks = await prisma.task.findMany({
      where: {
        taskType: { in: CRITICAL_TASK_TYPES },
        status: { notIn: ["COMPLETED", "CANCELLED"] },
        slaDeadline: { lt: new Date() },
        slaBreach: false,
        ...(tenantId ? { tenantId } : {}),
      },
      include: {
        assignments: { select: { userId: true } },
      },
    });

    let tasksEscalated = 0;
    for (const task of overdueTasks) {
      // Mark as breached
      await prisma.task.update({ where: { id: task.id }, data: { slaBreach: true } });

      // Escalate to OS manager based on module
      const escalateeRoles: UserRole[] =
        task.taskType === "ceo_payment_validation"
          ? ["CEO", "DIRECTION", "ADMIN"]
          : task.taskType === "quote_approval"
            ? ["LOGISTICS_MANAGER", "DIRECTION", "CEO", "ADMIN"]
            : ["COMMUNITY_MANAGER", "DIRECTION", "ADMIN"]; // client_notification

      const escalatees = await prisma.user.findMany({
        where: { tenantId: task.tenantId, role: { in: escalateeRoles } },
        select: { id: true },
      });

      for (const esc of escalatees) {
        await prisma.notification.create({
          data: {
            tenantId: task.tenantId,
            userId: esc.id,
            type: "SLA_BREACH",
            title: `SLA dépassé — ${task.title.slice(0, 80)}`,
            message: `La tâche "${task.title}" a dépassé son échéance SLA. Action immédiate requise.`,
            entityType: "task",
            entityId: task.id,
          },
        });
      }

      tasksEscalated += 1;
    }

    return NextResponse.json({
      data: {
        shipmentsChecked: shipments.length,
        shipmentsNotified: notified,
        leadsChecked: leads.length,
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
