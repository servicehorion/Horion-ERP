import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { UserRole } from "@prisma/client";
import QRCode from "qrcode";

import { prisma } from "@/lib/db";
import { checkPermission } from "@/lib/permissions";
import { generateShippingLabelPdf } from "@/lib/pdf/shipping-label";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  if (!token) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    checkPermission(token.role as UserRole, "order.view");
  } catch {
    return NextResponse.json({ error: "Permission insuffisante" }, { status: 403 });
  }

  const order = await prisma.order.findFirst({
    where: { id, tenantId: token.tenantId as string },
    select: {
      id: true,
      orderNumber: true,
      contact: { select: { name: true, phone: true } },
      items: { select: { description: true, quantity: true } },
      shipments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { origin: true, destination: true },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  }

  const shipment = order.shipments[0];
  const itemsSummary = order.items
    .map((i) => `${i.quantity}× ${i.description}`)
    .join(", ")
    .slice(0, 200);

  const qrPayload = JSON.stringify({ orderId: order.id, orderNumber: order.orderNumber });
  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    width: 128,
    margin: 1,
    color: { dark: "#111827", light: "#FFFFFF" },
  });

  const pdfBuffer = await generateShippingLabelPdf({
    orderNumber: order.orderNumber,
    clientName: order.contact?.name ?? "Client",
    clientPhone: order.contact?.phone ?? null,
    origin: shipment?.origin ?? "Guangzhou, Chine",
    destination: shipment?.destination ?? "Brazzaville, Congo",
    items: itemsSummary || "Marchandise diverse",
    qrDataUrl,
    createdAt: new Date().toISOString(),
  });

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="horion-label-${order.orderNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
