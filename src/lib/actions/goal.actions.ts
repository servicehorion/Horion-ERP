"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";

export async function getGoals() {
  const user = await getSession();
  const goals = await prisma.goal.findMany({
    where: { tenantId: user.tenantId },
    include: { keyResults: true },
    orderBy: { createdAt: "desc" },
  });
  return { data: goals };
}

export async function createGoal(data: {
  title: string;
  description?: string;
  status?: string;
  targetDate?: string;
}) {
  const user = await getSession();
  if (!data.title?.trim()) return { error: "Le titre est requis" };

  const goal = await prisma.goal.create({
    data: {
      tenantId: user.tenantId,
      ownerId: user.id,
      title: data.title.trim(),
      description: data.description,
      status: data.status ?? "ON_TRACK",
      targetDate: data.targetDate ? new Date(data.targetDate) : undefined,
    },
    include: { keyResults: true },
  });

  revalidatePath("/tasks/goals");
  return { data: goal };
}

export async function updateGoalStatus(goalId: string, status: string) {
  const user = await getSession();
  await prisma.goal.updateMany({
    where: { id: goalId, tenantId: user.tenantId },
    data: { status },
  });
  revalidatePath("/tasks/goals");
  return { data: { success: true } };
}

export async function updateGoalProgress(goalId: string, progress: number) {
  const user = await getSession();
  await prisma.goal.updateMany({
    where: { id: goalId, tenantId: user.tenantId },
    data: { progress: Math.min(100, Math.max(0, progress)) },
  });
  revalidatePath("/tasks/goals");
  return { data: { success: true } };
}

export async function deleteGoal(goalId: string) {
  const user = await getSession();
  await prisma.goal.deleteMany({
    where: { id: goalId, tenantId: user.tenantId },
  });
  revalidatePath("/tasks/goals");
  return { data: { success: true } };
}

export async function addKeyResult(goalId: string, data: {
  title: string;
  target: number;
  unit?: string;
}) {
  const user = await getSession();
  const goal = await prisma.goal.findFirst({
    where: { id: goalId, tenantId: user.tenantId },
  });
  if (!goal) return { error: "Objectif introuvable" };
  if (!data.title?.trim()) return { error: "Le titre est requis" };

  const kr = await prisma.keyResult.create({
    data: {
      goalId,
      title: data.title.trim(),
      target: data.target,
      unit: data.unit ?? "%",
    },
  });
  revalidatePath("/tasks/goals");
  return { data: kr };
}

export async function updateKeyResultCurrent(krId: string, current: number) {
  const kr = await prisma.keyResult.update({
    where: { id: krId },
    data: { current },
    include: { goal: { select: { id: true, tenantId: true } } },
  });

  // Auto-update goal progress = avg of KR progress
  const allKrs = await prisma.keyResult.findMany({ where: { goalId: kr.goal.id } });
  const avgProgress = allKrs.length
    ? Math.round(
        allKrs.reduce((sum, k) => {
          const pct = Number(k.target) > 0 ? (Number(k.current) / Number(k.target)) * 100 : 0;
          return sum + Math.min(100, pct);
        }, 0) / allKrs.length
      )
    : 0;

  await prisma.goal.update({
    where: { id: kr.goal.id },
    data: { progress: avgProgress },
  });

  revalidatePath("/tasks/goals");
  return { data: { success: true } };
}

export async function deleteKeyResult(krId: string) {
  await prisma.keyResult.delete({ where: { id: krId } });
  revalidatePath("/tasks/goals");
  return { data: { success: true } };
}
