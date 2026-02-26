import { prisma } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import { canTransition } from "@/config/order-statuses";
import type { OrderStatus, Priority, Prisma } from "@prisma/client";
import type { CreateOrderInput } from "@/lib/validators/order";
import { convertCurrency } from "@/config/currencies";

export class OrderService {
  static async generateOrderNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = "HOR";

    const lastOrder = await prisma.order.findFirst({
      where: {
        tenantId,
        orderNumber: { startsWith: `${prefix}-${year}-` },
      },
      orderBy: { orderNumber: "desc" },
      select: { orderNumber: true },
    });

    const lastNum = lastOrder
      ? parseInt(lastOrder.orderNumber.split("-")[2])
      : 0;
    const nextNum = String(lastNum + 1).padStart(5, "0");

    return `${prefix}-${year}-${nextNum}`;
  }

  static async create(
    tenantId: string,
    data: CreateOrderInput & { ownerId?: string | null; onboardedById?: string | null; collaboratorIds?: string[] }
  ) {
    const orderNumber = await this.generateOrderNumber(tenantId);

    // Calculate totals
    let merchandiseTotal = 0;
    const itemsWithXAF = data.items.map((item) => {
      const totalOriginal = item.unitPrice * item.quantity;
      const unitPriceXAF = convertCurrency(item.unitPrice, item.currency || "RMB", "XAF");
      const totalXAF = unitPriceXAF * item.quantity;
      merchandiseTotal += totalXAF;
      return {
        ...item,
        unitPriceXAF,
        totalXAF,
      };
    });

    const commissionRate = 0.10;
    const commissionAmount = merchandiseTotal * commissionRate;
    const totalClient = merchandiseTotal + commissionAmount;

    const order = await prisma.order.create({
      data: {
        tenantId,
        orderNumber,
        contactId: data.contactId,
        ownerId: data.ownerId ?? null,
        onboardedById: data.onboardedById ?? null,
        priority: data.priority as Priority,
        destinationCity: data.destinationCity || "Brazzaville",
        notes: data.notes,
        merchandiseTotal,
        commissionRate,
        commissionAmount,
        totalClient,
        currency: "XAF",
        items: {
          create: itemsWithXAF.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            currency: item.currency || "RMB",
            unitPriceXAF: item.unitPriceXAF,
            totalXAF: item.totalXAF,
            hsCode: item.hsCode,
            weight: item.weight,
            volume: item.volume,
            notes: item.notes,
          })),
        },
        collaborators: data.collaboratorIds?.length
          ? {
              create: data.collaboratorIds.map((userId) => ({ userId })),
            }
          : undefined,
        timeline: {
          create: {
            event: "order_created",
            toValue: "DEMANDE",
            note: "Commande creee",
          },
        },
      },
      include: {
        items: true,
        contact: true,
        timeline: true,
        collaborators: { include: { user: true } },
      },
    });

    await emitEvent("order.created", "order", order.id, {
      orderNumber: order.orderNumber,
      contactId: order.contactId,
      totalClient: Number(order.totalClient),
    });

    return order;
  }

  static async list(
    tenantId: string,
    options: {
      status?: OrderStatus;
      page?: number;
      limit?: number;
      search?: string;
      includeArchived?: boolean;
    } = {}
  ) {
    const { status, page = 1, limit = 20, search, includeArchived } = options;

    const where: Prisma.OrderWhereInput = {
      tenantId,
      ...(includeArchived ? {} : { archivedAt: null }),
      ...(status && { status }),
      ...(search && {
        OR: [
          { orderNumber: { contains: search, mode: "insensitive" as const } },
          { contact: { name: { contains: search, mode: "insensitive" as const } } },
          { notes: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { contact: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return {
      orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  static async getById(orderId: string) {
    return prisma.order.findUnique({
      where: { id: orderId },
      include: {
        contact: true,
        items: true,
        owner: true,
        onboardedBy: true,
        collaborators: { include: { user: true } },
        attachments: { include: { user: true }, orderBy: { createdAt: "desc" } },
        quotes: { orderBy: { version: "desc" } },
        timeline: { orderBy: { createdAt: "desc" } },
        tasks: {
          include: { assignments: { include: { user: true } } },
          orderBy: { createdAt: "desc" },
        },
        shipments: true,
        payments: true,
        disputes: true,
        qcRequests: { include: { reports: true }, orderBy: { createdAt: "desc" } },
      },
    });
  }

  static async update(
    orderId: string,
    data: Partial<CreateOrderInput> & {
      ownerId?: string | null;
      onboardedById?: string | null;
      collaboratorIds?: string[];
      logisticsCost?: number;
      insuranceAmount?: number;
      commissionRate?: number;
    }
  ) {
    const existing = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!existing) throw new Error("Commande introuvable");

    let merchandiseTotal = Number(existing.merchandiseTotal);
    let itemsPayload: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      currency?: string;
      hsCode?: string;
      weight?: number;
      volume?: number;
      notes?: string;
      unitPriceXAF: number;
      totalXAF: number;
    }> = [];

    if (data.items && data.items.length > 0) {
      merchandiseTotal = 0;
      itemsPayload = data.items.map((item) => {
        const unitPriceXAF = convertCurrency(item.unitPrice, item.currency || "RMB", "XAF");
        const totalXAF = unitPriceXAF * item.quantity;
        merchandiseTotal += totalXAF;
        return { ...item, unitPriceXAF, totalXAF };
      });
    }

    const commissionRate = data.commissionRate ?? Number(existing.commissionRate);
    const commissionAmount = merchandiseTotal * commissionRate;
    const logisticsCost = data.logisticsCost ?? Number(existing.logisticsCost);
    const insuranceAmount = data.insuranceAmount ?? Number(existing.insuranceAmount);
    const totalClient = merchandiseTotal + commissionAmount + logisticsCost + insuranceAmount;

    const updated = await prisma.$transaction(async (tx) => {
      if (data.items && data.items.length > 0) {
        await tx.orderItem.deleteMany({ where: { orderId } });
        await tx.orderItem.createMany({
          data: itemsPayload.map((item) => ({
            orderId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            currency: item.currency || "RMB",
            unitPriceXAF: item.unitPriceXAF,
            totalXAF: item.totalXAF,
            hsCode: item.hsCode,
            weight: item.weight,
            volume: item.volume,
            notes: item.notes,
          })),
        });
      }

      const order = await tx.order.update({
        where: { id: orderId },
        data: {
          ...(data.contactId && { contactId: data.contactId }),
          ...(data.priority && { priority: data.priority as Priority }),
          ...(data.destinationCity && { destinationCity: data.destinationCity }),
          ...(data.notes !== undefined && { notes: data.notes }),
          ...(data.ownerId !== undefined && { ownerId: data.ownerId }),
          ...(data.onboardedById !== undefined && { onboardedById: data.onboardedById }),
          ...(data.logisticsCost !== undefined && { logisticsCost }),
          ...(data.insuranceAmount !== undefined && { insuranceAmount }),
          ...(data.commissionRate !== undefined && { commissionRate }),
          merchandiseTotal,
          commissionAmount,
          totalClient,
        },
      });

      if (data.collaboratorIds) {
        await tx.orderCollaborator.deleteMany({ where: { orderId } });
        if (data.collaboratorIds.length > 0) {
          await tx.orderCollaborator.createMany({
            data: data.collaboratorIds.map((userId) => ({ orderId, userId })),
          });
        }
      }

      return order;
    });

    return updated;
  }

  static async duplicate(orderId: string) {
    const existing = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!existing) throw new Error("Commande introuvable");

    const orderNumber = await this.generateOrderNumber(existing.tenantId);
    const order = await prisma.order.create({
      data: {
        tenantId: existing.tenantId,
        orderNumber,
        contactId: existing.contactId,
        ownerId: existing.ownerId,
        onboardedById: existing.onboardedById,
        priority: existing.priority,
        destinationCity: existing.destinationCity,
        notes: existing.notes,
        merchandiseTotal: existing.merchandiseTotal,
        logisticsCost: existing.logisticsCost,
        commissionRate: existing.commissionRate,
        commissionAmount: existing.commissionAmount,
        insuranceAmount: existing.insuranceAmount,
        totalClient: existing.totalClient,
        currency: existing.currency,
        originCountry: existing.originCountry,
        riskLevel: existing.riskLevel,
        items: {
          create: existing.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            currency: item.currency,
            unitPriceXAF: item.unitPriceXAF,
            totalXAF: item.totalXAF,
            hsCode: item.hsCode,
            weight: item.weight,
            volume: item.volume,
            notes: item.notes,
          })),
        },
        timeline: {
          create: {
            event: "order_created",
            toValue: "DEMANDE",
            note: "Commande dupliquée",
          },
        },
      },
    });
    return order;
  }

  static async archive(orderId: string) {
    return prisma.order.update({
      where: { id: orderId },
      data: { archivedAt: new Date() },
    });
  }

  static async updateStatus(
    orderId: string,
    newStatus: OrderStatus,
    userId?: string,
    note?: string
  ) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) throw new Error("Commande introuvable");
    if (!canTransition(order.status, newStatus)) {
      throw new Error(
        `Transition impossible: ${order.status} -> ${newStatus}`
      );
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: newStatus,
        ...(newStatus === "LIVRE" && { actualDelivery: new Date() }),
        timeline: {
          create: {
            event: "status_changed",
            fromValue: order.status,
            toValue: newStatus,
            note: note || `Statut change: ${order.status} -> ${newStatus}`,
            userId,
          },
        },
      },
      include: { contact: true, timeline: { orderBy: { createdAt: "desc" }, take: 1 } },
    });

    await emitEvent("order.status_changed", "order", orderId, {
      previousStatus: order.status,
      newStatus,
      userId,
    });

    return updated;
  }

  static async getStatusCounts(tenantId: string) {
    const counts = await prisma.order.groupBy({
      by: ["status"],
      where: { tenantId, archivedAt: null },
      _count: { id: true },
    });

    return counts.reduce(
      (acc, item) => {
        acc[item.status] = item._count.id;
        return acc;
      },
      {} as Record<string, number>
    );
  }
}
