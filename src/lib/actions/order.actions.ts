"use server";

import { getSession } from "@/lib/session";
import { OrderService } from "@/lib/services/order.service";
import { AuditService } from "@/lib/services/audit.service";
import { NotificationService } from "@/lib/services/notification.service";
import { WhatsAppNotificationChannel } from "@/lib/services/notification-channels.service";
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

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

function escapePdfText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildSimplePdf(lines: string[]): Buffer {
  const header = "%PDF-1.4\n";
  const contentLines = [
    "BT",
    "/F1 12 Tf",
    "72 760 Td",
    ...lines.map((line, index) => (index === 0
      ? `(${escapePdfText(line)}) Tj`
      : `0 -16 Td (${escapePdfText(line)}) Tj`
    )),
    "ET",
  ];
  const contentStream = contentLines.join("\n") + "\n";
  const objects: string[] = [];
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  objects.push("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n");
  objects.push(`4 0 obj\n<< /Length ${Buffer.byteLength(contentStream, "utf8")} >>\nstream\n${contentStream}endstream\nendobj\n`);
  objects.push("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

  let offset = Buffer.byteLength(header, "utf8");
  const xrefOffsets = [0];
  for (const obj of objects) {
    xrefOffsets.push(offset);
    offset += Buffer.byteLength(obj, "utf8");
  }

  const xrefStart = offset;
  const xrefLines = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...xrefOffsets.slice(1).map((o) => `${String(o).padStart(10, "0")} 00000 n `),
  ];
  const trailer = [
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefStart),
    "%%EOF",
  ];

  const pdf = header + objects.join("") + xrefLines.join("\n") + "\n" + trailer.join("\n");
  return Buffer.from(pdf, "utf8");
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
      message: `${user.name || user.email} a cree une commande`,
      entityType: "order",
      entityId: order.id,
    });

    revalidatePath("/orders");
    revalidatePath("/dashboard");
    revalidatePath("/tasks");

    return { data: order };
  } catch (error) {
    console.error("Error creating order:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la crÃ©ation de la commande" };
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
    return { error: error instanceof Error ? error.message : "Erreur lors de la rÃ©cupÃ©ration des commandes" };
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
    return { error: error instanceof Error ? error.message : "Erreur lors de la rÃ©cupÃ©ration de la commande" };
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
      type: "ORDER_UPDATED",
      title: "Statut commande mis a jour",
      message: `${user.name || user.email} a change le statut en ${validated.newStatus}`,
      entityType: "order",
      entityId: validated.orderId,
    });

    revalidatePath(`/orders/${validated.orderId}`);
    revalidatePath("/orders");
    revalidatePath("/dashboard");
    revalidatePath("/tasks");

    return { data: order };
  } catch (error) {
    console.error("Error updating order status:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la mise a jour du statut" };
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
      title: `Commande mise Ã  jour`,
      message: `${user.name || user.email} a mis Ã  jour la commande`,
      entityType: "order",
      entityId: orderId,
    });

    revalidatePath(`/orders/${orderId}`);
    revalidatePath("/orders");
    return { data: order };
  } catch (error) {
    console.error("Error updating order:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la mise ÃƒÂ  jour" };
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
      title: `Equipe commande mise Ã  jour`,
      message: `${user.name || user.email} a modifiÃ© l'Ã©quipe de la commande`,
      entityType: "order",
      entityId: orderId,
    });

    revalidatePath(`/orders/${orderId}`);
    return { data: order };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la mise Ã  jour de l'Ã©quipe" };
  }
}

export async function getOrderStatusCounts() {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.view");
    return { data: await OrderService.getStatusCounts(user.tenantId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la rÃ©cupÃ©ration des compteurs" };
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

    const order = await OrderService.getById(data.orderId);
    if (!order || order.tenantId !== user.tenantId) {
      return { error: "Commande introuvable" };
    }

    const validated = createQuoteSchema.parse(data);

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
        validUntil: validated.validUntil ? new Date(validated.validUntil) : undefined,
      },
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "quote.created",
      entityType: "quote",
      entityId: quote.id,
      newValue: { orderId: validated.orderId, total: Number(quote.total) },
    });

    const teamIds = await getOrderTeamUserIds(validated.orderId);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "QUOTE_CREATED",
      title: "Nouveau devis",
      message: `${user.name || user.email} a cree un devis`,
      entityType: "quote",
      entityId: quote.id,
    });

    revalidatePath(`/orders/${validated.orderId}`);
    return { data: quote };
  } catch (error) {
    console.error("Error creating quote:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la creation du devis" };
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
      include: {
        order: {
          select: {
            id: true,
            tenantId: true,
            orderNumber: true,
            contact: { select: { name: true, phone: true, whatsapp: true } },
          },
        },
      },
    });
    if (!quote || quote.order.tenantId !== user.tenantId) {
      return { error: "Devis introuvable" };
    }

    const updated = await updateQuoteStatusInternal(quoteId, "SENT");

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "quote.sent",
      entityType: "quote",
      entityId: quoteId,
      newValue: { orderId: quote.order.id },
    });

    const teamIds = await getOrderTeamUserIds(quote.order.id);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "QUOTE_SENT",
      title: "Devis envoye",
      message: `${user.name || user.email} a envoye un devis`,
      entityType: "quote",
      entityId: quoteId,
    });

    const recipient = quote.order.contact.whatsapp || quote.order.contact.phone;
    if (recipient) {
      const total = formatMoney(Number(quote.total), quote.currency);
      const merch = formatMoney(Number(quote.merchandiseTotal), quote.currency);
      const logistics = formatMoney(Number(quote.logisticsCost), quote.currency);
      const commission = formatMoney(Number(quote.commission), quote.currency);
      const insurance = Number(quote.insuranceCost) > 0
        ? formatMoney(Number(quote.insuranceCost), quote.currency)
        : null;
      const validUntil = quote.validUntil
        ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(quote.validUntil)
        : "Non specifie";

      const messageLines = [
        `Bonjour ${quote.order.contact.name || ""}`.trim(),
        `Votre devis ${quote.order.orderNumber} est disponible.`,
        `Total: ${total}`,
        `Marchandise: ${merch}`,
        `Logistique: ${logistics}`,
        `Commission: ${commission}`,
        insurance ? `Assurance: ${insurance}` : null,
        `Validite: ${validUntil}`,
        "Merci de confirmer pour lancer la suite.",
      ].filter(Boolean) as string[];

      await WhatsAppNotificationChannel.send({
        to: recipient,
        type: "QUOTE_SENT",
        title: `Devis ${quote.order.orderNumber}`,
        message: messageLines.join("\n"),
      });
    }

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

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "quote.accepted",
      entityType: "quote",
      entityId: quoteId,
      newValue: { orderId: quote.order.id },
    });

    const teamIds = await getOrderTeamUserIds(quote.order.id);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "QUOTE_ACCEPTED",
      title: "Devis accepte",
      message: `${user.name || user.email} a accepte un devis`,
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

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "quote.rejected",
      entityType: "quote",
      entityId: quoteId,
      newValue: { orderId: quote.order.id },
    });

    const teamIds = await getOrderTeamUserIds(quote.order.id);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "QUOTE_REJECTED",
      title: "Devis refuse",
      message: `${user.name || user.email} a refuse un devis`,
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
      title: "Devis expire",
      message: `${user.name || user.email} a expire un devis`,
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
      title: "Document ajoute",
      message: `${user.name || user.email} a ajoute un document`,
      entityType: "order",
      entityId: orderId,
    });

    revalidatePath(`/orders/${orderId}`);
    return { data: attachment };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur ajout document" };
  }
}

export async function exportQuotePDF(quoteId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.view");

    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        order: {
          include: { contact: true },
        },
      },
    });
    if (!quote || quote.order.tenantId !== user.tenantId) {
      return { error: "Devis introuvable" };
    }

    const lines = [
      `Devis ${quote.order.orderNumber}`,
      `Client: ${quote.order.contact.name}`,
      `Date: ${new Date(quote.createdAt).toLocaleDateString("fr-FR")}`,
      `Statut: ${quote.status}`,
      `Total: ${formatMoney(Number(quote.total), quote.currency)}`,
      `Marchandise: ${formatMoney(Number(quote.merchandiseTotal), quote.currency)}`,
      `Logistique: ${formatMoney(Number(quote.logisticsCost), quote.currency)}`,
      `Commission: ${formatMoney(Number(quote.commission), quote.currency)}`,
      Number(quote.insuranceCost) > 0 ? `Assurance: ${formatMoney(Number(quote.insuranceCost), quote.currency)}` : "",
      quote.validUntil ? `Validite: ${quote.validUntil.toLocaleDateString("fr-FR")}` : "",
      "",
      "Horion ERP - Devis (placeholder)",
    ].filter(Boolean);

    const pdfBuffer = buildSimplePdf(lines);
    return { data: pdfBuffer.toString("base64"), filename: `devis-${quote.order.orderNumber}.pdf` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur export PDF" };
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
      title: "Expedition creee",
      message: `Nouvelle expedition pour commande ${order.orderNumber}`,
      entityType: "shipment",
      entityId: shipment.id,
    });

    revalidatePath(`/orders/${orderId}`);
    return { data: shipment };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur creation expedition" };
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
      return { error: "Expedition introuvable" };
    }

    const updated = await prisma.shipment.update({
      where: { id: shipmentId },
      data: { status: status as any },
    });

    const teamIds = await getOrderTeamUserIds(shipment.order.id);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "SHIPMENT_UPDATED",
      title: "Expedition mise a jour",
      message: `Statut expedition: ${status}`,
      entityType: "shipment",
      entityId: shipmentId,
    });

    revalidatePath(`/orders/${shipment.order.id}`);
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur mise a jour expedition" };
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
      return { error: "Expedition introuvable" };
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
      title: "QC creee",
      message: `Nouvelle demande QC pour commande ${order.orderNumber}`,
      entityType: "qc_request",
      entityId: request.id,
    });

    revalidatePath(`/orders/${orderId}`);
    return { data: request };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur creation QC" };
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
      message: `Rapport QC ajoute pour commande ${request.order.id}`,
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
    return { error: error instanceof Error ? error.message : "Erreur crï¿½ation litige" };
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
      title: "Litige resolu",
      message: `Litige resolu pour commande ${dispute.order.orderNumber}`,
      entityType: "dispute",
      entityId: disputeId,
    });

    revalidatePath(`/orders/${dispute.order.id}`);
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur resolution litige" };
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

    const headers = "ID,Numero,Statut,Priorite,Client,Montant,XAF,Creee le";
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

export async function exportOrdersPDF() {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.view");

    const orders = await prisma.order.findMany({
      where: { tenantId: user.tenantId, archivedAt: null },
      include: { contact: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const lines = [
      "Export commandes",
      `Total: ${orders.length}`,
      "",
      ...orders.flatMap((o) => ([
        `${o.orderNumber} | ${o.contact?.name || "Client"} | ${o.status} | ${formatMoney(Number(o.totalClient), o.currency)}`,
      ])),
      "",
      "Horion ERP - Export (placeholder)",
    ];

    const pdfBuffer = buildSimplePdf(lines);
    return { data: pdfBuffer.toString("base64"), filename: `orders-${new Date().toISOString().slice(0, 10)}.pdf` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur export PDF" };
  }
}










