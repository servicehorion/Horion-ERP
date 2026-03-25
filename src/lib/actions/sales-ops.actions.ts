"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { SalesOpsService } from "@/lib/services/sales-ops.service";

export async function getSalesTeams() {
  try {
    const user = await getSession();
    checkPermission(user.role, "crm.view");
    const teams = await SalesOpsService.listTeams(user.tenantId);
    return { data: teams };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function createSalesTeam(data: {
  name: string;
  managerId?: string | null;
  territoryId?: string | null;
  currency?: string;
  targetAmount?: number;
  memberIds?: string[];
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "crm.manage");
    const team = await SalesOpsService.createTeam(user.tenantId, data);
    revalidatePath("/crm/sales-ops");
    return { data: team };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function updateSalesTeam(teamId: string, data: {
  name?: string;
  managerId?: string | null;
  territoryId?: string | null;
  currency?: string;
  targetAmount?: number;
  memberIds?: string[];
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "crm.manage");
    const team = await SalesOpsService.updateTeam(teamId, data);
    revalidatePath("/crm/sales-ops");
    return { data: team };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getSalesTerritories() {
  try {
    const user = await getSession();
    checkPermission(user.role, "crm.view");
    const territories = await SalesOpsService.listTerritories(user.tenantId);
    return { data: territories };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function createSalesTerritory(data: {
  name: string;
  countryCodes?: string[];
  cityNames?: string[];
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "crm.manage");
    const territory = await SalesOpsService.createTerritory(user.tenantId, data);
    revalidatePath("/crm/sales-ops");
    return { data: territory };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getSalesQuotas() {
  try {
    const user = await getSession();
    checkPermission(user.role, "crm.view");
    const quotas = await SalesOpsService.listQuotas(user.tenantId);
    return { data: quotas };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function createSalesQuota(data: {
  teamId?: string | null;
  userId?: string | null;
  periodStart: string;
  periodEnd: string;
  targetAmount: number;
  currency?: string;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "crm.manage");
    const quota = await SalesOpsService.createQuota(user.tenantId, {
      teamId: data.teamId || null,
      userId: data.userId || null,
      periodStart: new Date(data.periodStart),
      periodEnd: new Date(data.periodEnd),
      targetAmount: data.targetAmount,
      currency: data.currency,
    });
    revalidatePath("/crm/sales-ops");
    return { data: quota };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}
