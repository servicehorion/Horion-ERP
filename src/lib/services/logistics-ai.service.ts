import { prisma } from "@/lib/db";
import { computeShipmentSla } from "@/lib/services/logistics-sla.service";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function diffDays(from: Date, to: Date) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY));
}

function avgDays(samples: Array<{ actualDeparture: Date | null; actualArrival: Date | null }>) {
  const totals = samples.reduce(
    (acc, s) => {
      if (!s.actualDeparture || !s.actualArrival) return acc;
      const days = Math.max(0, (s.actualArrival.getTime() - s.actualDeparture.getTime()) / MS_PER_DAY);
      acc.total += days;
      acc.count += 1;
      return acc;
    },
    { total: 0, count: 0 }
  );
  return totals.count > 0 ? totals.total / totals.count : 0;
}

export async function refreshShipmentAI(shipmentId: string) {
  const now = new Date();
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: {
      order: {
        select: {
          tenantId: true,
          disputes: { where: { resolvedAt: null }, select: { id: true } },
        },
      },
      freightPartner: { select: { rating: true } },
      trackingEvents: { orderBy: { occurredAt: "desc" }, take: 20 },
      customsClearance: true,
      incidents: { where: { status: { not: "RESOLVED" } } },
    },
  });
  if (!shipment) return null;

  const deliveredSamples = await prisma.shipment.findMany({
    where: {
      order: { tenantId: shipment.order.tenantId },
      mode: shipment.mode,
      actualDeparture: { not: null },
      actualArrival: { not: null },
    },
    select: {
      actualDeparture: true,
      actualArrival: true,
      freightPartnerId: true,
    },
    take: 250,
  });

  const partnerSamples = shipment.freightPartnerId
    ? deliveredSamples.filter((s) => s.freightPartnerId === shipment.freightPartnerId)
    : [];
  const modeAvgDays = avgDays(deliveredSamples) || 20;
  const partnerAvgDays = partnerSamples.length >= 3 ? avgDays(partnerSamples) : 0;
  const averageDays = partnerAvgDays || modeAvgDays || 20;

  const baseDate = shipment.actualDeparture || shipment.estimatedDeparture || shipment.createdAt;
  const predictedArrival = new Date(baseDate.getTime() + averageDays * MS_PER_DAY);
  const predictedDelayDays = shipment.estimatedArrival
    ? Math.max(
      0,
      Math.round((predictedArrival.getTime() - new Date(shipment.estimatedArrival).getTime()) / MS_PER_DAY)
    )
    : 0;

  const lastUpdateAt = shipment.trackingEvents[0]?.occurredAt || shipment.updatedAt;
  const daysInStatus = diffDays(lastUpdateAt, now);
  const noUpdateDays = daysInStatus;
  const sla = computeShipmentSla(shipment, now);
  const partnerRating = shipment.freightPartner?.rating ?? null;
  const openIncidents = shipment.incidents.length;
  const openDisputes = shipment.order.disputes.length;
  const customsPending = shipment.customsClearance && shipment.customsClearance.status !== "CLEARED";

  let riskScore = 35;
  if (sla.level === "SLA_WARNING") riskScore += 15;
  if (sla.level === "SLA_BREACH") riskScore += 25;
  if (predictedDelayDays >= 3) riskScore += 10;
  if (predictedDelayDays >= 7) riskScore += 15;
  if (predictedDelayDays >= 14) riskScore += 20;
  if (shipment.status === "CUSTOMS") riskScore += 15;
  if (daysInStatus >= 10) riskScore += 10;
  if (noUpdateDays >= 4) riskScore += 10;
  if (openIncidents >= 1) riskScore += 10;
  if (openIncidents >= 3) riskScore += 10;
  if (openDisputes >= 1) riskScore += 10;
  if (customsPending) riskScore += 10;
  if (partnerRating !== null && partnerRating < 60) riskScore += 10;
  if (partnerRating !== null && partnerRating < 40) riskScore += 10;

  riskScore = Math.min(100, Math.max(0, riskScore));

  const riskLevel =
    riskScore >= 85 ? "CRITICAL" : riskScore >= 70 ? "HIGH" : riskScore >= 50 ? "MEDIUM" : "LOW";

  const factors = [
    sla.level === "SLA_BREACH" ? "SLA depasse" : null,
    sla.level === "SLA_WARNING" ? "SLA en risque" : null,
    predictedDelayDays >= 3 ? "Retard probable" : null,
    shipment.status === "CUSTOMS" ? "Douane en cours" : null,
    noUpdateDays >= 4 ? "Pas de tracking recent" : null,
    openIncidents > 0 ? `${openIncidents} incident(s) ouverts` : null,
    openDisputes > 0 ? `${openDisputes} litige(s) ouverts` : null,
    customsPending ? "Docs douane manquants" : null,
    partnerRating !== null && partnerRating < 60 ? "Partenaire fragile" : null,
  ].filter(Boolean);

  const ai = await prisma.shipmentAIInsight.upsert({
    where: { shipmentId },
    update: {
      predictedArrival,
      predictedDelayDays,
      riskScore,
      riskLevel: riskLevel as any,
      factors,
      calculatedAt: new Date(),
    },
    create: {
      shipmentId,
      predictedArrival,
      predictedDelayDays,
      riskScore,
      riskLevel: riskLevel as any,
      factors,
    },
  });

  return ai;
}
