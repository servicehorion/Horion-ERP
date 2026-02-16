"use server";

import { getSession } from "@/lib/session";
import { TaskService } from "@/lib/services/task.service";
import { checkPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import type { TaskStatus } from "@prisma/client";

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
    const user = await getSession();
    checkPermission(user.role, "task.update");

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
  try {
    const user = await getSession();
    checkPermission(user.role, "task.assign");

    const assignment = await TaskService.assignTask(taskId, userId);

    revalidatePath("/tasks");
    return { data: assignment };
  } catch (error) {
    console.error("Error assigning task:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de l'assignation" };
  }
}

export async function getTaskModuleCounts() {
  try {
    const user = await getSession();
    return { data: await TaskService.getModuleCounts(user.tenantId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la récupération" };
  }
}

export async function getPendingTaskCount() {
  try {
    const user = await getSession();
    return { data: await TaskService.getPendingCount(user.tenantId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la récupération" };
  }
}
