"use server";

import { randomUUID } from "crypto";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { AuditService } from "@/lib/services/audit.service";
import { OrderService } from "@/lib/services/order.service";
import {
  EmailNotificationChannel,
  WhatsAppNotificationChannel,
} from "@/lib/services/notification-channels.service";
import { revalidatePath } from "next/cache";
import { renderQuotePdf, type QuotePdfItem } from "@/lib/pdf/quote-pdf";
import {
  attachQuoteToRelatedDemands,
  cancelQuoteWorkflowTasks,
  createQuoteVersion,
  ensureQuoteApprovalTask,
  getQuoteApprovalGateLabel,
  resolveQuoteCreationApproval,
  syncDemandStatusForQuote,
} from "@/lib/quotes/workflow";

function formatMoney(amount: number, currency = "XAF"): string {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency === "RMB" ? "CNY" : currency,
      maximumFractionDigits: currency === "XAF" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${Math.round(amount).toLocaleString("fr-FR")} ${currency}`;
  }
}


export async function getIndicatifOrdersForQuote() {
  try {
    const user = await getSession();
    checkPermission(user.role, "quote.create");

    const orders = await prisma.order.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        orderNumber: true,
        contact: {
          select: {
            name: true,
            email: true,
            phone: true,
            whatsapp: true,
          },
        },
      },
    });

    return { data: orders };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur chargement commandes" };
  }
}

export async function getIndicatifContactsForQuote() {
  try {
    const user = await getSession();
    checkPermission(user.role, "quote.create");

    const contacts = await prisma.contact.findMany({
      where: {
        tenantId: user.tenantId,
        type: { in: ["CLIENT", "PROSPECT"] },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        name: true,
        company: true,
        email: true,
        phone: true,
        whatsapp: true,
        type: true,
      },
    });

    return { data: contacts };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur chargement contacts" };
  }
}

const INDICATIF_DOSSIER_MARKER = "[AUTO-INDICATIF-DOSSIER]";
const INDICATIF_SOURCE_KEY = "SOURCING_INDICATIF";

async function ensureIndicatifQuoteOrder(params: {
  tenantId: string;
  contactId: string;
  userId: string;
}) {
  const candidates = await prisma.order.findMany({
    where: {
      tenantId: params.tenantId,
      contactId: params.contactId,
      status: { in: ["DEMANDE", "RECHERCHE_PRODUIT", "DEVIS", "PAIEMENT_EN_COURS"] },
      archivedAt: null,
      payments: {
        none: {
          direction: "INBOUND",
          status: "CONFIRMED",
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      notes: true,
      quotes: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { pricingSnapshot: true },
      },
    },
  });

  const reusable = candidates.find((candidate) => {
    const snapshot = (candidate.quotes[0]?.pricingSnapshot ?? null) as Record<string, unknown> | null;
    return (
      candidate.notes?.includes(INDICATIF_DOSSIER_MARKER) ||
      snapshot?.source === INDICATIF_SOURCE_KEY
    );
  });

  if (reusable) {
    return {
      id: reusable.id,
      orderNumber: reusable.orderNumber,
      status: reusable.status,
      created: false,
    };
  }

  const orderNumber = await OrderService.generateOrderNumber(params.tenantId);
  const created = await prisma.order.create({
    data: {
      tenantId: params.tenantId,
      orderNumber,
      contactId: params.contactId,
      ownerId: params.userId,
      onboardedById: params.userId,
      status: "DEVIS",
      destinationCity: "Brazzaville",
      notes:
        `${INDICATIF_DOSSIER_MARKER} Dossier technique pre-paiement cree automatiquement ` +
        "depuis le module sourcing indicatif.",
      timeline: {
        create: {
          event: "indicatif_quote_dossier_created",
          toValue: "DEVIS",
          note: "Dossier technique pre-paiement cree automatiquement depuis le contact.",
          userId: params.userId,
        },
      },
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
    },
  });

  return { ...created, created: true };
}

const transportLineSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  mode: z.string().min(1),
  serviceLevel: z.string().min(1),
  costXAF: z.number().nonnegative(),
  ratePerKg: z.number().nonnegative().optional(),
  ratePerCbm: z.number().nonnegative().optional(),
  delayLabel: z.string().min(1),
  eligible: z.boolean(),
  freightPartnerId: z.string().optional().nullable(),
  freightPartnerName: z.string().optional().nullable(),
  incoterm: z.string().optional().nullable(),
  supportsDap: z.boolean().optional(),
  customsDeclarant: z.boolean().optional(),
});

const indicatifQuoteItemSchema = z.object({
  description: z.string().min(1),
  category: z.string().optional(),
  platform: z.string().optional(),
  catalogProductId: z.string().optional(),
  catalogMatchScore: z.number().nonnegative().optional(),
  catalogConfidenceScore: z.number().nonnegative().optional(),
  isCatalogMatch: z.boolean().optional(),
  quantity: z.number().int().positive(),
  platformUnitPriceRmb: z.number().nonnegative(),
  exchangeRate: z.number().positive(),
  productSellXAF: z.number().nonnegative(),
  serviceFeeXAF: z.number().nonnegative(),
  totalXAF: z.number().nonnegative(),
  selectedTransport: transportLineSchema,
  transportOptions: z.array(transportLineSchema),
  weightKg: z.number().nonnegative().optional(),
  productBufferPct: z.number().min(0).optional(),
  appliedRealityCoefficient: z.number().positive().optional().nullable(),
  categoryAverageDensityRatio: z.number().positive().optional().nullable(),
  compliance: z.record(z.string(), z.any()).optional(),
});

const sendIndicatifQuoteSchema = z
  .object({
  orderId: z.string().min(1).optional(),
  contactId: z.string().min(1).optional(),
  clientEmail: z.string().email().optional(),
  // Legacy single-item fields (kept for compatibility)
  description: z.string().optional(),
  category: z.string().optional(),
  platform: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  platformUnitPriceRmb: z.number().nonnegative().optional(),
  exchangeRate: z.number().positive().optional(),
  productSellXAF: z.number().nonnegative().optional(),
  serviceFeeXAF: z.number().nonnegative().optional(),
  totalXAF: z.number().nonnegative().optional(),
  selectedTransport: transportLineSchema.optional(),
  transportOptions: z.array(transportLineSchema).optional(),
  // Multi-product indicatif
  items: z.array(indicatifQuoteItemSchema).optional(),
  validDays: z.number().int().min(1).max(60).default(7),
})
  .refine((data) => Boolean(data.orderId || data.contactId), {
    message: "Selectionnez un contact ou une commande support.",
    path: ["contactId"],
  });

export async function sendIndicatifQuote(data: z.infer<typeof sendIndicatifQuoteSchema>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "quote.create");
    checkPermission(user.role, "quote.send");

    const payload = sendIndicatifQuoteSchema.parse(data);
    const normalizedItems =
      payload.items && payload.items.length > 0
        ? payload.items
        : payload.quantity &&
            payload.platformUnitPriceRmb != null &&
            payload.exchangeRate != null &&
            payload.productSellXAF != null &&
            payload.serviceFeeXAF != null &&
            payload.totalXAF != null &&
            payload.selectedTransport &&
            payload.transportOptions
          ? [
              {
                description: payload.description || "Article indicatif",
                category: payload.category,
                platform: payload.platform,
                quantity: payload.quantity,
                platformUnitPriceRmb: payload.platformUnitPriceRmb,
                exchangeRate: payload.exchangeRate,
                productSellXAF: payload.productSellXAF,
                serviceFeeXAF: payload.serviceFeeXAF,
                totalXAF: payload.totalXAF,
                selectedTransport: payload.selectedTransport,
                transportOptions: payload.transportOptions,
              },
            ]
          : [];

    if (normalizedItems.length === 0) {
      return { error: "Aucun produit indicatif a envoyer." };
    }

    const totals = normalizedItems.reduce(
      (acc, item) => {
        acc.productSell += item.productSellXAF;
        acc.serviceFee += item.serviceFeeXAF;
        acc.total += item.totalXAF;
        acc.logistics += item.selectedTransport.costXAF;
        return acc;
      },
      { productSell: 0, serviceFee: 0, total: 0, logistics: 0 }
    );

    const resolvedOrderId =
      payload.orderId ||
      (
        await ensureIndicatifQuoteOrder({
          tenantId: user.tenantId,
          contactId: payload.contactId as string,
          userId: user.id,
        })
      ).id;

    const order = await prisma.order.findUnique({
      where: { id: resolvedOrderId },
      select: {
        id: true,
        tenantId: true,
        status: true,
        orderNumber: true,
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            whatsapp: true,
            company: true,
          },
        },
      },
    });
    if (!order || order.tenantId !== user.tenantId) {
      return { error: "Commande introuvable" };
    }

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + payload.validDays);
    const approval = await resolveQuoteCreationApproval({
      tenantId: user.tenantId,
      totalXaf: totals.total,
      creatorRole: user.role,
      creatorId: user.id,
    });
    const canSendImmediately = approval.creatorCanApprove;
    const signatureToken = canSendImmediately ? randomUUID() : null;

      const quote = await prisma.$transaction(async (tx) => {
        const createdQuote = await createQuoteVersion(tx, {
          orderId: resolvedOrderId,
          status: canSendImmediately ? "SENT" : "DRAFT",
          sentAt: canSendImmediately ? new Date() : null,
          validUntil,
          signatureToken,
          ...approval.autoApprovalData,
          merchandiseTotal: totals.productSell,
          logisticsCost: totals.logistics,
          commission: totals.serviceFee,
          insuranceCost: 0,
          total: totals.total,
          currency: "XAF",
          pricingSnapshot: {
            source: "SOURCING_INDICATIF",
            sourcePriority: normalizedItems.some((item) => item.catalogProductId)
              ? "CLEAN_CATALOG_FIRST"
              : "EXTERNAL_SOURCING_FALLBACK",
            lineCount: normalizedItems.length,
            items: normalizedItems,
            pricingPolicy: {
              hiddenProductMarginPct: 30,
              visibleServiceFeePct: 10,
              serviceFeeBase: "PRODUCT_ONLY",
              customsIncludedInDDP: false,
            },
          } as Prisma.InputJsonValue,
        });

      await tx.order.update({
        where: { id: resolvedOrderId },
        data: {
          merchandiseTotal: totals.productSell,
          logisticsCost: totals.logistics,
          commissionRate: totals.productSell > 0 ? totals.serviceFee / totals.productSell : 0,
          commissionAmount: totals.serviceFee,
          insuranceAmount: 0,
          totalClient: totals.total,
          budgetPlannedXAF: totals.productSell + totals.logistics,
          status: "DEVIS",
        },
      });

      const matchedProductIds = Array.from(
        new Set(
          normalizedItems
            .map((item) => item.catalogProductId)
            .filter((value): value is string => Boolean(value))
        )
      );
      if (matchedProductIds.length > 0) {
        await tx.catalogProduct.updateMany({
          where: {
            tenantId: user.tenantId,
            id: { in: matchedProductIds },
          },
          data: {
            lastQuotedAt: new Date(),
          },
        });
      }

      return createdQuote;
      });

      await attachQuoteToRelatedDemands({ quoteId: quote.id, orderId: resolvedOrderId });
      await cancelQuoteWorkflowTasks({
        orderId: resolvedOrderId,
        includePaymentTasks: true,
        excludingQuoteId: quote.id,
      });

      if (!approval.creatorCanApprove) {
        await ensureQuoteApprovalTask({
          tenantId: user.tenantId,
          orderId: resolvedOrderId,
          quoteId: quote.id,
          orderNumber: order.orderNumber,
          totalXaf: totals.total,
          customerName: order.contact?.name ?? null,
        });
      }
    await syncDemandStatusForQuote(quote.id);

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_BASE_URL ||
      "http://localhost:3000";
    const landingUrl = signatureToken
      ? `${appUrl.replace(/\/$/, "")}/quote/${signatureToken}`
      : null;

    const emailTo = payload.clientEmail || order.contact?.email || "";
    if (canSendImmediately && emailTo && landingUrl) {
      const message = [
        `Bonjour ${order.contact?.name || ""}`.trim(),
        `Votre devis ${order.orderNumber} est disponible.`,
        `Produits: ${normalizedItems.length}`,
        `Total: ${formatMoney(totals.total, "XAF")}`,
        `Marchandise: ${formatMoney(totals.productSell, "XAF")}`,
        `Transport: ${formatMoney(totals.logistics, "XAF")}`,
        `Frais de service: ${formatMoney(totals.serviceFee, "XAF")}`,
        "",
        ...normalizedItems.slice(0, 5).map((item, idx) => {
          return `${idx + 1}. ${item.description} x${item.quantity} - ${item.selectedTransport.label} (${item.selectedTransport.delayLabel})`;
        }),
        ...(normalizedItems.length > 5 ? [`... +${normalizedItems.length - 5} autres lignes`] : []),
        "",
        `Validation du devis: ${landingUrl}`,
      ].join("\n");
      await EmailNotificationChannel.send({
        to: emailTo,
        type: "QUOTE_SENT",
        title: `Devis ${order.orderNumber}`,
        message,
        entityType: "quote",
        entityId: quote.id,
      });

      await prisma.quote.update({
        where: { id: quote.id },
        data: {
          sentByEmailAt: new Date(),
          sentByEmailTo: emailTo,
        },
      });
    }

    const waRecipient = order.contact?.whatsapp || order.contact?.phone || "";
    if (canSendImmediately && waRecipient && landingUrl) {
      await WhatsAppNotificationChannel.send({
        to: waRecipient,
        type: "QUOTE_SENT",
        title: `Devis ${order.orderNumber}`,
        message: [
          `${normalizedItems.length} produit(s)`,
          `Total ${formatMoney(totals.total, "XAF")}`,
          `Transport cumule ${formatMoney(totals.logistics, "XAF")}`,
          `Lien validation: ${landingUrl}`,
        ].join("\n"),
      });
    }

    const items: QuotePdfItem[] = normalizedItems.map((item) => ({
      description: item.description,
      category: item.category || null,
      platform: item.platform || null,
      quantity: item.quantity,
      unitPrice: item.quantity > 0 ? item.productSellXAF / item.quantity : item.productSellXAF,
      currency: "XAF",
      lineTotal: item.productSellXAF,
      transportLabel: item.selectedTransport.label,
      transportDelay: item.selectedTransport.delayLabel,
      transportCost: item.selectedTransport.costXAF,
      }));

    const pdf = canSendImmediately
      ? await renderQuotePdf({
          title: "Devis Horion",
          quoteNumber: order.orderNumber,
          clientName: order.contact?.name || "-",
          statusLabel: "A valider",
          createdAt: new Date().toLocaleDateString("fr-FR"),
          validUntil: validUntil.toLocaleDateString("fr-FR"),
          paymentLink: landingUrl,
          companyEmail: "servicehorion@gmail.com",
          companyWhatsapp: "+242 06 460 08 31",
          items,
          totals: {
            merchandiseTotal: totals.productSell,
            logisticsCost: totals.logistics,
            commission: totals.serviceFee,
            insuranceCost: 0,
            total: totals.total,
            currency: "XAF",
          },
        })
      : null;
    const filename = `devis-horion-${order.orderNumber}.pdf`;

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
        action: canSendImmediately ? "sourcing.indicatif.quote_sent" : "sourcing.indicatif.quote_pending_approval",
        entityType: "quote",
        entityId: quote.id,
        newValue: {
        orderId: resolvedOrderId,
        contactId: order.contact?.id,
        totalXAF: totals.total,
        lineCount: normalizedItems.length,
        channelEmail: canSendImmediately && Boolean(emailTo),
        channelWhatsapp: canSendImmediately && Boolean(waRecipient),
        approvalPending: !canSendImmediately,
      },
    });

    revalidatePath(`/orders/${resolvedOrderId}`);
    revalidatePath("/sourcing/indicatif");
    revalidatePath("/tasks");
    revalidatePath("/dashboard");

    return {
      data: {
        quoteId: quote.id,
        orderId: resolvedOrderId,
        landingUrl,
        filename: canSendImmediately ? filename : null,
        pdfBase64: pdf ? pdf.toString("base64") : null,
        requiresApproval: !canSendImmediately,
        approvalLabel: approval.creatorCanApprove
          ? null
          : getQuoteApprovalGateLabel(approval.policy.requiredGate),
      },
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur envoi devis indicatif" };
  }
}


