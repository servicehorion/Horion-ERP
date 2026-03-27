import type { ShipmentMode } from "@prisma/client";

import { prisma } from "@/lib/db";

function normalizeMode(value: string | null | undefined): ShipmentMode | undefined {
  if (!value) return undefined;
  const candidate = String(value).toUpperCase();
  return ["SEA", "AIR", "RAIL", "ROAD", "MULTIMODAL"].includes(candidate)
    ? (candidate as ShipmentMode)
    : undefined;
}

function normalizeStatus(value: string | null | undefined, fallback = "OPEN") {
  const status = String(value || fallback).trim();
  return status.length > 0 ? status.toUpperCase() : fallback;
}

export class LogisticsBatchService {
  static async ensureFromGroupageBatch(batchId: string) {
    const batch = await prisma.groupageBatch.findUnique({
      where: { id: batchId },
      select: {
        id: true,
        tenantId: true,
        name: true,
        destination: true,
        mode: true,
        status: true,
        etd: true,
        eta: true,
        notes: true,
        logisticsBatchId: true,
      },
    });

    if (!batch) return null;

    const canonical = await prisma.logisticsBatch.upsert({
      where: { legacyGroupageBatchId: batch.id },
      update: {
        tenantId: batch.tenantId,
        batchNumber: `GRP-${batch.id}`,
        type: "GROUPAGE",
        status: normalizeStatus(batch.status, "FORMING"),
        mode: normalizeMode(batch.mode),
        destination: batch.destination || undefined,
        etd: batch.etd ?? undefined,
        eta: batch.eta ?? undefined,
        notes: batch.notes ?? undefined,
      },
      create: {
        tenantId: batch.tenantId,
        batchNumber: `GRP-${batch.id}`,
        type: "GROUPAGE",
        status: normalizeStatus(batch.status, "FORMING"),
        mode: normalizeMode(batch.mode),
        destination: batch.destination || undefined,
        etd: batch.etd ?? undefined,
        eta: batch.eta ?? undefined,
        notes: batch.notes ?? undefined,
        legacyGroupageBatchId: batch.id,
      },
      select: { id: true },
    });

    if (batch.logisticsBatchId !== canonical.id) {
      await prisma.groupageBatch.update({
        where: { id: batch.id },
        data: { logisticsBatchId: canonical.id },
      });
    }

    return canonical;
  }

  static async ensureFromConsolidationBatch(batchId: string, tenantId?: string | null) {
    const batch = await prisma.consolidationBatch.findUnique({
      where: { id: batchId },
      select: {
        id: true,
        batchNumber: true,
        status: true,
        notes: true,
        logisticsBatchId: true,
        shipments: {
          select: {
            mode: true,
            destination: true,
            estimatedDeparture: true,
            estimatedArrival: true,
            order: {
              select: { tenantId: true },
            },
          },
          take: 8,
        },
      },
    });

    if (!batch) return null;

    const inferredTenantId =
      tenantId ||
      batch.shipments.find((shipment) => shipment.order.tenantId)?.order.tenantId ||
      null;
    if (!inferredTenantId) return null;

    const firstShipment = batch.shipments[0];

    const canonical = await prisma.logisticsBatch.upsert({
      where: { legacyConsolidationBatchId: batch.id },
      update: {
        tenantId: inferredTenantId,
        batchNumber: batch.batchNumber,
        type: "CONSOLIDATION",
        status: normalizeStatus(batch.status, "OPEN"),
        mode: firstShipment?.mode,
        destination: firstShipment?.destination || undefined,
        etd: firstShipment?.estimatedDeparture ?? undefined,
        eta: firstShipment?.estimatedArrival ?? undefined,
        notes: batch.notes ?? undefined,
      },
      create: {
        tenantId: inferredTenantId,
        batchNumber: batch.batchNumber,
        type: "CONSOLIDATION",
        status: normalizeStatus(batch.status, "OPEN"),
        mode: firstShipment?.mode,
        destination: firstShipment?.destination || undefined,
        etd: firstShipment?.estimatedDeparture ?? undefined,
        eta: firstShipment?.estimatedArrival ?? undefined,
        notes: batch.notes ?? undefined,
        legacyConsolidationBatchId: batch.id,
      },
      select: { id: true },
    });

    if (batch.logisticsBatchId !== canonical.id) {
      await prisma.consolidationBatch.update({
        where: { id: batch.id },
        data: { logisticsBatchId: canonical.id },
      });
    }

    return canonical;
  }
}
