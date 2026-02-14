"use server";

import { auth } from "@/lib/auth";
import { OrderService } from "@/lib/services/order.service";
import { AuditService } from "@/lib/services/audit.service";
import { checkPermission } from "@/lib/permissions";
import { createOrderSchema, updateOrderStatusSchema, createQuoteSchema } from "@/lib/validators/order";
import { revalidatePath } from "next/cache";
import type { OrderStatus } from "@prisma/client";
import type { UserRole } from "@prisma/client";

async function getSession() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifie");
  return session.user as { id: string; email: string; name: string; role: UserRole; tenantId: string; tenantName: string };
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
      oldValue: { status: newStatus },
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
  const user = await getSession();
  return OrderService.getStatusCounts(user.tenantId);
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
  const user = await getSession();
  checkPermission(user.role, "quote.create");

  const validated = createQuoteSchema.parse(data);
  const { prisma } = await import("@/lib/db");

  // Get latest version
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
  return { success: true, quote };
}
