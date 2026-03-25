"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

const toNumber = (value: FormDataEntryValue | null) => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toDate = (value: FormDataEntryValue | null) => {
  if (!value) return undefined;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const parseConditions = (value: FormDataEntryValue | null) => {
  if (!value) return {};
  const raw = String(value).trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { note: raw };
  }
};

export async function getDelegationRules() {
  const user = await getSession();
  checkPermission(user.role, "delegation.manage");

  const rules = await prisma.delegationRule.findMany({
    where: { tenantId: user.tenantId },
    include: {
      delegator: { select: { id: true, name: true, email: true, role: true } },
      delegatee: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return { data: rules };
}

export async function createDelegationRule(formData: FormData) {
  const user = await getSession();
  checkPermission(user.role, "delegation.manage");

  const delegatorId = String(formData.get("delegatorId") || "");
  const delegateeId = String(formData.get("delegateeId") || "");
  if (!delegatorId || !delegateeId) {
    return { error: "Delegant et delegue requis" };
  }
  if (delegatorId === delegateeId) {
    return { error: "Delegation invalide: delegant = delegue" };
  }

  const permissions = formData
    .getAll("permissions")
    .map((value) => String(value))
    .filter(Boolean);

  const rule = await prisma.delegationRule.create({
    data: {
      tenantId: user.tenantId,
      delegatorId,
      delegateeId,
      permissions,
      isActive: true,
      startsAt: toDate(formData.get("startsAt")),
      endsAt: toDate(formData.get("endsAt")),
      maxAmountXAF: toNumber(formData.get("maxAmountXAF")),
      maxAmountUSD: toNumber(formData.get("maxAmountUSD")),
      maxAmountRMB: toNumber(formData.get("maxAmountRMB")),
      conditions: parseConditions(formData.get("conditions")),
    },
  });

  revalidatePath("/settings/delegation");
  return { data: rule };
}

export async function setDelegationRuleActive(id: string, isActive: boolean) {
  const user = await getSession();
  checkPermission(user.role, "delegation.manage");

  const updated = await prisma.delegationRule.update({
    where: { id },
    data: { isActive },
  });

  revalidatePath("/settings/delegation");
  return { data: updated };
}
