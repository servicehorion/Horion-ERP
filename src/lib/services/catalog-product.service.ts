import { prisma } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import type { ProductStatus, Prisma } from "@prisma/client";

export class CatalogProductService {
  static async create(tenantId: string, data: {
    name: string;
    categoryId?: string;
    status?: ProductStatus;
    specsJson?: Record<string, unknown>;
    weightEstimate?: number;
    volumeEstimate?: number;
    qcRecommendedLevel?: string;
    moqMin?: number;
    priceMin?: number;
    priceMax?: number;
    priceCurrency?: string;
    shippingHints?: Record<string, unknown>;
    notes?: string;
  }) {
    const product = await prisma.catalogProduct.create({
      data: {
        tenantId,
        name: data.name,
        categoryId: data.categoryId,
        status: data.status || "TESTING",
        specsJson: data.specsJson ? JSON.parse(JSON.stringify(data.specsJson)) : undefined,
        weightEstimate: data.weightEstimate,
        volumeEstimate: data.volumeEstimate,
        qcRecommendedLevel: data.qcRecommendedLevel,
        moqMin: data.moqMin,
        priceMin: data.priceMin,
        priceMax: data.priceMax,
        priceCurrency: data.priceCurrency || "RMB",
        shippingHints: data.shippingHints ? JSON.parse(JSON.stringify(data.shippingHints)) : undefined,
        notes: data.notes,
      },
      include: { category: true },
    });

    await emitEvent("catalog_product_created", "product", product.id, {
      name: product.name, status: product.status,
    });

    return product;
  }

  static async update(productId: string, data: Partial<{
    name: string;
    categoryId: string;
    status: ProductStatus;
    specsJson: Record<string, unknown>;
    weightEstimate: number;
    volumeEstimate: number;
    qcRecommendedLevel: string;
    moqMin: number;
    priceMin: number;
    priceMax: number;
    priceCurrency: string;
    shippingHints: Record<string, unknown>;
    marketingPack: Record<string, unknown>;
    notes: string;
  }>) {
    const updateData: Record<string, unknown> = { ...data };
    if (data.specsJson) updateData.specsJson = JSON.parse(JSON.stringify(data.specsJson));
    if (data.shippingHints) updateData.shippingHints = JSON.parse(JSON.stringify(data.shippingHints));
    if (data.marketingPack) updateData.marketingPack = JSON.parse(JSON.stringify(data.marketingPack));

    return prisma.catalogProduct.update({
      where: { id: productId },
      data: updateData as Prisma.CatalogProductUpdateInput,
      include: { category: true },
    });
  }

  static async list(tenantId: string, options: {
    status?: ProductStatus;
    categoryId?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const { status, categoryId, search, page = 1, limit = 20 } = options;

    const where: Prisma.CatalogProductWhereInput = {
      tenantId,
      ...(status && { status }),
      ...(categoryId && { categoryId }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { notes: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    const [products, total] = await Promise.all([
      prisma.catalogProduct.findMany({
        where,
        include: {
          category: true,
          _count: { select: { supplierProducts: true, orderItems: true, qcReports: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.catalogProduct.count({ where }),
    ]);

    return { products, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  static async getById(productId: string) {
    return prisma.catalogProduct.findUnique({
      where: { id: productId },
      include: {
        category: true,
        supplierProducts: {
          include: { supplier: true },
          orderBy: { isPrimary: "desc" },
        },
        offers: {
          include: { supplier: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        qcReports: {
          include: { qcRequest: { select: { type: true, orderId: true } } },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        media: { orderBy: { createdAt: "desc" } },
        orderItems: {
          include: { order: { select: { id: true, orderNumber: true, status: true, createdAt: true } } },
          orderBy: { order: { createdAt: "desc" } },
          take: 10,
        },
        _count: { select: { supplierProducts: true, orderItems: true, qcReports: true, offers: true, media: true } },
      },
    });
  }

  static async getStatusCounts(tenantId: string) {
    const counts = await prisma.catalogProduct.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: { id: true },
    });
    return counts.reduce(
      (acc, item) => ({ ...acc, [item.status]: item._count.id }),
      {} as Record<string, number>
    );
  }

  static async getTopByDemand(tenantId: string, limit = 5) {
    return prisma.catalogProduct.findMany({
      where: { tenantId, status: { in: ["CURATED", "TESTED"] } },
      orderBy: { demandScore: "desc" },
      take: limit,
      include: { category: true },
    });
  }

  static async getCategoryStats(tenantId: string) {
    return prisma.catalogProduct.groupBy({
      by: ["categoryId"],
      where: { tenantId },
      _count: { id: true },
    });
  }
}
