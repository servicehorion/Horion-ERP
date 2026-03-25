import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireSecretHeader } from "@/lib/api/secret-auth";
import { TransportCalculatorService } from "@/lib/services/transport-calculator.service";
import { toPlainData } from "@/lib/utils";

function deriveShipmentMode(selectedMode?: string | null) {
  if (selectedMode === "SEA") return "SEA";
  return "AIR";
}

export async function POST(req: NextRequest) {
  const auth = requireSecretHeader(req, "HORION_PARTNER_SECRET");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => ({}));
  const {
    orderId,
    orderNumber,
    weightKg,
    lengthCm,
    widthCm,
    heightCm,
    proofImageUrl,
  } = body as {
    orderId?: string;
    orderNumber?: string;
    weightKg?: number;
    lengthCm?: number;
    widthCm?: number;
    heightCm?: number;
    proofImageUrl?: string;
  };

  if ((!orderId && !orderNumber) || !weightKg || !lengthCm || !widthCm || !heightCm) {
    return NextResponse.json(
      { error: "orderId/orderNumber, weightKg, lengthCm, widthCm et heightCm sont requis" },
      { status: 400 }
    );
  }

  const order = await prisma.order.findFirst({
    where: orderId ? { id: orderId } : { orderNumber },
    select: {
      id: true,
      tenantId: true,
      orderNumber: true,
      destinationCity: true,
      quotes: {
        orderBy: [{ createdAt: "desc" }],
        take: 1,
        select: {
          id: true,
          total: true,
          pricingSnapshot: true,
        },
      },
      shipments: {
        orderBy: [{ createdAt: "desc" }],
        take: 1,
        select: {
          id: true,
          mode: true,
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  }

  const quoteSnapshot = (order.quotes[0]?.pricingSnapshot as Record<string, unknown> | null) ?? {};
  const firstItem =
    Array.isArray(quoteSnapshot.items) && quoteSnapshot.items.length > 0
      ? (quoteSnapshot.items[0] as Record<string, unknown>)
      : null;
  const selectedTransport =
    firstItem?.selectedTransport && typeof firstItem.selectedTransport === "object"
      ? (firstItem.selectedTransport as Record<string, unknown>)
      : null;

  const shipmentMode = order.shipments[0]?.mode ?? deriveShipmentMode(String(selectedTransport?.mode ?? "AIR"));
  const cartonCount = Array.isArray(quoteSnapshot.items) ? quoteSnapshot.items.length : 1;
  const transportPreview = TransportCalculatorService.calculate({
    mode: shipmentMode as "AIR" | "SEA",
    serviceLevel:
      String(selectedTransport?.serviceLevel ?? "STANDARD") === "EXPRESS" ? "EXPRESS" : "STANDARD",
    pricingUnit: shipmentMode === "SEA" ? "CBM" : "KG",
    ratePerKg:
      typeof selectedTransport?.ratePerKg === "number" ? Number(selectedTransport.ratePerKg) : undefined,
    ratePerCbm:
      typeof selectedTransport?.ratePerCbm === "number" ? Number(selectedTransport.ratePerCbm) : undefined,
    weightKg: Number(weightKg),
    lengthCm: Number(lengthCm),
    widthCm: Number(widthCm),
    heightCm: Number(heightCm),
    cartonCount: Math.max(1, cartonCount),
  });

  const estimatedWeightFromQuote = Array.isArray(quoteSnapshot.items)
    ? quoteSnapshot.items.reduce((sum, item) => sum + Number((item as Record<string, unknown>).weightKg ?? 0), 0)
    : 0;
  const estimatedChargeableWeight =
    estimatedWeightFromQuote > 0 ? Math.ceil(estimatedWeightFromQuote) : transportPreview.chargeableWeightKg;
  const deviationPct =
    estimatedChargeableWeight > 0
      ? ((transportPreview.chargeableWeightKg - estimatedChargeableWeight) / estimatedChargeableWeight) * 100
      : 0;

  const shipment =
    order.shipments[0]?.id
      ? await prisma.shipment.update({
          where: { id: order.shipments[0].id },
          data: {
            mode: shipmentMode as any,
            weight: Number(weightKg),
            volume: transportPreview.bufferedCbm ?? transportPreview.cbm ?? undefined,
            lengthCm: Number(lengthCm),
            widthCm: Number(widthCm),
            heightCm: Number(heightCm),
            volumetricWeightKg: transportPreview.bufferedVolumetricWeightKg ?? undefined,
            chargeableWeightKg: transportPreview.chargeableWeightKg,
            proofImageUrl: proofImageUrl || undefined,
            weightValidatedAt: new Date(),
          },
        })
      : await prisma.shipment.create({
          data: {
            orderId: order.id,
            mode: shipmentMode as any,
            status: "PENDING",
            origin: "Guangzhou",
            destination: order.destinationCity || "Brazzaville",
            weight: Number(weightKg),
            volume: transportPreview.bufferedCbm ?? transportPreview.cbm ?? undefined,
            lengthCm: Number(lengthCm),
            widthCm: Number(widthCm),
            heightCm: Number(heightCm),
            volumetricWeightKg: transportPreview.bufferedVolumetricWeightKg ?? undefined,
            chargeableWeightKg: transportPreview.chargeableWeightKg,
            proofImageUrl: proofImageUrl || undefined,
            weightValidatedAt: new Date(),
          },
        });

  if (deviationPct > 10) {
    const existingTask = await prisma.task.findFirst({
      where: {
        entityType: "order",
        entityId: order.id,
        taskType: "transport_regularization",
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      select: { id: true },
    });

    if (!existingTask) {
      const logisticsManager = await prisma.user.findFirst({
        where: { tenantId: order.tenantId, role: "LOGISTICS_MANAGER", isActive: true },
        select: { id: true },
      });
      const task = await prisma.task.create({
        data: {
          tenantId: order.tenantId,
          entityType: "order",
          entityId: order.id,
          taskType: "transport_regularization",
          title: `Régularisation transport - ${order.orderNumber}`,
          description: `Le poids facturable réel (${transportPreview.chargeableWeightKg} kg) dépasse l'estimé du devis (${estimatedChargeableWeight} kg) de ${Math.round(
            deviationPct
          )}%. Vérifiez si un complément client est nécessaire avant expédition.`,
          module: "logistics",
          priority: "URGENT",
          ownerType: "HUMAN",
          status: "PENDING",
          riskLevel: "HIGH",
          slaDeadline: new Date(Date.now() + 4 * 3_600_000),
          tags: ["transport-regularization", order.orderNumber],
          customFields: {
            estimatedChargeableWeight,
            actualChargeableWeight: transportPreview.chargeableWeightKg,
            deviationPct: Math.round(deviationPct * 100) / 100,
            proofImageUrl: proofImageUrl || null,
          },
        },
      });
      if (logisticsManager) {
        await prisma.taskAssignment.create({
          data: { taskId: task.id, userId: logisticsManager.id, assignedAt: new Date() },
        });
      }
    }
  }

  await prisma.orderTimeline.create({
    data: {
      orderId: order.id,
      event: "partner_weight_validated",
      note: `Poids réel validé via partenaire: ${transportPreview.chargeableWeightKg} kg facturables.`,
    },
  });

  return NextResponse.json({
    ok: true,
    shipment: toPlainData(shipment),
    transport: toPlainData({
      chargeableWeightKg: transportPreview.chargeableWeightKg,
      bufferedWeightKg: transportPreview.bufferedWeightKg,
      volumetricWeightKg: transportPreview.bufferedVolumetricWeightKg,
      bufferedCbm: transportPreview.bufferedCbm,
      deviationPct: Math.round(deviationPct * 100) / 100,
    }),
  });
}
