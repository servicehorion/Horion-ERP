"use server";

/**
 * order-logistics.actions.ts
 * Logistics, QC, disputes, exports, approvals, EDI, portal actions.
 */

import { getSession } from "@/lib/session";
import { OrderService } from "@/lib/services/order.service";
import { AuditService } from "@/lib/services/audit.service";
import { NotificationService } from "@/lib/services/notification.service";
import { LogisticsGovernanceService } from "@/lib/services/logistics-governance.service";
import { LogisticsTaskOrchestratorService } from "@/lib/services/logistics-task-orchestrator.service";
import { OrderCustomsSummaryService } from "@/lib/services/order-customs-summary.service";
import { ShipmentTrackingService } from "@/lib/services/shipment-tracking.service";
import { notifyShipmentSlaIfNeeded } from "@/lib/services/logistics-sla.service";
import { refreshShipmentAI } from "@/lib/services/logistics-ai.service";
import { OrderApprovalService } from "@/lib/services/order-approval.service";
import { EdiService } from "@/lib/services/edi.service";
import { FxService } from "@/lib/services/fx.service";
import { checkPermission } from "@/lib/permissions";
import { convertCurrency } from "@/config/currencies";
import { getOrderScopeWithDelegation } from "@/lib/access-control";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { randomUUID } from "crypto";
import {
  TransportCalculatorService,
  type HorionCargoCategory,
} from "@/lib/services/transport-calculator.service";

function hasOrderArchivedAt() {
  const models = (prisma as any)?._dmmf?.datamodel?.models;
  const orderModel = Array.isArray(models) ? models.find((m: any) => m.name === "Order") : null;
  return !!orderModel?.fields?.some((f: any) => f.name === "archivedAt");
}

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

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function escapePdfText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && next === '"') { current += '"'; i++; continue; }
    if (char === '"') { inQuotes = !inQuotes; continue; }
    if (char === "," && !inQuotes) { result.push(current); current = ""; continue; }
    current += char;
  }
  result.push(current);
  return result.map((v) => v.trim());
}

function buildSimplePdf(lines: string[]): Buffer {
  const header = "%PDF-1.4\n";
  const contentLines = [
    "BT",
    "/F1 12 Tf",
    "72 760 Td",
    ...lines.map((line, index) =>
      index === 0
        ? `(${escapePdfText(line)}) Tj`
        : `0 -18 Td (${escapePdfText(line)}) Tj`
    ),
    "ET",
  ];
  const contentStream = `${contentLines.join("\n")}\n`;
  const objects: string[] = [];
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  objects.push("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n");
  objects.push(`4 0 obj\n<< /Length ${Buffer.byteLength(contentStream, "utf8")} >>\nstream\n${contentStream}endstream\nendobj\n`);
  objects.push("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

  let offset = Buffer.byteLength(header, "utf8");
  const xrefOffsets = [0];
  for (const obj of objects) {
    xrefOffsets.push(offset);
    offset += Buffer.byteLength(obj, "utf8");
  }
  const xrefStart = offset;
  const xrefLines = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...xrefOffsets.slice(1).map((o) => `${o.toString().padStart(10, "0")} 00000 n `),
  ];
  const trailer = [
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefStart),
    "%%EOF",
  ];

  const pdf = `${header}${objects.join("")}${xrefLines.join("\n")}\n${trailer.join("\n")}`;
  return Buffer.from(pdf, "utf8");
}
export async function createShipment(orderId: string, data: {
  mode: string;
  origin?: string;
  destination?: string;
  parentShipmentId?: string;
  deliveryScope?: "FULL" | "PARTIAL" | "MULTI_LEG" | "SPLIT_DELIVERY";
  shipmentRole?: "PRIMARY" | "LEG" | "PARTIAL";
  splitGroupKey?: string;
  segmentIndex?: number;
  segmentLabel?: string;
  containerNumber?: string;
  blNumber?: string;
  estimatedDeparture?: string;
  estimatedArrival?: string;
  cost?: number;
  currency?: string;
  trackingProvider?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  cargoCategory?: HorionCargoCategory;
  isPureBattery?: boolean;
  isLiquid?: boolean;
  isDrone?: boolean;
  isFlammable?: boolean;
  isExplosive?: boolean;
  isSpray?: boolean;
  isIllegal?: boolean;
  isToxicChemical?: boolean;
  isWeaponReplica?: boolean;
  isMedicalSupplement?: boolean;
  hasImportAuthorization?: boolean;
  isUndeclared?: boolean;
  isFragile?: boolean;
  hasWoodenCratePackaging?: boolean;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.manage");

    const order = await OrderService.getById(orderId);
    if (!order || order.tenantId !== user.tenantId) return { error: "Commande introuvable" };

    const mode = data.mode as "SEA" | "AIR" | "ROAD" | "RAIL" | "MULTIMODAL";

    const orderItems = await prisma.orderItem.findMany({
      where: { orderId },
      select: { description: true },
      take: 20,
    });
    const inferred = TransportCalculatorService.inferComplianceFlagsFromDescriptions(
      orderItems.map((item) => item.description || "")
    );

    let appliedSurchargePct = 0;
    let complianceWarnings: string[] = [];
    if (mode === "AIR" || mode === "SEA") {
      const eligibility = TransportCalculatorService.validateTransportEligibility({
        weightKg: 1,
        mode,
        category: data.cargoCategory || inferred.category,
        isPureBattery: data.isPureBattery ?? inferred.isPureBattery,
        isLiquid: data.isLiquid ?? inferred.isLiquid,
        isDrone: data.isDrone ?? inferred.isDrone,
        isFlammable: data.isFlammable ?? inferred.isFlammable,
        isExplosive: data.isExplosive ?? inferred.isExplosive,
        isSpray: data.isSpray ?? inferred.isSpray,
        isIllegal: data.isIllegal,
        isToxicChemical: data.isToxicChemical ?? inferred.isToxicChemical,
        isWeaponReplica: data.isWeaponReplica ?? inferred.isWeaponReplica,
        isMedicalSupplement: data.isMedicalSupplement ?? inferred.isMedicalSupplement,
        hasImportAuthorization: data.hasImportAuthorization ?? false,
        isUndeclared: data.isUndeclared ?? false,
        isFragile: data.isFragile ?? false,
        hasWoodenCratePackaging: data.hasWoodenCratePackaging ?? false,
      });
      if (!eligibility.allowed) {
        return {
          error: `Expedition bloquee: ${eligibility.blockingReasons.join(" ")}`,
        };
      }
      appliedSurchargePct = eligibility.surchargePct;
      complianceWarnings = eligibility.warnings;
    }

    const baseCost = data.cost ?? undefined;
    const costWithSurcharge =
      baseCost != null
        ? Math.round(baseCost * (1 + appliedSurchargePct))
        : undefined;

    const shipment = await prisma.shipment.create({
      data: {
        orderId,
        mode: data.mode as any,
        parentShipmentId: data.parentShipmentId,
        deliveryScope: data.deliveryScope || "FULL",
        shipmentRole: data.shipmentRole || "PRIMARY",
        splitGroupKey: data.splitGroupKey,
        segmentIndex: data.segmentIndex,
        segmentLabel: data.segmentLabel,
        origin: data.origin || "Guangzhou",
        destination: data.destination || "Pointe-Noire",
        trackingProvider: data.trackingProvider,
        trackingNumber: data.trackingNumber,
        trackingUrl: data.trackingUrl,
        containerNumber: data.containerNumber,
        blNumber: data.blNumber,
        estimatedDeparture: data.estimatedDeparture ? new Date(data.estimatedDeparture) : undefined,
        estimatedArrival: data.estimatedArrival ? new Date(data.estimatedArrival) : undefined,
        cost: costWithSurcharge,
        currency: data.currency || "USD",
      },
    });

    const teamIds = await getOrderTeamUserIds(orderId);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "SHIPMENT_CREATED",
      title: "Expedition creee",
      message:
        appliedSurchargePct > 0
          ? `Nouvelle expedition pour commande ${order.orderNumber} (majoration ${Math.round(
              appliedSurchargePct * 100
            )}%)`
          : `Nouvelle expedition pour commande ${order.orderNumber}`,
      entityType: "shipment",
      entityId: shipment.id,
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "shipment.created",
      entityType: "shipment",
      entityId: shipment.id,
      newValue: {
        orderId,
        mode: data.mode,
        deliveryScope: data.deliveryScope || "FULL",
        shipmentRole: data.shipmentRole || "PRIMARY",
        parentShipmentId: data.parentShipmentId ?? null,
        segmentIndex: data.segmentIndex ?? null,
        surchargePct: appliedSurchargePct,
        complianceWarnings,
      },
    });

    await refreshShipmentAI(shipment.id);
    await LogisticsTaskOrchestratorService.syncShipmentWorkflow(shipment.id);

    revalidatePath(`/orders/${orderId}`);
    revalidatePath("/logistics");
    return { data: shipment, warnings: complianceWarnings };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur creation expedition" };
  }
}

export async function updateShipmentStatus(shipmentId: string, status: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.manage");

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { order: { select: { id: true, tenantId: true } } },
    });
    if (!shipment || shipment.order.tenantId !== user.tenantId) {
      return { error: "Expedition introuvable" };
    }

    await LogisticsGovernanceService.assertShipmentTransition(shipmentId, status as any);

    const updated = await prisma.shipment.update({
      where: { id: shipmentId },
      data: { status: status as any },
    });

    const teamIds = await getOrderTeamUserIds(shipment.order.id);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "SHIPMENT_UPDATED",
      title: "Expedition mise a jour",
      message: `Statut expedition: ${status}`,
      entityType: "shipment",
      entityId: shipmentId,
    });

    await notifyShipmentSlaIfNeeded({
      shipment: updated,
      tenantId: user.tenantId,
      teamIds,
    });

    await refreshShipmentAI(shipmentId);
    await LogisticsTaskOrchestratorService.syncShipmentWorkflow(shipmentId);

    revalidatePath(`/orders/${shipment.order.id}`);
    revalidatePath("/logistics");
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur mise a jour expedition" };
  }
}

export async function addTrackingEvent(shipmentId: string, data: { event: string; location?: string; description?: string; occurredAt: string }) {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.manage");

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { order: { select: { id: true, tenantId: true } } },
    });
    if (!shipment || shipment.order.tenantId !== user.tenantId) {
      return { error: "Expedition introuvable" };
    }

    const event = await prisma.trackingEvent.create({
      data: {
        shipmentId,
        event: data.event,
        location: data.location,
        description: data.description,
        occurredAt: new Date(data.occurredAt),
      },
    });

    const teamIds = await getOrderTeamUserIds(shipment.order.id);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "SHIPMENT_UPDATED",
      title: "Tracking mis a jour",
      message: data.event,
      entityType: "shipment",
      entityId: shipmentId,
    });

    await refreshShipmentAI(shipmentId);
    await LogisticsTaskOrchestratorService.syncShipmentWorkflow(shipmentId);

    revalidatePath(`/orders/${shipment.order.id}`);
    revalidatePath("/logistics");
    return { data: event };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur tracking" };
  }
}

export async function syncShipmentTracking(shipmentId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.manage");

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { order: { select: { id: true, tenantId: true } } },
    });
    if (!shipment || shipment.order.tenantId !== user.tenantId) {
      return { error: "Expedition introuvable" };
    }

    const result = await ShipmentTrackingService.syncShipmentTracking(shipmentId);

    const existing = await prisma.trackingEvent.findMany({
      where: { shipmentId },
      select: { event: true, occurredAt: true },
    });
    const existingKey = new Set(
      existing.map((e) => `${e.event}|${new Date(e.occurredAt).toISOString()}`)
    );

    const newEvents = result.events.filter(
      (e) => !existingKey.has(`${e.event}|${new Date(e.occurredAt).toISOString()}`)
    );

    if (newEvents.length) {
      await prisma.trackingEvent.createMany({
        data: newEvents.map((e) => ({
          shipmentId,
          event: e.event,
          location: e.location || undefined,
          description: e.description || undefined,
          occurredAt: e.occurredAt,
        })),
      });
    }

    const updated = await prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        trackingStatus: result.status || shipment.trackingStatus,
        trackingUrl: result.trackingUrl || shipment.trackingUrl,
        lastTrackingSyncAt: new Date(),
        ...(result.estimatedArrival ? { estimatedArrival: result.estimatedArrival } : {}),
      },
    });

    await refreshShipmentAI(shipmentId);
    await LogisticsTaskOrchestratorService.syncShipmentWorkflow(shipmentId);

    const teamIds = await getOrderTeamUserIds(shipment.order.id);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "SHIPMENT_UPDATED",
      title: "Tracking synchronise",
      message: "Synchronisation tracking terminee",
      entityType: "shipment",
      entityId: shipmentId,
    });

    revalidatePath(`/orders/${shipment.order.id}`);
    revalidatePath("/logistics");
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur sync tracking" };
  }
}

export async function createQcRequest(orderId: string, data: { type: string; inspector?: string; cost?: number; currency?: string; scheduledAt?: string }) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.manage");

    const order = await OrderService.getById(orderId);
    if (!order || order.tenantId !== user.tenantId) return { error: "Commande introuvable" };

    const request = await prisma.qCRequest.create({
      data: {
        orderId,
        type: data.type as any,
        inspector: data.inspector,
        cost: data.cost ?? undefined,
        currency: data.currency || "USD",
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      },
    });

    const teamIds = await getOrderTeamUserIds(orderId);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "QC_REQUEST_CREATED",
      title: "QC creee",
      message: `Nouvelle demande QC pour commande ${order.orderNumber}`,
      entityType: "qc_request",
      entityId: request.id,
    });

    revalidatePath(`/orders/${orderId}`);
    return { data: request };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur creation QC" };
  }
}

export async function updateQcRequestStatus(requestId: string, status: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.manage");

    const request = await prisma.qCRequest.findUnique({
      where: { id: requestId },
      include: { order: { select: { id: true, tenantId: true } } },
    });
    if (!request || request.order.tenantId !== user.tenantId) return { error: "QC introuvable" };

    const updated = await prisma.qCRequest.update({
      where: { id: requestId },
      data: { status: status as any, ...(status === "COMPLETED" && { completedAt: new Date() }) },
    });

    if (String(status).toUpperCase() === "FAILED") {
      await prisma.order.update({
        where: { id: request.order.id },
        data: {
          status: "LITIGE",
          timeline: {
            create: {
              event: "qc_failed_block",
              fromValue: null,
              toValue: "LITIGE",
              note: "QC FAIL detecte - commande bloquee",
              userId: user.id,
            },
          },
        },
      });
    }

    revalidatePath(`/orders/${request.order.id}`);
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur statut QC" };
  }
}

export async function addQcReport(requestId: string, data: { overallResult: string; defectRate?: number; recommendation?: string; photos?: string[] }) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.manage");

    const request = await prisma.qCRequest.findUnique({
      where: { id: requestId },
      include: { order: { select: { id: true, tenantId: true, status: true } } },
    });
    if (!request || request.order.tenantId !== user.tenantId) return { error: "QC introuvable" };

    const report = await prisma.qCReport.create({
      data: {
        qcRequestId: requestId,
        overallResult: data.overallResult,
        defectRate: data.defectRate ?? undefined,
        recommendation: data.recommendation,
        photos: data.photos ?? [],
      },
    });

    const qcStatus =
      data.overallResult === "PASS"
        ? "PASSED"
        : data.overallResult === "CONDITIONAL"
          ? "CONDITIONAL"
          : "FAILED";

    await prisma.qCRequest.update({
      where: { id: requestId },
      data: { status: qcStatus as any, completedAt: new Date() },
    });

    if (qcStatus === "FAILED") {
      await prisma.order.update({
        where: { id: request.order.id },
        data: {
          status: "LITIGE",
          timeline: {
            create: {
              event: "qc_failed_block",
              fromValue: request.order.status,
              toValue: "LITIGE",
              note: "QC FAIL detecte - commande bloquee jusqu'a correction",
              userId: user.id,
            },
          },
        },
      });
    }

    const teamIds = await getOrderTeamUserIds(request.order.id);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "QC_REPORT_ADDED",
      title: "Rapport QC",
      message: `Rapport QC ajoute pour commande ${request.order.id}`,
      entityType: "qc_report",
      entityId: report.id,
    });

    revalidatePath(`/orders/${request.order.id}`);
    return { data: report };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur rapport QC" };
  }
}

export async function createDispute(orderId: string, data: { type: string; description: string; amount?: number; currency?: string }) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.update_status");

    const order = await OrderService.getById(orderId);
    if (!order || order.tenantId !== user.tenantId) return { error: "Commande introuvable" };

    const dispute = await prisma.dispute.create({
      data: {
        orderId,
        type: data.type as any,
        description: data.description,
        amount: data.amount ?? undefined,
        currency: data.currency || "XAF",
      },
    });

    const returnModel = (prisma as any).returnMerchandise;
    const needsPhysicalReturn = ["QUALITY", "MISSING_ITEMS", "DAMAGE"].includes(String(data.type || "").toUpperCase());
    if (returnModel && needsPhysicalReturn) {
      await returnModel.create({
        data: {
          tenantId: user.tenantId,
          orderId,
          disputeId: dispute.id,
          status: "APPROVAL_PENDING",
          reason: data.description,
          requestedById: user.id,
          notes: "Auto-created from dispute requiring physical return",
          lines: {
            create: [{ description: "Items under dispute", quantity: 1, condition: "UNKNOWN" }],
          },
        },
      });
    }

    const teamIds = await getOrderTeamUserIds(orderId);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "DISPUTE_CREATED",
      title: "Nouveau litige",
      message: `Litige ouvert pour commande ${order.orderNumber}`,
      entityType: "dispute",
      entityId: dispute.id,
    });

    revalidatePath(`/orders/${orderId}`);
    return { data: dispute };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur cr-ation litige" };
  }
}

export async function resolveDispute(disputeId: string, resolution: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.update_status");

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { order: { select: { id: true, tenantId: true, orderNumber: true } } },
    });
    if (!dispute || dispute.order.tenantId !== user.tenantId) return { error: "Litige introuvable" };

    const updated = await prisma.dispute.update({
      where: { id: disputeId },
      data: { status: "RESOLVED", resolution, resolvedAt: new Date() },
    });

    const teamIds = await getOrderTeamUserIds(dispute.order.id);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "DISPUTE_RESOLVED",
      title: "Litige resolu",
      message: `Litige resolu pour commande ${dispute.order.orderNumber}`,
      entityType: "dispute",
      entityId: disputeId,
    });

    revalidatePath(`/orders/${dispute.order.id}`);
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur resolution litige" };
  }
}

export async function createReturnMerchandise(orderId: string, data: {
  disputeId?: string;
  reason: string;
  notes?: string;
  lines?: Array<{ description: string; quantity?: number; condition?: string; notes?: string }>;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.update_status");

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, tenantId: true },
    });
    if (!order || order.tenantId !== user.tenantId) {
      return { error: "Commande introuvable" };
    }

    const returnModel = (prisma as any).returnMerchandise;
    if (!returnModel) {
      return { error: "Le module RMA n'est pas disponible dans le schema Prisma courant" };
    }

    const lines = (data.lines || [])
      .filter((l) => l.description?.trim())
      .map((l) => ({
        description: l.description.trim(),
        quantity: Math.max(1, Number(l.quantity || 1)),
        condition: l.condition || "UNKNOWN",
        notes: l.notes || undefined,
      }));

    const rma = await returnModel.create({
      data: {
        tenantId: user.tenantId,
        orderId,
        disputeId: data.disputeId || undefined,
        status: "APPROVAL_PENDING",
        reason: data.reason.trim(),
        notes: data.notes || undefined,
        requestedById: user.id,
        lines: {
          create: lines.length > 0 ? lines : [{ description: "Retour commande", quantity: 1, condition: "UNKNOWN" }],
        },
      },
      include: { lines: true },
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "order.rma.created",
      entityType: "return_merchandise",
      entityId: rma.id,
      newValue: { orderId, disputeId: data.disputeId || null, status: rma.status },
    });

    const teamIds = await getOrderTeamUserIds(orderId);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "ORDER_UPDATED",
      title: "RMA cree",
      message: "Un retour marchandise a ete ouvert",
      entityType: "order",
      entityId: orderId,
    });

    revalidatePath(`/orders/${orderId}`);
    return { data: rma };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur creation RMA" };
  }
}

export async function updateReturnMerchandiseStatus(
  rmaId: string,
  status: "REQUESTED" | "APPROVAL_PENDING" | "APPROVED" | "REJECTED" | "IN_TRANSIT_TO_WAREHOUSE" | "RECEIVED" | "INSPECTED" | "RESOLVED" | "CLOSED",
  notes?: string
) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.update_status");

    const returnModel = (prisma as any).returnMerchandise;
    if (!returnModel) {
      return { error: "Le module RMA n'est pas disponible dans le schema Prisma courant" };
    }

    const rma = await returnModel.findUnique({
      where: { id: rmaId },
      include: { order: { select: { id: true, tenantId: true } } },
    });
    if (!rma || rma.order.tenantId !== user.tenantId) {
      return { error: "RMA introuvable" };
    }

    const updated = await returnModel.update({
      where: { id: rmaId },
      data: {
        status,
        notes: notes || rma.notes,
        ...(status === "APPROVED" ? { approvedById: user.id, approvedAt: new Date() } : {}),
        ...(status === "RECEIVED" ? { receivedAt: new Date() } : {}),
      },
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "order.rma.status_changed",
      entityType: "return_merchandise",
      entityId: rmaId,
      oldValue: { status: rma.status },
      newValue: { status },
    });

    const teamIds = await getOrderTeamUserIds(rma.order.id);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "ORDER_UPDATED",
      title: "RMA mise a jour",
      message: `Statut retour: ${status}`,
      entityType: "order",
      entityId: rma.order.id,
    });

    revalidatePath(`/orders/${rma.order.id}`);
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur mise a jour RMA" };
  }
}

export async function getReturnsForOrder(orderId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.view");

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, tenantId: true },
    });
    if (!order || order.tenantId !== user.tenantId) {
      return { error: "Commande introuvable" };
    }

    const returnModel = (prisma as any).returnMerchandise;
    if (!returnModel) return { data: [] };

    const returns = await returnModel.findMany({
      where: { orderId, tenantId: user.tenantId },
      include: { lines: true },
      orderBy: { createdAt: "desc" },
    });

    return { data: returns };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur chargement retours" };
  }
}

export async function calculateMargin(orderId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.view");

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, tenantId: true },
    });
    if (!order || order.tenantId !== user.tenantId) return { error: "Commande introuvable" };

    const report = await OrderService.recalculateMarginFromFinance(orderId);

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "order.margin_calculated",
      entityType: "order",
      entityId: orderId,
      newValue: { marginPercent: Number(report.marginPercent).toFixed(2), source: "finance_transaction" },
    });

    revalidatePath(`/orders/${orderId}`);
    return { data: report };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur calcul marge" };
  }
}

export async function upsertCustomsClearance(
  shipmentId: string,
  data: {
    status?: string;
    declarationNum?: string;
    dutyAmount?: number;
    dutyCurrency?: string;
    brokerName?: string;
    submittedAt?: string;
    clearedAt?: string;
  }
) {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.manage");

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { order: { select: { id: true, tenantId: true } } },
    });
    if (!shipment || shipment.order.tenantId !== user.tenantId) {
      return { error: "Exp-dition introuvable" };
    }

      const clearance = await prisma.customsClearance.upsert({
        where: { shipmentId },
      update: {
        ...(data.status && { status: data.status as any }),
        ...(data.declarationNum !== undefined && { declarationNum: data.declarationNum }),
        ...(data.dutyAmount !== undefined && { dutyAmount: data.dutyAmount }),
        ...(data.dutyCurrency && { dutyCurrency: data.dutyCurrency }),
        ...(data.brokerName !== undefined && { brokerName: data.brokerName }),
        ...(data.submittedAt && { submittedAt: new Date(data.submittedAt) }),
        ...(data.clearedAt && { clearedAt: new Date(data.clearedAt) }),
      },
      create: {
        shipmentId,
        status: (data.status as any) || "PENDING",
        declarationNum: data.declarationNum,
        dutyAmount: data.dutyAmount,
        dutyCurrency: data.dutyCurrency || "XAF",
        brokerName: data.brokerName,
        submittedAt: data.submittedAt ? new Date(data.submittedAt) : undefined,
        clearedAt: data.clearedAt ? new Date(data.clearedAt) : undefined,
        },
      });

      await OrderCustomsSummaryService.syncFromShipments(shipment.order.id);
      await refreshShipmentAI(shipmentId);
      await LogisticsTaskOrchestratorService.syncShipmentWorkflow(shipmentId);

      revalidatePath(`/orders/${shipment.order.id}`);
      revalidatePath("/logistics");
      return { data: clearance };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur d-douanement" };
  }
}

export async function addQcNonConformity(
  reportId: string,
  data: {
    category: string;
    severity: string;
    description: string;
    resolution?: string;
  }
) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.manage");

    const report = await prisma.qCReport.findUnique({
      where: { id: reportId },
      include: {
        qcRequest: { include: { order: { select: { id: true, tenantId: true } } } },
      },
    });
    if (!report || report.qcRequest.order.tenantId !== user.tenantId) {
      return { error: "Rapport QC introuvable" };
    }

    const nc = await prisma.qCNonConformity.create({
      data: {
        reportId,
        category: data.category,
        severity: data.severity,
        description: data.description,
        resolution: data.resolution,
      },
    });

    revalidatePath(`/orders/${report.qcRequest.order.id}`);
    return { data: nc };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur non-conformit-" };
  }
}

export async function exportOrdersCSV() {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.view");
    const scope = await getOrderScopeWithDelegation(user);
    if (!scope) return { error: "Acces refuse" };

    const orders = await prisma.order.findMany({
        where: {
          ...scope,
          ...(hasOrderArchivedAt() ? { archivedAt: null } : {}),
        },
        include: { contact: true },
        orderBy: { createdAt: "desc" },
      take: 5000,
    });

    const headers = "ID,Numero,Statut,Priorite,Client,Montant,XAF,Creee le";
    const rows = orders.map((o) =>
      [
        o.id,
        o.orderNumber,
        o.status,
        o.priority,
        `"${(o.contact?.name || "").replace(/"/g, '""')}"`,
        Number(o.totalClient),
        o.currency,
        o.createdAt.toISOString(),
      ].join(",")
    );

    const csv = [headers, ...rows].join("\n");

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "order.export.csv",
      entityType: "order",
      entityId: "bulk",
      newValue: { rows: orders.length },
    });

    return { data: csv };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur export" };
  }
}

export async function exportOrdersPDF() {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.view");
    const scope = await getOrderScopeWithDelegation(user);
    if (!scope) return { error: "Acces refuse" };

    const orders = await prisma.order.findMany({
        where: {
          ...scope,
          ...(hasOrderArchivedAt() ? { archivedAt: null } : {}),
        },
        include: { contact: true },
        orderBy: { createdAt: "desc" },
      take: 200,
    });

    const lines = [
      "Export commandes",
      `Total: ${orders.length}`,
      "",
      ...orders.flatMap((o) => ([
        `${o.orderNumber} | ${o.contact?.name || "Client"} | ${o.status} | ${formatMoney(Number(o.totalClient), o.currency)}`,
      ])),
      "",
      "Horion ERP - Export (placeholder)",
    ];

    const pdfBuffer = buildSimplePdf(lines);

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "order.export.pdf",
      entityType: "order",
      entityId: "bulk",
      newValue: { rows: orders.length },
    });

    return { data: pdfBuffer.toString("base64"), filename: `orders-${new Date().toISOString().slice(0, 10)}.pdf` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur export PDF" };
  }
}

export async function importOrdersCSV(payload: { content: string }) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.create");

    const lines = payload.content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      return { error: "CSV vide ou invalide" };
    }

    const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
    const getValue = (row: string[], key: string) => {
      const idx = headers.indexOf(key);
      return idx >= 0 ? row[idx] : "";
    };

    let created = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = parseCsvLine(lines[i]);
      if (row.length === 0) continue;

      const clientName = getValue(row, "contactname") || getValue(row, "client") || getValue(row, "clientname");
      const phone = getValue(row, "phone") || getValue(row, "telephone") || getValue(row, "whatsapp");
      const description = getValue(row, "description") || getValue(row, "item") || getValue(row, "product");
      const quantity = Number(getValue(row, "quantity") || "1");
      const unitPrice = Number(getValue(row, "unitprice") || "0");
      const currency = getValue(row, "currency") || "XAF";
      const destinationCity = getValue(row, "destinationcity") || "Brazzaville";
      const priority = (getValue(row, "priority") || "NORMAL").toUpperCase();
      const notes = getValue(row, "notes") || undefined;

      if (!clientName || !description) {
        errors.push(`Ligne ${i + 1}: client ou description manquante`);
        continue;
      }

      const contact = await prisma.contact.findFirst({
        where: {
          tenantId: user.tenantId,
          OR: [
            { name: clientName },
            ...(phone ? [{ phone }, { whatsapp: phone }] : []),
          ],
        },
        select: { id: true },
      });

      const contactId = contact?.id ?? (await prisma.contact.create({
        data: {
          tenantId: user.tenantId,
          type: "PROSPECT",
          name: clientName,
          phone: phone || undefined,
          whatsapp: phone || undefined,
        },
        select: { id: true },
      })).id;

      await OrderService.create(user.tenantId, {
        contactId,
        items: [
          {
            description,
            quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
            unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
            currency,
          },
        ],
        destinationCity,
        priority: ["LOW", "NORMAL", "HIGH", "URGENT"].includes(priority) ? (priority as any) : "NORMAL",
        notes,
        ownerId: user.id,
        onboardedById: user.id,
      });

      created += 1;
    }

    revalidatePath("/orders");
    revalidatePath("/dashboard");
    return { data: { created, errors } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur import CSV" };
  }
}

export async function refreshOrderApprovals(orderId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.approve");

    const order = await OrderService.getById(orderId);
    if (!order || order.tenantId !== user.tenantId) return { error: "Commande introuvable" };

    const result = await OrderApprovalService.syncOrderApprovals(orderId);
    revalidatePath(`/orders/${orderId}`);
    return { data: result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur approval" };
  }
}

export async function approveOrderStep(stepId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.approve");

    const step = await prisma.orderApproval.findUnique({
      where: { id: stepId },
      include: { order: true, rule: true },
    });
    if (!step || step.order.tenantId !== user.tenantId) {
      return { error: "Approbation introuvable" };
    }

    const updated = await OrderApprovalService.approveStep({
      stepId,
      userId: user.id,
    });

    const teamIds = await getOrderTeamUserIds(step.orderId);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "ORDER_UPDATED",
      title: "Commande approuvee",
      message: `Validation ${step.rule.name} par ${user.name || user.email}`,
      entityType: "order",
      entityId: step.orderId,
    });

    revalidatePath(`/orders/${step.orderId}`);
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur approval" };
  }
}

export async function rejectOrderStep(stepId: string, note?: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.approve");

    const step = await prisma.orderApproval.findUnique({
      where: { id: stepId },
      include: { order: true, rule: true },
    });
    if (!step || step.order.tenantId !== user.tenantId) {
      return { error: "Approbation introuvable" };
    }

    const updated = await OrderApprovalService.rejectStep({
      stepId,
      userId: user.id,
      note,
    });

    const teamIds = await getOrderTeamUserIds(step.orderId);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "ORDER_UPDATED",
      title: "Commande rejetee",
      message: `Validation ${step.rule.name} rejetee`,
      entityType: "order",
      entityId: step.orderId,
    });

    revalidatePath(`/orders/${step.orderId}`);
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur rejection" };
  }
}

export async function createOrderPortalLink(orderId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.view");

    const order = await OrderService.getById(orderId);
    if (!order || order.tenantId !== user.tenantId) return { error: "Commande introuvable" };

    const token = randomUUID();
    const portal = await prisma.orderPortalToken.create({
      data: {
        orderId,
        token,
        role: "CLIENT",
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const url = `${baseUrl}/portal/order/${portal.token}`;
    return { data: { url } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur portail" };
  }
}

export async function sendOrderEdi(orderId: string, provider = "CN_EDI") {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.update");

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, contact: true },
    });
    if (!order || order.tenantId !== user.tenantId) {
      return { error: "Commande introuvable" };
    }

    const supplierId = order.items[0]?.supplierId || null;
    const supplier = supplierId ? await prisma.supplier.findUnique({ where: { id: supplierId } }) : null;
    const payload = EdiService.buildOrderPayload({
      order,
      items: order.items,
      contact: order.contact,
      supplier,
    });

    const ediResult = await EdiService.sendOrderPayload(provider, payload);
    const edi = await prisma.orderEdiTransmission.create({
      data: {
        orderId,
        supplierId: supplierId || undefined,
        provider,
        status: ediResult.status,
        payload,
        response: ediResult.response ?? undefined,
        errorMessage: ediResult.errorMessage ?? undefined,
        sentAt: ediResult.ok ? new Date() : undefined,
        ackAt: (ediResult as any).acknowledged ? new Date() : undefined,
      },
    });

    if (ediResult.ok) {
      await NotificationService.notifyMany(await getOrderTeamUserIds(orderId), {
        tenantId: user.tenantId,
        type: "ORDER_UPDATED",
        title: "EDI envoye",
        message: `Transmission EDI envoyee (${provider})`,
        entityType: "order",
        entityId: orderId,
      });
    }

    revalidatePath(`/orders/${orderId}`);
    if (!ediResult.ok) {
      return { error: ediResult.errorMessage || "Erreur EDI", data: edi };
    }
    return { data: edi };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur EDI" };
  }
}

export async function recalculateOrderBudget(orderId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.update");

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, payments: true },
    });
    if (!order || order.tenantId !== user.tenantId) return { error: "Commande introuvable" };

    const outPayments = order.payments.filter(
      (p) => p.direction === "OUTBOUND" && p.status === "CONFIRMED"
    );
    const actualOut = outPayments.reduce((sum, p) => sum + Number(p.amountXAF), 0);
    const actualCost = actualOut + Number(order.logisticsCost) + Number(order.insuranceAmount);

    const latestRates = await FxService.getLatestRates();
    const snapshotRates = (order.fxRatesSnapshot as Record<string, number>) || {};
    const fxImpact = order.items.reduce((sum, item) => {
      try {
        const baseAmount = Number(item.unitPrice);
        const qty = item.quantity;
        const snapshot = convertCurrency(baseAmount, item.currency || "RMB", "XAF", snapshotRates);
        const latest = convertCurrency(baseAmount, item.currency || "RMB", "XAF", latestRates);
        return sum + (latest - snapshot) * qty;
      } catch {
        return sum;
      }
    }, 0);

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        budgetActualXAF: actualCost,
        fxImpactXAF: fxImpact,
      },
    });

    revalidatePath(`/orders/${orderId}`);
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur budget" };
  }
}

