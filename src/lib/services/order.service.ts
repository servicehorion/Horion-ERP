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

  static async create(tenantId: string, data: CreateOrderInput) {
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
    } = {}
  ) {
    const { status, page = 1, limit = 20, search } = options;

    const where: Prisma.OrderWhereInput = {
      tenantId,
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
        quotes: { orderBy: { version: "desc" } },
        timeline: { orderBy: { createdAt: "desc" } },
        tasks: {
          include: { assignments: { include: { user: true } } },
          orderBy: { createdAt: "desc" },
        },
        shipments: true,
        payments: true,
        disputes: true,
      },
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
      where: { tenantId },
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
