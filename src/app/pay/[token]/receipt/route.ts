import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getPaymentMethodLabel } from "@/lib/payments/config";
import { renderPaymentReceiptPdf } from "@/lib/pdf/payment-receipt";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  const quote = await prisma.quote.findFirst({
    where: { paymentToken: token, isActive: true },
    select: {
      total: true,
      currency: true,
      paymentStatus: true,
      paymentMethod: true,
      paidAt: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          contact: { select: { name: true } },
          payments: {
            where: {
              direction: "INBOUND",
              status: "CONFIRMED",
            },
            orderBy: [{ confirmedAt: "desc" }, { createdAt: "desc" }],
            take: 1,
            select: {
              reference: true,
              confirmedAt: true,
            },
          },
        },
      },
    },
  });

  if (!quote) {
    return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
  }

  if (quote.paymentStatus !== "PAID") {
    return NextResponse.json({ error: "Le reçu n'est disponible qu'après validation du paiement." }, { status: 400 });
  }

  const payment = quote.order.payments[0] ?? null;
  const paidAt = payment?.confirmedAt ?? quote.paidAt;
  const methodLabel = quote.paymentMethod ? getPaymentMethodLabel(quote.paymentMethod) : "Paiement Horion";

  const buffer = await renderPaymentReceiptPdf({
    receiptNumber: `RCPT-${quote.order.orderNumber}`,
    orderNumber: quote.order.orderNumber,
    clientName: quote.order.contact?.name || "Client Horion",
    amount: Number(quote.total),
    currency: quote.currency,
    methodLabel,
    paymentReference: payment?.reference ?? null,
    paidAt: paidAt
      ? new Date(paidAt).toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null,
    companyEmail: "servicehorion@gmail.com",
    companyWhatsapp: "+242 06 460 08 31",
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=\"recu-horion-${quote.order.orderNumber}.pdf\"`,
      "Cache-Control": "private, no-store",
    },
  });
}
