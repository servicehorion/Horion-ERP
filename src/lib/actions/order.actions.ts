"use server";

import { getSession } from "@/lib/session";
import { OrderService } from "@/lib/services/order.service";
import { AuditService } from "@/lib/services/audit.service";
import { NotificationService } from "@/lib/services/notification.service";
import { EmailNotificationChannel, WhatsAppNotificationChannel } from "@/lib/services/notification-channels.service";
import { checkPermission } from "@/lib/permissions";
import { createOrderSchema, updateOrderStatusSchema, createQuoteSchema, updateOrderSchema } from "@/lib/validators/order";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { Prisma, type OrderStatus } from "@prisma/client";
import * as orderLogisticsActions from "./order-logistics.actions";
import { randomUUID } from "crypto";
import { renderQuotePdf, type QuotePdfItem } from "@/lib/pdf/quote-pdf";
import { applyIndicatifTransportSelection } from "@/lib/quotes/indicatif-pricing";
import { emitEvent } from "@/lib/events";
import { serializeDecimals, toPlainData } from "@/lib/utils";
import {
  attachQuoteToRelatedDemands,
  canRoleApproveQuote,
  cancelQuoteWorkflowTasks,
  createQuoteVersion,
  ensureQuoteApprovalTask,
  ensureQuoteIsActive,
  getQuoteApprovalGateLabel,
  getQuoteApprovalPolicy,
  resolveQuoteCreationApproval,
  syncDemandStatusForQuote,
} from "@/lib/quotes/workflow";

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

function normalizeEmail(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

function getRequestIpFromHeaders(headerStore: Headers) {
  return (
    headerStore.get("x-real-ip")?.trim() ||
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null
  );
}

function buildPublicPaymentUrl(paymentToken: string) {
  const siteBaseUrl =
    process.env.PUBLIC_QUOTE_SITE_BASE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000/pay";
  const normalizedBaseUrl = siteBaseUrl.replace(/\/+$/, "");
  return normalizedBaseUrl.endsWith("/pay")
    ? `${normalizedBaseUrl}/${paymentToken}`
    : `${normalizedBaseUrl}/pay/${paymentToken}`;
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

    return { data: toPlainData(order) };
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
  } catch (error) {    return { error: error instanceof Error ? error.message : "Erreur lors de la rÃ©cupÃ©ration des commandes" };
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

export async function restoreOrder(orderId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.delete");

    const existing = await OrderService.getById(orderId);
    if (!existing || existing.tenantId !== user.tenantId) {
      return { error: "Commande introuvable" };
    }

    const order = await OrderService.restore(orderId);

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "order.restored",
      entityType: "order",
      entityId: orderId,
    });

    revalidatePath("/orders");
    revalidatePath(`/orders/${orderId}`);
    return { data: serializeDecimals(order) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur restauration commande" };
  }
}

export async function deleteOrder(orderId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.delete");

    const existing = await OrderService.getById(orderId);
    if (!existing || existing.tenantId !== user.tenantId) {
      return { error: "Commande introuvable" };
    }

    await OrderService.deleteOrder(orderId);

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "order.deleted",
      entityType: "order",
      entityId: orderId,
      oldValue: { orderNumber: existing.orderNumber },
    });

    revalidatePath("/orders");
    return { data: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur suppression commande" };
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
    const quoteTotal =
      validated.merchandiseTotal +
      validated.logisticsCost +
      validated.commission +
      (validated.insuranceCost || 0);
    const approval = await resolveQuoteCreationApproval({
      tenantId: user.tenantId,
      totalXaf: quoteTotal,
      creatorRole: user.role,
      creatorId: user.id,
    });

      const createNextVersion = async () =>
        prisma.$transaction(async (tx) => {
          return createQuoteVersion(tx, {
            orderId: validated.orderId,
            ...approval.autoApprovalData,
            merchandiseTotal: validated.merchandiseTotal,
            logisticsCost: validated.logisticsCost,
            commission: validated.commission,
            insuranceCost: validated.insuranceCost || 0,
            total: quoteTotal,
            currency: validated.currency || "XAF",
            validUntil: validated.validUntil ? new Date(validated.validUntil) : undefined,
          });
        });

    let quote;
    try {
      quote = await createNextVersion();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        quote = await createNextVersion();
      } else {
        throw error;
      }
    }

      await attachQuoteToRelatedDemands({ quoteId: quote.id, orderId: validated.orderId });
      await cancelQuoteWorkflowTasks({
        orderId: validated.orderId,
        includePaymentTasks: true,
        excludingQuoteId: quote.id,
      });

      if (!approval.creatorCanApprove) {
        await ensureQuoteApprovalTask({
          tenantId: user.tenantId,
          orderId: validated.orderId,
          quoteId: quote.id,
          orderNumber: order.orderNumber,
          totalXaf: Number(quote.total),
          customerName: order.contact?.name ?? null,
        });
      }

    await syncDemandStatusForQuote(quote.id);

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
      message: approval.creatorCanApprove
        ? `${user.name || user.email} a cree et valide un devis`
        : `${user.name || user.email} a cree un devis en attente de validation interne`,
      entityType: "quote",
      entityId: quote.id,
    });

    revalidatePath(`/orders/${validated.orderId}`);
    revalidatePath("/quotes");
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    return { data: toPlainData(quote) };
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
      ...(status === "REJECTED" || status === "EXPIRED"
        ? {
            paymentToken: null,
            paymentExpiry: null,
            paymentStatus: "PENDING",
            paymentMethod: null,
            paidAt: null,
          }
        : {}),
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
        approvedBy: { select: { role: true } },
      },
      });
      if (!quote || quote.order.tenantId !== user.tenantId) {
        return { error: "Devis introuvable" };
      }
      await ensureQuoteIsActive({ quoteId, orderId: quote.order.id, isActive: quote.isActive });

      const policy = await getQuoteApprovalPolicy(user.tenantId, Number(quote.total));
    if (
      quote.approvalStatus !== "APPROVED" ||
      !quote.approvedBy ||
      !canRoleApproveQuote(quote.approvedBy.role, policy)
    ) {
      return {
        error: `Ce devis doit être validé par ${getQuoteApprovalGateLabel(policy.requiredGate)} avant envoi.`,
      };
    }

    let signatureToken = quote.signatureToken;
    if (!signatureToken) {
      signatureToken = randomUUID();
    }

    const updated = await prisma.quote.update({
      where: { id: quoteId },
      data: {
        status: "SENT",
        sentAt: new Date(),
        signatureToken,
      },
    });

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

    await prisma.task.updateMany({
      where: {
        entityType: "order",
        entityId: quote.order.id,
        taskType: "send_quote",
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    await syncDemandStatusForQuote(quoteId);

    revalidatePath(`/orders/${quote.order.id}`);
    revalidatePath("/quotes");
    revalidatePath("/dashboard");
    return { data: toPlainData(updated) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur envoi devis" };
  }
}

export async function approveQuote(quoteId: string, note?: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "quote.approve");

      const quote = await prisma.quote.findUnique({
        where: { id: quoteId },
        include: {
          order: { select: { id: true, tenantId: true } },
        },
      });
      if (!quote || quote.order.tenantId !== user.tenantId) {
        return { error: "Devis introuvable" };
      }
      await ensureQuoteIsActive({ quoteId, orderId: quote.order.id, isActive: quote.isActive });

    const policy = await getQuoteApprovalPolicy(user.tenantId, Number(quote.total));
    if (!canRoleApproveQuote(user.role, policy)) {
      return {
        error: `Ce devis doit être validé par ${getQuoteApprovalGateLabel(policy.requiredGate)}.`,
      };
    }

    const updated = await prisma.quote.update({
      where: { id: quoteId },
      data: {
        approvalStatus: "APPROVED",
        approvedById: user.id,
        approvedAt: new Date(),
        approvalNote: note ?? null,
      },
    });

      await AuditService.log({
        tenantId: user.tenantId,
        userId: user.id,
        action: "quote.approved",
        entityType: "quote",
        entityId: quoteId,
        newValue: { orderId: quote.order.id, note: note ?? null },
      });
      await emitEvent("quote.approved", "quote", quoteId, {
        orderId: quote.order.id,
        approvedById: user.id,
      });

    await prisma.task.updateMany({
      where: {
        entityType: "order",
        entityId: quote.order.id,
        taskType: "quote_approval",
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    const teamIds = await getOrderTeamUserIds(quote.order.id);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "APPROVAL_DECIDED",
      title: "Devis approuve",
      message: `${user.name || user.email} a approuve un devis`,
      entityType: "quote",
      entityId: quoteId,
    });

    await syncDemandStatusForQuote(quoteId);

    revalidatePath(`/orders/${quote.order.id}`);
    revalidatePath("/quotes");
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    return { data: toPlainData(updated) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur approbation devis" };
  }
}

export async function rejectQuoteApproval(quoteId: string, note?: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "quote.approve");

      const quote = await prisma.quote.findUnique({
        where: { id: quoteId },
        include: { order: { select: { id: true, tenantId: true, status: true } } },
      });
      if (!quote || quote.order.tenantId !== user.tenantId) {
        return { error: "Devis introuvable" };
      }
      await ensureQuoteIsActive({ quoteId, orderId: quote.order.id, isActive: quote.isActive });

    const policy = await getQuoteApprovalPolicy(user.tenantId, Number(quote.total));
    if (!canRoleApproveQuote(user.role, policy)) {
      return {
        error: `Ce devis doit être traité par ${getQuoteApprovalGateLabel(policy.requiredGate)}.`,
      };
    }

    const updated = await prisma.quote.update({
      where: { id: quoteId },
      data: {
        approvalStatus: "REJECTED",
        approvedById: user.id,
        approvedAt: new Date(),
        approvalNote: note ?? null,
      },
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "quote.approval_rejected",
      entityType: "quote",
      entityId: quoteId,
      newValue: { orderId: quote.order.id, note: note ?? null },
    });

    await cancelQuoteWorkflowTasks({ orderId: quote.order.id, includePaymentTasks: false, excludingQuoteId: quoteId });
    await syncDemandStatusForQuote(quoteId);

    const teamIds = await getOrderTeamUserIds(quote.order.id);
    await NotificationService.notifyMany(teamIds, {
      tenantId: user.tenantId,
      type: "APPROVAL_DECIDED",
      title: "Approbation devis rejetee",
      message: `${user.name || user.email} a rejete l'approbation d'un devis`,
      entityType: "quote",
      entityId: quoteId,
    });

    revalidatePath(`/orders/${quote.order.id}`);
    revalidatePath("/quotes");
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    return { data: toPlainData(updated) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur rejet approbation devis" };
  }
}

export async function sendQuoteEmail(quoteId: string, to: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "quote.send");

    const target = to.trim().toLowerCase();
    if (!target || !target.includes("@")) {
      return { error: "Email destinataire invalide" };
    }

      const quote = await prisma.quote.findUnique({
        where: { id: quoteId },
        include: {
        order: {
          select: {
            id: true,
            tenantId: true,
            orderNumber: true,
            contact: { select: { name: true } },
          },
        },
        approvedBy: { select: { role: true } },
      },
      });
      if (!quote || quote.order.tenantId !== user.tenantId) {
        return { error: "Devis introuvable" };
      }
      await ensureQuoteIsActive({ quoteId, orderId: quote.order.id, isActive: quote.isActive });

    const policy = await getQuoteApprovalPolicy(user.tenantId, Number(quote.total));
    if (
      quote.approvalStatus !== "APPROVED" ||
      !quote.approvedBy ||
      !canRoleApproveQuote(quote.approvedBy.role, policy)
    ) {
      return {
        error: `Ce devis doit être validé par ${getQuoteApprovalGateLabel(policy.requiredGate)} avant envoi email.`,
      };
    }

    const signatureToken = quote.signatureToken || randomUUID();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || "http://localhost:3000";
    const signatureUrl = `${appUrl.replace(/\/$/, "")}/quote/${signatureToken}`;

    const emailBody = [
      `Bonjour ${quote.order.contact?.name || ""}`.trim(),
      `Votre devis ${quote.order.orderNumber} est pret.`,
      `Total: ${formatMoney(Number(quote.total), quote.currency)}`,
      `Marchandise: ${formatMoney(Number(quote.merchandiseTotal), quote.currency)}`,
      `Logistique: ${formatMoney(Number(quote.logisticsCost), quote.currency)}`,
      `Commission: ${formatMoney(Number(quote.commission), quote.currency)}`,
      Number(quote.insuranceCost) > 0 ? `Assurance: ${formatMoney(Number(quote.insuranceCost), quote.currency)}` : "",
      quote.validUntil ? `Validite: ${quote.validUntil.toLocaleDateString("fr-FR")}` : "",
      "",
      `Signature en ligne: ${signatureUrl}`,
    ].filter(Boolean).join("\n");

    await EmailNotificationChannel.send({
      to: target,
      type: "QUOTE_SENT",
      title: `Devis ${quote.order.orderNumber}`,
      message: emailBody,
      entityType: "quote",
      entityId: quote.id,
    });

    const updated = await prisma.quote.update({
      where: { id: quote.id },
      data: {
        status: quote.status === "DRAFT" ? "SENT" : quote.status,
        sentAt: quote.sentAt ?? new Date(),
        sentByEmailAt: new Date(),
        sentByEmailTo: target,
        signatureToken,
      },
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "quote.email_sent",
      entityType: "quote",
      entityId: quote.id,
      newValue: { to: target, orderId: quote.order.id },
    });

    await prisma.task.updateMany({
      where: {
        entityType: "order",
        entityId: quote.order.id,
        taskType: "send_quote",
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    await syncDemandStatusForQuote(quote.id);

    revalidatePath(`/orders/${quote.order.id}`);
    revalidatePath("/quotes");
    revalidatePath("/dashboard");
    return { data: toPlainData(updated) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur envoi email devis" };
  }
}

export async function acceptQuoteAndPreparePaymentByToken(
  token: string,
  signer: { name: string; email?: string },
  transportSelections?: Record<string, string>
) {
  try {
    const normalizedToken = token.trim();
    if (!normalizedToken) return { error: "Lien de signature invalide" };
    if (!signer?.name?.trim()) return { error: "Nom requis" };
    const signerEmail = normalizeEmail(signer.email);
    if (!signerEmail) return { error: "Email requis pour signer le devis" };

      const quote = await prisma.quote.findUnique({
        where: { signatureToken: normalizedToken },
        include: {
        order: {
          select: {
            id: true,
            tenantId: true,
            orderNumber: true,
            status: true,
            contact: { select: { name: true, email: true } },
          },
        },
        approvedBy: { select: { role: true } },
      },
      });
      if (!quote) return { error: "Devis introuvable" };
      await ensureQuoteIsActive({ quoteId: quote.id, orderId: quote.order.id, isActive: quote.isActive });

      if (quote.validUntil && quote.validUntil < new Date()) {
      await prisma.quote.update({
        where: { id: quote.id },
        data: { status: "EXPIRED" },
      });
      return { error: "Ce devis a expire" };
    }

    if (quote.status === "REJECTED" || quote.status === "EXPIRED") {
      return { error: `Ce devis est deja ${quote.status.toLowerCase()}` };
    }
    if (!quote.sentByEmailAt) {
      return { error: "La signature publique n'est autorisee que pour un devis envoye par email." };
    }

    const allowedEmail = normalizeEmail(quote.sentByEmailTo) || normalizeEmail(quote.order.contact?.email);
    if (!allowedEmail) {
      return { error: "Ce devis doit etre envoye a une adresse email verifiee avant signature." };
    }
    if (signerEmail !== allowedEmail) {
      return { error: "Utilisez l'adresse email qui a recu ce lien pour signer le devis." };
    }

    const headerStore = await headers();
    const signerIp = getRequestIpFromHeaders(headerStore);
    const snapshot = (quote.pricingSnapshot as Record<string, unknown> | null) ?? {};
    const repricedIndicatif =
      snapshot.source === "SOURCING_INDICATIF"
        ? applyIndicatifTransportSelection(snapshot, transportSelections)
        : null;
    const finalQuoteTotal = repricedIndicatif ? repricedIndicatif.total : Number(quote.total);
    const approvalPolicy = await getQuoteApprovalPolicy(quote.order.tenantId, finalQuoteTotal);
    const approvalStillValid =
      quote.approvalStatus === "APPROVED" &&
      !!quote.approvedBy &&
      canRoleApproveQuote(quote.approvedBy.role, approvalPolicy);

    if (!approvalStillValid) {
      await prisma.quote.update({
        where: { id: quote.id },
        data: {
          status: "SENT",
          acceptedAt: null,
          signedAt: null,
          signedByName: null,
          signedByEmail: null,
          signedByIp: null,
          approvalStatus: "PENDING",
          approvedById: null,
          approvedAt: null,
          approvalNote: repricedIndicatif
            ? "Revalidation interne requise après modification du transport."
            : "Revalidation interne requise avant paiement.",
          paymentToken: null,
          paymentExpiry: null,
          paymentStatus: "PENDING",
          ...(repricedIndicatif
            ? {
                pricingSnapshot: repricedIndicatif.snapshot,
                merchandiseTotal: repricedIndicatif.merchandiseTotal,
                logisticsCost: repricedIndicatif.logisticsCost,
                commission: repricedIndicatif.commission,
                insuranceCost: repricedIndicatif.insuranceCost,
                total: repricedIndicatif.total,
              }
            : {}),
        },
      });
      await ensureQuoteApprovalTask({
        tenantId: quote.order.tenantId,
        orderId: quote.order.id,
        quoteId: quote.id,
        orderNumber: quote.order.orderNumber,
        totalXaf: finalQuoteTotal,
        customerName: quote.order.contact?.name ?? null,
      });
      await syncDemandStatusForQuote(quote.id);
      revalidatePath(`/quote/${normalizedToken}`);
      revalidatePath(`/orders/${quote.order.id}`);
      revalidatePath("/quotes");
      revalidatePath("/tasks");
      return {
        error: `Le nouveau montant doit être revalidé par ${getQuoteApprovalGateLabel(
          approvalPolicy.requiredGate
        )} avant paiement.`,
      };
    }

    const paymentToken =
      quote.paymentToken && (!quote.paymentExpiry || quote.paymentExpiry > new Date())
        ? quote.paymentToken
        : randomUUID();
    const paymentExpiry =
      quote.paymentExpiry && quote.paymentExpiry > new Date()
        ? quote.paymentExpiry
        : new Date(Date.now() + 72 * 60 * 60 * 1000);

    const updated = await prisma.quote.update({
      where: { id: quote.id },
      data: {
        status: "ACCEPTED",
        acceptedAt: quote.acceptedAt ?? new Date(),
        signedAt: new Date(),
        signedByName: signer.name.trim(),
        signedByEmail: signerEmail,
        signedByIp: signerIp,
        paymentToken,
        paymentExpiry,
        paymentStatus: quote.paymentStatus === "PAID" ? "PAID" : "PENDING",
        ...(repricedIndicatif
          ? {
              pricingSnapshot: repricedIndicatif.snapshot,
              merchandiseTotal: repricedIndicatif.merchandiseTotal,
              logisticsCost: repricedIndicatif.logisticsCost,
              commission: repricedIndicatif.commission,
              insuranceCost: repricedIndicatif.insuranceCost,
              total: repricedIndicatif.total,
            }
          : {}),
      },
    });

    if (["DEMANDE", "RECHERCHE_PRODUIT", "DEVIS"].includes(quote.order.status)) {
      await OrderService.updateStatus(quote.order.id, "PAIEMENT_EN_COURS", undefined, "Devis accepte par le client");
    }

    await syncDemandStatusForQuote(updated.id);

    await AuditService.log({
      tenantId: quote.order.tenantId,
      action: "quote.public_accepted_and_prepared_for_payment",
      entityType: "quote",
      entityId: quote.id,
      newValue: {
        signedByName: signer.name.trim(),
        signedByEmail: signerEmail,
        signedByIp: signerIp,
        paymentToken,
      },
    });

    const teamIds = await getOrderTeamUserIds(quote.order.id);
    await NotificationService.notifyMany(teamIds, {
      tenantId: quote.order.tenantId,
      type: "QUOTE_ACCEPTED",
      title: "Devis signe et pret au paiement",
      message: `Le devis ${quote.order.orderNumber} a ete signe et peut etre paye`,
      entityType: "quote",
      entityId: quote.id,
    });

    revalidatePath(`/quote/${normalizedToken}`);
    revalidatePath(`/pay/${paymentToken}`);
    revalidatePath(`/verification/${paymentToken}`);
    revalidatePath(`/orders/${quote.order.id}`);
    revalidatePath("/quotes");

    return {
      data: {
        quoteId: updated.id,
        paymentToken,
        paymentUrl: buildPublicPaymentUrl(paymentToken),
      },
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur preparation paiement devis" };
  }
}

export async function signQuoteByToken(token: string, signer: { name: string; email?: string }) {
  try {
    const normalizedToken = token.trim();
    if (!normalizedToken) return { error: "Lien de signature invalide" };
    if (!signer?.name?.trim()) return { error: "Nom requis" };
    const signerEmail = normalizeEmail(signer.email);
    if (!signerEmail) return { error: "Email requis pour signer le devis" };

      const quote = await prisma.quote.findUnique({
        where: { signatureToken: normalizedToken },
        include: {
        order: {
          select: {
            id: true,
            tenantId: true,
            orderNumber: true,
            contact: { select: { email: true } },
          },
        },
        approvedBy: { select: { role: true } },
      },
      });
      if (!quote) return { error: "Devis introuvable" };
      await ensureQuoteIsActive({ quoteId: quote.id, orderId: quote.order.id, isActive: quote.isActive });

    if (quote.validUntil && quote.validUntil < new Date()) {
      await prisma.quote.update({
        where: { id: quote.id },
        data: { status: "EXPIRED" },
      });
      return { error: "Ce devis a expire" };
    }

    if (quote.status === "REJECTED" || quote.status === "EXPIRED") {
      return { error: `Ce devis est deja ${quote.status.toLowerCase()}` };
    }
    if (!quote.sentByEmailAt) {
      return { error: "La signature publique n'est autorisee que pour un devis envoye par email." };
    }

    const allowedEmail = normalizeEmail(quote.sentByEmailTo) || normalizeEmail(quote.order.contact?.email);
    if (!allowedEmail) {
      return { error: "Ce devis doit etre envoye a une adresse email verifiee avant signature." };
    }
    if (signerEmail !== allowedEmail) {
      return { error: "Utilisez l'adresse email qui a recu ce lien pour signer le devis." };
    }

    const approvalPolicy = await getQuoteApprovalPolicy(quote.order.tenantId, Number(quote.total));
    if (
      quote.approvalStatus !== "APPROVED" ||
      !quote.approvedBy ||
      !canRoleApproveQuote(quote.approvedBy.role, approvalPolicy)
    ) {
      return { error: "Ce devis doit être validé en interne avant signature." };
    }

    const headerStore = await headers();
    const signerIp = getRequestIpFromHeaders(headerStore);

    const updated = await prisma.quote.update({
      where: { id: quote.id },
      data: {
        status: "ACCEPTED",
        acceptedAt: quote.acceptedAt ?? new Date(),
        signedAt: new Date(),
        signedByName: signer.name.trim(),
        signedByEmail: signerEmail,
        signedByIp: signerIp,
      },
    });
    await syncDemandStatusForQuote(quote.id);

    await AuditService.log({
      tenantId: quote.order.tenantId,
      action: "quote.public_accepted",
      entityType: "quote",
      entityId: quote.id,
      newValue: { signedByName: signer.name.trim(), signedByEmail: signerEmail, signedByIp: signerIp },
    });

    const teamIds = await getOrderTeamUserIds(quote.order.id);
    await NotificationService.notifyMany(teamIds, {
      tenantId: quote.order.tenantId,
      type: "QUOTE_ACCEPTED",
      title: "Devis signe",
      message: `Le devis ${quote.order.orderNumber} a ete signe`,
      entityType: "quote",
      entityId: quote.id,
    });

    revalidatePath(`/quote/${normalizedToken}`);
    revalidatePath(`/orders/${quote.order.id}`);
    revalidatePath("/quotes");
    return { data: toPlainData(updated) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur signature devis" };
  }
}

export async function rejectQuoteByToken(token: string, signer: { name?: string; email?: string }) {
  try {
    const normalizedToken = token.trim();
    if (!normalizedToken) return { error: "Lien de signature invalide" };
    const signerEmail = normalizeEmail(signer.email);
    if (!signerEmail) return { error: "Email requis pour refuser le devis" };

      const quote = await prisma.quote.findUnique({
        where: { signatureToken: normalizedToken },
        include: {
        order: {
          select: {
            id: true,
            tenantId: true,
            orderNumber: true,
            contact: { select: { email: true } },
          },
        },
      },
      });
      if (!quote) return { error: "Devis introuvable" };
      await ensureQuoteIsActive({ quoteId: quote.id, orderId: quote.order.id, isActive: quote.isActive });

    if (quote.status === "ACCEPTED" || quote.status === "EXPIRED") {
      return { error: `Ce devis est deja ${quote.status.toLowerCase()}` };
    }
    if (!quote.sentByEmailAt) {
      return { error: "La reponse publique n'est autorisee que pour un devis envoye par email." };
    }

    const allowedEmail = normalizeEmail(quote.sentByEmailTo) || normalizeEmail(quote.order.contact?.email);
    if (!allowedEmail) {
      return { error: "Ce devis doit etre envoye a une adresse email verifiee avant reponse." };
    }
    if (signerEmail !== allowedEmail) {
      return { error: "Utilisez l'adresse email qui a recu ce lien pour repondre au devis." };
    }

    const headerStore = await headers();
    const signerIp = getRequestIpFromHeaders(headerStore);

    const updated = await prisma.quote.update({
      where: { id: quote.id },
      data: {
        status: "REJECTED",
        signedByName: signer.name?.trim() || null,
        signedByEmail: signerEmail,
        signedByIp: signerIp,
        paymentToken: null,
        paymentExpiry: null,
        paymentStatus: "PENDING",
        paymentMethod: null,
        paidAt: null,
      },
    });

    await cancelQuoteWorkflowTasks({ orderId: quote.order.id, includePaymentTasks: true, excludingQuoteId: quote.id });
    await syncDemandStatusForQuote(quote.id);

    await AuditService.log({
      tenantId: quote.order.tenantId,
      action: "quote.public_rejected",
      entityType: "quote",
      entityId: quote.id,
      newValue: { signedByName: signer.name?.trim() || null, signedByEmail: signerEmail, signedByIp: signerIp },
    });

    const teamIds = await getOrderTeamUserIds(quote.order.id);
    await NotificationService.notifyMany(teamIds, {
      tenantId: quote.order.tenantId,
      type: "QUOTE_REJECTED",
      title: "Devis refuse",
      message: `Le devis ${quote.order.orderNumber} a ete refuse`,
      entityType: "quote",
      entityId: quote.id,
    });

    revalidatePath(`/quote/${normalizedToken}`);
    revalidatePath(`/orders/${quote.order.id}`);
    revalidatePath("/quotes");
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    return { data: toPlainData(updated) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur rejet devis" };
  }
}
export async function acceptQuote(quoteId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "quote.send");

      const quote = await prisma.quote.findUnique({
        where: { id: quoteId },
        include: { order: { select: { id: true, tenantId: true, status: true } } },
      });
      if (!quote || quote.order.tenantId !== user.tenantId) {
        return { error: "Devis introuvable" };
      }
      await ensureQuoteIsActive({ quoteId, orderId: quote.order.id, isActive: quote.isActive });

    const updated = await updateQuoteStatusInternal(quoteId, "ACCEPTED");
    if (["DEMANDE", "RECHERCHE_PRODUIT", "DEVIS"].includes(quote.order.status)) {
      await OrderService.updateStatus(quote.order.id, "PAIEMENT_EN_COURS", user.id, "Devis accepté manuellement");
    }
    await syncDemandStatusForQuote(quoteId);

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
    revalidatePath("/quotes");
    revalidatePath("/dashboard");
    return { data: toPlainData(updated) };
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
      await ensureQuoteIsActive({ quoteId, orderId: quote.order.id, isActive: quote.isActive });

    const updated = await updateQuoteStatusInternal(quoteId, "REJECTED");
    await cancelQuoteWorkflowTasks({ orderId: quote.order.id, includePaymentTasks: true, excludingQuoteId: quoteId });
    await syncDemandStatusForQuote(quoteId);

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
    revalidatePath("/quotes");
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    return { data: toPlainData(updated) };
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
      await ensureQuoteIsActive({ quoteId, orderId: quote.order.id, isActive: quote.isActive });

    const updated = await updateQuoteStatusInternal(quoteId, "EXPIRED");
    await cancelQuoteWorkflowTasks({ orderId: quote.order.id, includePaymentTasks: true, excludingQuoteId: quoteId });
    await syncDemandStatusForQuote(quoteId);

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
    revalidatePath("/quotes");
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    return { data: toPlainData(updated) };
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
        approvedBy: { select: { role: true } },
      },
    });
    if (!quote || quote.order.tenantId !== user.tenantId) {
      return { error: "Devis introuvable" };
    }
    await ensureQuoteIsActive({ quoteId, orderId: quote.order.id, isActive: quote.isActive });

    const approvalPolicy = await getQuoteApprovalPolicy(user.tenantId, Number(quote.total));
    if (
      quote.approvalStatus !== "APPROVED" ||
      !quote.approvedBy ||
      !canRoleApproveQuote(quote.approvedBy.role, approvalPolicy)
    ) {
      return {
        error: `Le devis doit être validé par ${getQuoteApprovalGateLabel(
          approvalPolicy.requiredGate
        )} avant téléchargement.`,
      };
    }

    const statusLabel = quote.status === "DRAFT" ? "Brouillon"
      : quote.status === "SENT" ? "Envoye"
      : quote.status === "ACCEPTED" ? "Accepte"
      : quote.status === "REJECTED" ? "Refuse"
      : quote.status === "EXPIRED" ? "Expire"
      : quote.status;

    const snapshot = (quote.pricingSnapshot || {}) as Record<string, unknown>;
    const itemsRaw = Array.isArray((snapshot as { items?: unknown }).items)
      ? ((snapshot as { items?: unknown[] }).items ?? [])
      : [];
    const items: QuotePdfItem[] = itemsRaw.map((item) => {
      const row = item as Record<string, unknown>;
      const selectedTransport =
        row.selectedTransport && typeof row.selectedTransport === "object"
          ? (row.selectedTransport as Record<string, unknown>)
          : null;
      return {
        description: String(row.description ?? row.label ?? "Article"),
        category: row.category ? String(row.category) : null,
        platform: row.platform ? String(row.platform) : null,
        quantity: row.quantity != null ? Number(row.quantity) : null,
        unitPrice: row.unitPrice != null ? Number(row.unitPrice) : null,
        currency: quote.currency,
        lineTotal: row.total != null ? Number(row.total) : null,
        transportLabel: row.transportLabel
          ? String(row.transportLabel)
          : selectedTransport?.label
            ? String(selectedTransport.label)
            : null,
        transportDelay: row.transportDelay
          ? String(row.transportDelay)
          : selectedTransport?.delayLabel
            ? String(selectedTransport.delayLabel)
            : null,
        transportCost: row.transportCost != null
          ? Number(row.transportCost)
          : row.logisticsCost != null
            ? Number(row.logisticsCost)
            : selectedTransport?.costXAF != null
              ? Number(selectedTransport.costXAF)
              : null,
      };
    });

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "";
    const paymentLink = quote.signatureToken
      ? `${appUrl.replace(/\/$/, "")}/quote/${quote.signatureToken}`
      : null;

    const pdfBuffer = await renderQuotePdf({
      title: "Devis",
      quoteNumber: quote.order.orderNumber,
      clientName: quote.order.contact?.name || "-",
      statusLabel,
      createdAt: new Date(quote.createdAt).toLocaleDateString("fr-FR"),
      validUntil: quote.validUntil ? quote.validUntil.toLocaleDateString("fr-FR") : null,
      paymentLink,
      companyEmail: "servicehorion@gmail.com",
      companyWhatsapp: "+242 06 460 08 31",
      items,
      totals: {
        merchandiseTotal: Number(quote.merchandiseTotal),
        logisticsCost: Number(quote.logisticsCost),
        commission: Number(quote.commission),
        insuranceCost: Number(quote.insuranceCost || 0),
        total: Number(quote.total),
        currency: quote.currency,
      },
    });
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

// Bridge exports for logistics actions:
// In a "use server" module, we must only export async functions.
export async function createShipment(...args: Parameters<typeof orderLogisticsActions.createShipment>) {
  return orderLogisticsActions.createShipment(...args);
}

export async function updateShipmentStatus(...args: Parameters<typeof orderLogisticsActions.updateShipmentStatus>) {
  return orderLogisticsActions.updateShipmentStatus(...args);
}

export async function addTrackingEvent(...args: Parameters<typeof orderLogisticsActions.addTrackingEvent>) {
  return orderLogisticsActions.addTrackingEvent(...args);
}

export async function syncShipmentTracking(...args: Parameters<typeof orderLogisticsActions.syncShipmentTracking>) {
  return orderLogisticsActions.syncShipmentTracking(...args);
}

export async function createQcRequest(...args: Parameters<typeof orderLogisticsActions.createQcRequest>) {
  return orderLogisticsActions.createQcRequest(...args);
}

export async function updateQcRequestStatus(...args: Parameters<typeof orderLogisticsActions.updateQcRequestStatus>) {
  return orderLogisticsActions.updateQcRequestStatus(...args);
}

export async function addQcReport(...args: Parameters<typeof orderLogisticsActions.addQcReport>) {
  return orderLogisticsActions.addQcReport(...args);
}

export async function createDispute(...args: Parameters<typeof orderLogisticsActions.createDispute>) {
  return orderLogisticsActions.createDispute(...args);
}

export async function resolveDispute(...args: Parameters<typeof orderLogisticsActions.resolveDispute>) {
  return orderLogisticsActions.resolveDispute(...args);
}

export async function createReturnMerchandise(...args: Parameters<typeof orderLogisticsActions.createReturnMerchandise>) {
  return orderLogisticsActions.createReturnMerchandise(...args);
}

export async function updateReturnMerchandiseStatus(...args: Parameters<typeof orderLogisticsActions.updateReturnMerchandiseStatus>) {
  return orderLogisticsActions.updateReturnMerchandiseStatus(...args);
}

export async function getReturnsForOrder(...args: Parameters<typeof orderLogisticsActions.getReturnsForOrder>) {
  return orderLogisticsActions.getReturnsForOrder(...args);
}

export async function calculateMargin(...args: Parameters<typeof orderLogisticsActions.calculateMargin>) {
  return orderLogisticsActions.calculateMargin(...args);
}

export async function upsertCustomsClearance(...args: Parameters<typeof orderLogisticsActions.upsertCustomsClearance>) {
  return orderLogisticsActions.upsertCustomsClearance(...args);
}

export async function addQcNonConformity(...args: Parameters<typeof orderLogisticsActions.addQcNonConformity>) {
  return orderLogisticsActions.addQcNonConformity(...args);
}

export async function exportOrdersCSV(...args: Parameters<typeof orderLogisticsActions.exportOrdersCSV>) {
  return orderLogisticsActions.exportOrdersCSV(...args);
}

export async function exportOrdersPDF(...args: Parameters<typeof orderLogisticsActions.exportOrdersPDF>) {
  return orderLogisticsActions.exportOrdersPDF(...args);
}

export async function importOrdersCSV(...args: Parameters<typeof orderLogisticsActions.importOrdersCSV>) {
  return orderLogisticsActions.importOrdersCSV(...args);
}

export async function refreshOrderApprovals(...args: Parameters<typeof orderLogisticsActions.refreshOrderApprovals>) {
  return orderLogisticsActions.refreshOrderApprovals(...args);
}

export async function approveOrderStep(...args: Parameters<typeof orderLogisticsActions.approveOrderStep>) {
  return orderLogisticsActions.approveOrderStep(...args);
}

export async function rejectOrderStep(...args: Parameters<typeof orderLogisticsActions.rejectOrderStep>) {
  return orderLogisticsActions.rejectOrderStep(...args);
}

export async function createOrderPortalLink(...args: Parameters<typeof orderLogisticsActions.createOrderPortalLink>) {
  return orderLogisticsActions.createOrderPortalLink(...args);
}

export async function sendOrderEdi(...args: Parameters<typeof orderLogisticsActions.sendOrderEdi>) {
  return orderLogisticsActions.sendOrderEdi(...args);
}

export async function recalculateOrderBudget(...args: Parameters<typeof orderLogisticsActions.recalculateOrderBudget>) {
  return orderLogisticsActions.recalculateOrderBudget(...args);
}
