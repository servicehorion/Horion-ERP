import { prisma } from "@/lib/db";
import type { Prisma, SourcingStatus } from "@prisma/client";

const VALID_TRANSITIONS: Record<SourcingStatus, SourcingStatus[]> = {
  SEARCHING: ["OFFERS_RECEIVED", "CANCELLED"],
  OFFERS_RECEIVED: ["NEGOTIATING", "SELECTED", "CANCELLED"],
  NEGOTIATING: ["SELECTED", "OFFERS_RECEIVED", "CANCELLED"],
  SELECTED: ["CONFIRMED", "NEGOTIATING", "CANCELLED"],
  CONFIRMED: [],
  CANCELLED: ["SEARCHING"],
};

export class SourcingCaseService {
  static async create(data: {
    orderId: string;
    requirement: string;
    budget?: number;
    currency?: string;
  }) {
    return prisma.sourcingCase.create({
      data: {
        orderId: data.orderId,
        requirement: data.requirement,
        budget: data.budget,
        currency: data.currency || "RMB",
      },
      include: {
        order: { select: { orderNumber: true, contact: { select: { name: true } } } },
        supplier: { select: { name: true } },
        _count: { select: { offers: true, negotiations: true } },
      },
    });
  }

  static async getById(id: string) {
    return prisma.sourcingCase.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            tenantId: true,
            status: true,
            currency: true,
            merchandiseTotal: true,
            contact: { select: { id: true, name: true, company: true } },
          },
        },
        supplier: { select: { id: true, name: true, country: true, city: true, rating: true } },
        offers: {
          include: {
            supplier: { select: { id: true, name: true, country: true, rating: true } },
            product: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        negotiations: {
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  static async list(
    tenantId: string,
    options: {
      status?: SourcingStatus;
      search?: string;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const { status, search, page = 1, limit = 20 } = options;

    const where: Prisma.SourcingCaseWhereInput = {
      order: { tenantId },
      ...(status && { status }),
      ...(search && {
        OR: [
          { requirement: { contains: search, mode: "insensitive" as const } },
          { order: { orderNumber: { contains: search, mode: "insensitive" as const } } },
        ],
      }),
    };

    const [cases, total] = await Promise.all([
      prisma.sourcingCase.findMany({
        where,
        include: {
          order: { select: { orderNumber: true, contact: { select: { name: true } } } },
          supplier: { select: { id: true, name: true } },
          _count: { select: { offers: true, negotiations: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.sourcingCase.count({ where }),
    ]);

    return { cases, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  static async updateStatus(id: string, newStatus: SourcingStatus) {
    const current = await prisma.sourcingCase.findUnique({ where: { id } });
    if (!current) throw new Error("Cas de sourcing introuvable");

    const allowed = VALID_TRANSITIONS[current.status];
    if (!allowed.includes(newStatus)) {
      throw new Error(
        `Transition invalide : ${current.status} → ${newStatus}. Transitions permises : ${allowed.join(", ")}`
      );
    }

    return prisma.sourcingCase.update({
      where: { id },
      data: { status: newStatus },
      include: {
        order: { select: { orderNumber: true } },
        supplier: { select: { name: true } },
      },
    });
  }

  static async selectSupplier(id: string, supplierId: string, offerId: string) {
    return prisma.$transaction(async (tx) => {
      // Mark the offer as selected
      await tx.offer.updateMany({
        where: { sourcingCaseId: id },
        data: { isSelected: false },
      });
      await tx.offer.update({
        where: { id: offerId },
        data: { isSelected: true },
      });

      // Update sourcing case
      return tx.sourcingCase.update({
        where: { id },
        data: {
          supplierId,
          status: "SELECTED",
          selectedAt: new Date(),
        },
        include: {
          order: { select: { orderNumber: true } },
          supplier: { select: { name: true } },
          offers: {
            include: { supplier: { select: { name: true } } },
          },
        },
      });
    });
  }

  static async confirmSelection(id: string) {
    const current = await prisma.sourcingCase.findUnique({ where: { id } });
    if (!current) throw new Error("Cas de sourcing introuvable");
    if (current.status !== "SELECTED") {
      throw new Error("Un fournisseur doit être sélectionné avant de confirmer");
    }

    return prisma.sourcingCase.update({
      where: { id },
      data: { status: "CONFIRMED" },
      include: {
        order: { select: { orderNumber: true } },
        supplier: { select: { name: true } },
      },
    });
  }

  static async addNegotiationLog(data: {
    sourcingCaseId: string;
    message: string;
    direction: string;
    channel?: string;
  }) {
    const log = await prisma.negotiationLog.create({
      data: {
        sourcingCaseId: data.sourcingCaseId,
        message: data.message,
        direction: data.direction,
        channel: data.channel,
      },
    });

    // Auto-transition to NEGOTIATING if currently in OFFERS_RECEIVED
    const sc = await prisma.sourcingCase.findUnique({
      where: { id: data.sourcingCaseId },
    });
    if (sc && sc.status === "OFFERS_RECEIVED") {
      await prisma.sourcingCase.update({
        where: { id: data.sourcingCaseId },
        data: { status: "NEGOTIATING" },
      });
    }

    return log;
  }

  static async addOffer(data: {
    sourcingCaseId: string;
    supplierId: string;
    supplierProductId?: string;
    productId?: string;
    unitPrice: number;
    currency?: string;
    moq?: number;
    leadTimeDays?: number;
    sampleAvailable?: boolean;
    notes?: string;
    validTo?: Date;
  }) {
    const offer = await prisma.offer.create({
      data: {
        sourcingCaseId: data.sourcingCaseId,
        supplierId: data.supplierId,
        supplierProductId: data.supplierProductId,
        productId: data.productId,
        unitPrice: data.unitPrice,
        currency: data.currency || "RMB",
        moq: data.moq,
        leadTimeDays: data.leadTimeDays,
        sampleAvailable: data.sampleAvailable || false,
        notes: data.notes,
        validTo: data.validTo,
        sourceType: "sourcing",
      },
      include: {
        supplier: { select: { name: true } },
      },
    });

    // Auto-transition to OFFERS_RECEIVED if currently SEARCHING
    const sc = await prisma.sourcingCase.findUnique({
      where: { id: data.sourcingCaseId },
    });
    if (sc && sc.status === "SEARCHING") {
      await prisma.sourcingCase.update({
        where: { id: data.sourcingCaseId },
        data: { status: "OFFERS_RECEIVED" },
      });
    }

    return offer;
  }

  static async getPipelineStats(tenantId: string) {
    const pipeline = await prisma.sourcingCase.groupBy({
      by: ["status"],
      where: { order: { tenantId } },
      _count: { id: true },
    });

    return pipeline.map((item) => ({
      status: item.status,
      count: item._count.id,
    }));
  }

  static async getKanbanData(tenantId: string) {
    return prisma.sourcingCase.findMany({
      where: { order: { tenantId } },
      include: {
        order: { select: { orderNumber: true, contact: { select: { name: true } } } },
        supplier: { select: { id: true, name: true } },
        _count: { select: { offers: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  }
}
