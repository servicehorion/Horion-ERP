import type { DemandStatus, QuoteApprovalStatus, QuoteStatus, SourcingTicketStatus } from "@prisma/client";

import { prisma } from "@/lib/db";

type DemandSnapshot = {
  id: string;
  tenantId: string;
  contactId: string | null;
  leadId: string | null;
  quoteId: string | null;
  orderId: string | null;
  assignedToId: string | null;
  rawDescription: string;
  category: string | null;
  quantity: number | null;
  targetPrice: unknown;
  currency: string;
  status: DemandStatus;
  source: string;
  sourcePayload: unknown;
};

function toStatusFromDemandStatus(status: DemandStatus): SourcingTicketStatus {
  switch (status) {
    case "RAW":
      return "CREATED";
    case "QUALIFIED":
      return "INTERNAL_SCANNING";
    case "INDICATIF_PENDING":
      return "EXTERNAL_SOURCING_PENDING";
    case "QUOTE_DRAFT":
    case "QUOTE_PENDING_APPROVAL":
    case "QUOTE_APPROVED":
      return "QUOTE_READY";
    case "QUOTE_SENT":
      return "QUOTED";
    case "CLIENT_ACCEPTED":
    case "PAYMENT_SUBMITTED":
    case "PAYMENT_VALIDATED":
      return "CLIENT_ACCEPTED";
    case "CONVERTED":
      return "CONVERTED";
    case "LOST":
      return "LOST";
    default:
      return "CREATED";
  }
}

function toStatusFromQuote(params: {
  quoteStatus: QuoteStatus;
  approvalStatus: QuoteApprovalStatus;
  paymentStatus: string | null;
  orderId?: string | null;
}): SourcingTicketStatus {
  if (params.orderId && params.paymentStatus === "PAID") return "ORDERED";
  if (params.quoteStatus === "ACCEPTED" || params.paymentStatus === "SUBMITTED") return "CLIENT_ACCEPTED";
  if (params.quoteStatus === "SENT") return "QUOTED";
  if (params.approvalStatus === "APPROVED" || params.quoteStatus === "DRAFT") return "QUOTE_READY";
  if (params.quoteStatus === "REJECTED" || params.quoteStatus === "EXPIRED") return "LOST";
  return "CREATED";
}

function trimText(value?: string | null, fallback = "Demande sourcing") {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
}

function summarizeIndicatifItems(
  items: Array<Record<string, unknown>>,
  fallback: string
) {
  const labels = items
    .map((item) => trimText(String(item.description ?? item.name ?? "").trim(), ""))
    .filter(Boolean)
    .slice(0, 3);

  if (labels.length === 0) return fallback;
  if (items.length > 3) {
    return `${labels.join(", ")} +${items.length - 3} autre(s)`;
  }
  return labels.join(", ");
}

async function findReusableTicket(params: {
  tenantId: string;
  demandId?: string | null;
  quoteId?: string | null;
  orderId?: string | null;
  contactId?: string | null;
}) {
  if (params.demandId) {
    const byDemand = await prisma.sourcingTicket.findFirst({
      where: { tenantId: params.tenantId, demandId: params.demandId },
      orderBy: { updatedAt: "desc" },
    });
    if (byDemand) return byDemand;
  }

  if (params.quoteId) {
    const byQuote = await prisma.sourcingTicket.findFirst({
      where: { tenantId: params.tenantId, quoteId: params.quoteId },
      orderBy: { updatedAt: "desc" },
    });
    if (byQuote) return byQuote;
  }

  if (params.orderId) {
    const byOrder = await prisma.sourcingTicket.findFirst({
      where: { tenantId: params.tenantId, orderId: params.orderId },
      orderBy: { updatedAt: "desc" },
    });
    if (byOrder) return byOrder;
  }

  if (params.contactId) {
    return prisma.sourcingTicket.findFirst({
      where: {
        tenantId: params.tenantId,
        contactId: params.contactId,
        orderId: null,
        status: { notIn: ["LOST", "ORDERED", "CONVERTED"] },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  return null;
}

export class SourcingTicketService {
  static async ensureFromDemand(demandId: string) {
    const demand = await prisma.demandIntake.findUnique({
      where: { id: demandId },
      select: {
        id: true,
        tenantId: true,
        contactId: true,
        leadId: true,
        quoteId: true,
        orderId: true,
        assignedToId: true,
        rawDescription: true,
        category: true,
        quantity: true,
        targetPrice: true,
        currency: true,
        status: true,
        source: true,
        sourcePayload: true,
      },
    });

    if (!demand) return null;

    const existing = await findReusableTicket({
      tenantId: demand.tenantId,
      demandId: demand.id,
      quoteId: demand.quoteId,
      orderId: demand.orderId,
      contactId: demand.contactId,
    });

    const nextStatus = toStatusFromDemandStatus(demand.status);
    const baseData = {
      tenantId: demand.tenantId,
      demandId: demand.id,
      contactId: demand.contactId,
      leadId: demand.leadId,
      quoteId: demand.quoteId,
      orderId: demand.orderId,
      status: nextStatus,
      description: trimText(demand.rawDescription, "Demande sourcing"),
      category: demand.category,
      quantity: demand.quantity,
      targetPrice: demand.targetPrice as any,
      currency: demand.currency || "XAF",
      assignedToId: demand.assignedToId,
      notes: existing?.notes ?? `Origine: ${demand.source}`,
      pricingSnapshot: (existing?.pricingSnapshot as any) ?? {
        source: demand.source,
        sourcePayload: demand.sourcePayload ?? {},
      },
      lostAt: nextStatus === "LOST" ? existing?.lostAt ?? new Date() : null,
      lostReason: nextStatus === "LOST" ? "Demand marked as lost" : null,
      convertedAt:
        nextStatus === "CONVERTED" || nextStatus === "ORDERED"
          ? existing?.convertedAt ?? new Date()
          : null,
    };

    if (existing) {
      return prisma.sourcingTicket.update({
        where: { id: existing.id },
        data: baseData,
      });
    }

    return prisma.sourcingTicket.create({ data: baseData });
  }

  static async ensureForIndicatifQuote(params: {
    tenantId: string;
    quoteId: string;
    orderId: string;
    contactId?: string | null;
    leadId?: string | null;
    assignedToId?: string | null;
    items: Array<Record<string, unknown>>;
    approvalStatus: QuoteApprovalStatus;
    quoteStatus: QuoteStatus;
    paymentStatus?: string | null;
  }) {
    const existing = await findReusableTicket({
      tenantId: params.tenantId,
      quoteId: params.quoteId,
      orderId: params.orderId,
      contactId: params.contactId,
    });

    const description = summarizeIndicatifItems(params.items, "Sourcing indicatif Horion");
    const firstCategory =
      params.items.find((item) => typeof item.category === "string" && item.category)?.category ?? null;
    const quantity = params.items.reduce((sum, item) => sum + Math.max(1, Number(item.quantity ?? 1)), 0);
    const targetPrice = params.items.reduce((sum, item) => sum + Number(item.totalXAF ?? 0), 0);
    const primaryItem = params.items[0] ?? null;
    const nextStatus = toStatusFromQuote({
      quoteStatus: params.quoteStatus,
      approvalStatus: params.approvalStatus,
      paymentStatus: params.paymentStatus ?? null,
      orderId: params.orderId,
    });

    const data = {
      tenantId: params.tenantId,
      contactId: params.contactId ?? null,
      leadId: params.leadId ?? null,
      quoteId: params.quoteId,
      orderId: params.orderId,
      assignedToId: params.assignedToId ?? existing?.assignedToId ?? null,
      status: nextStatus,
      description,
      category: firstCategory ? String(firstCategory) : null,
      quantity: quantity > 0 ? quantity : null,
      targetPrice: targetPrice > 0 ? targetPrice : null,
      currency: "XAF",
      catalogProductId:
        typeof primaryItem?.catalogProductId === "string" ? String(primaryItem.catalogProductId) : null,
      catalogMatchScore:
        primaryItem && Number.isFinite(Number(primaryItem.catalogMatchScore))
          ? Number(primaryItem.catalogMatchScore)
          : null,
      catalogMatchSource:
        typeof primaryItem?.catalogMatchScore === "number" ? "FUZZY" : "NONE",
      estimatedWeight:
        primaryItem && Number.isFinite(Number(primaryItem.weightKg))
          ? Number(primaryItem.weightKg)
          : null,
      pricingSnapshot: {
        source: "SOURCING_INDICATIF",
        items: params.items,
      } as any,
      notes: existing?.notes ?? "Ticket auto-cree depuis devis sourcing indicatif.",
      convertedAt:
        nextStatus === "ORDERED" || nextStatus === "CONVERTED"
          ? existing?.convertedAt ?? new Date()
          : null,
      lostAt: nextStatus === "LOST" ? existing?.lostAt ?? new Date() : null,
      lostReason: nextStatus === "LOST" ? existing?.lostReason ?? "Quote no longer active" : null,
    };

    if (existing) {
      return prisma.sourcingTicket.update({
        where: { id: existing.id },
        data,
      });
    }

    return prisma.sourcingTicket.create({ data });
  }

  static async syncForQuote(quoteId: string) {
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      select: {
        id: true,
        orderId: true,
        status: true,
        approvalStatus: true,
        paymentStatus: true,
        pricingSnapshot: true,
        total: true,
        currency: true,
        order: {
          select: {
            id: true,
            tenantId: true,
            contactId: true,
            leadId: true,
          },
        },
      },
    });

    if (!quote) return;

    const nextStatus = toStatusFromQuote({
      quoteStatus: quote.status,
      approvalStatus: quote.approvalStatus,
      paymentStatus: quote.paymentStatus ?? null,
      orderId: quote.orderId,
    });

    const relatedDemands = await prisma.demandIntake.findMany({
      where: { OR: [{ quoteId }, { orderId: quote.orderId }] },
      select: { id: true },
    });

    const relatedDemandIds = relatedDemands.map((demand) => demand.id);
    const tickets = await prisma.sourcingTicket.findMany({
      where: {
        tenantId: quote.order.tenantId,
        OR: [
          { quoteId },
          { orderId: quote.orderId },
          ...(relatedDemandIds.length > 0 ? [{ demandId: { in: relatedDemandIds } }] : []),
          {
            contactId: quote.order.contactId,
            orderId: null,
            status: { notIn: ["LOST", "CONVERTED", "ORDERED"] },
          },
        ],
      },
      orderBy: { updatedAt: "desc" },
    });

    if (tickets.length === 0) {
      const snapshot =
        quote.pricingSnapshot && typeof quote.pricingSnapshot === "object"
          ? (quote.pricingSnapshot as Record<string, unknown>)
          : {};
      const items = Array.isArray(snapshot.items)
        ? (snapshot.items as Array<Record<string, unknown>>)
        : [];
      await prisma.sourcingTicket.create({
        data: {
          tenantId: quote.order.tenantId,
          contactId: quote.order.contactId,
          leadId: quote.order.leadId,
          quoteId,
          orderId: quote.orderId,
          status: nextStatus,
          description: summarizeIndicatifItems(items, `Devis ${quoteId}`),
          quantity:
            items.length > 0
              ? items.reduce((sum, item) => sum + Math.max(1, Number(item.quantity ?? 1)), 0)
              : null,
          targetPrice: Number(quote.total),
          currency: quote.currency,
          pricingSnapshot: quote.pricingSnapshot as any,
          notes: "Ticket auto-cree depuis devis existant.",
          convertedAt: nextStatus === "ORDERED" || nextStatus === "CONVERTED" ? new Date() : null,
          lostAt: nextStatus === "LOST" ? new Date() : null,
          lostReason: nextStatus === "LOST" ? "Quote rejected or expired" : null,
        },
      });
      return;
    }

    await prisma.$transaction(
      tickets.map((ticket) =>
        prisma.sourcingTicket.update({
          where: { id: ticket.id },
          data: {
            quoteId,
            orderId: quote.orderId,
            contactId: ticket.contactId ?? quote.order.contactId,
            leadId: ticket.leadId ?? quote.order.leadId,
            status:
              ticket.status === "ORDERED" || ticket.status === "CONVERTED" ? ticket.status : nextStatus,
            convertedAt:
              nextStatus === "ORDERED" || nextStatus === "CONVERTED"
                ? ticket.convertedAt ?? new Date()
                : ticket.convertedAt,
            lostAt: nextStatus === "LOST" ? ticket.lostAt ?? new Date() : ticket.lostAt,
            lostReason:
              nextStatus === "LOST" ? ticket.lostReason ?? "Quote rejected or expired" : ticket.lostReason,
          },
        })
      )
    );
  }
}
