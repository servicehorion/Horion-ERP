"use server";

import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { serializeDecimals } from "@/lib/utils";
import { NotificationService } from "@/lib/services/notification.service";
import { computeShipmentSla, notifyShipmentSlaIfNeeded } from "@/lib/services/logistics-sla.service";
import { refreshShipmentAI } from "@/lib/services/logistics-ai.service";
import { StorageService } from "@/lib/services/storage.service";
import { CatalogMemoryService } from "@/lib/services/catalog-memory.service";
import type { NegotiatedTransportRateProfile } from "@/lib/services/transport-calculator.service";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const PDF_MAX_LINES = 70;
const RISK_RANK: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

const createFreightPartnerSchema = z.object({
  name: z.string().min(2, "Nom requis"),
  country: z.string().min(2, "Pays requis"),
  type: z.string().min(2, "Type requis"),
  city: z.string().optional(),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  wechat: z.string().optional(),
  website: z.union([z.string().url(), z.literal("")]).optional(),
  address: z.string().optional(),
  contactsJson: z.record(z.string(), z.unknown()).optional(),
  serviceProfileJson: z.record(z.string(), z.unknown()).optional(),
  rating: z.coerce.number().min(0).max(100).optional(),
  notes: z.string().optional(),
});

const createBatchSchema = z.object({
  notes: z.string().optional(),
});

const assignBatchSchema = z.object({
  batchId: z.string().min(1),
  shipmentIds: z.array(z.string().min(1)).min(1),
});

type DashboardPortStat = { port: string; count: number };

function diffDays(from: Date, to: Date) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY));
}

function buildBatchNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `LCL-${stamp}-${suffix}`;
}

function parseStringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function extractNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function extractString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function extractBestPartnerRateProfile(
  partners: Array<{
    id: string;
    name: string;
    serviceProfileJson: unknown;
  }>,
  params: {
    key: string;
    mode: "AIR" | "SEA";
    prefersDap?: boolean;
    field: "kgBuyRateXAF" | "cbmBuyRateXAF";
    pricingUnit: "KG" | "CBM";
  }
): NegotiatedTransportRateProfile | null {
  const candidates = partners.reduce<NegotiatedTransportRateProfile[]>((acc, partner) => {
      const profile =
        partner.serviceProfileJson && typeof partner.serviceProfileJson === "object"
          ? (partner.serviceProfileJson as Record<string, unknown>)
          : {};
      const supportedModes = parseStringList(profile.supportedModes).map((mode) => mode.toUpperCase());
      const modeAllowed = supportedModes.length === 0 || supportedModes.includes(params.mode);
      if (!modeAllowed) return acc;

      const rate = extractNumber(profile[params.field]);
      if (!rate || rate <= 0) return acc;

      acc.push({
        key: params.key,
        pricingUnit: params.pricingUnit,
        ratePerKg: params.field === "kgBuyRateXAF" ? rate : null,
        ratePerCbm: params.field === "cbmBuyRateXAF" ? rate : null,
        freightPartnerId: partner.id,
        freightPartnerName: partner.name,
        incoterm: extractString(profile.incoterms),
        supportsDap: profile.supportsDap === true,
        customsDeclarant: profile.customsDeclarant === true,
      });
      return acc;
    }, []);

  if (candidates.length === 0) return null;

  const filtered = params.prefersDap
    ? candidates.filter((candidate) => candidate.supportsDap)
    : candidates;
  const pool = filtered.length > 0 ? filtered : candidates;

  return pool.sort((a, b) => {
    const aRate = params.field === "kgBuyRateXAF" ? a.ratePerKg ?? Number.POSITIVE_INFINITY : a.ratePerCbm ?? Number.POSITIVE_INFINITY;
    const bRate = params.field === "kgBuyRateXAF" ? b.ratePerKg ?? Number.POSITIVE_INFINITY : b.ratePerCbm ?? Number.POSITIVE_INFINITY;
    return aRate - bRate;
  })[0] ?? null;
}

function escapePdfText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildSimplePdf(lines: string[]): Buffer {
  const header = "%PDF-1.4\n";
  const contentLines = [
    "BT",
    "/F1 12 Tf",
    "72 760 Td",
    ...lines.map((line, index) => (
      index === 0
        ? `(${escapePdfText(line)}) Tj`
        : `0 -16 Td (${escapePdfText(line)}) Tj`
    )),
    "ET",
  ];
  const contentStream = contentLines.join("\n") + "\n";
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
    ...xrefOffsets.slice(1).map((o) => `${String(o).padStart(10, "0")} 00000 n `),
  ];
  const trailer = [
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefStart),
    "%%EOF",
  ];
  const pdf = header + objects.join("") + xrefLines.join("\n") + "\n" + trailer.join("\n");
  return Buffer.from(pdf, "utf8");
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

function computeRiskLevel(params: {
  status: string;
  daysInStatus: number;
  isLate: boolean;
  noUpdateDays: number;
}) {
  const { status, daysInStatus, isLate, noUpdateDays } = params;
  if (status === "CUSTOMS" && daysInStatus >= 6) return "HIGH";
  if (isLate && daysInStatus >= 4) return "HIGH";
  if (noUpdateDays >= 4) return "HIGH";
  if (daysInStatus >= 10) return "MEDIUM";
  if (isLate) return "MEDIUM";
  return "LOW";
}

function buildRiskReasons(params: {
  status: string;
  daysInStatus: number;
  isLate: boolean;
  noUpdateDays: number;
}) {
  const reasons: string[] = [];
  if (params.status === "CUSTOMS") reasons.push("Bloque en douane");
  if (params.isLate) reasons.push("ETA depasse");
  if (params.daysInStatus >= 10) reasons.push("Statut trop long");
  if (params.noUpdateDays >= 4) reasons.push("Aucune mise a jour recente");
  return reasons;
}

export async function getLogisticsDashboard() {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.view");
    const tenantId = user.tenantId;
    const now = new Date();

    // Limit parallel DB fan-out to avoid exhausting Supabase Session-mode pool.
    const shipmentsRaw = await prisma.shipment.findMany({
      where: { order: { tenantId } },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            contact: { select: { name: true, phone: true, email: true, whatsapp: true } },
            totalClient: true,
            merchandiseTotal: true,
            logisticsCost: true,
            insuranceAmount: true,
            items: { select: { description: true }, take: 1 },
            disputes: {
              orderBy: { createdAt: "desc" },
              take: 5,
            },
          },
        },
        freightPartner: { select: { id: true, name: true, rating: true, country: true, type: true, notes: true } },
        trackingEvents: { orderBy: { occurredAt: "desc" } },
        customsClearance: true,
        aiInsight: true,
        costLines: true,
        incidents: { orderBy: { createdAt: "desc" }, take: 5 },
      },
      orderBy: { updatedAt: "desc" },
      take: 250,
    });

    const [statusCountsRaw, modeCountsRaw] = await Promise.all([
      prisma.shipment.groupBy({
        by: ["status"],
        where: { order: { tenantId } },
        _count: { _all: true },
      }),
      prisma.shipment.groupBy({
        by: ["mode"],
        where: { order: { tenantId } },
        _count: { _all: true },
      }),
    ]);

    const customsQueueRaw = await prisma.customsClearance.findMany({
      where: {
        status: { not: "CLEARED" },
        shipment: { order: { tenantId } },
      },
      include: {
        shipment: {
          select: {
            id: true,
            status: true,
            estimatedArrival: true,
            origin: true,
            destination: true,
            updatedAt: true,
            order: { select: { orderNumber: true, contact: { select: { name: true } } } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    const freightPartnersRaw = await prisma.freightPartner.findMany({
      include: {
        shipments: {
          where: { order: { tenantId } },
          select: {
            id: true,
            status: true,
            actualArrival: true,
            actualDeparture: true,
            estimatedArrival: true,
            weight: true,
            volume: true,
            cost: true,
            createdAt: true,
            mode: true,
          },
        },
      },
      orderBy: { rating: "desc" },
      take: 50,
    });

    const consolidationBatchesRaw = await prisma.consolidationBatch.findMany({
      where: { shipments: { some: { order: { tenantId } } } },
      include: {
        shipments: {
          where: { order: { tenantId } },
          select: { id: true, mode: true, status: true, destination: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });

    const [deliveredSamples, transitSamples, costAgg, originCountsRaw, destinationCountsRaw] = await Promise.all([
      prisma.shipment.findMany({
        where: {
          order: { tenantId },
          status: "DELIVERED",
          actualArrival: { not: null },
          estimatedArrival: { not: null },
        },
        select: { actualArrival: true, estimatedArrival: true },
      }),
      prisma.shipment.findMany({
        where: {
          order: { tenantId },
          actualDeparture: { not: null },
          actualArrival: { not: null },
        },
        select: { actualDeparture: true, actualArrival: true, mode: true },
      }),
      prisma.shipment.aggregate({
        where: {
          order: { tenantId },
          cost: { not: null },
          weight: { not: null },
        },
        _sum: { cost: true, weight: true },
      }),
      prisma.shipment.groupBy({
        by: ["origin"],
        where: { order: { tenantId } },
        _count: { _all: true },
      }),
      prisma.shipment.groupBy({
        by: ["destination"],
        where: { order: { tenantId } },
        _count: { _all: true },
      }),
    ]);

    const statusCounts = Object.fromEntries(
      statusCountsRaw.map((s) => [s.status, s._count._all])
    );

    const modeCounts = Object.fromEntries(
      modeCountsRaw.map((m) => [m.mode, m._count._all])
    );

    const shipments = shipmentsRaw.map((ship) => {
      const lastEvent = ship.trackingEvents[0];
      const lastUpdateAt = lastEvent?.occurredAt ?? ship.updatedAt;
      const daysInStatus = diffDays(lastUpdateAt, now);
      const isLate = Boolean(
        ship.estimatedArrival &&
          ship.status !== "DELIVERED" &&
          new Date(ship.estimatedArrival).getTime() < now.getTime()
      );
      const noUpdateDays = diffDays(lastUpdateAt, now);

      const totalClient = Number(ship.order?.totalClient || 0);
      const costBase =
        Number(ship.order?.merchandiseTotal || 0) +
        Number(ship.order?.logisticsCost || 0) +
        Number(ship.order?.insuranceAmount || 0);
      const marginValue = totalClient - costBase;
      const marginPercent = totalClient > 0 ? (marginValue / totalClient) * 100 : 0;

      const riskLevelBase = computeRiskLevel({
        status: ship.status,
        daysInStatus,
        isLate,
        noUpdateDays,
      });
      const riskReasons = buildRiskReasons({
        status: ship.status,
        daysInStatus,
        isLate,
        noUpdateDays,
      });
      const sla = computeShipmentSla(ship, now);
      // aiInsight not in current schema — reserved for future AI module
      const aiInsight = ship.aiInsight
        ? {
            predictedArrival: ship.aiInsight.predictedArrival,
            predictedDelayDays: ship.aiInsight.predictedDelayDays,
            riskScore: ship.aiInsight.riskScore,
            riskLevel: ship.aiInsight.riskLevel,
            factors: ship.aiInsight.factors,
            calculatedAt: ship.aiInsight.calculatedAt,
          }
        : null;
      const aiRisk = aiInsight?.riskLevel || null;
      const riskLevel =
        aiRisk && (RISK_RANK[aiRisk] || 0) > (RISK_RANK[riskLevelBase] || 0)
          ? aiRisk
          : riskLevelBase;
      const aiFactors = Array.isArray(aiInsight?.factors) ? aiInsight?.factors : [];
      const mergedReasons = [...riskReasons, ...aiFactors].filter((reason): reason is string => Boolean(reason));

      return {
        id: ship.id,
        orderId: ship.orderId,
        orderNumber: ship.order?.orderNumber || "",
        customerName: ship.order?.contact?.name || "",
        customerPhone: ship.order?.contact?.phone || "",
        customerEmail: ship.order?.contact?.email || "",
        customerWhatsApp: ship.order?.contact?.whatsapp || "",
        product: ship.order?.items?.[0]?.description || "",
        freightPartner: ship.freightPartner?.name || "",
        freightPartnerId: ship.freightPartner?.id || null,
        mode: ship.mode,
        origin: ship.origin,
        destination: ship.destination,
        trackingNumber: ship.trackingNumber || ship.blNumber || ship.containerNumber || "",
        trackingProvider: ship.trackingProvider || null,
        trackingStatus: ship.trackingStatus || null,
        trackingUrl: ship.trackingUrl || null,
        lastTrackingSyncAt: ship.lastTrackingSyncAt || null,
        status: ship.status,
        daysInStatus,
        riskLevel,
        riskReasons: mergedReasons,
        cost: ship.cost ?? 0,
        marginPercent,
        weight: ship.weight ?? null,
        volume: ship.volume ?? null,
        lastUpdateAt,
        lastLocation: lastEvent?.location || ship.origin || "",
        estimatedArrival: ship.estimatedArrival,
        estimatedDeparture: ship.estimatedDeparture,
        trackingEvents: ship.trackingEvents,
        customsClearance: ship.customsClearance,
        aiInsight: aiInsight || undefined,
        costLines: ship.costLines?.map((line) => ({
          id: line.id,
          type: line.type,
          amount: Number(line.amount),
          currency: line.currency,
          notes: line.notes,
        })) || [],
        incidents: ship.incidents?.map((inc) => ({
          id: inc.id,
          type: inc.type,
          severity: inc.severity,
          status: inc.status,
          description: inc.description,
          resolution: inc.resolution,
          amount: inc.amount != null ? Number(inc.amount) : null,
          currency: inc.currency,
          createdAt: inc.createdAt,
          resolvedAt: inc.resolvedAt,
        })) || [],
        disputes: ship.order?.disputes?.map((d) => ({
          id: d.id,
          type: d.type,
          status: d.status,
          description: d.description,
          resolution: d.resolution,
          amount: d.amount != null ? Number(d.amount) : null,
          currency: d.currency,
          createdAt: d.createdAt,
          resolvedAt: d.resolvedAt,
        })) || [],
        consolidationBatchId: ship.consolidationBatchId ?? null,
        slaDueAt: sla.dueAt,
        daysLate: sla.daysLate,
        slaStatus: sla.level,
        apiConnected: Boolean(ship.freightPartner?.notes?.toLowerCase().includes("api")),
      };
    });

    const shipmentsInProgress = shipments.filter((s) => s.status !== "DELIVERED");
    const trackingCoverage =
      shipments.length > 0
        ? (shipments.filter((s) => s.trackingProvider && s.trackingNumber).length / shipments.length) * 100
        : 0;
    const lateShipments = shipmentsInProgress.filter((s) => (s.daysLate || 0) > 0).length;

    const onTimeTotal = deliveredSamples.length;
    const onTimeCount = deliveredSamples.filter((d) => {
      const actual = d.actualArrival ? new Date(d.actualArrival).getTime() : 0;
      const estimated = d.estimatedArrival ? new Date(d.estimatedArrival).getTime() : 0;
      return actual && estimated && actual <= estimated;
    }).length;
    const onTimeRate = onTimeTotal > 0 ? (onTimeCount / onTimeTotal) * 100 : 0;

    const transitSamplesCount = transitSamples.length;
    const totalTransitDays = transitSamples.reduce((sum, s) => {
      const start = s.actualDeparture ? new Date(s.actualDeparture).getTime() : 0;
      const end = s.actualArrival ? new Date(s.actualArrival).getTime() : 0;
      if (!start || !end) return sum;
      return sum + Math.max(0, (end - start) / MS_PER_DAY);
    }, 0);
    const avgTransitDays =
      transitSamplesCount > 0 ? totalTransitDays / transitSamplesCount : 0;

    const sumCost = Number(costAgg._sum.cost || 0);
    const sumWeight = Number(costAgg._sum.weight || 0);
    const costPerKg = sumWeight > 0 ? sumCost / sumWeight : 0;

    const topOrigins: DashboardPortStat[] = originCountsRaw
      .filter((o) => o.origin)
      .map((o) => ({ port: o.origin, count: o._count._all }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const topDestinations: DashboardPortStat[] = destinationCountsRaw
      .filter((d) => d.destination)
      .map((d) => ({ port: d.destination, count: d._count._all }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const freightPartners = freightPartnersRaw.map((fp) => {
      const partnerShipments = fp.shipments || [];
      const delivered = partnerShipments.filter(
        (s) => s.actualArrival && s.estimatedArrival
      );
      const onTime = delivered.filter((s) => {
        if (!s.actualArrival || !s.estimatedArrival) return false;
        return new Date(s.actualArrival).getTime() <= new Date(s.estimatedArrival).getTime();
      }).length;
      const lastShipmentAt = partnerShipments.reduce<Date | null>((acc, s) => {
        const date = s.actualArrival ?? s.createdAt;
        if (!date) return acc;
        if (!acc || date > acc) return date;
        return acc;
      }, null);
      const totalCost = partnerShipments.reduce((sum, s) => sum + Number(s.cost || 0), 0);
      const totalWeight = partnerShipments.reduce((sum, s) => sum + Number(s.weight || 0), 0);
      const totalVolume = partnerShipments.reduce((sum, s) => sum + Number(s.volume || 0), 0);
      const avgDeliveryDays = delivered.length > 0
        ? delivered.reduce((sum, s) => {
          const start = s.actualDeparture ? new Date(s.actualDeparture).getTime() : 0;
          const end = s.actualArrival ? new Date(s.actualArrival).getTime() : 0;
          if (!start || !end) return sum;
          return sum + Math.max(0, (end - start) / MS_PER_DAY);
        }, 0) / delivered.length
        : 0;
      const latePercent = delivered.length > 0 ? ((delivered.length - onTime) / delivered.length) * 100 : 0;
      const modes = Array.from(new Set(partnerShipments.map((s) => s.mode)));
      const activeShipments = partnerShipments.filter((s) => s.status !== "DELIVERED").length;

      return {
        id: fp.id,
        name: fp.name,
        type: fp.type,
        country: fp.country,
        city: fp.city || "",
        rating: fp.rating,
        contactName: fp.contactName || "",
        phone: fp.phone || "",
        whatsapp: fp.whatsapp || "",
        email: fp.email || "",
        wechat: fp.wechat || "",
        website: fp.website || "",
        address: fp.address || "",
        contactsJson: fp.contactsJson || {},
        serviceProfileJson: fp.serviceProfileJson || {},
        notes: fp.notes || "",
        modes,
        apiConnected: Boolean(
          fp.notes?.toLowerCase().includes("api") ||
          (fp.serviceProfileJson &&
            typeof fp.serviceProfileJson === "object" &&
            (fp.serviceProfileJson as Record<string, unknown>).apiEnabled === true)
        ),
        avgDeliveryDays,
        lateShipmentPercent: latePercent,
        costPerKg: totalWeight > 0 ? totalCost / totalWeight : 0,
        costPerCbm: totalVolume > 0 ? totalCost / totalVolume : 0,
        reliabilityScore: fp.rating,
        activeShipments,
        shipmentsCount: partnerShipments.length,
        onTimeRate: delivered.length > 0 ? (onTime / delivered.length) * 100 : 0,
        lastShipmentAt,
      };
    });

    const consolidationBatches = consolidationBatchesRaw.map((batch) => ({
      id: batch.id,
      batchNumber: batch.batchNumber,
      status: batch.status,
      notes: batch.notes,
      updatedAt: batch.updatedAt,
      shipmentsCount: batch.shipments.length,
      modes: Array.from(new Set(batch.shipments.map((s) => s.mode))),
      destinations: Array.from(
        new Set(batch.shipments.map((s) => s.destination).filter((destination): destination is string => Boolean(destination)))
      ),
    }));

    const consolidationSuggestions = shipments
      .filter((s) => s.mode === "SEA" && !s.consolidationBatchId && s.status !== "DELIVERED")
      .reduce<Record<string, any>>((acc, ship) => {
        const key = `${ship.destination || "UNKNOWN"}-${ship.mode}`;
        if (!acc[key]) {
          acc[key] = {
            destination: ship.destination || "UNKNOWN",
            mode: ship.mode,
            shipments: [],
            totalWeight: 0,
            totalVolume: 0,
          };
        }
        acc[key].shipments.push(ship);
        acc[key].totalWeight += Number(ship.weight || 0);
        acc[key].totalVolume += Number(ship.volume || 0);
        return acc;
      }, {});

    const customsIssues = await Promise.all(customsQueueRaw.map(async (issue) => {
      const baseDate = issue.submittedAt || issue.shipment?.updatedAt || issue.createdAt;
      const daysBlocked = baseDate ? diffDays(new Date(baseDate), now) : 0;
      let priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "MEDIUM";
      if (daysBlocked >= 10) priority = "CRITICAL";
      else if (daysBlocked >= 6) priority = "HIGH";
      else if (daysBlocked >= 3) priority = "MEDIUM";
      else priority = "LOW";
      const docs = Array.isArray(issue.documents) ? issue.documents : [];
      const enrichedDocs = await Promise.all(
        docs.map(async (doc: any) => {
          if (doc?.storage?.path) {
            try {
              const downloadUrl = await StorageService.createSignedUrl({
                bucket: doc.storage.bucket,
                path: doc.storage.path,
                expiresIn: 3600,
              });
              return { ...doc, downloadUrl };
            } catch {
              return doc;
            }
          }
          return doc;
        })
      );
      return {
        id: issue.id,
        shipmentId: issue.shipmentId,
        orderId: issue.shipment?.order?.orderNumber || "",
        customerName: issue.shipment?.order?.contact?.name || "",
        country: issue.shipment?.destination || "",
        reason: issue.status,
        amountNeeded: issue.dutyAmount ? Number(issue.dutyAmount) : 0,
        whoMustAct: issue.brokerName ? `Broker ${issue.brokerName}` : "Docs team",
        daysBlocked,
        priority,
        documents: enrichedDocs,
        documentsCount: enrichedDocs.length,
      };
    }));

    const aiAlerts = shipmentsInProgress.flatMap((ship) => {
      const alerts: any[] = [];
      const isLate =
        ship.estimatedArrival &&
        ship.status !== "DELIVERED" &&
        new Date(ship.estimatedArrival).getTime() < now.getTime();
      if (isLate) {
        alerts.push({
          id: `delay-${ship.id}`,
          type: "delay",
          title: "Retard detecte",
          description: `${ship.orderNumber} - ETA depasse`,
          orderId: ship.orderNumber,
          severity: "HIGH",
          action: "Contacter transitaire",
          timestamp: "now",
        });
      }
      if ((ship.aiInsight?.predictedDelayDays ?? 0) >= 5) {
        alerts.push({
          id: `predict-delay-${ship.id}`,
          type: "predictive_delay",
          title: "Retard probable",
          description: `${ship.orderNumber} risque ${ship.aiInsight?.predictedDelayDays}j`,
          orderId: ship.orderNumber,
          severity: "MEDIUM",
          action: "Verifier tracking",
          timestamp: "now",
        });
      }
      if ((ship.aiInsight?.riskScore ?? 0) >= 70) {
        alerts.push({
          id: `risk-${ship.id}`,
          type: "risk",
          title: "Risque eleve",
          description: `${ship.orderNumber} score ${ship.aiInsight?.riskScore}/100`,
          orderId: ship.orderNumber,
          severity: "HIGH",
          action: "Plan d'escalade",
          timestamp: "now",
        });
      }
      if (ship.daysInStatus >= 7 && ship.status === "CUSTOMS") {
        alerts.push({
          id: `customs-${ship.id}`,
          type: "at_risk",
          title: "Blocage douane",
          description: `${ship.orderNumber} en douane depuis ${ship.daysInStatus} jours`,
          orderId: ship.orderNumber,
          severity: "HIGH",
          action: "Escalader dossier",
          timestamp: "now",
        });
      }
      // AI delay/risk alerts reserved for future AI module integration
      if (ship.daysInStatus >= 4 && ship.lastUpdateAt) {
        alerts.push({
          id: `no-update-${ship.id}`,
          type: "no_response",
          title: "Aucune mise a jour",
          description: `${ship.orderNumber} sans update recente`,
          orderId: ship.orderNumber,
          severity: "MEDIUM",
          action: "Relancer partenaire",
          timestamp: "now",
        });
      }
      return alerts;
    }).slice(0, 12);

    const monthlyCounts: { month: string; count: number }[] = [];
    const monthMap = new Map<string, number>();
    shipmentsRaw.forEach((s) => {
      const d = s.createdAt;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthMap.set(key, (monthMap.get(key) || 0) + 1);
    });
    Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .forEach(([month, count]) => {
        monthlyCounts.push({ month, count });
      });

    const transitByMode = transitSamples.reduce<Record<string, { total: number; count: number }>>(
      (acc, s) => {
        const start = s.actualDeparture ? new Date(s.actualDeparture).getTime() : 0;
        const end = s.actualArrival ? new Date(s.actualArrival).getTime() : 0;
        if (!start || !end) return acc;
        const days = Math.max(0, (end - start) / MS_PER_DAY);
        const key = s.mode;
        acc[key] = acc[key] || { total: 0, count: 0 };
        acc[key].total += days;
        acc[key].count += 1;
        return acc;
      },
      {}
    );

    const transitByModeChart = Object.entries(transitByMode).map(([mode, stats]) => ({
      mode,
      avgDays: stats.count > 0 ? stats.total / stats.count : 0,
    }));

    return {
      data: {
        shipments: serializeDecimals(shipments),
        shipmentsInProgress: serializeDecimals(shipmentsInProgress),
        statusCounts,
        modeCounts,
        ports: {
          origins: topOrigins,
          destinations: topDestinations,
        },
        customsIssues: serializeDecimals(customsIssues),
        freightPartners: serializeDecimals(freightPartners),
        consolidationBatches: serializeDecimals(consolidationBatches),
        consolidationSuggestions: serializeDecimals(Object.values(consolidationSuggestions)),
        aiAlerts,
        analytics: {
          statusChart: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
          modeChart: Object.entries(modeCounts).map(([mode, count]) => ({ mode, count })),
          monthlyCounts,
          transitByModeChart,
        },
        kpis: {
          onTimeRate,
          avgTransitDays,
          costPerKg,
          inProgressCount: shipmentsInProgress.length,
          trackingCoverage,
          customsBacklog: customsIssues.length,
          lateShipments,
        },
      },
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors du chargement" };
  }
}

export async function createFreightPartner(formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.manage");
    const validated = createFreightPartnerSchema.parse(formData);

    const partner = await prisma.freightPartner.create({
      data: {
        name: validated.name,
        country: validated.country,
        type: validated.type,
        city: validated.city || undefined,
        contactName: validated.contactName || undefined,
        phone: validated.phone || undefined,
        whatsapp: validated.whatsapp || undefined,
        email: validated.email || undefined,
        wechat: validated.wechat || undefined,
        website: validated.website || undefined,
        address: validated.address || undefined,
        contactsJson: validated.contactsJson ? JSON.parse(JSON.stringify(validated.contactsJson)) : undefined,
        serviceProfileJson: validated.serviceProfileJson
          ? JSON.parse(JSON.stringify(validated.serviceProfileJson))
          : undefined,
        rating: validated.rating ?? 50,
        notes: validated.notes || undefined,
      },
    });

    return { data: partner };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur creation partenaire" };
  }
}

export async function deleteFreightPartner(partnerId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.manage");

    const count = await prisma.shipment.count({
      where: { freightPartnerId: partnerId, order: { tenantId: user.tenantId } },
    });
    if (count > 0) return { error: "Partenaire lie a des expeditions" };

    await prisma.freightPartner.delete({ where: { id: partnerId } });
    return { data: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur suppression partenaire" };
  }
}

export async function updateFreightPartner(partnerId: string, formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.manage");
    const validated = createFreightPartnerSchema.parse(formData);

    const partner = await prisma.freightPartner.update({
      where: { id: partnerId },
      data: {
        name: validated.name,
        country: validated.country,
        type: validated.type,
        city: validated.city || undefined,
        contactName: validated.contactName || undefined,
        phone: validated.phone || undefined,
        whatsapp: validated.whatsapp || undefined,
        email: validated.email || undefined,
        wechat: validated.wechat || undefined,
        website: validated.website || undefined,
        address: validated.address || undefined,
        contactsJson: validated.contactsJson ? JSON.parse(JSON.stringify(validated.contactsJson)) : undefined,
        serviceProfileJson: validated.serviceProfileJson
          ? JSON.parse(JSON.stringify(validated.serviceProfileJson))
          : undefined,
        rating: validated.rating ?? 50,
        notes: validated.notes || undefined,
      },
    });

    return { data: partner };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur mise a jour partenaire" };
  }
}

export async function createConsolidationBatch(formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.manage");
    const validated = createBatchSchema.parse(formData);

    const batch = await prisma.consolidationBatch.create({
      data: {
        batchNumber: buildBatchNumber(),
        status: "open",
        notes: validated.notes || undefined,
      },
    });

    return { data: batch };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur creation lot" };
  }
}

export async function assignShipmentsToBatch(formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.manage");
    const validated = assignBatchSchema.parse(formData);

    const updated = await prisma.shipment.updateMany({
      where: {
        id: { in: validated.shipmentIds },
        order: { tenantId: user.tenantId },
      },
      data: { consolidationBatchId: validated.batchId },
    });

    return { data: updated.count };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur assignation lot" };
  }
}

const customsDocumentSchema = z.object({
  shipmentId: z.string().min(1),
  name: z.string().min(2),
  url: z.string().url(),
  note: z.string().optional(),
});

const resolveCustomsSchema = z.object({
  shipmentId: z.string().min(1),
  resolutionNote: z.string().optional(),
  document: z
    .object({
      name: z.string().min(2),
      url: z.string().url(),
      note: z.string().optional(),
    })
    .optional(),
});

const customsDocumentStatusSchema = z.object({
  shipmentId: z.string().min(1),
  docId: z.string().min(1),
  status: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().optional(),
});

const costLineSchema = z.object({
  shipmentId: z.string().min(1),
  type: z.string().min(2),
  amount: z.coerce.number().min(0),
  currency: z.string().min(1).default("USD"),
  notes: z.string().optional(),
});

const incidentSchema = z.object({
  shipmentId: z.string().min(1),
  type: z.string().min(2),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  description: z.string().min(3),
  amount: z.coerce.number().optional(),
  currency: z.string().min(1).default("USD"),
});

const incidentUpdateSchema = z.object({
  status: z.enum(["OPEN", "INVESTIGATING", "RESOLVED", "ESCALATED", "CLOSED"]).optional(),
  resolution: z.string().optional(),
});

export async function addCustomsDocument(formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.manage");
    const validated = customsDocumentSchema.parse(formData);

    const shipment = await prisma.shipment.findUnique({
      where: { id: validated.shipmentId },
      include: { order: { select: { id: true, tenantId: true, orderNumber: true } } },
    });
    if (!shipment || shipment.order.tenantId !== user.tenantId) {
      return { error: "Expedition introuvable" };
    }

    const existing = await prisma.customsClearance.findUnique({
      where: { shipmentId: validated.shipmentId },
      select: { documents: true },
    });
    const docs = Array.isArray(existing?.documents) ? existing?.documents : [];
    const newDoc = {
      id: crypto.randomUUID(),
      name: validated.name,
      url: validated.url,
      note: validated.note || "",
      addedAt: new Date().toISOString(),
      status: "PENDING",
      addedById: user.id,
    };

    await prisma.customsClearance.upsert({
      where: { shipmentId: validated.shipmentId },
      update: { documents: [...docs, newDoc] },
      create: {
        shipmentId: validated.shipmentId,
        status: "PENDING",
        documents: [newDoc],
      },
    });

    const teamIds = await getOrderTeamUserIds(shipment.order.id);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "SHIPMENT_UPDATED",
      title: "Document douane ajoute",
      message: `Nouveau document douane pour commande ${shipment.order.orderNumber}`,
      entityType: "shipment",
      entityId: shipment.id,
    });

    await refreshShipmentAI(shipment.id);

    return { data: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur ajout document" };
  }
}

export async function updateCustomsDocumentStatus(formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.manage");
    const validated = customsDocumentStatusSchema.parse(formData);

    const shipment = await prisma.shipment.findUnique({
      where: { id: validated.shipmentId },
      include: { order: { select: { id: true, tenantId: true, orderNumber: true } } },
    });
    if (!shipment || shipment.order.tenantId !== user.tenantId) {
      return { error: "Expedition introuvable" };
    }

    const existing = await prisma.customsClearance.findUnique({
      where: { shipmentId: validated.shipmentId },
      select: { documents: true },
    });
    const docs = Array.isArray(existing?.documents) ? existing?.documents : [];
    const updatedDocs = docs.map((doc: any) =>
      doc?.id === validated.docId
        ? {
            ...doc,
            status: validated.status,
            validationNote: validated.note || doc.validationNote || "",
            validatedAt: new Date().toISOString(),
            validatedById: user.id,
          }
        : doc
    );

    await prisma.customsClearance.upsert({
      where: { shipmentId: validated.shipmentId },
      update: { documents: updatedDocs },
      create: {
        shipmentId: validated.shipmentId,
        status: "PENDING",
        documents: updatedDocs,
      },
    });

    const teamIds = await getOrderTeamUserIds(shipment.order.id);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "SHIPMENT_UPDATED",
      title: "Document douane valide",
      message: `Document douane ${validated.status.toLowerCase()} pour commande ${shipment.order.orderNumber}`,
      entityType: "shipment",
      entityId: shipment.id,
    });

    await refreshShipmentAI(shipment.id);

    return { data: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur validation document" };
  }
}

export async function resolveCustomsIssue(formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.manage");
    const validated = resolveCustomsSchema.parse(formData);

    const shipment = await prisma.shipment.findUnique({
      where: { id: validated.shipmentId },
      include: { order: { select: { id: true, tenantId: true, orderNumber: true } } },
    });
    if (!shipment || shipment.order.tenantId !== user.tenantId) {
      return { error: "Expedition introuvable" };
    }

    const existing = await prisma.customsClearance.findUnique({
      where: { shipmentId: validated.shipmentId },
      select: { documents: true },
    });
    const docs = Array.isArray(existing?.documents) ? existing?.documents : [];
    const resolutionDoc = validated.document
      ? {
          id: crypto.randomUUID(),
          name: validated.document.name,
          url: validated.document.url,
          note: validated.document.note || validated.resolutionNote || "",
          addedAt: new Date().toISOString(),
          type: "resolution",
          status: "APPROVED",
          validatedAt: new Date().toISOString(),
          validatedById: user.id,
        }
      : validated.resolutionNote
        ? {
            id: crypto.randomUUID(),
            name: "Resolution",
            url: "",
            note: validated.resolutionNote,
            addedAt: new Date().toISOString(),
            type: "resolution",
            status: "APPROVED",
            validatedAt: new Date().toISOString(),
            validatedById: user.id,
          }
        : null;

    await prisma.customsClearance.upsert({
      where: { shipmentId: validated.shipmentId },
      update: {
        status: "CLEARED",
        clearedAt: new Date(),
        documents: resolutionDoc ? [...docs, resolutionDoc] : docs,
      },
      create: {
        shipmentId: validated.shipmentId,
        status: "CLEARED",
        clearedAt: new Date(),
        documents: resolutionDoc ? [...docs, resolutionDoc] : docs,
      },
    });

    const teamIds = await getOrderTeamUserIds(shipment.order.id);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "SHIPMENT_UPDATED",
      title: "Dedouanement resolu",
      message: `Commande ${shipment.order.orderNumber} dedouanee`,
      entityType: "shipment",
      entityId: shipment.id,
    });

    await refreshShipmentAI(shipment.id);

    return { data: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur resolution douane" };
  }
}

export async function exportLogisticsCSV() {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.view");

    const shipments = await prisma.shipment.findMany({
      where: { order: { tenantId: user.tenantId } },
      include: {
        order: { select: { orderNumber: true, contact: { select: { name: true } } } },
        freightPartner: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    const headers = [
      "Order",
      "Client",
      "Mode",
      "Status",
      "Origin",
      "Destination",
      "ETD",
      "ETA",
      "Cost",
      "Currency",
      "Partner",
    ];

    const rows = shipments.map((s) => [
      s.order?.orderNumber || "",
      s.order?.contact?.name || "",
      s.mode,
      s.status,
      s.origin || "",
      s.destination || "",
      s.estimatedDeparture ? new Date(s.estimatedDeparture).toISOString().slice(0, 10) : "",
      s.estimatedArrival ? new Date(s.estimatedArrival).toISOString().slice(0, 10) : "",
      s.cost != null ? String(Number(s.cost)) : "",
      s.currency || "",
      s.freightPartner?.name || "",
    ]);

    const escapeCsvField = (field: string) => {
      if (field.includes(",") || field.includes('"') || field.includes("\n")) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    const csv = [
      headers.map(escapeCsvField).join(","),
      ...rows.map((row) => row.map((cell) => escapeCsvField(cell)).join(",")),
    ].join("\n");

    return { data: csv };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur export CSV" };
  }
}

export async function getNegotiatedTransportRateProfiles() {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.view");

    const partners = await prisma.freightPartner.findMany({
      select: {
        id: true,
        name: true,
        serviceProfileJson: true,
      },
      orderBy: [{ rating: "desc" }, { name: "asc" }],
    });

    const airStandard = extractBestPartnerRateProfile(partners, {
      key: "AIR_STANDARD",
      mode: "AIR",
      field: "kgBuyRateXAF",
      pricingUnit: "KG",
    });
    const airExpress = extractBestPartnerRateProfile(partners, {
      key: "AIR_EXPRESS",
      mode: "AIR",
      field: "kgBuyRateXAF",
      pricingUnit: "KG",
    });
    const seaDdp = extractBestPartnerRateProfile(partners, {
      key: "SEA_DDP",
      mode: "SEA",
      field: "cbmBuyRateXAF",
      pricingUnit: "CBM",
      prefersDap: true,
    });

    return {
      data: serializeDecimals({
        AIR_STANDARD: airStandard,
        AIR_EXPRESS: airExpress,
        SEA_DDP: seaDdp,
      }) as Partial<Record<string, NegotiatedTransportRateProfile>>,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur chargement tarifs transitaires" };
  }
}

export async function exportLogisticsPDF() {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.view");

    const shipments = await prisma.shipment.findMany({
      where: { order: { tenantId: user.tenantId } },
      include: {
        order: { select: { orderNumber: true, contact: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: PDF_MAX_LINES - 5,
    });

    const lines = [
      "Horion Logistics Export",
      `Date: ${new Date().toLocaleDateString("fr-FR")}`,
      "",
      ...shipments.map((s) => {
        const orderNumber = s.order?.orderNumber || "-";
        const client = s.order?.contact?.name || "-";
        return `${orderNumber} | ${client} | ${s.mode} | ${s.status} | ${s.origin || "-"} -> ${s.destination || "-"}`;
      }),
    ];

    const pdf = buildSimplePdf(lines);
    return {
      data: pdf.toString("base64"),
      filename: `logistics-${new Date().toISOString().slice(0, 10)}.pdf`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur export PDF" };
  }
}

export async function runLogisticsSlaCheck() {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.manage");

    const shipments = await prisma.shipment.findMany({
      where: {
        order: { tenantId: user.tenantId },
        status: { not: "DELIVERED" },
      },
    });

    for (const shipment of shipments) {
      const teamIds = await getOrderTeamUserIds(shipment.orderId);
      await notifyShipmentSlaIfNeeded({
        shipment,
        tenantId: user.tenantId,
        teamIds,
      });
    }

    return { data: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur SLA check" };
  }
}

export async function recalcShipmentAI(shipmentId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.manage");

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { order: { select: { tenantId: true } } },
    });
    if (!shipment || shipment.order.tenantId !== user.tenantId) {
      return { error: "Expedition introuvable" };
    }

    const ai = await refreshShipmentAI(shipmentId);
    if (!ai) return { error: "Expedition introuvable" };
    return { data: ai };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur AI" };
  }
}

export async function createShipmentCostLine(formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.manage");
    const validated = costLineSchema.parse(formData);

    const shipment = await prisma.shipment.findUnique({
      where: { id: validated.shipmentId },
      include: { order: { select: { tenantId: true } } },
    });
    if (!shipment || shipment.order.tenantId !== user.tenantId) {
      return { error: "Expedition introuvable" };
    }

    const line = await prisma.shipmentCostLine.create({
      data: {
        shipmentId: validated.shipmentId,
        type: validated.type,
        amount: validated.amount,
        currency: validated.currency,
        notes: validated.notes,
      },
    });
    return { data: line };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur cout" };
  }
}

export async function removeShipmentCostLine(costLineId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.manage");

    const line = await prisma.shipmentCostLine.findUnique({
      where: { id: costLineId },
      include: { shipment: { include: { order: { select: { tenantId: true } } } } },
    });
    if (!line || line.shipment.order.tenantId !== user.tenantId) {
      return { error: "Ligne introuvable" };
    }
    await prisma.shipmentCostLine.delete({ where: { id: costLineId } });
    return { data: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur suppression" };
  }
}

export async function createShipmentIncident(formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.manage");
    const validated = incidentSchema.parse(formData);

    const shipment = await prisma.shipment.findUnique({
      where: { id: validated.shipmentId },
      include: { order: { select: { id: true, tenantId: true, orderNumber: true } } },
    });
    if (!shipment || shipment.order.tenantId !== user.tenantId) {
      return { error: "Expedition introuvable" };
    }

    const incident = await prisma.shipmentIncident.create({
      data: {
        shipmentId: validated.shipmentId,
        type: validated.type,
        severity: validated.severity as any,
        description: validated.description,
        amount: validated.amount ?? undefined,
        currency: validated.currency,
      },
    });

    const teamIds = await getOrderTeamUserIds(shipment.order.id);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "DISPUTE_CREATED",
      title: "Incident logistique",
      message: `Incident sur commande ${shipment.order.orderNumber}`,
      entityType: "shipment",
      entityId: shipment.id,
    });

    await refreshShipmentAI(shipment.id);

    return { data: incident };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur incident" };
  }
}

export async function updateShipmentIncident(incidentId: string, formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.manage");
    const validated = incidentUpdateSchema.parse(formData);

    const incident = await prisma.shipmentIncident.findUnique({
      where: { id: incidentId },
      include: { shipment: { include: { order: { select: { id: true, tenantId: true, orderNumber: true } } } } },
    });
    if (!incident || incident.shipment.order.tenantId !== user.tenantId) {
      return { error: "Incident introuvable" };
    }

    const updated = await prisma.shipmentIncident.update({
      where: { id: incidentId },
      data: {
        ...(validated.status && { status: validated.status as any }),
        ...(validated.resolution !== undefined && { resolution: validated.resolution }),
        ...(validated.status === "RESOLVED" && { resolvedAt: new Date() }),
      },
    });

    const teamIds = await getOrderTeamUserIds(incident.shipment.order.id);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "DISPUTE_RESOLVED",
      title: "Incident mis a jour",
      message: `Incident sur commande ${incident.shipment.order.orderNumber}`,
      entityType: "shipment",
      entityId: incident.shipment.id,
    });

    await refreshShipmentAI(incident.shipment.id);

    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur mise a jour incident" };
  }
}

export async function createShipmentPortalToken(shipmentId: string, role: "CLIENT" | "CARRIER") {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.manage");

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { order: { select: { tenantId: true } } },
    });
    if (!shipment || shipment.order.tenantId !== user.tenantId) {
      return { error: "Expedition introuvable" };
    }

    const token = crypto.randomUUID();
    const portal = await prisma.shipmentPortalToken.create({
      data: {
        shipmentId,
        token,
        role,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const url = `${baseUrl}/portal/${role === "CLIENT" ? "shipment" : "carrier"}/${token}`;
    return { data: { token: portal.token, url } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur portal token" };
  }
}

// ── Warehouse Receipt ─────────────────────────────────────────────────────────

const warehouseReceiptSchema = z.object({
  shipmentId: z.string().min(1, "ID expédition requis"),
  actualWeightKg: z.coerce.number().positive("Poids réel requis"),
  actualLengthCm: z.coerce.number().positive().optional(),
  actualWidthCm: z.coerce.number().positive().optional(),
  actualHeightCm: z.coerce.number().positive().optional(),
  condition: z.enum(["OK", "DAMAGED", "WRONG_ITEM", "PARTIAL"]).default("OK"),
  conditionNotes: z.string().optional(),
  photoUrls: z.array(z.string()).default([]),
  warehouseLocation: z.string().optional(),
  consolidationNote: z.string().optional(),
  readyToShip: z.boolean().default(false),
});

export async function createWarehouseReceipt(raw: unknown) {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.manage");

    const data = warehouseReceiptSchema.parse(raw);

    const shipment = await prisma.shipment.findUnique({
      where: { id: data.shipmentId },
      include: { order: { select: { id: true, tenantId: true } } },
    });

    if (!shipment || shipment.order.tenantId !== user.tenantId) {
      return { error: "Expédition introuvable" };
    }

    // Calculate volumetric and chargeable weights
    let volumetricWeightKg = 0;
    if (data.actualLengthCm && data.actualWidthCm && data.actualHeightCm) {
      volumetricWeightKg = (data.actualLengthCm * data.actualWidthCm * data.actualHeightCm) / 6000;
    }
    const chargeableWeightKg = Math.ceil(Math.max(data.actualWeightKg, volumetricWeightKg) * 10) / 10;

    // Upsert (one receipt per shipment)
    const receipt = await prisma.warehouseReceipt.upsert({
      where: { shipmentId: data.shipmentId },
      create: {
        shipmentId: data.shipmentId,
        orderId: shipment.order.id,
        receivedById: user.id,
        actualWeightKg: data.actualWeightKg,
        actualLengthCm: data.actualLengthCm ?? null,
        actualWidthCm: data.actualWidthCm ?? null,
        actualHeightCm: data.actualHeightCm ?? null,
        volumetricWeightKg,
        chargeableWeightKg,
        condition: data.condition,
        conditionNotes: data.conditionNotes ?? null,
        photoUrls: data.photoUrls,
        warehouseLocation: data.warehouseLocation ?? null,
        consolidationNote: data.consolidationNote ?? null,
        readyToShip: data.readyToShip,
      },
      update: {
        receivedById: user.id,
        actualWeightKg: data.actualWeightKg,
        actualLengthCm: data.actualLengthCm ?? null,
        actualWidthCm: data.actualWidthCm ?? null,
        actualHeightCm: data.actualHeightCm ?? null,
        volumetricWeightKg,
        chargeableWeightKg,
        condition: data.condition,
        conditionNotes: data.conditionNotes ?? null,
        photoUrls: data.photoUrls,
        warehouseLocation: data.warehouseLocation ?? null,
        consolidationNote: data.consolidationNote ?? null,
        readyToShip: data.readyToShip,
        receivedAt: new Date(),
      },
    });

    // Update shipment weight fields (internal — never sent to client)
    await prisma.shipment.update({
      where: { id: data.shipmentId },
      data: {
        weight: data.actualWeightKg,
        lengthCm: data.actualLengthCm ?? undefined,
        widthCm: data.actualWidthCm ?? undefined,
        heightCm: data.actualHeightCm ?? undefined,
        volumetricWeightKg,
        chargeableWeightKg,
        weightValidatedAt: new Date(),
        ...(data.readyToShip ? { status: "IN_TRANSIT" } : {}),
      },
    });

    const productIds = Array.from(
      new Set(
        (
          await prisma.orderItem.findMany({
            where: { orderId: shipment.order.id, productId: { not: null } },
            select: { productId: true },
          })
        )
          .map((item) => item.productId)
          .filter((value): value is string => Boolean(value))
      )
    );

    if (productIds.length === 1) {
      await CatalogMemoryService.refreshProductLogisticsProfileFromWarehouse(
        user.tenantId,
        productIds[0]
      ).catch((error) => {
        console.error(
          `[createWarehouseReceipt] Failed to refresh logistics memory for product ${productIds[0]}:`,
          error
        );
      });
    }

    // If damaged or wrong item — notify logistics manager
    if (["DAMAGED", "WRONG_ITEM", "PARTIAL"].includes(data.condition)) {
      const managers = await prisma.user.findMany({
        where: {
          tenantId: user.tenantId,
          isActive: true,
          role: { in: ["LOGISTICS_MANAGER", "OPS", "CEO"] as any[] },
        },
        select: { id: true },
      });
      if (managers.length > 0) {
        await NotificationService.notifyMany(
          managers.map((u) => u.id),
          {
            tenantId: user.tenantId,
            type: "SLA_BREACH",
            title: `Anomalie réception entrepôt — colis ${data.condition}`,
            message: `Expédition ${data.shipmentId}: condition ${data.condition}. ${data.conditionNotes ?? ""}`,
            entityType: "order",
            entityId: shipment.order.id,
          }
        );
      }
    }

    return { data: serializeDecimals(receipt) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: error.issues[0]?.message ?? "Données invalides" };
    }
    return { error: error instanceof Error ? error.message : "Erreur réception entrepôt" };
  }
}

export async function getWarehouseReceiptByShipment(shipmentId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.view");

    const receipt = await prisma.warehouseReceipt.findUnique({
      where: { shipmentId },
      include: {
        receivedBy: { select: { id: true, name: true } },
        shipment: {
          select: {
            id: true,
            trackingNumber: true,
            order: { select: { id: true, orderNumber: true, tenantId: true } },
          },
        },
      },
    });

    if (!receipt || receipt.shipment.order.tenantId !== user.tenantId) {
      return { data: null };
    }

    return { data: serializeDecimals(receipt) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur récupération réception" };
  }
}

export async function getWarehouseReceiptsByOrder(orderId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.view");

    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!order) return { data: [] };

    const receipts = await prisma.warehouseReceipt.findMany({
      where: { orderId },
      include: { receivedBy: { select: { id: true, name: true } } },
      orderBy: { receivedAt: "desc" },
    });

    return { data: receipts.map(serializeDecimals) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur réceptions" };
  }
}
