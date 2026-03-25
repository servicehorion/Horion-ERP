import { prisma } from "@/lib/db";

export class AssetService {
  private static getModel<T extends keyof typeof prisma>(name: T) {
    const model = (prisma as any)[name];
    if (!model) {
      console.warn(`Prisma client missing model: ${String(name)}. Run \`npx prisma generate\`.`);
    }
    return model;
  }

  static async listCategories(tenantId: string) {
    const model = this.getModel("assetCategory");
    if (!model) return [];
    return model.findMany({ where: { tenantId }, orderBy: { name: "asc" } });
  }

  static async createCategory(params: { tenantId: string; name: string; code?: string }) {
    const model = this.getModel("assetCategory");
    if (!model) {
      throw new Error("Model assetCategory missing. Run `npx prisma generate`.");
    }
    return model.create({
      data: {
        tenantId: params.tenantId,
        name: params.name,
        code: params.code || undefined,
      },
    });
  }

  static async listAssets(tenantId: string) {
    const model = this.getModel("fixedAsset");
    if (!model) return [];
    return model.findMany({
      where: { tenantId },
      include: { category: true, depreciations: { orderBy: { createdAt: "desc" }, take: 5 } },
      orderBy: { createdAt: "desc" },
    });
  }

  static async createAsset(params: {
    tenantId: string;
    categoryId?: string;
    name: string;
    acquisitionDate: Date;
    acquisitionCost: number;
    currency: string;
    usefulLifeMonths: number;
    salvageValue?: number;
  }) {
    const netBookValue = params.acquisitionCost - (params.salvageValue || 0);
    const model = this.getModel("fixedAsset");
    if (!model) {
      throw new Error("Model fixedAsset missing. Run `npx prisma generate`.");
    }
    return model.create({
      data: {
        tenantId: params.tenantId,
        categoryId: params.categoryId || undefined,
        name: params.name,
        acquisitionDate: params.acquisitionDate,
        acquisitionCost: params.acquisitionCost,
        currency: params.currency,
        usefulLifeMonths: params.usefulLifeMonths,
        salvageValue: params.salvageValue || 0,
        netBookValue,
      },
    });
  }

  static async runDepreciation(params: { tenantId: string; period: string }) {
    const fixedAssetModel = this.getModel("fixedAsset");
    const depreciationModel = this.getModel("assetDepreciation");
    if (!fixedAssetModel || !depreciationModel) {
      throw new Error("Asset models missing. Run `npx prisma generate`.");
    }
    const assets = await fixedAssetModel.findMany({
      where: { tenantId: params.tenantId, status: "ACTIVE" },
    });

    let created = 0;
    for (const asset of assets) {
      const monthly = Number(asset.acquisitionCost - asset.salvageValue) / asset.usefulLifeMonths;
      if (monthly <= 0) continue;

      await depreciationModel.create({
        data: {
          tenantId: params.tenantId,
          assetId: asset.id,
          period: params.period,
          amount: monthly,
        },
      });

      const newAccumulated = Number(asset.accumulatedDepreciation) + monthly;
      const newNBV = Math.max(0, Number(asset.acquisitionCost) - Number(asset.salvageValue) - newAccumulated);

      await fixedAssetModel.update({
        where: { id: asset.id },
        data: {
          accumulatedDepreciation: newAccumulated,
          netBookValue: newNBV,
        },
      });

      created++;
    }

    return { created };
  }
}
