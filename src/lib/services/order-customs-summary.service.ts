import type { CustomsClearanceStatus } from "@prisma/client";

import { prisma } from "@/lib/db";

type ShipmentCustomsSnapshot = {
  id: string;
  customsClearance: {
    status: string;
    declarationNum: string | null;
    dutyAmount: unknown;
    dutyCurrency: string;
    documents: unknown;
    clearedAt: Date | null;
  } | null;
};

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function toNumber(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function parseDocuments(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function deriveOrderStatus(
  shipments: ShipmentCustomsSnapshot[]
): CustomsClearanceStatus {
  const clearances = shipments
    .map((shipment) => shipment.customsClearance)
    .filter((clearance): clearance is NonNullable<ShipmentCustomsSnapshot["customsClearance"]> =>
      Boolean(clearance)
    );

  if (clearances.length === 0) return "PENDING";
  if (clearances.some((clearance) => clearance.status === "REJECTED")) return "REJECTED";
  if (clearances.some((clearance) => clearance.status === "HELD")) return "HOLD";
  if (clearances.every((clearance) => clearance.status === "CLEARED" || clearance.clearedAt)) {
    return "CLEARED";
  }
  return "IN_PROGRESS";
}

export class OrderCustomsSummaryService {
  static async syncFromShipments(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        shipments: {
          select: {
            id: true,
            customsClearance: {
              select: {
                status: true,
                declarationNum: true,
                dutyAmount: true,
                dutyCurrency: true,
                documents: true,
                clearedAt: true,
              },
            },
          },
        },
      },
    });

    if (!order) return null;

    const shipments = order.shipments as ShipmentCustomsSnapshot[];
    type ShipmentClearance = NonNullable<(typeof shipments)[number]["customsClearance"]>;
    const clearances = shipments
      .map((shipment) => ({
        shipmentId: shipment.id,
        clearance: shipment.customsClearance,
      }))
      .filter((item): item is { shipmentId: string; clearance: ShipmentClearance } =>
        Boolean(item.clearance)
      );

    const syncedShipmentIds = clearances.map((item) => item.shipmentId);
    const declarationRefs = uniqueStrings(
      clearances.map((item) => item.clearance.declarationNum)
    );
    const currencies = uniqueStrings(
      clearances.map((item) => item.clearance.dutyCurrency || "XAF")
    );
    const flattenedDocuments = clearances.flatMap((item) =>
      parseDocuments(item.clearance.documents).map((document) => ({
        shipmentId: item.shipmentId,
        document,
      }))
    );

    const orderStatus = deriveOrderStatus(shipments);
    const clearedDates = clearances
      .map((item) => item.clearance.clearedAt)
      .filter((value): value is Date => Boolean(value))
      .sort((a, b) => b.getTime() - a.getTime());

    const dutiesAmount =
      currencies.length === 1
        ? clearances.reduce((sum, item) => sum + toNumber(item.clearance.dutyAmount), 0)
        : null;
    const dutyCurrency = currencies[0] || "XAF";

    return prisma.orderCustomsClearance.upsert({
      where: { orderId: order.id },
      update: {
        status: orderStatus,
        declarationRef:
          declarationRefs.length <= 1
            ? declarationRefs[0] ?? null
            : `${declarationRefs.length} declarations shipment`,
        dutiesAmount,
        currency: dutyCurrency,
        clearedAt: orderStatus === "CLEARED" ? clearedDates[0] ?? null : null,
        documents: flattenedDocuments,
        syncedShipmentIds,
        lastSyncedAt: new Date(),
      },
      create: {
        orderId: order.id,
        status: orderStatus,
        declarationRef:
          declarationRefs.length <= 1
            ? declarationRefs[0] ?? null
            : `${declarationRefs.length} declarations shipment`,
        dutiesAmount,
        currency: dutyCurrency,
        clearedAt: orderStatus === "CLEARED" ? clearedDates[0] ?? null : null,
        documents: flattenedDocuments,
        syncedShipmentIds,
        lastSyncedAt: new Date(),
        notes: "Projection legacy alignee sur la douane shipment-level.",
      },
    });
  }
}
