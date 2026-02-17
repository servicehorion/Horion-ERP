"use server";

import { getSession } from "@/lib/session";
import { SupplierIntelligenceService } from "@/lib/services/supplier-intelligence.service";
import { checkPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import type { SupplierSegment } from "@prisma/client";

export async function getSupplierIntelligence(supplierId: string) {
  try {
    const user = await getSession();

    const profile = await SupplierIntelligenceService.getFullProfile(supplierId);
    if (!profile) {
      return { error: "Fournisseur introuvable" };
    }

    return { data: profile };
  } catch (error) {
    console.error("Error fetching supplier intelligence:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la récupération" };
  }
}

export async function recalculateSupplierIntelligence(supplierId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "catalog.manage");

    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true },
    });
    if (!supplier) {
      return { error: "Fournisseur introuvable" };
    }

    await SupplierIntelligenceService.recalculateAll(supplierId);

    revalidatePath(`/catalog/suppliers/${supplierId}`);
    revalidatePath("/sourcing");

    return { data: { success: true } };
  } catch (error) {
    console.error("Error recalculating supplier intelligence:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors du calcul" };
  }
}

export async function addSupplierSegment(
  supplierId: string,
  segment: SupplierSegment,
  notes?: string
) {
  try {
    const user = await getSession();
    checkPermission(user.role, "catalog.manage");

    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true },
    });
    if (!supplier) {
      return { error: "Fournisseur introuvable" };
    }

    const segmentation = await prisma.supplierSegmentation.upsert({
      where: {
        supplierId_segment: { supplierId, segment },
      },
      create: {
        supplierId,
        segment,
        score: 50,
        notes,
      },
      update: {
        notes,
        assignedAt: new Date(),
      },
    });

    revalidatePath(`/catalog/suppliers/${supplierId}`);
    revalidatePath("/sourcing");

    return { data: segmentation };
  } catch (error) {
    console.error("Error adding supplier segment:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de l'ajout" };
  }
}

export async function removeSupplierSegment(supplierId: string, segment: SupplierSegment) {
  try {
    const user = await getSession();
    checkPermission(user.role, "catalog.manage");

    await prisma.supplierSegmentation.delete({
      where: {
        supplierId_segment: { supplierId, segment },
      },
    });

    revalidatePath(`/catalog/suppliers/${supplierId}`);
    revalidatePath("/sourcing");

    return { data: { success: true } };
  } catch (error) {
    console.error("Error removing supplier segment:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la suppression" };
  }
}

export async function getSourcingDashboardIntelligence() {
  try {
    const user = await getSession();

    const [
      topSuppliers,
      highRiskSuppliers,
      atRiskSegments,
      strategicPartners,
      spendConcentration,
      globalStats,
    ] = await Promise.all([
      // Top suppliers by reliability
      prisma.supplierPerformanceProfile.findMany({
        include: {
          supplier: {
            select: { id: true, name: true, country: true, status: true, rating: true },
          },
        },
        orderBy: { reliabilityIndex: "desc" },
        take: 10,
      }),

      // High risk suppliers
      prisma.supplierRiskProfile.findMany({
        where: { globalRiskScore: { gte: 60 } },
        include: {
          supplier: {
            select: { id: true, name: true, country: true, status: true },
          },
        },
        orderBy: { globalRiskScore: "desc" },
        take: 5,
      }),

      // AT_RISK segment suppliers
      prisma.supplierSegmentation.findMany({
        where: { segment: "AT_RISK" },
        include: {
          supplier: { select: { id: true, name: true } },
        },
        take: 5,
      }),

      // STRATEGIC_PARTNER suppliers
      prisma.supplierSegmentation.findMany({
        where: { segment: "STRATEGIC_PARTNER" },
        include: {
          supplier: { select: { id: true, name: true, rating: true } },
        },
        orderBy: { score: "desc" },
        take: 5,
      }),

      // Top 5 suppliers by spend concentration
      prisma.supplierFinancialMetrics.findMany({
        include: {
          supplier: { select: { id: true, name: true } },
        },
        orderBy: { lifetimeSpend: "desc" },
        take: 5,
      }),

      // Global aggregations
      Promise.all([
        prisma.supplier.count({ where: { status: "ACTIVE" } }),
        prisma.supplierPerformanceProfile.aggregate({
          _avg: { reliabilityIndex: true },
        }),
        prisma.supplierRiskProfile.count({ where: { globalRiskScore: { gte: 70 } } }),
        prisma.supplierRiskProfile.aggregate({
          _sum: { outstandingOrdersValue: true },
        }),
      ]),
    ]);

    return {
      data: {
        topSuppliers,
        highRiskSuppliers,
        atRiskSegments,
        strategicPartners,
        spendConcentration,
        stats: {
          totalActiveSuppliers: globalStats[0],
          avgReliability: Number(globalStats[1]._avg.reliabilityIndex || 0),
          highRiskCount: globalStats[2],
          totalOutstandingValue: Number(globalStats[3]._sum.outstandingOrdersValue || 0),
        },
      },
    };
  } catch (error) {
    console.error("Error fetching sourcing dashboard intelligence:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la récupération" };
  }
}
