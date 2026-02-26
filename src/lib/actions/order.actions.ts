"use server";

import { getSession } from "@/lib/session";
import { OrderService } from "@/lib/services/order.service";
import { AuditService } from "@/lib/services/audit.service";
import { NotificationService } from "@/lib/services/notification.service";
import { checkPermission } from "@/lib/permissions";
import { createOrderSchema, updateOrderStatusSchema, createQuoteSchema, updateOrderSchema } from "@/lib/validators/order";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import type { OrderStatus } from "@prisma/client";

const uniqueIds = (ids: Array<string | null | undefined>) =>
  Array.from(new Set(ids.filter((id): id is string => Boolean(id))));

async function getOrderTeamUserIds(orderId: string): Promise<string[]> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      ownerId: true,
      onboardedById: true,
      collaborators: { select: { userId: true } },
      tenantId: true,
    },
  });
  if (!order) return [];
  return uniqueIds([
    order.ownerId,
    order.onboardedById,
    ...order.collaborators.map((c) => c.userId),
  ]);
}

export async function createOrder(formData: {
  contactId: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    currency?: string;
    hsCode?: string;
    weight?: number;
    volume?: number;
    notes?: string;
  }>;
  priority?: string;
  destinationCity?: string;
  notes?: string;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.create");

    const validated = createOrderSchema.parse(formData);
    const contact = await prisma.contact.findUnique({
      where: { id: validated.contactId },
      select: { id: true, tenantId: true },
    });
    if (!contact || contact.tenantId !== user.tenantId) {
      return { error: "Contact introuvable" };
    }
    const order = await OrderService.create(user.tenantId, {
      ...validated,
      ownerId: user.id,
      onboardedById: user.id,
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "order.created",
      entityType: "order",
      entityId: order.id,
      newValue: { orderNumber: order.orderNumber },
    });

    const teamIds = await getOrderTeamUserIds(order.id);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "ORDER_CREATED",
      title: `Nouvelle commande ${order.orderNumber}`,
      message: `${user.name || user.email} a créé une commande`,
      entityType: "order",
      entityId: order.id,
    });

    revalidatePath("/orders");
    revalidatePath("/dashboard");
    revalidatePath("/tasks");

    return { data: order };
  } catch (error) {
    console.error("Error creating order:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la création de la commande" };
  }
}

export async function getOrders(options?: {
  status?: string;
  page?: number;
  limit?: number;
  search?: string;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.view");

    const result = await OrderService.list(user.tenantId, {
      status: options?.status as OrderStatus | undefined,
      page: options?.page,
      limit: options?.limit,
      search: options?.search,
    });

    return {
      data: result.orders,
      total: result.total,
      totalPages: result.totalPages,
      page: result.page,
      limit: result.limit,
    };
  } catch (error) {
    console.error("Error fetching orders:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la récupération des commandes" };
  }
}

export async function getOrderById(orderId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.view");
    const order = await OrderService.getById(orderId);

    if (!order || order.tenantId !== user.tenantId) {
      return { error: "Commande introuvable" };
    }

    return { data: order };
  } catch (error) {
    console.error("Error fetching order:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la récupération de la commande" };
  }
}

export async function updateOrderStatus(orderId: string, newStatus: string, note?: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.update_status");

    // Verify order belongs to tenant before update
    const existing = await OrderService.getById(orderId);
    if (!existing || existing.tenantId !== user.tenantId) {
      return { error: "Commande introuvable" };
    }

    const validated = updateOrderStatusSchema.parse({ orderId, newStatus, note });

    const order = await OrderService.updateStatus(
      validated.orderId,
      validated.newStatus as OrderStatus,
      user.id,
      validated.note
    );

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "order.status_changed",
      entityType: "order",
      entityId: validated.orderId,
      oldValue: { status: existing.status },
      newValue: { status: validated.newStatus },
    });

    
    const teamIds = await getOrderTeamUserIds(validated.orderId);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "QUOTE_CREATED",
      title: "Nouveau devis",
      message: `${user.name || user.email} a cr�� un devis`,
      entityType: "quote",
      entityId: quote.id,
    });


    revalidatePath(`/orders/${validated.orderId}`);
    revalidatePath("/orders");
    revalidatePath("/dashboard");
    revalidatePath("/tasks");

    return { data: order };
  } catch (error) {
    console.error("Error updating order status:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la mise à jour du statut" };
  }
}

export async function updateOrder(orderId: string, formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.update");

    const existing = await OrderService.getById(orderId);
    if (!existing || existing.tenantId !== user.tenantId) {
      return { error: "Commande introuvable" };
    }

    const validated = updateOrderSchema.parse({ orderId, ...formData });
    if (validated.contactId) {
      const contact = await prisma.contact.findUnique({
        where: { id: validated.contactId },
        select: { id: true, tenantId: true },
      });
      if (!contact || contact.tenantId !== user.tenantId) {
        return { error: "Contact introuvable" };
      }
    }

    const order = await OrderService.update(orderId, validated);

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "order.updated",
      entityType: "order",
      entityId: orderId,
      newValue: validated,
    });

    const teamIds = await getOrderTeamUserIds(orderId);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "ORDER_UPDATED",
      title: `Commande mise à jour`,
      message: `${user.name || user.email} a mis à jour la commande`,
      entityType: "order",
      entityId: orderId,
    });

    revalidatePath(`/orders/${orderId}`);
    revalidatePath("/orders");
    return { data: order };
  } catch (error) {
    console.error("Error updating order:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la mise Ã  jour" };
  }
}

export async function duplicateOrder(orderId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.create");

    const existing = await OrderService.getById(orderId);
    if (!existing || existing.tenantId !== user.tenantId) {
      return { error: "Commande introuvable" };
    }

    const order = await OrderService.duplicate(orderId);

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "order.duplicated",
      entityType: "order",
      entityId: order.id,
      newValue: { from: orderId, orderNumber: order.orderNumber },
    });

    revalidatePath("/orders");
    return { data: order };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la duplication" };
  }
}

export async function archiveOrder(orderId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.delete");

    const existing = await OrderService.getById(orderId);
    if (!existing || existing.tenantId !== user.tenantId) {
      return { error: "Commande introuvable" };
    }

    const order = await OrderService.archive(orderId);

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "order.archived",
      entityType: "order",
      entityId: orderId,
    });

    revalidatePath("/orders");
    return { data: order };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de l'archivage" };
  }
}

export async function updateOrderTeam(orderId: string, data: { ownerId?: string | null; collaboratorIds?: string[] }) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.update");

    const existing = await OrderService.getById(orderId);
    if (!existing || existing.tenantId !== user.tenantId) {
      return { error: "Commande introuvable" };
    }

    const collaboratorIds = data.collaboratorIds ?? [];
    const ownerId = data.ownerId ?? null;

    const order = await OrderService.update(orderId, {
      ownerId,
      collaboratorIds,
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "order.team_updated",
      entityType: "order",
      entityId: orderId,
      newValue: { ownerId, collaboratorIds },
    });

    const teamIds = uniqueIds([ownerId, ...collaboratorIds, user.id]);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "ORDER_TEAM_UPDATED",
      title: `Equipe commande mise à jour`,
      message: `${user.name || user.email} a modifié l'équipe de la commande`,
      entityType: "order",
      entityId: orderId,
    });

    revalidatePath(`/orders/${orderId}`);
    return { data: order };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la mise à jour de l'équipe" };
  }
}

export async function getOrderStatusCounts() {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.view");
    return { data: await OrderService.getStatusCounts(user.tenantId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la récupération des compteurs" };
  }
}

export async function createQuote(data: {
  orderId: string;
  merchandiseTotal: number;
  logisticsCost: number;
  commission: number;
  insuranceCost?: number;
  currency?: string;
  validUntil?: string;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "quote.create");

    // Verify order belongs to tenant
    const order = await OrderService.getById(data.orderId);
    if (!order || order.tenantId !== user.tenantId) {
      return { error: "Commande introuvable" };
    }

    const validated = createQuoteSchema.parse(data);
    const { prisma } = await import("@/lib/db");

    const latestQuote = await prisma.quote.findFirst({
      where: { orderId: validated.orderId },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const quote = await prisma.quote.create({
      data: {
        orderId: validated.orderId,
        version: (latestQuote?.version || 0) + 1,
        merchandiseTotal: validated.merchandiseTotal,
        logisticsCost: validated.logisticsCost,
        commission: validated.commission,
        insuranceCost: validated.insuranceCost || 0,
        total:
          validated.merchandiseTotal +
          validated.logisticsCost +
          validated.commission +
          (validated.insuranceCost || 0),
        currency: validated.currency || "XAF",
        validUntil: validated.validUntil
          ? new Date(validated.validUntil)
          : undefined,
      },
    });

    
    const teamIds = await getOrderTeamUserIds(validated.orderId);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "QUOTE_CREATED",
      title: "Nouveau devis",
      message: `${user.name || user.email} a cr�� un devis`,
      entityType: "quote",
      entityId: quote.id,
    });


    revalidatePath(`/orders/${validated.orderId}`);
    return { data: quote };
  } catch (error) {
    console.error("Error creating quote:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la création du devis" };
  }
}


async function updateQuoteStatusInternal(quoteId: string, status: "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED") {
  return prisma.quote.update({
    where: { id: quoteId },
    data: {
      status,
      ...(status === "SENT" && { sentAt: new Date() }),
      ...(status === "ACCEPTED" && { acceptedAt: new Date() }),
    },
  });
}

export async function sendQuote(quoteId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "quote.send");

    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: { order: { select: { id: true, tenantId: true } } },
    });
    if (!quote || quote.order.tenantId !== user.tenantId) {
      return { error: "Devis introuvable" };
    }

    const updated = await updateQuoteStatusInternal(quoteId, "SENT");

    const teamIds = await getOrderTeamUserIds(quote.order.id);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "QUOTE_SENT",
      title: "Devis envoy�",
      message: `${user.name || user.email} a envoy� un devis`,
      entityType: "quote",
      entityId: quoteId,
    });

    revalidatePath(`/orders/${quote.order.id}`);
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur envoi devis" };
  }
}

export async function acceptQuote(quoteId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "quote.send");

    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: { order: { select: { id: true, tenantId: true } } },
    });
    if (!quote || quote.order.tenantId !== user.tenantId) {
      return { error: "Devis introuvable" };
    }

    const updated = await updateQuoteStatusInternal(quoteId, "ACCEPTED");

    const teamIds = await getOrderTeamUserIds(quote.order.id);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "QUOTE_ACCEPTED",
      title: "Devis accept�",
      message: `${user.name || user.email} a accept� un devis`,
      entityType: "quote",
      entityId: quoteId,
    });

    revalidatePath(`/orders/${quote.order.id}`);
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur acceptation devis" };
  }
}

export async function rejectQuote(quoteId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "quote.send");

    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: { order: { select: { id: true, tenantId: true } } },
    });
    if (!quote || quote.order.tenantId !== user.tenantId) {
      return { error: "Devis introuvable" };
    }

    const updated = await updateQuoteStatusInternal(quoteId, "REJECTED");

    const teamIds = await getOrderTeamUserIds(quote.order.id);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "QUOTE_REJECTED",
      title: "Devis refus�",
      message: `${user.name || user.email} a refus� un devis`,
      entityType: "quote",
      entityId: quoteId,
    });

    revalidatePath(`/orders/${quote.order.id}`);
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur rejet devis" };
  }
}

export async function expireQuote(quoteId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "quote.send");

    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: { order: { select: { id: true, tenantId: true } } },
    });
    if (!quote || quote.order.tenantId !== user.tenantId) {
      return { error: "Devis introuvable" };
    }

    const updated = await updateQuoteStatusInternal(quoteId, "EXPIRED");

    const teamIds = await getOrderTeamUserIds(quote.order.id);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "QUOTE_EXPIRED",
      title: "Devis expir�",
      message: `${user.name || user.email} a expir� un devis`,
      entityType: "quote",
      entityId: quoteId,
    });

    revalidatePath(`/orders/${quote.order.id}`);
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur expiration devis" };
  }
}

export async function addOrderAttachment(orderId: string, data: { name: string; url: string; type?: string }) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.update");

    const order = await OrderService.getById(orderId);
    if (!order || order.tenantId !== user.tenantId) return { error: "Commande introuvable" };

    const attachment = await prisma.orderAttachment.create({
      data: {
        orderId,
        userId: user.id,
        name: data.name.trim(),
        url: data.url.trim(),
        type: data.type ?? "link",
      },
      include: { user: { select: { name: true } } },
    });

    const teamIds = await getOrderTeamUserIds(orderId);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "ATTACHMENT_ADDED",
      title: "Document ajout�",
      message: `${user.name || user.email} a ajout� un document`,
      entityType: "order",
      entityId: orderId,
    });

    revalidatePath(`/orders/${orderId}`);
    return { data: attachment };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur ajout document" };
  }
}

export async function removeOrderAttachment(attachmentId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.update");

    const attachment = await prisma.orderAttachment.findUnique({
      where: { id: attachmentId },
      include: { order: { select: { id: true, tenantId: true } } },
    });
    if (!attachment || attachment.order.tenantId !== user.tenantId) {
      return { error: "Document introuvable" };
    }

    await prisma.orderAttachment.delete({ where: { id: attachmentId } });
    revalidatePath(`/orders/${attachment.order.id}`);
    return { data: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur suppression document" };
  }
}

export async function createShipment(orderId: string, data: {
  mode: string;
  origin?: string;
  destination?: string;
  containerNumber?: string;
  blNumber?: string;
  estimatedDeparture?: string;
  estimatedArrival?: string;
  cost?: number;
  currency?: string;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.manage");

    const order = await OrderService.getById(orderId);
    if (!order || order.tenantId !== user.tenantId) return { error: "Commande introuvable" };

    const shipment = await prisma.shipment.create({
      data: {
        orderId,
        mode: data.mode as any,
        origin: data.origin || "Guangzhou",
        destination: data.destination || "Pointe-Noire",
        containerNumber: data.containerNumber,
        blNumber: data.blNumber,
        estimatedDeparture: data.estimatedDeparture ? new Date(data.estimatedDeparture) : undefined,
        estimatedArrival: data.estimatedArrival ? new Date(data.estimatedArrival) : undefined,
        cost: data.cost ?? undefined,
        currency: data.currency || "USD",
      },
    });

    const teamIds = await getOrderTeamUserIds(orderId);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "SHIPMENT_CREATED",
      title: "Exp�dition cr��e",
      message: `Nouvelle exp�dition pour commande ${order.orderNumber}`,
      entityType: "shipment",
      entityId: shipment.id,
    });

    revalidatePath(`/orders/${orderId}`);
    return { data: shipment };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur cr�ation exp�dition" };
  }
}

export async function updateShipmentStatus(shipmentId: string, status: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.manage");

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { order: { select: { id: true, tenantId: true } } },
    });
    if (!shipment || shipment.order.tenantId !== user.tenantId) {
      return { error: "Exp�dition introuvable" };
    }

    const updated = await prisma.shipment.update({
      where: { id: shipmentId },
      data: { status: status as any },
    });

    const teamIds = await getOrderTeamUserIds(shipment.order.id);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "SHIPMENT_UPDATED",
      title: "Exp�dition mise � jour",
      message: `Statut exp�dition: ${status}`,
      entityType: "shipment",
      entityId: shipmentId,
    });

    revalidatePath(`/orders/${shipment.order.id}`);
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur mise � jour exp�dition" };
  }
}

export async function addTrackingEvent(shipmentId: string, data: { event: string; location?: string; description?: string; occurredAt: string }) {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.manage");

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { order: { select: { id: true, tenantId: true } } },
    });
    if (!shipment || shipment.order.tenantId !== user.tenantId) {
      return { error: "Exp�dition introuvable" };
    }

    const event = await prisma.trackingEvent.create({
      data: {
        shipmentId,
        event: data.event,
        location: data.location,
        description: data.description,
        occurredAt: new Date(data.occurredAt),
      },
    });

    revalidatePath(`/orders/${shipment.order.id}`);
    return { data: event };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur tracking" };
  }
}

export async function createQcRequest(orderId: string, data: { type: string; inspector?: string; cost?: number; currency?: string; scheduledAt?: string }) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.manage");

    const order = await OrderService.getById(orderId);
    if (!order || order.tenantId !== user.tenantId) return { error: "Commande introuvable" };

    const request = await prisma.qCRequest.create({
      data: {
        orderId,
        type: data.type as any,
        inspector: data.inspector,
        cost: data.cost ?? undefined,
        currency: data.currency || "USD",
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      },
    });

    const teamIds = await getOrderTeamUserIds(orderId);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "QC_REQUEST_CREATED",
      title: "QC cr��e",
      message: `Nouvelle demande QC pour commande ${order.orderNumber}`,
      entityType: "qc_request",
      entityId: request.id,
    });

    revalidatePath(`/orders/${orderId}`);
    return { data: request };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur cr�ation QC" };
  }
}

export async function updateQcRequestStatus(requestId: string, status: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.manage");

    const request = await prisma.qCRequest.findUnique({
      where: { id: requestId },
      include: { order: { select: { id: true, tenantId: true } } },
    });
    if (!request || request.order.tenantId !== user.tenantId) return { error: "QC introuvable" };

    const updated = await prisma.qCRequest.update({
      where: { id: requestId },
      data: { status: status as any, ...(status === "COMPLETED" && { completedAt: new Date() }) },
    });

    revalidatePath(`/orders/${request.order.id}`);
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur statut QC" };
  }
}

export async function addQcReport(requestId: string, data: { overallResult: string; defectRate?: number; recommendation?: string; photos?: string[] }) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.manage");

    const request = await prisma.qCRequest.findUnique({
      where: { id: requestId },
      include: { order: { select: { id: true, tenantId: true } } },
    });
    if (!request || request.order.tenantId !== user.tenantId) return { error: "QC introuvable" };

    const report = await prisma.qCReport.create({
      data: {
        qcRequestId: requestId,
        overallResult: data.overallResult,
        defectRate: data.defectRate ?? undefined,
        recommendation: data.recommendation,
        photos: data.photos ?? [],
      },
    });

    await prisma.qCRequest.update({
      where: { id: requestId },
      data: { status: data.overallResult === "PASS" ? "PASSED" : "FAILED", completedAt: new Date() },
    });

    const teamIds = await getOrderTeamUserIds(request.order.id);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "QC_REPORT_ADDED",
      title: "Rapport QC",
      message: `Rapport QC ajout� pour commande ${request.order.id}`,
      entityType: "qc_report",
      entityId: report.id,
    });

    revalidatePath(`/orders/${request.order.id}`);
    return { data: report };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur rapport QC" };
  }
}

export async function createDispute(orderId: string, data: { type: string; description: string; amount?: number; currency?: string }) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.update_status");

    const order = await OrderService.getById(orderId);
    if (!order || order.tenantId !== user.tenantId) return { error: "Commande introuvable" };

    const dispute = await prisma.dispute.create({
      data: {
        orderId,
        type: data.type as any,
        description: data.description,
        amount: data.amount ?? undefined,
        currency: data.currency || "XAF",
      },
    });

    const teamIds = await getOrderTeamUserIds(orderId);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "DISPUTE_CREATED",
      title: "Nouveau litige",
      message: `Litige ouvert pour commande ${order.orderNumber}`,
      entityType: "dispute",
      entityId: dispute.id,
    });

    revalidatePath(`/orders/${orderId}`);
    return { data: dispute };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur cr�ation litige" };
  }
}

export async function resolveDispute(disputeId: string, resolution: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.update_status");

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { order: { select: { id: true, tenantId: true, orderNumber: true } } },
    });
    if (!dispute || dispute.order.tenantId !== user.tenantId) return { error: "Litige introuvable" };

    const updated = await prisma.dispute.update({
      where: { id: disputeId },
      data: { status: "RESOLVED", resolution, resolvedAt: new Date() },
    });

    const teamIds = await getOrderTeamUserIds(dispute.order.id);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "DISPUTE_RESOLVED",
      title: "Litige r�solu",
      message: `Litige r�solu pour commande ${dispute.order.orderNumber}`,
      entityType: "dispute",
      entityId: disputeId,
    });

    revalidatePath(`/orders/${dispute.order.id}`);
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur r�solution litige" };
  }
}

export async function exportOrdersCSV() {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.view");

    const orders = await prisma.order.findMany({
      where: { tenantId: user.tenantId, archivedAt: null },
      include: { contact: true },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    const headers = "ID,Num�ro,Statut,Priorit�,Client,Montant,XAF,Cr��e le";
    const rows = orders.map((o) =>
      [
        o.id,
        o.orderNumber,
        o.status,
        o.priority,
        `"${(o.contact?.name || "").replace(/"/g, '""')}"`,
        Number(o.totalClient),
        o.currency,
        o.createdAt.toISOString(),
      ].join(",")
    );

    return { data: [headers, ...rows].join("\n") };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur export" };
  }
}
