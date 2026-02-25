import { prisma } from "@/lib/db";
import type { LeadStatus, Prisma } from "@prisma/client";

export class LeadService {
  static async create(data: {
    contactId: string;
    source?: string;
    description?: string;
    estimatedValue?: number;
    currency?: string;
    category?: string;
    assignedTo?: string;
    ownerId?: string;
    onboardedById?: string;
    collaboratorIds?: string[];
  }) {
    const collaboratorIds = (data.collaboratorIds || []).filter(Boolean);
    return prisma.lead.create({
      data: {
        contactId: data.contactId,
        source: data.source,
        description: data.description,
        estimatedValue: data.estimatedValue,
        currency: data.currency || "XAF",
        category: data.category,
        assignedTo: data.assignedTo,
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
        contact: { select: { name: true } },
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

  static async updateStatus(leadId: string, status: LeadStatus) {
    return prisma.lead.update({
      where: { id: leadId },
      data: { status },
    });
  }

  static async list(
    tenantId: string,
    options: {
      status?: LeadStatus;
      assignedTo?: string;
      search?: string;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const { status, assignedTo, search, page = 1, limit = 20 } = options;

    const where: Prisma.LeadWhereInput = {
      contact: { tenantId },
      ...(status && { status }),
      ...(assignedTo && { assignedTo }),
      ...(search && {
        OR: [
          { description: { contains: search, mode: "insensitive" as const } },
          { source: { contains: search, mode: "insensitive" as const } },
          { category: { contains: search, mode: "insensitive" as const } },
          { contact: { name: { contains: search, mode: "insensitive" as const } } },
        ],
      }),
    };

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          contact: { select: { name: true, company: true, phone: true } },
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
      prisma.lead.count({ where }),
    ]);

    return { leads, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  static async getById(leadId: string) {
    return prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        onboardedBy: { select: { id: true, name: true, email: true } },
        collaborators: {
          select: {
            userId: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
        contact: {
          select: {
            id: true,
            name: true,
            company: true,
            phone: true,
            email: true,
            whatsapp: true,
            city: true,
            country: true,
            type: true,
            tenantId: true,
          },
        },
      },
    });
  }

  static async update(
    leadId: string,
    data: Partial<{
      source: string;
      description: string;
      estimatedValue: number;
      currency: string;
      category: string;
      assignedTo: string;
      status: LeadStatus;
      ownerId: string | null;
      collaboratorIds: string[];
    }>
  ) {
    const { collaboratorIds, ...updateData } = data;
    const payload: Prisma.LeadUpdateInput = {
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

    return prisma.lead.update({
      where: { id: leadId },
      data: payload,
      include: {
        contact: { select: { name: true } },
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

  static async getPipelineStats(tenantId: string) {
    const pipeline = await prisma.lead.groupBy({
      by: ["status"],
      where: { contact: { tenantId } },
      _count: { id: true },
      _sum: { estimatedValue: true },
    });

    return pipeline.map((item) => ({
      status: item.status,
      count: item._count.id,
      totalValue: Number(item._sum.estimatedValue || 0),
    }));
  }
}
