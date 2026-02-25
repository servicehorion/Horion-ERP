import { prisma } from "@/lib/db";
import type { ContactType, Prisma } from "@prisma/client";

export class ContactService {
  static async create(tenantId: string, data: {
    name: string;
    type: ContactType;
    company?: string;
    phone?: string;
    email?: string;
    whatsapp?: string;
    city?: string;
    country?: string;
    notes?: string;
    tags?: string[];
    ownerId?: string;
    onboardedById?: string;
    collaboratorIds?: string[];
  }) {
    const collaboratorIds = (data.collaboratorIds || []).filter(Boolean);
    return prisma.contact.create({
      data: {
        tenantId,
        name: data.name,
        type: data.type,
        company: data.company,
        phone: data.phone,
        email: data.email,
        whatsapp: data.whatsapp,
        city: data.city,
        country: data.country || "CG",
        notes: data.notes,
        tags: data.tags || [],
        ownerId: data.ownerId,
        onboardedById: data.onboardedById,
        collaborators: collaboratorIds.length > 0
          ? {
              createMany: {
                data: collaboratorIds.map((userId) => ({ userId })),
              },
            }
          : undefined,
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        onboardedBy: { select: { id: true, name: true, email: true } },
        collaborators: {
          select: {
            userId: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
  }

  static async update(contactId: string, data: Partial<{
    name: string;
    type: ContactType;
    company: string;
    phone: string;
    email: string;
    whatsapp: string;
    city: string;
    country: string;
    notes: string;
    trustScore: number;
    tags: string[];
    ownerId: string | null;
    collaboratorIds: string[];
  }>) {
    const { collaboratorIds, ...updateData } = data;
    const payload: Prisma.ContactUpdateInput = {
      ...updateData,
    };

    if (collaboratorIds !== undefined) {
      payload.collaborators = {
        deleteMany: {},
        ...(collaboratorIds.length > 0
          ? { createMany: { data: collaboratorIds.map((userId) => ({ userId })) } }
          : {}),
      };
    }

    return prisma.contact.update({
      where: { id: contactId },
      data: payload,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        onboardedBy: { select: { id: true, name: true, email: true } },
        collaborators: {
          select: {
            userId: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
  }

  static async list(
    tenantId: string,
    options: {
      type?: ContactType;
      search?: string;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const { type, search, page = 1, limit = 20 } = options;

    const where: Prisma.ContactWhereInput = {
      tenantId,
      ...(type && { type }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { company: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    const [contacts, total] = await Promise.all([
        prisma.contact.findMany({
          where,
          include: {
            _count: { select: { orders: true, leads: true } },
            financialMetrics: true,
            owner: { select: { id: true, name: true, email: true } },
            onboardedBy: { select: { id: true, name: true, email: true } },
            collaborators: {
              select: {
                userId: true,
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contact.count({ where }),
    ]);

    return { contacts, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  static async getById(contactId: string) {
    return prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        onboardedBy: { select: { id: true, name: true, email: true } },
        collaborators: {
          select: {
            userId: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
        orders: {
          select: { id: true, orderNumber: true, status: true, totalClient: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        leads: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        _count: { select: { orders: true, leads: true } },
      },
    });
  }

  static async getTypeCount(tenantId: string) {
    const counts = await prisma.contact.groupBy({
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
