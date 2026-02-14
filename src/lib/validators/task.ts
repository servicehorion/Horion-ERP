import { z } from "zod";

export const createTaskSchema = z.object({
  tenantId: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  taskType: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  module: z.string().min(1),
  slaHours: z.number().optional(),
  requiredApproval: z.boolean().default(false),
  automationAllowed: z.boolean().default(false),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("LOW"),
});

export const updateTaskStatusSchema = z.object({
  taskId: z.string().min(1),
  newStatus: z.enum(["PENDING", "IN_PROGRESS", "WAITING_APPROVAL", "BLOCKED", "COMPLETED", "CANCELLED"]),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
