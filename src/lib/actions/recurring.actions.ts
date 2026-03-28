"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

export async function getRecurringTasks() {
  const user = await getSession();
  const tasks = await prisma.recurringTask.findMany({
    where: { tenantId: user.tenantId },
    include: {
      template: { select: { id: true, name: true, module: true, defaultPriority: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return { data: tasks };
}

export async function createRecurringTask(data: {
  templateId: string;
  cronExpression: string;
  timezone?: string;
}) {
  const user = await getSession();
  checkPermission(user.role, "task.manage");

  if (!data.cronExpression?.trim()) return { error: "Expression cron requise" };

  // Verify template belongs to tenant
  const template = await prisma.taskTemplate.findFirst({
    where: { id: data.templateId, tenantId: user.tenantId },
  });
  if (!template) return { error: "Template introuvable" };

  // Check no existing recurring for this template
  const existing = await prisma.recurringTask.findUnique({
    where: { templateId: data.templateId },
  });
  if (existing) return { error: "Ce template a déjà une récurrence configurée" };

  const rec = await prisma.recurringTask.create({
    data: {
      tenantId: user.tenantId,
      templateId: data.templateId,
      cronExpression: data.cronExpression.trim(),
      timezone: data.timezone ?? "Africa/Brazzaville",
      isActive: true,
    },
    include: {
      template: { select: { id: true, name: true, module: true, defaultPriority: true } },
    },
  });

  revalidatePath("/tasks/recurring");
  return { data: rec };
}

export async function toggleRecurringTask(recurringId: string) {
  const user = await getSession();
  checkPermission(user.role, "task.manage");

  const rec = await prisma.recurringTask.findFirst({
    where: { id: recurringId, tenantId: user.tenantId },
  });
  if (!rec) return { error: "Récurrence introuvable" };

  await prisma.recurringTask.update({
    where: { id: recurringId },
    data: { isActive: !rec.isActive },
  });

  revalidatePath("/tasks/recurring");
  return { data: { isActive: !rec.isActive } };
}

export async function deleteRecurringTask(recurringId: string) {
  const user = await getSession();
  checkPermission(user.role, "task.manage");

  await prisma.recurringTask.deleteMany({
    where: { id: recurringId, tenantId: user.tenantId },
  });

  revalidatePath("/tasks/recurring");
  return { data: { success: true } };
}
