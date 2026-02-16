import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export class CatalogOfferService {
  static async create(data: {
    supplierId: string;
    supplierProductId?: string;
    productId?: string;
    sourcingCaseId?: string;
    unitPrice: number;
    currency?: string;
    moq?: number;
    leadTimeDays?: number;
    sampleAvailable?: boolean;
    validFrom?: Date;
    validTo?: Date;
    sourceType?: string;
    sourceId?: string;
    notes?: string;
  }) {
    return prisma.offer.create({
      data: {
        supplierId: data.supplierId,
        supplierProductId: data.supplierProductId,
        productId: data.productId,
        sourcingCaseId: data.sourcingCaseId,
        unitPrice: data.unitPrice,
        currency: data.currency || "RMB",
        moq: data.moq,
        leadTimeDays: data.leadTimeDays,
        sampleAvailable: data.sampleAvailable || false,
        validFrom: data.validFrom || new Date(),
        validTo: data.validTo,
        sourceType: data.sourceType || "manual",
        sourceId: data.sourceId,
        notes: data.notes,
      },
      include: {
        supplier: { select: { name: true } },
        product: { select: { name: true } },
      },
    });
  }

  static async list(options: {
    productId?: string;
    supplierId?: string;
    supplierProductId?: string;
    sourceType?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const { productId, supplierId, supplierProductId, sourceType, page = 1, limit = 20 } = options;

    const where: Prisma.OfferWhereInput = {
      ...(productId && { productId }),
      ...(supplierId && { supplierId }),
      ...(supplierProductId && { supplierProductId }),
      ...(sourceType && { sourceType }),
    };

    const [offers, total] = await Promise.all([
      prisma.offer.findMany({
        where,
        include: {
          supplier: { select: { name: true, city: true, platform: true } },
          product: { select: { name: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.offer.count({ where }),
    ]);

    return { offers, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  static async getPriceHistory(productId: string, supplierId?: string) {
    const where: Prisma.OfferWhereInput = {
      productId,
      ...(supplierId && { supplierId }),
    };

    return prisma.offer.findMany({
      where,
      include: { supplier: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  static async recordFromOrder(data: {
    orderId: string;
    supplierId: string;
    productId?: string;
    unitPrice: number;
    currency: string;
    moq?: number;
    leadTimeDays?: number;
  }) {
    return this.create({
      ...data,
      sourceType: "order",
      sourceId: data.orderId,
    });
  }
}
