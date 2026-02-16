import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export class CatalogMediaService {
  static async create(tenantId: string, data: {
    type: string;
    url: string;
    filename?: string;
    tags?: string[];
    linkedEntityType: string;
    linkedEntityId: string;
    productId?: string;
    supplierId?: string;
    orderId?: string;
  }) {
    return prisma.catalogMedia.create({
      data: {
        tenantId,
        type: data.type,
        url: data.url,
        filename: data.filename,
        tags: data.tags || [],
        linkedEntityType: data.linkedEntityType,
        linkedEntityId: data.linkedEntityId,
        productId: data.productId,
        supplierId: data.supplierId,
        orderId: data.orderId,
      },
    });
  }

  static async list(tenantId: string, options: {
    linkedEntityType?: string;
    linkedEntityId?: string;
    productId?: string;
    supplierId?: string;
    type?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const { linkedEntityType, linkedEntityId, productId, supplierId, type, page = 1, limit = 20 } = options;

    const where: Prisma.CatalogMediaWhereInput = {
      tenantId,
      ...(linkedEntityType && { linkedEntityType }),
      ...(linkedEntityId && { linkedEntityId }),
      ...(productId && { productId }),
      ...(supplierId && { supplierId }),
      ...(type && { type }),
    };

    const [media, total] = await Promise.all([
      prisma.catalogMedia.findMany({
        where,
        include: {
          product: { select: { name: true } },
          supplier: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.catalogMedia.count({ where }),
    ]);

    return { media, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  static async delete(mediaId: string) {
    return prisma.catalogMedia.delete({ where: { id: mediaId } });
  }

  static async getCountsByType(tenantId: string) {
    const counts = await prisma.catalogMedia.groupBy({
      by: ["type"],
      where: { tenantId },
      _count: { id: true },
    });
    return counts.reduce(
      (acc, item) => ({ ...acc, [item.type]: item._count.id }),
      {} as Record<string, number>
    );
  }
}
