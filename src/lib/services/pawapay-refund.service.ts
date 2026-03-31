import { convertCurrency } from "@/config/currencies";
import { prisma } from "@/lib/db";
import { PawaPayAdapter } from "@/lib/payment-gateway/pawapay-adapter";
import {
  getPawaPayCountryOptions,
  normalizePawaPayCountryCode,
} from "@/lib/payments/pawapay-market-config";

function toAmountXaf(amount: number, currency: string) {
  if (currency === "XAF") return amount;
  return convertCurrency(amount, currency, "XAF");
}

function extractProviderCode(method?: string | null) {
  const match = String(method ?? "").match(/^PAWAPAY:([A-Z0-9_]+)$/);
  return match?.[1] ?? null;
}

export class PawaPayRefundService {
  static async initiate(params: { paymentId: string; amount?: number; tenantId?: string }) {
    const payment = await prisma.payment.findFirst({
      where: {
        id: params.paymentId,
        direction: "INBOUND",
        type: "CLIENT_DEPOSIT",
        status: "CONFIRMED",
        ...(params.tenantId ? { order: { tenantId: params.tenantId } } : {}),
      },
      select: {
        id: true,
        orderId: true,
        amount: true,
        currency: true,
        reference: true,
        method: true,
        order: {
          select: {
            orderNumber: true,
            contact: {
              select: {
                country: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new Error("Paiement client introuvable ou non remboursable.");
    }
    if (!payment.reference) {
      throw new Error("Reference pawaPay manquante sur le paiement a rembourser.");
    }

    const countryCode = normalizePawaPayCountryCode(payment.order.contact?.country ?? null);
    if (!countryCode) {
      throw new Error("Pays du client incompatible avec pawaPay pour le remboursement.");
    }
    const country = getPawaPayCountryOptions().find((option) => option.code === countryCode);
    if (!country) {
      throw new Error("Configuration pawaPay introuvable pour ce pays.");
    }

    const amount = Number(params.amount ?? payment.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > Number(payment.amount)) {
      throw new Error("Montant de remboursement invalide.");
    }

    const adapter = new PawaPayAdapter();
    const providerCode = extractProviderCode(payment.method);
    const refundIntent = await adapter.initiateRefund({
      depositReference: payment.reference,
      amount,
      currency: payment.currency,
      countryCode: country.alpha3,
      providerCode,
      metadata: {
        orderId: payment.orderId,
        orderNumber: payment.order.orderNumber,
        sourcePaymentId: payment.id,
      },
    });

    const refundPayment = await prisma.payment.create({
      data: {
        orderId: payment.orderId,
        direction: "OUTBOUND",
        type: "REFUND",
        status: refundIntent.status === "CONFIRMED" ? "REFUNDED" : refundIntent.status === "FAILED" ? "FAILED" : refundIntent.status === "CANCELLED" ? "CANCELLED" : "PROCESSING",
        amount,
        currency: payment.currency,
        amountXAF: toAmountXaf(amount, payment.currency),
        methodKey: "AGGREGATOR",
        method: providerCode ? `PAWAPAY_REFUND:${providerCode}` : "PAWAPAY_REFUND",
        reference: refundIntent.providerReference,
        paidAt: refundIntent.status === "CONFIRMED" ? new Date() : undefined,
        confirmedAt: refundIntent.status === "CONFIRMED" ? new Date() : undefined,
        notes: `Remboursement pawaPay initie depuis ${payment.id}. Reference provider: ${refundIntent.providerReference}.`,
      },
    });

    return { refundPayment, refundIntent };
  }
}
