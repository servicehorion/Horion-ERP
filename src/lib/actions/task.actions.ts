"use server";

import { auth } from "@/lib/auth";
import { TaskService } from "@/lib/services/task.service";
import { revalidatePath } from "next/cache";
import type { TaskStatus, UserRole } from "@prisma/client";

async function getSession() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifie");
  return session.user as { id: string; email: string; name: string; role: UserRole; tenantId: string; tenantName: string };
}

export async function getTasks(options?: {
  module?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  try {
    const user = await getSession();

    const result = await TaskService.list(user.tenantId, {
      module: options?.module,
      status: options?.status as TaskStatus | undefined,
      page: options?.page,
      limit: options?.limit,
    });

    return { data: result.tasks };
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la récupération des tâches" };
  }
}

export async function updateTaskStatus(taskId: string, newStatus: string) {
  try {
    await getSession();

    const task = await TaskService.updateStatus(taskId, newStatus as TaskStatus);

    revalidatePath("/tasks");
    revalidatePath("/dashboard");

    return { data: task };
  } catch (error) {
    console.error("Error updating task status:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la mise à jour du statut" };
  }
}

export async function assignTask(taskId: string, userId: string) {
  await getSession();

  const assignment = await TaskService.assignTask(taskId, userId);

  revalidatePath("/tasks");

  return { success: true, assignment };
}

export async function getTaskModuleCounts() {
  const user = await getSession();
  return TaskService.getModuleCounts(user.tenantId);
}

export async function getPendingTaskCount() {
  const user = await getSession();
  return TaskService.getPendingCount(user.tenantId);
}
