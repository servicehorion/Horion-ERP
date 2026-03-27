import { prisma } from "@/lib/db";
import type { LogisticsDashboardProjection, LogisticsPriorityAction } from "@/lib/logistics/types";
import { LogisticsGovernanceService } from "@/lib/services/logistics-governance.service";

function buildPriorityActions(input: {
  readyToBookCount: number;
  trackingStaleCount: number;
  customsBlockedCount: number;
  criticalIncidentCount: number;
  warehouseDraftCount: number;
  overdueLogisticsTasks: number;
}): LogisticsPriorityAction[] {
  const actions: LogisticsPriorityAction[] = [];

  if (input.readyToBookCount > 0) {
    actions.push({
      id: "ready_to_book",
      title: "Reserver les shipments prets a partir",
      description: `${input.readyToBookCount} expedition(s) ont deja une reception entrepot validee mais attendent encore un booking defensable.`,
      severity: "warning",
      href: "/logistics",
      count: input.readyToBookCount,
    });
  }

  if (input.trackingStaleCount > 0) {
    actions.push({
      id: "tracking_stale",
      title: "Relancer les shipments sans update recente",
      description: `${input.trackingStaleCount} expedition(s) manquent de signal tracking frais et menacent la lisibilite terrain.`,
      severity: "critical",
      href: "/logistics",
      count: input.trackingStaleCount,
    });
  }

  if (input.customsBlockedCount > 0) {
    actions.push({
      id: "customs_blocked",
      title: "Debloquer les dossiers douane",
      description: `${input.customsBlockedCount} expedition(s) sont retenues par la douane ou des pieces insuffisantes.`,
      severity: "critical",
      href: "/logistics",
      count: input.customsBlockedCount,
    });
  }

  if (input.criticalIncidentCount > 0) {
    actions.push({
      id: "critical_incidents",
      title: "Traiter les incidents critiques",
      description: `${input.criticalIncidentCount} incident(s) logistiques critiques restent ouverts et exposent la promesse client.`,
      severity: "critical",
      href: "/logistics",
      count: input.criticalIncidentCount,
    });
  }

  if (input.warehouseDraftCount > 0) {
    actions.push({
      id: "warehouse_drafts",
      title: "Revoir les brouillons entrepot Chine",
      description: `${input.warehouseDraftCount} brouillon(s) WhatsApp attendent encore une validation operations.`,
      severity: "warning",
      href: "/logistics/warehouse-bridge",
      count: input.warehouseDraftCount,
    });
  }

  if (input.overdueLogisticsTasks > 0) {
    actions.push({
      id: "overdue_logistics_tasks",
      title: "Nettoyer le backlog logistique",
      description: `${input.overdueLogisticsTasks} tache(s) logistiques actives ont deja depasse leur echeance interne.`,
      severity: "warning",
      href: "/tasks/my?module=logistics",
      count: input.overdueLogisticsTasks,
    });
  }

  return actions;
}

export class LogisticsDashboardProjectionService {
  static async get(tenantId: string): Promise<LogisticsDashboardProjection> {
    const [shipments, drafts, logisticsTasks] = await Promise.all([
      prisma.shipment.findMany({
        where: { order: { tenantId }, status: { not: "DELIVERED" } },
        select: {
          id: true,
          status: true,
          mode: true,
          origin: true,
          destination: true,
          freightPartnerId: true,
          trackingProvider: true,
          trackingNumber: true,
          trackingUrl: true,
          lastTrackingSyncAt: true,
          containerNumber: true,
          blNumber: true,
          proofImageUrl: true,
          estimatedDeparture: true,
          actualDeparture: true,
          estimatedArrival: true,
          actualArrival: true,
          updatedAt: true,
          weightValidatedAt: true,
          aiInsight: { select: { riskLevel: true } },
          warehouseReceipt: {
            select: { receivedAt: true, readyToShip: true, condition: true },
          },
          customsClearance: {
            select: { status: true, clearedAt: true, documents: true },
          },
          trackingEvents: {
            orderBy: { occurredAt: "desc" },
            take: 12,
            select: { event: true, location: true, occurredAt: true },
          },
          incidents: {
            where: { status: { notIn: ["RESOLVED", "CLOSED"] } },
            select: { id: true, type: true, severity: true, status: true },
          },
        },
        take: 400,
      }),
      prisma.warehouseIntakeDraft.count({
        where: { tenantId, status: "PENDING_REVIEW" },
      }),
      prisma.task.findMany({
        where: {
          tenantId,
          module: "logistics",
          status: { notIn: ["COMPLETED", "CANCELLED"] },
        },
        select: { dueDate: true, slaDeadline: true },
        take: 400,
      }),
    ]);

    const snapshots = shipments.map((shipment) =>
      LogisticsGovernanceService.buildWorkflowSnapshotFromContext({
        id: shipment.id,
        status: shipment.status,
        mode: shipment.mode,
        origin: shipment.origin ?? null,
        destination: shipment.destination ?? null,
        freightPartnerId: shipment.freightPartnerId ?? null,
        trackingProvider: shipment.trackingProvider ?? null,
        trackingNumber: shipment.trackingNumber ?? null,
        trackingUrl: shipment.trackingUrl ?? null,
        lastTrackingSyncAt: shipment.lastTrackingSyncAt ?? null,
        containerNumber: shipment.containerNumber ?? null,
        blNumber: shipment.blNumber ?? null,
        proofImageUrl: shipment.proofImageUrl ?? null,
        estimatedDeparture: shipment.estimatedDeparture ?? null,
        actualDeparture: shipment.actualDeparture ?? null,
        estimatedArrival: shipment.estimatedArrival ?? null,
        actualArrival: shipment.actualArrival ?? null,
        updatedAt: shipment.updatedAt,
        weightValidatedAt: shipment.weightValidatedAt ?? null,
        aiRiskLevel: shipment.aiInsight?.riskLevel ?? null,
        warehouseReceipt: shipment.warehouseReceipt
          ? {
              receivedAt: shipment.warehouseReceipt.receivedAt,
              readyToShip: shipment.warehouseReceipt.readyToShip,
              condition: shipment.warehouseReceipt.condition,
            }
          : null,
        customsClearance: shipment.customsClearance
          ? {
              status: shipment.customsClearance.status,
              clearedAt: shipment.customsClearance.clearedAt ?? null,
              documents: shipment.customsClearance.documents,
            }
          : null,
        trackingEvents: shipment.trackingEvents,
        incidents: shipment.incidents,
      })
    );

    const activeShipments = shipments.length;
    const readyToBookCount = shipments.filter(
      (shipment) => shipment.status === "PENDING" && shipment.warehouseReceipt?.readyToShip
    ).length;
    const trackingStaleCount = snapshots.filter((snapshot) => snapshot.trackingFreshness !== "LIVE").length;
    const customsBlockedCount = shipments.filter((shipment) =>
      ["HELD", "REJECTED", "PENDING", "DOCUMENTS_SUBMITTED", "UNDER_REVIEW", "DUTY_ASSESSED"].includes(
        shipment.customsClearance?.status || ""
      ) && ["ARRIVED_PORT", "CUSTOMS", "CLEARED"].includes(shipment.status)
    ).length;
    const criticalIncidentCount = shipments.reduce(
      (count, shipment) =>
        count +
        shipment.incidents.filter((incident) => ["HIGH", "CRITICAL"].includes(incident.severity)).length,
      0
    );

    const overdueLogisticsTasks = logisticsTasks.filter((task) => {
      const deadline = task.dueDate || task.slaDeadline;
      return deadline ? deadline < new Date() : false;
    }).length;

    return {
      overview: {
        activeShipments,
        readyToBookCount,
        trackingStaleCount,
        customsBlockedCount,
        criticalIncidentCount,
        warehouseDraftCount: drafts,
        canonicalJourney: [
          {
            key: "warehouse_ready",
            label: "Entrepot / readiness",
            count: shipments.filter((shipment) => ["PENDING", "BOOKED"].includes(shipment.status)).length,
            description: "Shipments encore en preparation, booking ou pickup initial.",
          },
          {
            key: "in_motion",
            label: "Transit",
            count: shipments.filter((shipment) => ["PICKED_UP", "IN_TRANSIT", "ARRIVED_PORT"].includes(shipment.status)).length,
            description: "Expeditions physiquement parties ou proches du point d'entree.",
          },
          {
            key: "customs",
            label: "Douane",
            count: shipments.filter((shipment) => ["CUSTOMS", "CLEARED"].includes(shipment.status)).length,
            description: "Dossiers d'import a clarifier avant la livraison finale.",
          },
          {
            key: "last_mile",
            label: "Last mile",
            count: shipments.filter((shipment) => shipment.status === "IN_DELIVERY").length,
            description: "Expeditions prêtes a etre remises au client final.",
          },
        ],
      },
      priorityActions: buildPriorityActions({
        readyToBookCount,
        trackingStaleCount,
        customsBlockedCount,
        criticalIncidentCount,
        warehouseDraftCount: drafts,
        overdueLogisticsTasks,
      }),
    };
  }
}
