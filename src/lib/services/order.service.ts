import { prisma } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import { canTransition } from "@/config/order-statuses";
import type { OrderStatus, Priority, Prisma } from "@prisma/client";
import type { CreateOrderInput } from "@/lib/validators/order";
import { convertCurrency } from "@/config/currencies";
import { RiskCalculatorService } from "@/lib/services/risk-calculator.service";
import { serializeDecimals } from "@/lib/utils";
import { FxService } from "@/lib/services/fx.service";
import { OrderApprovalService } from "@/lib/services/order-approval.service";
import { InvoiceService } from "@/lib/services/invoice.service";
import { CatalogMemoryService } from "@/lib/services/catalog-memory.service";

export class OrderService {
  private static hasArchivedAtField() {
    const models = (prisma as any)?._dmmf?.datamodel?.models;
    const orderModel = Array.isArray(models) ? models.find((m: any) => m.name === "Order") : null;
    return !!orderModel?.fields?.some((f: any) => f.name === "archivedAt");
  }

  private static async assertClientFacingContact(tenantId: string, contactId: string) {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, tenantId },
      select: { id: true, type: true },
    });
    if (!contact) throw new Error("Contact introuvable");
    if (!["CLIENT", "PROSPECT"].includes(contact.type)) {
      throw new Error("Une commande client doit etre rattachée a un contact CLIENT ou PROSPECT");
    }
    return contact;
  }

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
    data: CreateOrderInput & { ownerId?: string | null; onboardedById?: string | null; collaboratorIds?: string[]; leadId?: string | null }
  ) {
      const orderNumber = await this.generateOrderNumber(tenantId);
      const fxRates = await FxService.getLatestRates();
      await this.assertClientFacingContact(tenantId, data.contactId);

    // Calculate totals
    let merchandiseTotal = 0;
    const itemsWithXAF = data.items.map((item) => {
      const totalOriginal = item.unitPrice * item.quantity;
      const unitPriceXAF = convertCurrency(item.unitPrice, item.currency || "RMB", "XAF", fxRates);
      const totalXAF = unitPriceXAF * item.quantity;
      merchandiseTotal += totalXAF;
      return {
        ...item,
        unitPriceXAF,
        totalXAF,
      };
    });

    const commissionRate = data.commissionRate ?? 0.10;
    const commissionAmount = merchandiseTotal * commissionRate;
    const logisticsCost = data.logisticsCost ?? 0;
    const insuranceAmount = data.insuranceAmount ?? 0;
    const totalClient = merchandiseTotal + commissionAmount + logisticsCost + insuranceAmount;
    const budgetPlannedXAF = merchandiseTotal + logisticsCost + insuranceAmount;

    const order = await prisma.order.create({
      data: {
        tenantId,
        orderNumber,
        contactId: data.contactId,
        leadId: data.leadId ?? undefined,
        ownerId: data.ownerId ?? null,
        onboardedById: data.onboardedById ?? null,
        priority: data.priority as Priority,
        destinationCity: data.destinationCity || "Brazzaville",
        notes: data.notes,
        merchandiseTotal,
        commissionRate,
        commissionAmount,
        logisticsCost,
        insuranceAmount,
        totalClient,
        budgetPlannedXAF,
        budgetActualXAF: 0,
        currency: "XAF",
        fxRatesSnapshot: FxService.buildSnapshot(fxRates),
        fxImpactXAF: 0,
        originCountry: data.originCountry || "CN",
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

    await OrderApprovalService.syncOrderApprovals(order.id);

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
      scopeWhere?: Prisma.OrderWhereInput;
    } = {}
  ) {
    const { status, page = 1, limit = 20, search, includeArchived } = options;

    const where: Prisma.OrderWhereInput = {
      tenantId,
      ...(includeArchived || !OrderService.hasArchivedAtField() ? {} : { archivedAt: null }),
      ...(status && { status }),
      ...(search && {
        OR: [
          { orderNumber: { contains: search, mode: "insensitive" as const } },
          { contact: { name: { contains: search, mode: "insensitive" as const } } },
          { notes: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(options.scopeWhere || {}),
    };

    const select = {
      id: true,
      orderNumber: true,
      status: true,
      priority: true,
      riskLevel: true,
      estimatedDelivery: true,
      updatedAt: true,
      createdAt: true,
      totalClient: true,
      contact: { select: { name: true } },
    };

    let orders: any[] = [];
    let total = 0;

    try {
      [orders, total] = await prisma.$transaction([
        prisma.order.findMany({
          where,
          select,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.order.count({ where }),
      ]);
    } catch (error) {
      console.warn("OrderService.list timeout fallback:", error);
      orders = await prisma.order.findMany({
        where,
        select,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      });
      total = orders.length;
    }

    return {
      orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  static async getById(orderId: string, scopeWhere?: Prisma.OrderWhereInput) {
    return prisma.order.findFirst({
      where: { id: orderId, ...(scopeWhere || {}) },
      include: {
        contact: true,
        items: true,
        owner: { select: { id: true, name: true, email: true } },
        onboardedBy: { select: { id: true, name: true, email: true } },
        collaborators: { include: { user: { select: { id: true, name: true, email: true } } } },
        attachments: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" } },
        quotes: { orderBy: { version: "desc" } },
        approvals: { include: { rule: true, decidedBy: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } },
        revisions: { orderBy: { createdAt: "desc" }, take: 10 },
        ediTransmissions: { include: { supplier: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } },
        portalTokens: { orderBy: { createdAt: "desc" }, take: 3 },
        timeline: { orderBy: { createdAt: "desc" } },
        tasks: {
          include: { assignments: { include: { user: true } } },
          orderBy: { createdAt: "desc" },
        },
        shipments: {
          include: {
            trackingEvents: { orderBy: { occurredAt: "asc" } },
            customsClearance: true,
            aiInsight: true,
          },
          orderBy: { createdAt: "asc" },
        },
        payments: { orderBy: { createdAt: "desc" } },
        disputes: { orderBy: { createdAt: "desc" } },
        returns: { include: { lines: true }, orderBy: { createdAt: "desc" } },
        qcRequests: {
          include: { reports: { include: { nonConformities: true } } },
          orderBy: { createdAt: "desc" },
        },
        sourcingCases: {
          include: {
            supplier: { select: { id: true, name: true, country: true } },
            offers: { orderBy: { createdAt: "desc" } },
          },
          orderBy: { createdAt: "desc" },
        },
        marginReport: true,
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
      budgetPlannedXAF?: number;
    },
    updatedById?: string,
    revisionReason?: string
    ) {
      const existing = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      if (!existing) throw new Error("Commande introuvable");
      await this.assertClientFacingContact(existing.tenantId, data.contactId ?? existing.contactId);

    const lastRevision = await prisma.orderRevision.findFirst({
      where: { orderId },
      orderBy: { revisionNumber: "desc" },
      select: { revisionNumber: true },
    });
    const nextRevisionNumber = lastRevision ? lastRevision.revisionNumber + 1 : 1;
    await prisma.orderRevision.create({
      data: {
        orderId,
        revisionNumber: nextRevisionNumber,
        reason: revisionReason || "Order update",
        snapshot: serializeDecimals({
          order: existing,
          items: existing.items,
        }),
        createdById: updatedById || undefined,
      },
    });

    const fxRates = await FxService.getLatestRates();
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
        const unitPriceXAF = convertCurrency(item.unitPrice, item.currency || "RMB", "XAF", fxRates);
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
    const budgetPlannedXAF =
      data.budgetPlannedXAF ??
      (Number(existing.budgetPlannedXAF || 0) || (merchandiseTotal + logisticsCost + insuranceAmount));

    const snapshotRates = (existing.fxRatesSnapshot as Record<string, number>) || {};
    const computeImpact = (items: typeof existing.items) => {
      let impact = 0;
      for (const item of items) {
        try {
          const baseAmount = Number(item.unitPrice);
          const qty = item.quantity;
          const xafSnapshot = convertCurrency(baseAmount, item.currency || "RMB", "XAF", snapshotRates);
          const xafLatest = convertCurrency(baseAmount, item.currency || "RMB", "XAF", fxRates);
          impact += (xafLatest - xafSnapshot) * qty;
        } catch {
          continue;
        }
      }
      return impact;
    };
    const fxImpactXAF = computeImpact(data.items && data.items.length > 0 ? (itemsPayload as any) : existing.items);

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
          ...(data.originCountry && { originCountry: data.originCountry }),
          ...(data.notes !== undefined && { notes: data.notes }),
          ...(data.ownerId !== undefined && { ownerId: data.ownerId }),
          ...(data.onboardedById !== undefined && { onboardedById: data.onboardedById }),
          ...(data.logisticsCost !== undefined && { logisticsCost }),
          ...(data.insuranceAmount !== undefined && { insuranceAmount }),
          ...(data.commissionRate !== undefined && { commissionRate }),
          ...(data.budgetPlannedXAF !== undefined && { budgetPlannedXAF }),
          merchandiseTotal,
          commissionAmount,
          totalClient,
          fxRatesSnapshot: FxService.buildSnapshot(fxRates),
          fxImpactXAF,
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

    await OrderApprovalService.syncOrderApprovals(orderId);
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
        approvalStatus: "NOT_REQUIRED",
        originCountry: existing.originCountry,
        riskLevel: existing.riskLevel,
        budgetPlannedXAF: existing.budgetPlannedXAF,
        budgetActualXAF: existing.budgetActualXAF,
        fxRatesSnapshot: existing.fxRatesSnapshot as any,
        fxImpactXAF: existing.fxImpactXAF,
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
      data: OrderService.hasArchivedAtField() ? { archivedAt: new Date() } : {},
    });
  }

  static async restore(orderId: string) {
    return prisma.order.update({
      where: { id: orderId },
      data: OrderService.hasArchivedAtField() ? { archivedAt: null } : {},
    });
  }

  static async deleteOrder(orderId: string) {
    return prisma.order.delete({ where: { id: orderId } });
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
    if (["PENDING", "REJECTED"].includes(order.approvalStatus as any) && !["DEMANDE", "DEVIS"].includes(newStatus)) {
      throw new Error("Commande en attente d'approbation");
    }
    if (!canTransition(order.status, newStatus)) {
      throw new Error(
        `Transition impossible: ${order.status} -> ${newStatus}`
      );
    }

    await this.assertQualityAndReturnGates(orderId, newStatus);

    // Compute new risk level based on incoming status
    const riskResult = RiskCalculatorService.computeLight({
      status: newStatus,
      priority: order.priority as string,
      riskLevel: order.riskLevel as string,
      estimatedDelivery: order.estimatedDelivery ?? null,
    });

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: newStatus,
        riskLevel: riskResult.level as any,
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

    if (newStatus === "LIVRE") {
      const existingInvoice = await prisma.invoice.findFirst({
        where: { orderId },
        select: { id: true },
      });
      if (!existingInvoice) {
        const year = new Date().getFullYear();
        const prefix = `INV-${year}-`;
        const last = await prisma.invoice.findFirst({
          where: { tenantId: order.tenantId, invoiceNumber: { startsWith: prefix } },
          orderBy: { invoiceNumber: "desc" },
          select: { invoiceNumber: true },
        });
        const lastNum = last ? parseInt(last.invoiceNumber.split("-")[2] || "0") : 0;
        const nextNum = String(lastNum + 1).padStart(5, "0");
        const invoiceNumber = `${prefix}${nextNum}`;

        await InvoiceService.create({
          tenantId: order.tenantId,
          direction: "AR",
          invoiceNumber,
          contactId: order.contactId,
          orderId: order.id,
          currency: order.currency || "XAF",
          issuedAt: new Date(),
          notes: `Facture automatique - livraison ${order.orderNumber}`,
          lines: [
            {
              description: `Commande ${order.orderNumber}`,
              quantity: 1,
              unitPrice: Number(order.totalClient),
            },
          ],
        });
      }

      try {
        await CatalogMemoryService.recordDeliveredOrder(orderId);
      } catch (error) {
        console.error("Catalog memory sync failed:", error);
      }
    }

    await emitEvent("order.status_changed", "order", orderId, {
      previousStatus: order.status,
      newStatus,
      userId,
    });

    return updated;
  }

  private static async assertQualityAndReturnGates(orderId: string, newStatus: OrderStatus) {
    const statusesRequiringQcClearance: OrderStatus[] = [
      "QC_VALIDE",
      "EN_TRANSIT",
      "DEDOUANE",
      "LIVRE",
      "CLOTURE",
    ];

    if (statusesRequiringQcClearance.includes(newStatus)) {
      const [latestRequest, latestInspection] = await Promise.all([
        prisma.qCRequest.findFirst({
          where: { orderId, status: { in: ["FAILED", "PASSED", "CONDITIONAL"] } },
          orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
          select: { status: true, completedAt: true },
        }),
        prisma.qcInspection.findFirst({
          where: { orderId, status: "COMPLETED", overall: { not: null } },
          orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
          select: { overall: true },
        }),
      ]);

      if (latestRequest?.status === "FAILED" || latestInspection?.overall === "FAIL") {
        throw new Error("Blocage qualite: un QC en echec doit etre corrige avant progression de la commande");
      }
    }

    if (newStatus === "CLOTURE") {
      const returnModel = (prisma as any).returnMerchandise;
      if (returnModel) {
        const openReturns = await returnModel.count({
          where: {
            orderId,
            status: { notIn: ["RESOLVED", "CLOSED", "REJECTED"] },
          },
        });
        if (openReturns > 0) {
          throw new Error("Impossible de cloturer: des retours marchandise sont encore ouverts");
        }
      }
    }
  }

  static async getStatusCounts(tenantId: string, scopeWhere?: Prisma.OrderWhereInput) {
    const counts = await prisma.order.groupBy({
      by: ["status"],
      where: {
        tenantId,
        ...(OrderService.hasArchivedAtField() ? { archivedAt: null } : {}),
        ...(scopeWhere || {}),
      },
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
