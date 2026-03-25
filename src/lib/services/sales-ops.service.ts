import { prisma } from "@/lib/db";

export class SalesOpsService {
  static async listTeams(tenantId: string) {
    return prisma.salesTeam.findMany({
      where: { tenantId },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        territory: { select: { id: true, name: true } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        quotas: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async createTeam(tenantId: string, data: {
    name: string;
    managerId?: string | null;
    territoryId?: string | null;
    currency?: string;
    targetAmount?: number;
    memberIds?: string[];
  }) {
    return prisma.salesTeam.create({
      data: {
        tenantId,
        name: data.name,
        managerId: data.managerId || undefined,
        territoryId: data.territoryId || undefined,
        currency: data.currency || "XAF",
        targetAmount: data.targetAmount ?? 0,
        members: data.memberIds?.length
          ? {
              createMany: {
                data: data.memberIds.map((userId) => ({ userId })),
              },
            }
          : undefined,
      },
    });
  }

  static async updateTeam(teamId: string, data: {
    name?: string;
    managerId?: string | null;
    territoryId?: string | null;
    currency?: string;
    targetAmount?: number;
    memberIds?: string[];
  }) {
    const updateData: any = {
      ...(data.name ? { name: data.name } : {}),
      ...(data.managerId !== undefined ? { managerId: data.managerId } : {}),
      ...(data.territoryId !== undefined ? { territoryId: data.territoryId } : {}),
      ...(data.currency ? { currency: data.currency } : {}),
      ...(data.targetAmount !== undefined ? { targetAmount: data.targetAmount } : {}),
    };

    if (data.memberIds) {
      updateData.members = {
        deleteMany: {},
        createMany: { data: data.memberIds.map((userId) => ({ userId })) },
      };
    }

    return prisma.salesTeam.update({
      where: { id: teamId },
      data: updateData,
    });
  }

  static async listTerritories(tenantId: string) {
    return prisma.salesTerritory.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
  }

  static async createTerritory(tenantId: string, data: {
    name: string;
    countryCodes?: string[];
    cityNames?: string[];
  }) {
    return prisma.salesTerritory.create({
      data: {
        tenantId,
        name: data.name,
        countryCodes: data.countryCodes || [],
        cityNames: data.cityNames || [],
      },
    });
  }

  static async listQuotas(tenantId: string) {
    return prisma.salesQuota.findMany({
      where: { tenantId },
      include: {
        team: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { periodStart: "desc" },
    });
  }

  static async createQuota(tenantId: string, data: {
    teamId?: string | null;
    userId?: string | null;
    periodStart: Date;
    periodEnd: Date;
    targetAmount: number;
    currency?: string;
  }) {
    return prisma.salesQuota.create({
      data: {
        tenantId,
        teamId: data.teamId || undefined,
        userId: data.userId || undefined,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        targetAmount: data.targetAmount,
        currency: data.currency || "XAF",
      },
    });
  }
}
