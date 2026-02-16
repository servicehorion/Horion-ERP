"use server";

import { getSession } from "@/lib/session";
import { OrderService } from "@/lib/services/order.service";
import { AuditService } from "@/lib/services/audit.service";
import { checkPermission } from "@/lib/permissions";
import { createOrderSchema, updateOrderStatusSchema, createQuoteSchema } from "@/lib/validators/order";
import { revalidatePath } from "next/cache";
import type { OrderStatus } from "@prisma/client";

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
    const order = await OrderService.create(user.tenantId, validated);

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "order.created",
      entityType: "order",
      entityId: order.id,
      newValue: { orderNumber: order.orderNumber },
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

    const result = await OrderService.list(user.tenantId, {
      status: options?.status as OrderStatus | undefined,
      page: options?.page,
      limit: options?.limit,
      search: options?.search,
    });

    return { data: result.orders };
  } catch (error) {
    console.error("Error fetching orders:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la récupération des commandes" };
  }
}

export async function getOrderById(orderId: string) {
  try {
    const user = await getSession();
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

export async function getOrderStatusCounts() {
  try {
    const user = await getSession();
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

    revalidatePath(`/orders/${validated.orderId}`);
    return { data: quote };
  } catch (error) {
    console.error("Error creating quote:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la création du devis" };
  }
}
