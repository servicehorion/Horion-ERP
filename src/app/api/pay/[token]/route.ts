import { NextRequest, NextResponse } from "next/server";
import { Prisma, type PaymentMethod } from "@prisma/client";

import { prisma } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import { getInsuranceUpsellCost, INSURANCE_UPSELL_RATE } from "@/lib/insurance-upsell";
import { getDeferredPaymentExpiryHours } from "@/lib/payments/deferred-payment";
import {
  generateDepositCode,
  isManualPaymentMethod,
  isMobileMoneyMethod,
  normalizePaymentMethod,
} from "@/lib/payments/config";
import { formatPublicMoney } from "@/lib/public-money";
import { applyIndicatifTransportSelection } from "@/lib/quotes/indicatif-pricing";
import { getQcUpsellCost, normalizeQcUpsellOption } from "@/lib/qc-upsell";
import { PaymentService } from "@/lib/services/payment.service";
const MOBILE_MONEY_FEE_PCT = 0.035;

function normalizePhone(value?: string | null) {
  return (value || "").replace(/[^\d+]/g, "").trim();
}

function buildQuotePayload(quote: {
  id: string;
  version: number;
  currency: string;
  merchandiseTotal: unknown;
  logisticsCost: unknown;
  commission: unknown;
  insuranceCost: unknown;
  qcOption: unknown;
  qcCost: unknown;
  total: unknown;
  validUntil: Date | null;
  paymentExpiry: Date | null;
  paymentStatus: string | null;
  pricingSnapshot: unknown;
}) {
  return {
    id: quote.id,
    version: quote.version,
    currency: quote.currency,
    merchandiseTotal: Number(quote.merchandiseTotal),
    logisticsCost: Number(quote.logisticsCost),
    commission: Number(quote.commission),
    insuranceCost: Number(quote.insuranceCost ?? 0),
    qcOption: String(quote.qcOption ?? "NONE"),
    qcCost: Number(quote.qcCost ?? 0),
    total: Number(quote.total),
    validUntil: quote.validUntil,
    paymentExpiry: quote.paymentExpiry,
    paymentStatus: quote.paymentStatus,
    pricingSnapshot: quote.pricingSnapshot,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const quote = await prisma.quote.findFirst({
    where: { paymentToken: token, isActive: true },
    select: {
      id: true,
      orderId: true,
      version: true,
      currency: true,
      merchandiseTotal: true,
      logisticsCost: true,
      commission: true,
      insuranceCost: true,
      qcOption: true,
      qcCost: true,
      total: true,
      validUntil: true,
      paymentExpiry: true,
      paymentStatus: true,
      paymentMethod: true,
      pricingSnapshot: true,
      paidAt: true,
    },
  });

  if (!quote) {
    return NextResponse.json({ error: "Lien invalide" }, { status: 404 });
  }

  if (quote.paymentExpiry && new Date() > quote.paymentExpiry) {
    if (quote.paymentStatus !== "EXPIRED") {
      await prisma.quote.update({
        where: { id: quote.id },
        data: { paymentStatus: "EXPIRED" },
      });
    }

    return NextResponse.json({ status: "EXPIRED" });
  }

  const order = await prisma.order.findUnique({
    where: { id: quote.orderId },
    select: {
      orderNumber: true,
      notes: true,
      contact: { select: { name: true, company: true, email: true } },
    },
  });

  return NextResponse.json({
    status: quote.paymentStatus ?? "PENDING",
    quote: buildQuotePayload(quote),
    order: order
      ? {
          orderNumber: order.orderNumber,
          notes: order.notes,
          contact: order.contact
            ? {
                name: order.contact.name,
                company: order.contact.company,
                email: order.contact.email,
              }
            : null,
        }
      : null,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const body = await req.json().catch(() => ({}));
  const { paymentMethod, paymentReference, payerPhone, selectedTransportKey, adjustedTotal, qcOption, withInsurance, cgvAcceptedAt } = body as {
    paymentMethod?: string;
    paymentReference?: string;
    payerPhone?: string;
    selectedTransportKey?: string;
    adjustedTotal?: number;
    qcOption?: string;
    withInsurance?: boolean;
    cgvAcceptedAt?: string;
  };

  if (!cgvAcceptedAt) {
    return NextResponse.json({ error: "Veuillez accepter les CGV avant de proceder." }, { status: 400 });
  }

  const normalizedMethod = normalizePaymentMethod(paymentMethod);
  if (!paymentMethod || !normalizedMethod) {
    return NextResponse.json({ error: "Methode de paiement requise" }, { status: 400 });
  }

  const methodKey: PaymentMethod = normalizedMethod;
  const isMobileMoney = isMobileMoneyMethod(methodKey);
  const isManualPayment = isManualPaymentMethod(methodKey);
  const normalizedReference = paymentReference?.trim() || "";
  const normalizedPhone = normalizePhone(payerPhone);

  if (isMobileMoney) {
    if (normalizedPhone.length < 9 || normalizedPhone.length > 16) {
      return NextResponse.json({ error: "Numero Mobile Money invalide" }, { status: 400 });
    }
  } else if (!isManualPayment && normalizedReference.length > 0 && (normalizedReference.length < 4 || normalizedReference.length > 120)) {
    return NextResponse.json({ error: "Reference de paiement invalide" }, { status: 400 });
  }

  const quote = await prisma.quote.findFirst({
    where: { paymentToken: token, isActive: true },
    select: {
      id: true,
      orderId: true,
      merchandiseTotal: true,
      logisticsCost: true,
      commission: true,
      insuranceCost: true,
      qcOption: true,
      qcCost: true,
      total: true,
      currency: true,
      version: true,
      paymentStatus: true,
      paymentExpiry: true,
      pricingSnapshot: true,
    },
  });

  if (!quote) {
    return NextResponse.json({ error: "Lien invalide" }, { status: 404 });
  }

  if (quote.paymentStatus === "PAID") {
    return NextResponse.json({ status: "PAID" });
  }

  if (quote.paymentStatus === "SUBMITTED") {
    return NextResponse.json({ status: "SUBMITTED" });
  }

  if (quote.paymentExpiry && new Date() > quote.paymentExpiry) {
    await prisma.quote.update({
      where: { id: quote.id },
      data: { paymentStatus: "EXPIRED" },
    });
    return NextResponse.json({ status: "EXPIRED" }, { status: 410 });
  }

  const order = await prisma.order.findUnique({
    where: { id: quote.orderId },
    select: {
      id: true,
      orderNumber: true,
      tenantId: true,
      contact: { select: { email: true } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  }

  const snapshot = (quote.pricingSnapshot ?? {}) as Record<string, unknown>;
  const repricedIndicatif =
    selectedTransportKey && snapshot.source === "SOURCING_INDICATIF"
      ? applyIndicatifTransportSelection(snapshot, selectedTransportKey)
      : null;

  if (selectedTransportKey && snapshot.source === "SOURCING_INDICATIF" && !repricedIndicatif) {
    return NextResponse.json({ error: "Mode de transport invalide pour ce devis" }, { status: 400 });
  }

  const finalMerchandise = repricedIndicatif?.merchandiseTotal ?? Number(quote.merchandiseTotal);
  const finalLogistics = repricedIndicatif?.logisticsCost ?? Number(quote.logisticsCost);
  const finalCommission = repricedIndicatif?.commission ?? Number(quote.commission);
  const finalQcOption = normalizeQcUpsellOption(qcOption ?? quote.qcOption ?? "NONE");
  const finalQcCost = getQcUpsellCost(finalQcOption);
  const wantsInsurance = Boolean(withInsurance ?? Number(quote.insuranceCost ?? 0) > 0);
  const subtotalBeforeInsurance = finalMerchandise + finalLogistics + finalCommission + finalQcCost;
  const finalInsurance = wantsInsurance ? getInsuranceUpsellCost(subtotalBeforeInsurance) : 0;
  const finalTotal = subtotalBeforeInsurance + finalInsurance;
  const finalBudgetPlannedXaf = finalMerchandise + finalLogistics + finalInsurance + finalQcCost;
  const snapshotBase = JSON.parse(
    JSON.stringify(
      repricedIndicatif?.snapshot ?? {
        ...snapshot,
      }
    )
  ) as Prisma.JsonObject;
    const finalPricingSnapshot: Prisma.InputJsonObject = {
      ...snapshotBase,
      insuranceCost: finalInsurance,
      insuranceSelected: wantsInsurance,
      insuranceRatePct: INSURANCE_UPSELL_RATE,
      qcOption: finalQcOption,
      qcCost: finalQcCost,
      total: finalTotal,
  };

  if (
    adjustedTotal &&
    typeof adjustedTotal === "number" &&
    Math.abs(adjustedTotal - finalTotal) > 1
  ) {
    return NextResponse.json({ error: "Le montant recalcule ne correspond pas au devis." }, { status: 400 });
  }

  const mobileMoneyFeeEstimate = isMobileMoney ? Math.round(finalTotal * MOBILE_MONEY_FEE_PCT) : 0;
  const manualExpiryHours = isManualPayment ? await getDeferredPaymentExpiryHours(order.tenantId, methodKey) : null;
  const expiresAt = manualExpiryHours
    ? new Date(Date.now() + manualExpiryHours * 3_600_000)
    : (quote.paymentExpiry ?? null);
  const depositCode = methodKey === "CASH_DEPOSIT" ? generateDepositCode(order.orderNumber) : null;
  const requiresGateway = !isManualPayment;
  const paymentEvidence = isMobileMoney
    ? `Numero a debiter: ${normalizedPhone}`
    : isManualPayment
      ? methodKey === "CASH_DEPOSIT"
        ? `Code de depot: ${depositCode}`
        : `Virement bancaire en attente de preuve client.`
      : normalizedReference
        ? `Reference: ${normalizedReference}`
        : "Verification operateur requise.";

  const [, , createdPayment] = await prisma.$transaction([
    prisma.quote.update({
      where: { id: quote.id },
      data: {
        paymentStatus: "SUBMITTED",
        paymentMethod: methodKey,
        cgvAcceptedAt: cgvAcceptedAt ? new Date(cgvAcceptedAt) : new Date(),
        ...(repricedIndicatif
          ? {
              pricingSnapshot: finalPricingSnapshot,
              merchandiseTotal: finalMerchandise,
              logisticsCost: finalLogistics,
              commission: finalCommission,
              insuranceCost: finalInsurance,
              qcOption: finalQcOption,
              qcCost: finalQcCost,
              total: finalTotal,
            }
          : {
              pricingSnapshot: finalPricingSnapshot,
              qcOption: finalQcOption,
              qcCost: finalQcCost,
              total: finalTotal,
            }),
        qcOption: finalQcOption,
        qcCost: finalQcCost,
      },
    }),
    prisma.order.update({
      where: { id: order.id },
      data: {
        status: "PAIEMENT_EN_COURS",
        merchandiseTotal: finalMerchandise,
        logisticsCost: finalLogistics,
        commissionAmount: finalCommission,
        insuranceAmount: finalInsurance,
        qcOption: finalQcOption,
        qcCost: finalQcCost,
        totalClient: finalTotal,
        budgetPlannedXAF: finalBudgetPlannedXaf,
        commissionRate: finalMerchandise > 0 ? finalCommission / finalMerchandise : 0,
      },
    }),
    prisma.payment.create({
      data: {
        orderId: order.id,
        direction: "INBOUND",
        type: "CLIENT_DEPOSIT",
        status: isManualPayment ? "PENDING_PROOF" : "PENDING",
        amount: finalTotal,
        currency: quote.currency,
        amountXAF: finalTotal,
        methodKey,
        method: methodKey,
        reference: !isMobileMoney && normalizedReference ? normalizedReference : null,
        depositCode,
        expiresAt: expiresAt ?? undefined,
        dueAt: expiresAt ?? quote.paymentExpiry ?? undefined,
        notes: [
          `Declaration client via lien public pour le devis v${quote.version}${selectedTransportKey ? ` (transport choisi: ${selectedTransportKey})` : ""}.`,
          paymentEvidence,
          isManualPayment && expiresAt
            ? `Preuve client attendue avant ${expiresAt.toLocaleString("fr-FR")}.`
            : "",
          finalInsurance > 0
            ? `Assurance Horion: ${formatPublicMoney(finalInsurance, quote.currency)} (${Math.round(
                INSURANCE_UPSELL_RATE * 100
              )}%).`
            : "",
          finalQcOption !== "NONE" ? `QC demande: ${finalQcOption} (${formatPublicMoney(finalQcCost, quote.currency)}).` : "",
          isMobileMoney && mobileMoneyFeeEstimate > 0
            ? `Frais operateur estimes hors devis: ${formatPublicMoney(mobileMoneyFeeEstimate, quote.currency)}.`
            : "",
          isManualPayment
            ? "Validation manuelle requise."
            : "Paiement instantane en attente de confirmation operateur.",
        ]
          .filter(Boolean)
          .join(" "),
      },
    }),
  ]);

  let gatewayIntent:
    | {
        provider: string;
        providerReference: string;
        checkoutUrl?: string | null;
        status: "PENDING" | "PROCESSING" | "REQUIRES_PROOF";
        raw?: Record<string, unknown>;
      }
    | null = null;

  if (requiresGateway) {
    try {
      const gateway = PaymentService.getGateway(methodKey);
      gatewayIntent = await gateway.initiatePayment({
        orderId: order.id,
        paymentId: createdPayment.id,
        amountXAF: finalTotal,
        currency: quote.currency,
        method: methodKey,
        customerPhone: isMobileMoney ? normalizedPhone : null,
        customerEmail: order.contact?.email ?? null,
        returnUrl: null,
        metadata: {
          quoteId: quote.id,
          quoteVersion: quote.version,
          orderNumber: order.orderNumber,
        },
      });

      await prisma.payment.update({
        where: { id: createdPayment.id },
        data: {
          reference: gatewayIntent.providerReference,
          status: gatewayIntent.status === "PROCESSING" ? "PROCESSING" : "PENDING",
          notes: [
            createdPayment.notes,
            `Passerelle: ${gatewayIntent.provider}.`,
            gatewayIntent.raw?.message ? String(gatewayIntent.raw.message) : "",
          ]
            .filter(Boolean)
            .join(" "),
        },
      });
    } catch (error) {
      await prisma.payment.update({
        where: { id: createdPayment.id },
        data: {
          notes: [
            createdPayment.notes,
            "Echec d'initialisation passerelle. Revue interne requise.",
            error instanceof Error ? error.message : "",
          ]
            .filter(Boolean)
            .join(" "),
        },
      });
    }
  }

  await emitEvent("payment.created", "payment", createdPayment.id, {
    orderId: order.id,
    direction: "INBOUND",
    type: "CLIENT_DEPOSIT",
    amount: finalTotal,
    currency: quote.currency,
    methodKey,
    providerReference: gatewayIntent?.providerReference ?? null,
  });
  return NextResponse.json({
    status: "SUBMITTED",
    payment: {
      amount: finalTotal,
      estimatedOperatorFee: mobileMoneyFeeEstimate,
      estimatedDebitAmount: isMobileMoney ? finalTotal + mobileMoneyFeeEstimate : finalTotal,
      expiresAt: expiresAt?.toISOString() ?? null,
      depositCode,
      requiresProofUpload: isManualPayment,
      providerReference: gatewayIntent?.providerReference ?? null,
      checkoutUrl: gatewayIntent?.checkoutUrl ?? null,
    },
  });
}
