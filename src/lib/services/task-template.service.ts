import { prisma } from "@/lib/db";
import type { Priority, OwnerType } from "@prisma/client";

/**
 * TaskTemplateService — Templates + Recurring tasks.
 *
 * Features:
 * - CRUD for task templates
 * - Instantiate tasks from templates (with variable substitution)
 * - Recurring task scheduling (CRON-based)
 * - Subtask + dependency auto-creation from template definitions
 */

interface SubtaskDefinition {
  title: string;
  priority?: string;
  slaHours?: number;
  module?: string;
}

interface DependencyDefinition {
  fromStep: number; // index in subtask array
  toStep: number;   // index in subtask array
  type: string;
}

export class TaskTemplateService {
  /**
   * List all templates for a tenant.
   */
  static async listTemplates(
    tenantId: string,
    options: { module?: string; isActive?: boolean } = {}
  ) {
    return prisma.taskTemplate.findMany({
      where: {
        tenantId,
        ...(options.module && { module: options.module }),
        ...(options.isActive !== undefined && { isActive: options.isActive }),
      },
      include: { recurringTask: true },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Get a single template with its recurring schedule.
   */
  static async getTemplate(templateId: string) {
    return prisma.taskTemplate.findUnique({
      where: { id: templateId },
      include: { recurringTask: true },
    });
  }

  /**
   * Create a new task template.
   */
  static async createTemplate(data: {
    tenantId: string;
    name: string;
    description?: string;
    module: string;
    taskType: string;
    titleTemplate: string;
    descriptionTemplate?: string;
    defaultPriority?: Priority;
    defaultSlaHours?: number;
    defaultTags?: string[];
    requiresApproval?: boolean;
    automationAllowed?: boolean;
    ownerType?: OwnerType;
    subtaskDefinitions?: SubtaskDefinition[];
    dependencyDefinitions?: DependencyDefinition[];
  }) {
    return prisma.taskTemplate.create({
      data: {
        tenantId: data.tenantId,
        name: data.name,
        description: data.description,
        module: data.module,
        taskType: data.taskType,
        titleTemplate: data.titleTemplate,
        descriptionTemplate: data.descriptionTemplate,
        defaultPriority: data.defaultPriority ?? "NORMAL",
        defaultSlaHours: data.defaultSlaHours,
        defaultTags: data.defaultTags ?? [],
        requiresApproval: data.requiresApproval ?? false,
        automationAllowed: data.automationAllowed ?? false,
        ownerType: data.ownerType ?? "HUMAN",
        subtaskDefinitions: data.subtaskDefinitions ? JSON.parse(JSON.stringify(data.subtaskDefinitions)) : [],
        dependencyDefinitions: data.dependencyDefinitions ? JSON.parse(JSON.stringify(data.dependencyDefinitions)) : [],
      },
    });
  }

  /**
   * Update a template.
   */
  static async updateTemplate(
    templateId: string,
    data: Partial<{
      name: string;
      description: string;
      module: string;
      taskType: string;
      titleTemplate: string;
      descriptionTemplate: string;
      defaultPriority: Priority;
      defaultSlaHours: number;
      defaultTags: string[];
      requiresApproval: boolean;
      automationAllowed: boolean;
      ownerType: OwnerType;
      subtaskDefinitions: SubtaskDefinition[];
      dependencyDefinitions: DependencyDefinition[];
      isActive: boolean;
    }>
  ) {
    return prisma.taskTemplate.update({
      where: { id: templateId },
      data: data as any,
    });
  }

  /**
   * Instantiate a task from a template.
   * Supports variable substitution in title/description: {{variable}}
   */
  static async instantiate(
    templateId: string,
    context: {
      tenantId: string;
      entityType?: string;
      entityId?: string;
      variables?: Record<string, string>; // e.g. { orderNumber: "ORD-001", supplierName: "Zhang" }
      assigneeId?: string;
      overridePriority?: Priority;
      overrideSlaHours?: number;
    }
  ) {
    const template = await prisma.taskTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) throw new Error("Template not found");

    // Variable substitution
    const vars = context.variables ?? {};
    const replaceVars = (text: string) =>
      text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);

    const title = replaceVars(template.titleTemplate);
    const description = template.descriptionTemplate
      ? replaceVars(template.descriptionTemplate)
      : undefined;

    const slaHours = context.overrideSlaHours ?? template.defaultSlaHours;
    const slaDeadline = slaHours
      ? new Date(Date.now() + slaHours * 3600 * 1000)
      : undefined;

    // Create main task
    const task = await prisma.task.create({
      data: {
        tenantId: context.tenantId,
        title,
        description,
        module: template.module,
        taskType: template.taskType,
        entityType: context.entityType ?? "manual",
        entityId: context.entityId ?? "none",
        priority: context.overridePriority ?? template.defaultPriority,
        ownerType: template.ownerType,
        slaDeadline,
        tags: template.defaultTags,
        requiredApproval: template.requiresApproval,
        automationAllowed: template.automationAllowed,
        templateId: template.id,
        riskLevel: "LOW",
      },
    });

    // Assign if specified
    if (context.assigneeId) {
      await prisma.taskAssignment.create({
        data: { taskId: task.id, userId: context.assigneeId },
      });
    }

    // Create subtasks from definitions
    const subtaskDefs = (template.subtaskDefinitions as unknown as SubtaskDefinition[]) ?? [];
    const createdSubtasks: { id: string; index: number }[] = [];

    for (let i = 0; i < subtaskDefs.length; i++) {
      const def = subtaskDefs[i];
      const subSlaDeadline = def.slaHours
        ? new Date(Date.now() + def.slaHours * 3600 * 1000)
        : undefined;

      const subtask = await prisma.task.create({
        data: {
          tenantId: context.tenantId,
          parentTaskId: task.id,
          title: replaceVars(def.title),
          module: def.module ?? template.module,
          taskType: "subtask",
          entityType: context.entityType ?? "manual",
          entityId: context.entityId ?? "none",
          priority: (def.priority as Priority) ?? template.defaultPriority,
          ownerType: "HUMAN",
          slaDeadline: subSlaDeadline,
          position: i,
          riskLevel: "LOW",
        },
      });
      createdSubtasks.push({ id: subtask.id, index: i });
    }

    // Create dependencies between subtasks
    const depDefs = (template.dependencyDefinitions as unknown as DependencyDefinition[]) ?? [];
    for (const depDef of depDefs) {
      const from = createdSubtasks.find((s) => s.index === depDef.fromStep);
      const to = createdSubtasks.find((s) => s.index === depDef.toStep);
      if (from && to) {
        await prisma.taskDependency.create({
          data: {
            taskId: from.id,
            dependsOnId: to.id,
            type: (depDef.type as any) ?? "BLOCKS",
          },
        });
      }
    }

    return { task, subtasks: createdSubtasks };
  }

  /**
   * Set up a recurring schedule for a template.
   */
  static async setRecurring(
    templateId: string,
    tenantId: string,
    cronExpression: string,
    timezone?: string
  ) {
    const nextRunAt = this.getNextCronRun(cronExpression);

    return prisma.recurringTask.upsert({
      where: { templateId },
      update: { cronExpression, nextRunAt, timezone, isActive: true },
      create: {
        tenantId,
        templateId,
        cronExpression,
        timezone: timezone ?? "Africa/Brazzaville",
        nextRunAt,
        isActive: true,
      },
    });
  }

  /**
   * Process due recurring tasks — call from CRON job.
   */
  static async processDueRecurring() {
    const now = new Date();

    const due = await prisma.recurringTask.findMany({
      where: {
        isActive: true,
        nextRunAt: { lte: now },
      },
      include: { template: true },
    });

    const results = [];

    for (const recurring of due) {
      try {
        const result = await this.instantiate(recurring.templateId, {
          tenantId: recurring.tenantId,
          variables: { date: now.toISOString().split("T")[0] },
        });

        const nextRunAt = this.getNextCronRun(recurring.cronExpression);

        await prisma.recurringTask.update({
          where: { id: recurring.id },
          data: { lastRunAt: now, nextRunAt },
        });

        results.push({ recurringId: recurring.id, taskId: result.task.id, success: true });
      } catch (error) {
        results.push({
          recurringId: recurring.id,
          error: error instanceof Error ? error.message : "Unknown error",
          success: false,
        });
      }
    }

    return results;
  }

  /**
   * Simple next CRON run calculator.
   * For production, use a library like `cron-parser`.
   * This is a simplified version supporting: daily, weekly, monthly patterns.
   */
  private static getNextCronRun(cronExpression: string): Date {
    const now = new Date();
    const parts = cronExpression.split(" ");

    // Simple patterns:
    // "0 9 * * *"   → daily at 9am
    // "0 9 * * 1"   → weekly on Monday at 9am
    // "0 9 1 * *"   → monthly on 1st at 9am

    if (parts.length !== 5) {
      // Default: next hour
      const next = new Date(now);
      next.setHours(next.getHours() + 1, 0, 0, 0);
      return next;
    }

    const [minute, hour, dayOfMonth, , dayOfWeek] = parts;
    const next = new Date(now);
    next.setMinutes(parseInt(minute) || 0);
    next.setSeconds(0, 0);

    if (hour !== "*") {
      next.setHours(parseInt(hour));
    }

    if (dayOfWeek !== "*") {
      // Weekly
      const targetDay = parseInt(dayOfWeek);
      const daysUntil = (targetDay - now.getDay() + 7) % 7 || 7;
      next.setDate(next.getDate() + daysUntil);
    } else if (dayOfMonth !== "*") {
      // Monthly
      next.setDate(parseInt(dayOfMonth));
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
      }
    } else {
      // Daily
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
    }

    return next;
  }
}
