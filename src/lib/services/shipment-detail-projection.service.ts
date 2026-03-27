import { prisma } from "@/lib/db";
import { LogisticsGovernanceService, SHIPMENT_STATUS_LABELS } from "@/lib/services/logistics-governance.service";

function toNumber(value: unknown) {
  return Number(value || 0);
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export type ShipmentDetailProjection = {
  id: string;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    customerName: string | null;
    customerPhone: string | null;
    customerEmail: string | null;
    customerWhatsApp: string | null;
  };
  shipment: {
    mode: string;
    status: string;
    origin: string | null;
    destination: string | null;
    trackingProvider: string | null;
    trackingNumber: string | null;
    trackingStatus: string | null;
    trackingUrl: string | null;
    containerNumber: string | null;
    blNumber: string | null;
    estimatedDeparture: Date | null;
    actualDeparture: Date | null;
    estimatedArrival: Date | null;
    actualArrival: Date | null;
    weight: number | null;
    volume: number | null;
    volumetricWeightKg: number | null;
    chargeableWeightKg: number | null;
    cost: number | null;
    currency: string;
    proofImageUrl: string | null;
    lastTrackingSyncAt: Date | null;
  };
  workflow: Awaited<ReturnType<typeof LogisticsGovernanceService.getShipmentWorkflowSnapshot>>;
  deliveryModel: {
    scope: string;
    role: string;
    label: string;
    splitGroupKey: string | null;
    segmentIndex: number | null;
    segmentLabel: string | null;
    parentShipment: {
      id: string;
      status: string;
      orderNumber: string | null;
    } | null;
    childShipments: Array<{
      id: string;
      status: string;
      label: string;
      segmentIndex: number | null;
      segmentLabel: string | null;
      role: string;
      scope: string;
    }>;
  };
  customs: {
    canonical: {
      status: string | null;
      declarationNum: string | null;
      brokerName: string | null;
      dutyAmount: number | null;
      dutyCurrency: string | null;
      documentCount: number;
      submittedAt: Date | null;
      clearedAt: Date | null;
    } | null;
    orderSummary: {
      status: string | null;
      declarationRef: string | null;
      lastSyncedAt: Date | null;
      syncedShipmentIds: string[];
    } | null;
  };
  batch: {
    canonical: {
      id: string;
      batchNumber: string;
      type: string;
      status: string;
      mode: string | null;
      destination: string | null;
      etd: Date | null;
      eta: Date | null;
    } | null;
    legacyGroupage: {
      id: string;
      name: string;
      status: string;
      destination: string | null;
    } | null;
    legacyConsolidation: {
      id: string;
      batchNumber: string;
      status: string;
    } | null;
  };
  warehouse: {
    receivedAt: Date | null;
    readyToShip: boolean;
    condition: string | null;
    conditionNotes: string | null;
    warehouseLocation: string | null;
    chargeableWeightKg: number | null;
    volumetricWeightKg: number | null;
  } | null;
  trackingEvents: Array<{
    id: string;
    event: string;
    location: string | null;
    description: string | null;
    occurredAt: Date;
  }>;
  incidents: Array<{
    id: string;
    type: string;
    severity: string;
    status: string;
    description: string;
    resolution: string | null;
    amount: number | null;
    currency: string | null;
    createdAt: Date;
    resolvedAt: Date | null;
  }>;
  costLines: Array<{
    id: string;
    type: string;
    amount: number;
    currency: string;
    notes: string | null;
  }>;
  portals: Array<{
    id: string;
    role: string;
    token: string;
    expiresAt: Date | null;
    createdAt: Date;
  }>;
  tasks: {
    total: number;
    open: number;
    blocked: number;
    overdue: number;
    items: Array<{
      id: string;
      title: string;
      status: string;
      dueDate: Date | null;
      slaDeadline: Date | null;
    }>;
  };
  metrics: {
    totalDetailedCost: number;
    unresolvedIncidents: number;
    customsDocuments: number;
  };
};

function getDeliveryModelLabel(scope: string, role: string, childCount: number) {
  if (scope === "MULTI_LEG") {
    return childCount > 0 ? "Shipment principal multi-leg" : "Shipment prepare pour multi-leg";
  }
  if (scope === "SPLIT_DELIVERY") {
    return childCount > 0 ? "Shipment split en plusieurs remises" : "Shipment marque split-delivery";
  }
  if (scope === "PARTIAL" || role === "PARTIAL") {
    return "Shipment partiel";
  }
  if (role === "LEG") {
    return "Jambe logistique";
  }
  return "Shipment simple";
}

function parseDocuments(value: unknown) {
  return Array.isArray(value) ? value : [];
}

export class ShipmentDetailProjectionService {
  static async get(shipmentId: string, tenantId: string): Promise<ShipmentDetailProjection | null> {
    const shipment = await prisma.shipment.findFirst({
      where: {
        id: shipmentId,
        order: { tenantId },
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            contact: {
              select: {
                name: true,
                phone: true,
                email: true,
                whatsapp: true,
              },
            },
            customsClearance: {
              select: {
                status: true,
                declarationRef: true,
                lastSyncedAt: true,
                syncedShipmentIds: true,
              },
            },
          },
        },
        logisticsBatch: {
          select: {
            id: true,
            batchNumber: true,
            type: true,
            status: true,
            mode: true,
            destination: true,
            etd: true,
            eta: true,
          },
        },
        groupageBatch: {
          select: {
            id: true,
            name: true,
            status: true,
            destination: true,
          },
        },
        consolidationBatch: {
          select: {
            id: true,
            batchNumber: true,
            status: true,
          },
        },
        parentShipment: {
          select: {
            id: true,
            status: true,
            order: { select: { orderNumber: true } },
          },
        },
        childShipments: {
          orderBy: [{ segmentIndex: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            status: true,
            segmentIndex: true,
            segmentLabel: true,
            shipmentRole: true,
            deliveryScope: true,
          },
        },
        customsClearance: true,
        warehouseReceipt: true,
        trackingEvents: {
          orderBy: { occurredAt: "desc" },
        },
        incidents: {
          orderBy: { createdAt: "desc" },
        },
        costLines: {
          orderBy: { createdAt: "asc" },
        },
        portalTokens: {
          orderBy: { createdAt: "desc" },
          take: 8,
        },
      },
    });

    if (!shipment) return null;

    const [workflow, tasks] = await Promise.all([
      LogisticsGovernanceService.getShipmentWorkflowSnapshot(shipment.id),
      prisma.task.findMany({
        where: {
          tenantId,
          entityType: "shipment",
          entityId: shipment.id,
        },
        select: {
          id: true,
          title: true,
          status: true,
          dueDate: true,
          slaDeadline: true,
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        take: 20,
      }),
    ]);

    const openTasks = tasks.filter((task) => !["COMPLETED", "CANCELLED"].includes(task.status));
    const overdueTasks = openTasks.filter((task) => {
      const deadline = task.dueDate || task.slaDeadline;
      return Boolean(deadline && deadline < new Date());
    });
    const customsDocuments = parseDocuments(shipment.customsClearance?.documents).length;
    const totalDetailedCost = shipment.costLines.reduce((sum, line) => sum + toNumber(line.amount), 0);

    return {
      id: shipment.id,
      order: {
        id: shipment.order.id,
        orderNumber: shipment.order.orderNumber,
        status: shipment.order.status,
        customerName: shipment.order.contact?.name ?? null,
        customerPhone: shipment.order.contact?.phone ?? null,
        customerEmail: shipment.order.contact?.email ?? null,
        customerWhatsApp: shipment.order.contact?.whatsapp ?? null,
      },
      shipment: {
        mode: shipment.mode,
        status: shipment.status,
        origin: shipment.origin,
        destination: shipment.destination,
        trackingProvider: shipment.trackingProvider,
        trackingNumber: shipment.trackingNumber,
        trackingStatus: shipment.trackingStatus,
        trackingUrl: shipment.trackingUrl,
        containerNumber: shipment.containerNumber,
        blNumber: shipment.blNumber,
        estimatedDeparture: shipment.estimatedDeparture,
        actualDeparture: shipment.actualDeparture,
        estimatedArrival: shipment.estimatedArrival,
        actualArrival: shipment.actualArrival,
        weight: shipment.weight != null ? toNumber(shipment.weight) : null,
        volume: shipment.volume != null ? toNumber(shipment.volume) : null,
        volumetricWeightKg:
          shipment.volumetricWeightKg != null ? toNumber(shipment.volumetricWeightKg) : null,
        chargeableWeightKg:
          shipment.chargeableWeightKg != null ? toNumber(shipment.chargeableWeightKg) : null,
        cost: shipment.cost != null ? toNumber(shipment.cost) : null,
        currency: shipment.currency,
        proofImageUrl: shipment.proofImageUrl,
        lastTrackingSyncAt: shipment.lastTrackingSyncAt,
      },
      workflow,
      deliveryModel: {
        scope: shipment.deliveryScope,
        role: shipment.shipmentRole,
        label: getDeliveryModelLabel(
          shipment.deliveryScope,
          shipment.shipmentRole,
          shipment.childShipments.length
        ),
        splitGroupKey: shipment.splitGroupKey,
        segmentIndex: shipment.segmentIndex,
        segmentLabel: shipment.segmentLabel,
        parentShipment: shipment.parentShipment
          ? {
              id: shipment.parentShipment.id,
              status: shipment.parentShipment.status,
              orderNumber: shipment.parentShipment.order?.orderNumber ?? null,
            }
          : null,
        childShipments: shipment.childShipments.map((child) => ({
          id: child.id,
          status: child.status,
          label: SHIPMENT_STATUS_LABELS[child.status] ?? child.status,
          segmentIndex: child.segmentIndex,
          segmentLabel: child.segmentLabel,
          role: child.shipmentRole,
          scope: child.deliveryScope,
        })),
      },
      customs: {
        canonical: shipment.customsClearance
          ? {
              status: shipment.customsClearance.status,
              declarationNum: shipment.customsClearance.declarationNum,
              brokerName: shipment.customsClearance.brokerName,
              dutyAmount:
                shipment.customsClearance.dutyAmount != null
                  ? toNumber(shipment.customsClearance.dutyAmount)
                  : null,
              dutyCurrency: shipment.customsClearance.dutyCurrency,
              documentCount: customsDocuments,
              submittedAt: shipment.customsClearance.submittedAt,
              clearedAt: shipment.customsClearance.clearedAt,
            }
          : null,
        orderSummary: shipment.order.customsClearance
          ? {
              status: shipment.order.customsClearance.status,
              declarationRef: shipment.order.customsClearance.declarationRef,
              lastSyncedAt: shipment.order.customsClearance.lastSyncedAt,
              syncedShipmentIds: uniqueStrings(
                Array.isArray(shipment.order.customsClearance.syncedShipmentIds)
                  ? shipment.order.customsClearance.syncedShipmentIds.map((value) => String(value))
                  : []
              ),
            }
          : null,
      },
      batch: {
        canonical: shipment.logisticsBatch
          ? {
              id: shipment.logisticsBatch.id,
              batchNumber: shipment.logisticsBatch.batchNumber,
              type: shipment.logisticsBatch.type,
              status: shipment.logisticsBatch.status,
              mode: shipment.logisticsBatch.mode ?? null,
              destination: shipment.logisticsBatch.destination ?? null,
              etd: shipment.logisticsBatch.etd ?? null,
              eta: shipment.logisticsBatch.eta ?? null,
            }
          : null,
        legacyGroupage: shipment.groupageBatch
          ? {
              id: shipment.groupageBatch.id,
              name: shipment.groupageBatch.name,
              status: shipment.groupageBatch.status,
              destination: shipment.groupageBatch.destination ?? null,
            }
          : null,
        legacyConsolidation: shipment.consolidationBatch
          ? {
              id: shipment.consolidationBatch.id,
              batchNumber: shipment.consolidationBatch.batchNumber,
              status: shipment.consolidationBatch.status,
            }
          : null,
      },
      warehouse: shipment.warehouseReceipt
        ? {
            receivedAt: shipment.warehouseReceipt.receivedAt,
            readyToShip: shipment.warehouseReceipt.readyToShip,
            condition: shipment.warehouseReceipt.condition,
            conditionNotes: shipment.warehouseReceipt.conditionNotes,
            warehouseLocation: shipment.warehouseReceipt.warehouseLocation,
            chargeableWeightKg:
              shipment.warehouseReceipt.chargeableWeightKg != null
                ? toNumber(shipment.warehouseReceipt.chargeableWeightKg)
                : null,
            volumetricWeightKg:
              shipment.warehouseReceipt.volumetricWeightKg != null
                ? toNumber(shipment.warehouseReceipt.volumetricWeightKg)
                : null,
          }
        : null,
      trackingEvents: shipment.trackingEvents.map((event) => ({
        id: event.id,
        event: event.event,
        location: event.location,
        description: event.description,
        occurredAt: event.occurredAt,
      })),
      incidents: shipment.incidents.map((incident) => ({
        id: incident.id,
        type: incident.type,
        severity: incident.severity,
        status: incident.status,
        description: incident.description,
        resolution: incident.resolution,
        amount: incident.amount != null ? toNumber(incident.amount) : null,
        currency: incident.currency,
        createdAt: incident.createdAt,
        resolvedAt: incident.resolvedAt,
      })),
      costLines: shipment.costLines.map((line) => ({
        id: line.id,
        type: line.type,
        amount: toNumber(line.amount),
        currency: line.currency,
        notes: line.notes,
      })),
      portals: shipment.portalTokens.map((token) => ({
        id: token.id,
        role: token.role,
        token: token.token,
        expiresAt: token.expiresAt,
        createdAt: token.createdAt,
      })),
      tasks: {
        total: tasks.length,
        open: openTasks.length,
        blocked: openTasks.filter((task) => task.status === "BLOCKED").length,
        overdue: overdueTasks.length,
        items: tasks,
      },
      metrics: {
        totalDetailedCost,
        unresolvedIncidents: shipment.incidents.filter((incident) => !["RESOLVED", "CLOSED"].includes(incident.status)).length,
        customsDocuments,
      },
    };
  }
}
