"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { OrderService } from "@/lib/services/order.service";
import { AuditService } from "@/lib/services/audit.service";
import { serializeDecimals } from "@/lib/utils";

type BoardStage =
  | "CREATED"
  | "RESEARCHING"
  | "QUOTED"
  | "CLIENT_ACCEPTED"
  | "ORDERED"
  | "LOST";

function deriveBoardStage(ticket: {
  status: string;
  orderId?: string | null;
  quoteStatus?: string | null;
}) : BoardStage {
  if (ticket.status === "LOST") return "LOST";
  if (ticket.orderId || ["ORDERED", "CONVERTED"].includes(ticket.status)) return "ORDERED";
  if (ticket.status === "CLIENT_ACCEPTED" || ticket.quoteStatus === "ACCEPTED") return "CLIENT_ACCEPTED";
  if (ticket.status === "QUOTED") return "QUOTED";
  if (ticket.status === "CREATED") return "CREATED";
  return "RESEARCHING";
}

function normalizeTicketStatus(value: string) {
  const allowed = [
    "CREATED",
    "INTERNAL_SCANNING",
    "CATALOG_MATCH_REVIEW",
    "EXTERNAL_SOURCING_PENDING",
    "PENDING_PARTNER_INFO",
    "QUOTE_READY",
    "QUOTED",
    "CLIENT_ACCEPTED",
    "ORDERED",
    "CONVERTED",
    "LOST",
  ];
  if (!allowed.includes(value)) {
    throw new Error("Statut de ticket invalide");
  }
  return value as
    | "CREATED"
    | "INTERNAL_SCANNING"
    | "CATALOG_MATCH_REVIEW"
    | "EXTERNAL_SOURCING_PENDING"
    | "PENDING_PARTNER_INFO"
    | "QUOTE_READY"
    | "QUOTED"
    | "CLIENT_ACCEPTED"
    | "ORDERED"
    | "CONVERTED"
    | "LOST";
}

export async function getSourcingTicketBoard() {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.view");

    const tickets = await prisma.sourcingTicket.findMany({
      where: { tenantId: user.tenantId },
      select: {
        id: true,
        status: true,
        description: true,
        category: true,
        quantity: true,
        targetPrice: true,
        currency: true,
        quoteId: true,
        orderId: true,
        demandId: true,
        createdAt: true,
        updatedAt: true,
        catalogMatchScore: true,
        catalogMatchSource: true,
        assignedTo: { select: { id: true, name: true } },
        contact: { select: { id: true, name: true } },
        demand: { select: { id: true, source: true, status: true } },
        lead: { select: { id: true, status: true } },
        catalogProduct: { select: { id: true, name: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });

    const quoteIds = Array.from(
      new Set(tickets.map((ticket) => ticket.quoteId).filter((value): value is string => Boolean(value)))
    );
    const orderIds = Array.from(
      new Set(tickets.map((ticket) => ticket.orderId).filter((value): value is string => Boolean(value)))
    );

    const [quotes, orders] = await Promise.all([
      quoteIds.length > 0
        ? prisma.quote.findMany({
            where: { id: { in: quoteIds } },
            select: { id: true, status: true, total: true, paymentToken: true },
          })
        : Promise.resolve([]),
      orderIds.length > 0
        ? prisma.order.findMany({
            where: { id: { in: orderIds } },
            select: { id: true, orderNumber: true, status: true },
          })
        : Promise.resolve([]),
    ]);

    const quoteMap = new Map(quotes.map((quote) => [quote.id, quote]));
    const orderMap = new Map(orders.map((order) => [order.id, order]));

    return {
      data: serializeDecimals(
        tickets.map((ticket) => {
          const quote = ticket.quoteId ? quoteMap.get(ticket.quoteId) ?? null : null;
          const order = ticket.orderId ? orderMap.get(ticket.orderId) ?? null : null;
          return {
            ...ticket,
            quote,
            order,
            boardStage: deriveBoardStage({
              status: ticket.status,
              orderId: ticket.orderId,
              quoteStatus: quote?.status ?? null,
            }),
          };
        })
      ),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur chargement tickets sourcing" };
  }
}

export async function updateSourcingTicketStatus(ticketId: string, status: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.manage");

    const ticket = await prisma.sourcingTicket.findFirst({
      where: { id: ticketId, tenantId: user.tenantId },
      select: { id: true, status: true, tenantId: true, lostAt: true, orderId: true, convertedAt: true },
    });
    if (!ticket) {
      return { error: "Ticket sourcing introuvable" };
    }

    const normalizedStatus = normalizeTicketStatus(status);
    const updated = await prisma.sourcingTicket.update({
      where: { id: ticketId },
      data: {
        status: normalizedStatus,
        lostAt: normalizedStatus === "LOST" ? new Date() : null,
        convertedAt:
          normalizedStatus === "ORDERED" || normalizedStatus === "CONVERTED"
            ? ticket.convertedAt ?? new Date()
            : undefined,
      },
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "sourcing_ticket.status_changed",
      entityType: "sourcing_ticket",
      entityId: ticketId,
      oldValue: { status: ticket.status },
      newValue: { status: normalizedStatus },
    });

    revalidatePath("/sourcing/tickets");
    return { data: serializeDecimals(updated) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur mise a jour ticket sourcing" };
  }
}

function extractPositiveNumber(values: unknown[]) {
  for (const value of values) {
    const numberValue = Number(value);
    if (Number.isFinite(numberValue) && numberValue > 0) {
      return numberValue;
    }
  }
  return null;
}

export async function createOrderFromTicket(ticketId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.create");

    const ticket = await prisma.sourcingTicket.findFirst({
      where: { id: ticketId, tenantId: user.tenantId },
      include: {
        contact: { select: { id: true, type: true, name: true } },
        demand: { select: { id: true } },
      },
    });

    if (!ticket) {
      return { error: "Ticket sourcing introuvable" };
    }

    if (ticket.orderId) {
      await prisma.sourcingTicket.update({
        where: { id: ticket.id },
        data: {
          status: "ORDERED",
          convertedAt: ticket.convertedAt ?? new Date(),
        },
      });
      revalidatePath("/sourcing/tickets");
      return { data: { orderId: ticket.orderId, reused: true } };
    }

    if (!ticket.contactId || !ticket.contact) {
      return { error: "Le ticket doit etre relie a un contact client avant conversion" };
    }

    const snapshot =
      ticket.pricingSnapshot && typeof ticket.pricingSnapshot === "object"
        ? (ticket.pricingSnapshot as Record<string, unknown>)
        : {};

    const quantity = Math.max(1, Number(ticket.quantity || 1));
    const unitPrice =
      extractPositiveNumber([
        snapshot.unitPrice,
        snapshot.unitPriceRmb,
        snapshot.estimatedCost,
        snapshot.platformUnitPriceRmb,
        ticket.targetPrice,
      ]) ?? 0;

    if (unitPrice <= 0) {
      return { error: "Le ticket doit avoir un prix unitaire positif avant conversion en commande" };
    }

    const createdOrder = await OrderService.create(user.tenantId, {
      contactId: ticket.contactId,
      leadId: ticket.leadId ?? undefined,
      ownerId: user.id,
      onboardedById: user.id,
      priority: "NORMAL",
      destinationCity: "Brazzaville",
      notes: `Commande creee depuis ticket sourcing ${ticket.id}`,
      items: [
        {
          description: ticket.description,
          quantity,
          unitPrice,
          currency: ticket.currency || "RMB",
          weight: ticket.estimatedWeight != null ? Number(ticket.estimatedWeight) : undefined,
        },
      ],
    });

    await prisma.sourcingTicket.update({
      where: { id: ticket.id },
      data: {
        orderId: createdOrder.id,
        status: "ORDERED",
        convertedAt: new Date(),
      },
    });

    if (ticket.demandId) {
      await prisma.demandIntake.update({
        where: { id: ticket.demandId },
        data: {
          status: "CONVERTED",
          convertedAt: new Date(),
          orderId: createdOrder.id,
        },
      });
    }

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "sourcing_ticket.converted_to_order",
      entityType: "sourcing_ticket",
      entityId: ticket.id,
      newValue: { orderId: createdOrder.id },
    });

    revalidatePath("/sourcing/tickets");
    revalidatePath(`/orders/${createdOrder.id}`);

    return { data: { orderId: createdOrder.id, orderNumber: createdOrder.orderNumber } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur conversion ticket -> commande" };
  }
}
