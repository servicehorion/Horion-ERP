import { prisma } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import type { SupplierStatus, Prisma } from "@prisma/client";

export class CatalogSupplierService {
  static async create(data: {
    name: string;
    country?: string;
    city?: string;
    platform?: string;
    status?: SupplierStatus;
    contactName?: string;
    phone?: string;
    whatsapp?: string;
    wechat?: string;
    email?: string;
    website?: string;
    storeUrl?: string;
    address?: string;
    category?: string;
    leadTimeDays?: number;
    sampleLeadTimeDays?: number;
    responseTimeHours?: number;
    productionCapacityMonthly?: number;
    moq?: string;
    paymentTerms?: string;
    languagesJson?: string[];
    certificationsJson?: string[];
    contactsJson?: Record<string, unknown>;
    negotiatedTermsJson?: Record<string, unknown>;
    notes?: string;
  }) {
    const supplier = await prisma.supplier.create({
      data: {
        name: data.name,
        country: data.country || "CN",
        city: data.city,
        platform: data.platform,
        status: data.status || "ACTIVE",
        contactName: data.contactName,
        phone: data.phone,
        whatsapp: data.whatsapp,
        wechat: data.wechat,
        email: data.email,
        website: data.website,
        storeUrl: data.storeUrl,
        address: data.address,
        category: data.category,
        leadTimeDays: data.leadTimeDays,
        sampleLeadTimeDays: data.sampleLeadTimeDays,
        responseTimeHours: data.responseTimeHours,
        productionCapacityMonthly: data.productionCapacityMonthly,
        moq: data.moq,
        paymentTerms: data.paymentTerms,
        languagesJson: data.languagesJson ?? undefined,
        certificationsJson: data.certificationsJson ?? undefined,
        contactsJson: data.contactsJson ? JSON.parse(JSON.stringify(data.contactsJson)) : undefined,
        negotiatedTermsJson: data.negotiatedTermsJson ? JSON.parse(JSON.stringify(data.negotiatedTermsJson)) : undefined,
        notes: data.notes,
      },
    });

    await emitEvent("supplier_created", "supplier", supplier.id, {
      name: supplier.name, platform: supplier.platform,
    });

    return supplier;
  }

  static async update(supplierId: string, data: Partial<{
    name: string;
    country: string;
    city: string;
    platform: string;
    status: SupplierStatus;
    contactName: string;
    phone: string;
    whatsapp: string;
    wechat: string;
    email: string;
    website: string;
    storeUrl: string;
    address: string;
    category: string;
    leadTimeDays: number;
    sampleLeadTimeDays: number;
    responseTimeHours: number;
    productionCapacityMonthly: number;
    moq: string;
    paymentTerms: string;
    languagesJson: string[];
    certificationsJson: string[];
    contactsJson: Record<string, unknown>;
    negotiatedTermsJson: Record<string, unknown>;
    notes: string;
    isVerified: boolean;
  }>) {
    const updateData: Record<string, unknown> = { ...data };
    if (data.languagesJson) updateData.languagesJson = JSON.parse(JSON.stringify(data.languagesJson));
    if (data.certificationsJson) updateData.certificationsJson = JSON.parse(JSON.stringify(data.certificationsJson));
    if (data.contactsJson) updateData.contactsJson = JSON.parse(JSON.stringify(data.contactsJson));
    if (data.negotiatedTermsJson) updateData.negotiatedTermsJson = JSON.parse(JSON.stringify(data.negotiatedTermsJson));

    return prisma.supplier.update({
      where: { id: supplierId },
      data: updateData as Prisma.SupplierUpdateInput,
    });
  }

  static async list(options: {
    status?: SupplierStatus;
    platform?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const { status, platform, search, page = 1, limit = 20 } = options;

    const where: Prisma.SupplierWhereInput = {
      ...(status && { status }),
      ...(platform && { platform }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { city: { contains: search, mode: "insensitive" as const } },
          { category: { contains: search, mode: "insensitive" as const } },
          { contactName: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        include: {
          _count: { select: { supplierProducts: true, offers: true, supplierScores: true, sourcingCases: true } },
        },
        orderBy: { rating: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.supplier.count({ where }),
    ]);

    return { suppliers, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  static async getById(supplierId: string) {
    return prisma.supplier.findUnique({
      where: { id: supplierId },
      include: {
        supplierProducts: {
          include: { product: true },
        },
        offers: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { product: true },
        },
        supplierScores: { orderBy: { createdAt: "desc" }, take: 20 },
        sourcingCases: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { order: { select: { orderNumber: true, status: true } } },
        },
        catalogMedia: { orderBy: { createdAt: "desc" }, take: 20 },
        _count: { select: { supplierProducts: true, offers: true, sourcingCases: true, catalogMedia: true } },
      },
    });
  }

  static async getStatusCounts() {
    const counts = await prisma.supplier.groupBy({
      by: ["status"],
      _count: { id: true },
    });
    return counts.reduce(
      (acc, item) => ({ ...acc, [item.status]: item._count.id }),
      {} as Record<string, number>
    );
  }

  static async getTopByRating(limit = 5) {
    return prisma.supplier.findMany({
      where: { status: "ACTIVE" },
      orderBy: { rating: "desc" },
      take: limit,
      include: {
        _count: { select: { supplierProducts: true, sourcingCases: true } },
      },
    });
  }

  static async blacklist(supplierId: string, reason: string) {
    const supplier = await prisma.supplier.update({
      where: { id: supplierId },
      data: { status: "BLACKLIST", notes: reason },
    });

    await emitEvent("supplier_blacklisted", "supplier", supplierId, { reason });
    return supplier;
  }
}
