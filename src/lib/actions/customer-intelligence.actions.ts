"use server";

import { getSession } from "@/lib/session";
import { CustomerIntelligenceService } from "@/lib/services/customer-intelligence.service";
import { checkPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import type { CustomerSegment } from "@prisma/client";

export async function getCustomerIntelligence(contactId: string) {
  try {
    const user = await getSession();

    const profile = await CustomerIntelligenceService.getFullProfile(contactId);
    if (!profile || profile.tenantId !== user.tenantId) {
      return { error: "Contact introuvable" };
    }

    return { data: profile };
  } catch (error) {
    console.error("Error fetching customer intelligence:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la récupération" };
  }
}

export async function recalculateCustomerIntelligence(contactId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "contact.manage");

    // Verify tenant ownership
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { tenantId: true },
    });
    if (!contact || contact.tenantId !== user.tenantId) {
      return { error: "Contact introuvable" };
    }

    await CustomerIntelligenceService.recalculateAll(contactId);

    revalidatePath(`/contacts/${contactId}`);
    revalidatePath("/crm");

    return { data: { success: true } };
  } catch (error) {
    console.error("Error recalculating intelligence:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors du calcul" };
  }
}

export async function createPipelineIntent(contactId: string, data: {
  productCategory?: string;
  productName?: string;
  estimatedOrderDate?: string;
  estimatedSize?: number;
  currency?: string;
  probability?: number;
  source?: string;
  notes?: string;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "contact.manage");

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { tenantId: true },
    });
    if (!contact || contact.tenantId !== user.tenantId) {
      return { error: "Contact introuvable" };
    }

    const probability = data.probability || 0.5;
    const estimatedSize = data.estimatedSize || 0;
    const expectedRevenue = estimatedSize * probability;

    const intent = await prisma.customerPipelineIntent.create({
      data: {
        contactId,
        productCategory: data.productCategory,
        productName: data.productName,
        estimatedOrderDate: data.estimatedOrderDate ? new Date(data.estimatedOrderDate) : undefined,
        estimatedSize: data.estimatedSize,
        currency: data.currency || "XAF",
        probability,
        expectedRevenue,
        source: data.source,
        notes: data.notes,
      },
    });

    revalidatePath(`/contacts/${contactId}`);
    revalidatePath("/crm");

    return { data: intent };
  } catch (error) {
    console.error("Error creating pipeline intent:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la création" };
  }
}

export async function updatePipelineIntentStatus(intentId: string, status: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "contact.manage");

    const intent = await prisma.customerPipelineIntent.update({
      where: { id: intentId },
      data: { status },
    });

    revalidatePath(`/contacts/${intent.contactId}`);
    revalidatePath("/crm");

    return { data: intent };
  } catch (error) {
    console.error("Error updating intent status:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la mise à jour" };
  }
}

export async function addCustomerSegment(contactId: string, segment: CustomerSegment, notes?: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "contact.manage");

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { tenantId: true },
    });
    if (!contact || contact.tenantId !== user.tenantId) {
      return { error: "Contact introuvable" };
    }

    const segmentation = await prisma.customerSegmentation.upsert({
      where: {
        contactId_segment: {
          contactId,
          segment,
        },
      },
      create: {
        contactId,
        segment,
        score: 50,
        notes,
      },
      update: {
        notes,
        assignedAt: new Date(),
      },
    });

    revalidatePath(`/contacts/${contactId}`);
    revalidatePath("/crm");

    return { data: segmentation };
  } catch (error) {
    console.error("Error adding segment:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de l'ajout" };
  }
}

export async function removeCustomerSegment(contactId: string, segment: CustomerSegment) {
  try {
    const user = await getSession();
    checkPermission(user.role, "contact.manage");

    await prisma.customerSegmentation.delete({
      where: {
        contactId_segment: {
          contactId,
          segment,
        },
      },
    });

    revalidatePath(`/contacts/${contactId}`);
    revalidatePath("/crm");

    return { data: { success: true } };
  } catch (error) {
    console.error("Error removing segment:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la suppression" };
  }
}

// ─── Custom Segment Rules ────────────────────────────────────────────────────

export type SegmentRule = {
  id: string;
  segment: CustomerSegment;
  field: "lifetimeGrossRevenue" | "totalOrdersCount" | "averageMarginPercent" | "globalRiskScore" | "contributionScore";
  operator: "gt" | "lt" | "gte" | "lte";
  value: number;
  createdAt: string;
};

async function getTenantSettings(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  return (tenant?.settings as Record<string, unknown>) ?? {};
}

export async function getCustomSegmentRules(): Promise<SegmentRule[]> {
  try {
    const user = await getSession();
    const settings = await getTenantSettings(user.tenantId);
    const rules = settings.customSegmentRules as SegmentRule[] | undefined;
    return rules ?? [];
  } catch { return []; }
}

export async function saveCustomSegmentRule(
  rule: Omit<SegmentRule, "id" | "createdAt">
): Promise<{ success?: boolean; error?: string }> {
  try {
    const user = await getSession();
    checkPermission(user.role, "contact.manage");
    const settings = await getTenantSettings(user.tenantId);
    const rules = (settings.customSegmentRules as SegmentRule[]) ?? [];
    const newRule: SegmentRule = {
      ...rule,
      id: `rule-${Date.now()}`,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    await prisma.tenant.update({
      where: { id: user.tenantId },
      data: { settings: { ...settings, customSegmentRules: [...rules, newRule] } },
    });
    revalidatePath("/crm");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur" };
  }
}

export async function deleteCustomSegmentRule(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const user = await getSession();
    checkPermission(user.role, "contact.manage");
    const settings = await getTenantSettings(user.tenantId);
    const rules = (settings.customSegmentRules as SegmentRule[]) ?? [];
    await prisma.tenant.update({
      where: { id: user.tenantId },
      data: { settings: { ...settings, customSegmentRules: rules.filter((r) => r.id !== id) } },
    });
    revalidatePath("/crm");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur" };
  }
}

export async function getCRMDashboardIntelligence(tenantId: string) {
  try {
    const user = await getSession();

    const [
      topContributors,
      highRiskClients,
      atRiskClients,
      keyAccounts,
      pipelineRevenue,
    ] = await Promise.all([
      // Top contributors by contribution score
      prisma.customerFinancialMetrics.findMany({
        where: { contact: { tenantId: user.tenantId } },
        include: { contact: { select: { id: true, name: true, company: true } } },
        orderBy: { contributionScore: "desc" },
        take: 5,
      }),

      // High risk clients (risk > 60 AND cash exposure > 0)
      prisma.customerRiskProfile.findMany({
        where: {
          contact: { tenantId: user.tenantId },
          globalRiskScore: { gte: 60 },
          cashExposure: { gt: 0 },
        },
        include: { contact: { select: { id: true, name: true, company: true } } },
        orderBy: { globalRiskScore: "desc" },
        take: 5,
      }),

      // At-risk clients (no orders in 90+ days)
      prisma.customerSegmentation.findMany({
        where: {
          contact: { tenantId: user.tenantId },
          segment: "AT_RISK",
        },
        include: { contact: { select: { id: true, name: true, company: true } } },
        take: 5,
      }),

      // Key accounts
      prisma.customerSegmentation.findMany({
        where: {
          contact: { tenantId: user.tenantId },
          segment: "KEY_ACCOUNT",
        },
        include: { contact: { select: { id: true, name: true, company: true } } },
        orderBy: { score: "desc" },
        take: 5,
      }),

      // Total pipeline revenue (active intents)
      prisma.customerPipelineIntent.aggregate({
        where: {
          contact: { tenantId: user.tenantId },
          status: "active",
        },
        _sum: { expectedRevenue: true },
        _count: true,
      }),
    ]);

    return {
      data: {
        topContributors,
        highRiskClients,
        atRiskClients,
        keyAccounts,
        pipelineRevenue: {
          total: Number(pipelineRevenue._sum.expectedRevenue || 0),
          count: pipelineRevenue._count,
        },
      },
    };
  } catch (error) {
    console.error("Error fetching CRM dashboard intelligence:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la récupération" };
  }
}
