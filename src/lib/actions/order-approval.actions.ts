"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { UserRole } from "@prisma/client";

const toNumber = (value: FormDataEntryValue | null, field: string) => {
  const n = Number(value);
  if (Number.isNaN(n)) throw new Error(`Champ invalide: ${field}`);
  return n;
};

const toRole = (value: FormDataEntryValue | null) => {
  const role = String(value || "");
  if (!Object.values(UserRole).includes(role as UserRole)) {
    throw new Error("Role invalide");
  }
  return role as UserRole;
};

export async function createOrderApprovalRule(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.approve");

    const name = String(formData.get("name") || "").trim();
    const minAmountXAF = toNumber(formData.get("minAmountXAF"), "Montant");
    const sequence = toNumber(formData.get("sequence"), "Sequence");
    const requiredRole = toRole(formData.get("requiredRole"));

    if (!name) return { error: "Nom obligatoire" };

    const rule = await prisma.orderApprovalRule.create({
      data: {
        tenantId: user.tenantId,
        name,
        minAmountXAF,
        sequence,
        requiredRole,
      },
    });

    revalidatePath("/settings/approval-rules");
    return { data: rule };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur creation" };
  }
}

export async function updateOrderApprovalRule(ruleId: string, formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.approve");

    const name = String(formData.get("name") || "").trim();
    const minAmountXAF = toNumber(formData.get("minAmountXAF"), "Montant");
    const sequence = toNumber(formData.get("sequence"), "Sequence");
    const requiredRole = toRole(formData.get("requiredRole"));

    const existing = await prisma.orderApprovalRule.findUnique({ where: { id: ruleId } });
    if (!existing || existing.tenantId !== user.tenantId) {
      return { error: "Regle introuvable" };
    }

    const rule = await prisma.orderApprovalRule.update({
      where: { id: ruleId },
      data: { name, minAmountXAF, sequence, requiredRole },
    });

    revalidatePath("/settings/approval-rules");
    return { data: rule };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur mise a jour" };
  }
}

export async function deleteOrderApprovalRule(ruleId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.approve");

    const existing = await prisma.orderApprovalRule.findUnique({ where: { id: ruleId } });
    if (!existing || existing.tenantId !== user.tenantId) {
      return { error: "Regle introuvable" };
    }

    await prisma.orderApprovalRule.delete({ where: { id: ruleId } });
    revalidatePath("/settings/approval-rules");
    return { data: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur suppression" };
  }
}

export async function moveOrderApprovalRule(ruleId: string, direction: "up" | "down") {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.approve");

    const rule = await prisma.orderApprovalRule.findUnique({ where: { id: ruleId } });
    if (!rule || rule.tenantId !== user.tenantId) {
      return { error: "Regle introuvable" };
    }

    const target = await prisma.orderApprovalRule.findFirst({
      where: {
        tenantId: user.tenantId,
        sequence: direction === "up" ? { lt: rule.sequence } : { gt: rule.sequence },
      },
      orderBy: { sequence: direction === "up" ? "desc" : "asc" },
    });

    if (!target) return { data: rule };

    await prisma.$transaction([
      prisma.orderApprovalRule.update({ where: { id: rule.id }, data: { sequence: target.sequence } }),
      prisma.orderApprovalRule.update({ where: { id: target.id }, data: { sequence: rule.sequence } }),
    ]);

    revalidatePath("/settings/approval-rules");
    return { data: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur reordonner" };
  }
}
