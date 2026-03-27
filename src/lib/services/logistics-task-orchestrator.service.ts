import type { UserRole } from "@prisma/client";

import { prisma } from "@/lib/db";
import { OperationalTaskService } from "@/lib/services/operational-task.service";
import { LogisticsGovernanceService } from "@/lib/services/logistics-governance.service";
const LOGISTICS_WORKFLOW_TASK_TYPES = [
  "book_freight",
  "track_shipment",
  "clear_customs",
  "arrange_delivery",
  "resolve_logistics_incident",
  "warehouse_intake_review",
] as const;

async function cancelWorkflowTasks(params: {
  tenantId: string;
  shipmentId: string;
  keepTaskTypes?: string[];
}) {
  const keep = new Set(params.keepTaskTypes ?? []);
  await prisma.task.updateMany({
    where: {
      tenantId: params.tenantId,
      entityType: "shipment",
      entityId: params.shipmentId,
      module: "logistics",
      taskType: {
        in: LOGISTICS_WORKFLOW_TASK_TYPES.filter((taskType) => !keep.has(taskType)),
      },
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    },
    data: {
      status: "CANCELLED",
      blockedBy: null,
    },
  });
}

function priorityFromSnapshot(input: {
  businessRisk: "LOW" | "MEDIUM" | "HIGH";
  blockers: string[];
  health: "STABLE" | "WATCH" | "AT_RISK" | "BLOCKED";
}) {
  if (input.blockers.length > 0 || input.health === "BLOCKED") return "URGENT" as const;
  if (input.businessRisk === "HIGH" || input.health === "AT_RISK") return "HIGH" as const;
  return "NORMAL" as const;
}

export class LogisticsTaskOrchestratorService {
  static async syncShipmentWorkflow(shipmentId: string) {
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: {
        id: true,
        status: true,
        mode: true,
        trackingNumber: true,
        trackingProvider: true,
        warehouseReceipt: {
          select: {
            readyToShip: true,
            condition: true,
          },
        },
        order: {
          select: {
            tenantId: true,
            orderNumber: true,
            contact: { select: { name: true } },
          },
        },
        incidents: {
          where: { status: { notIn: ["RESOLVED", "CLOSED"] } },
          select: { id: true, severity: true, type: true },
        },
      },
    });

    if (!shipment) return;

    const snapshot = await LogisticsGovernanceService.getShipmentWorkflowSnapshot(shipment.id);
    if (!snapshot) return;

    if (shipment.status === "DELIVERED") {
      await cancelWorkflowTasks({
        tenantId: shipment.order.tenantId,
        shipmentId: shipment.id,
        keepTaskTypes: [],
      });
      return;
    }

    const keepTaskTypes: string[] = [];
    const common = {
      tenantId: shipment.order.tenantId,
      entityType: "shipment",
      entityId: shipment.id,
      module: "logistics",
      ownerType: "SYSTEM" as const,
      riskLevel: snapshot.businessRisk === "HIGH" ? ("HIGH" as const) : ("LOW" as const),
      tags: [
        "logistics",
        "shipment-workflow",
        shipment.status.toLowerCase(),
        shipment.mode.toLowerCase(),
      ],
      assigneeRoles: ["LOGISTICS_ASSISTANT", "LOGISTICS_MANAGER", "OPS"] as UserRole[],
      fallbackRoles: ["ADMIN", "DIRECTION", "CEO"] as UserRole[],
      reuseIfOpen: true,
      completionRequirements: {
        requiredComment: true,
      },
    };

    const workflowConfigs: Record<string, { taskType: string; title: string; roles?: UserRole[] }> = {
      PENDING: shipment.warehouseReceipt?.readyToShip
        ? {
            taskType: "book_freight",
            title: `Reserver le fret - ${shipment.order.orderNumber}`,
          }
        : {
            taskType: "warehouse_intake_review",
            title: `Verifier la readiness entrepot - ${shipment.order.orderNumber}`,
          },
      BOOKED: {
        taskType: "book_freight",
        title: `Confirmer le pickup - ${shipment.order.orderNumber}`,
      },
      PICKED_UP: {
        taskType: "track_shipment",
        title: `Suivre le depart effectif - ${shipment.order.orderNumber}`,
      },
      IN_TRANSIT: {
        taskType: "track_shipment",
        title: `Suivre le transit - ${shipment.order.orderNumber}`,
      },
      ARRIVED_PORT: {
        taskType: "clear_customs",
        title: `Preparer la douane - ${shipment.order.orderNumber}`,
      },
      CUSTOMS: {
        taskType: "clear_customs",
        title: `Lever les blocages douane - ${shipment.order.orderNumber}`,
      },
      CLEARED: {
        taskType: "arrange_delivery",
        title: `Organiser le last mile - ${shipment.order.orderNumber}`,
      },
      IN_DELIVERY: {
        taskType: "arrange_delivery",
        title: `Confirmer la remise client - ${shipment.order.orderNumber}`,
      },
    };

    const config = workflowConfigs[shipment.status];
    if (config) {
      keepTaskTypes.push(config.taskType);
      await OperationalTaskService.create({
        ...common,
        taskType: config.taskType,
        title: config.title,
        description: snapshot.nextAction,
        priority: priorityFromSnapshot({
          businessRisk: snapshot.businessRisk,
          blockers: snapshot.blockers,
          health: snapshot.shipmentHealth,
        }),
        slaHours: shipment.status === "CUSTOMS" ? 12 : shipment.status === "IN_DELIVERY" ? 8 : 24,
        dueInHours: shipment.status === "CUSTOMS" ? 6 : shipment.status === "IN_DELIVERY" ? 4 : 12,
        customFields: {
          shipmentStatus: shipment.status,
          workflowBlockers: snapshot.blockers,
          trackingFreshness: snapshot.trackingFreshness,
          shipmentHealth: snapshot.shipmentHealth,
          warehouseReadyToShip: shipment.warehouseReceipt?.readyToShip ?? false,
          warehouseCondition: shipment.warehouseReceipt?.condition ?? null,
        },
      });
    }

    if (shipment.incidents.length > 0) {
      keepTaskTypes.push("resolve_logistics_incident");
      await OperationalTaskService.create({
        ...common,
        taskType: "resolve_logistics_incident",
        title: `Traiter les incidents shipment - ${shipment.order.orderNumber}`,
        description: `Incident(s) ouvert(s): ${shipment.incidents.map((incident) => incident.type).join(", ")}`,
        priority: shipment.incidents.some((incident) => ["HIGH", "CRITICAL"].includes(incident.severity))
          ? "URGENT"
          : "HIGH",
        slaHours: 8,
        dueInHours: 4,
        assigneeRoles: ["LOGISTICS_MANAGER", "OPS"] as UserRole[],
        customFields: {
          openIncidentCount: shipment.incidents.length,
          openIncidentTypes: shipment.incidents.map((incident) => incident.type),
        },
      });
    }

    await cancelWorkflowTasks({
      tenantId: shipment.order.tenantId,
      shipmentId: shipment.id,
      keepTaskTypes,
    });
  }
}
