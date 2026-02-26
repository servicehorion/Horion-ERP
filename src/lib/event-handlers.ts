import { prisma } from "@/lib/db";
import type { Event } from "@prisma/client";
import { TaskDependencyService } from "@/lib/services/task-dependency.service";
import { NotificationService } from "@/lib/services/notification.service";
import { SubtaskService } from "@/lib/services/subtask.service";
import { CustomerIntelligenceService } from "@/lib/services/customer-intelligence.service";

type EventHandler = (event: Event) => Promise<void>;

async function recalcCustomerIntelligence(contactId?: string | null) {
  if (!contactId) return;
  await CustomerIntelligenceService.recalculateAll(contactId);
}

const handleCustomerIntelligenceFromOrder: EventHandler = async (event) => {
  const payload = event.payload as Record<string, unknown>;
  const contactId = payload.contactId as string | undefined;

  if (contactId) {
    await recalcCustomerIntelligence(contactId);
    return;
  }

  const order = await prisma.order.findUnique({
    where: { id: event.entityId },
    select: { contactId: true },
  });
  await recalcCustomerIntelligence(order?.contactId);
};

const handleCustomerIntelligenceFromPayment: EventHandler = async (event) => {
  const payload = event.payload as Record<string, unknown>;
  const orderId = payload.orderId as string | undefined;

  if (orderId) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { contactId: true },
    });
    await recalcCustomerIntelligence(order?.contactId);
    return;
  }

  const payment = await prisma.payment.findUnique({
    where: { id: event.entityId },
    select: { order: { select: { contactId: true } } },
  });
  await recalcCustomerIntelligence(payment?.order?.contactId);
};

const handleCustomerIntelligenceFromDispute: EventHandler = async (event) => {
  const dispute = await prisma.dispute.findUnique({
    where: { id: event.entityId },
    select: { order: { select: { contactId: true } } },
  });
  await recalcCustomerIntelligence(dispute?.order?.contactId);
};

// ── Task Creation Helper ────────────────────────────────────────

async function createTaskFromEvent(
  event: Event,
  config: {
    taskType: string;
    title: string;
    module: string;
    slaHours: number;
    priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
    ownerType?: "HUMAN" | "AI_AGENT" | "SYSTEM";
    automationAllowed?: boolean;
    tags?: string[];
    subtasks?: { title: string; slaHours?: number; module?: string; priority?: string }[];
    dependsOnTaskTypes?: string[]; // block until these task types complete
  }
) {
  const order = await prisma.order.findUnique({
    where: { id: event.entityId },
    select: { tenantId: true, orderNumber: true },
  });

  if (!order) return;

  const slaDeadline = new Date();
  slaDeadline.setHours(slaDeadline.getHours() + config.slaHours);

  const task = await prisma.task.create({
    data: {
      tenantId: order.tenantId,
      entityType: event.entityType,
      entityId: event.entityId,
      taskType: config.taskType,
      title: config.title,
      module: config.module,
      priority: config.priority || "NORMAL",
      slaDeadline,
      ownerType: config.ownerType || "HUMAN",
      automationAllowed: config.automationAllowed ?? false,
      status: "PENDING",
      riskLevel: "LOW",
      tags: config.tags ?? [],
    },
  });

  // Auto-create subtasks if defined
  if (config.subtasks && config.subtasks.length > 0) {
    for (const sub of config.subtasks) {
      await SubtaskService.createSubtask({
        parentTaskId: task.id,
        title: sub.title,
        slaHours: sub.slaHours,
        module: sub.module,
        priority: sub.priority as any,
      });
    }
  }

  // Auto-add dependencies on previous task types in the same order
  if (config.dependsOnTaskTypes && config.dependsOnTaskTypes.length > 0) {
    const previousTasks = await prisma.task.findMany({
      where: {
        entityId: event.entityId,
        taskType: { in: config.dependsOnTaskTypes },
        status: { notIn: ["CANCELLED"] },
      },
      select: { id: true, status: true },
    });

    for (const prev of previousTasks) {
      if (!["COMPLETED", "CANCELLED"].includes(prev.status)) {
        await TaskDependencyService.addDependency(task.id, prev.id, "BLOCKS");
      }
    }
  }

  // Notify team
  const teamMembers = await prisma.user.findMany({
    where: {
      tenantId: order.tenantId,
      isActive: true,
      role: { in: getModuleRoles(config.module) as any[] },
    },
    select: { id: true },
  });

  if (teamMembers.length > 0) {
    await NotificationService.notifyMany(
      teamMembers.map((m) => m.id),
      {
        tenantId: order.tenantId,
        type: "TASK_ASSIGNED",
        title: `Nouvelle tâche: ${config.title}`,
        message: `Commande ${order.orderNumber} — Module ${config.module}`,
        entityType: "task",
        entityId: task.id,
      }
    );
  }

  return task;
}

// Map modules to relevant user roles
function getModuleRoles(module: string): string[] {
  const map: Record<string, string[]> = {
    orders: ["ADMIN", "CEO", "DIRECTION", "CRM_MANAGER", "COMMERCIAL", "OPS"],
    sourcing: ["ADMIN", "CEO", "DIRECTION", "LOGISTICS_MANAGER", "SOURCING_ASSISTANT", "OPS"],
    logistics: ["ADMIN", "CEO", "DIRECTION", "LOGISTICS_MANAGER", "LOGISTICS_ASSISTANT", "OPS"],
    finance: ["ADMIN", "CEO", "DIRECTION", "FINANCE_MANAGER", "FINANCE"],
    qc: ["ADMIN", "CEO", "DIRECTION", "LOGISTICS_MANAGER", "LOGISTICS_ASSISTANT", "OPS"],
    crm: ["ADMIN", "CEO", "DIRECTION", "CRM_MANAGER", "COMMERCIAL"],
    catalog: ["ADMIN", "CEO", "DIRECTION", "OPS", "COMMERCIAL"],
  };
  return map[module] ?? ["ADMIN", "CEO", "DIRECTION"];
}

// ── Order Handlers ──────────────────────────────────────────────

const handleOrderCreated: EventHandler = async (event) => {
  await createTaskFromEvent(event, {
    taskType: "send_quote",
    title: "Préparer et envoyer le devis au client",
    module: "orders",
    slaHours: 4,
    priority: "HIGH",
    tags: ["devis", "client"],
  });
};

const handleOrderStatusChanged: EventHandler = async (event) => {
  const payload = event.payload as Record<string, unknown>;
  const newStatus = payload.newStatus as string;

  const taskConfigs: Record<string, Parameters<typeof createTaskFromEvent>[1]> = {
    PAIEMENT_EN_COURS: {
      taskType: "confirm_payment",
      title: "Confirmer la réception du paiement client",
      module: "finance",
      slaHours: 24,
      priority: "HIGH",
      tags: ["paiement", "finance"],
      dependsOnTaskTypes: ["send_quote"],
    },
    SOURCING: {
      taskType: "find_supplier",
      title: "Rechercher et sélectionner un fournisseur",
      module: "sourcing",
      slaHours: 2,
      priority: "HIGH",
      automationAllowed: true,
      tags: ["fournisseur", "sourcing"],
      dependsOnTaskTypes: ["confirm_payment"],
      subtasks: [
        { title: "Identifier 3 fournisseurs potentiels", slaHours: 1, priority: "HIGH" },
        { title: "Demander les cotations", slaHours: 1 },
        { title: "Comparer et sélectionner", slaHours: 1 },
      ],
    },
    EN_PRODUCTION: {
      taskType: "monitor_production",
      title: "Suivre la production chez le fournisseur",
      module: "sourcing",
      slaHours: 168,
      tags: ["production", "suivi"],
      dependsOnTaskTypes: ["find_supplier"],
      subtasks: [
        { title: "Confirmer le démarrage production", slaHours: 24, priority: "HIGH" },
        { title: "Vérifier l'avancement à mi-parcours", slaHours: 96 },
        { title: "Confirmer la date de fin", slaHours: 168 },
      ],
    },
    QC_EN_COURS: {
      taskType: "schedule_qc",
      title: "Planifier l'inspection qualité",
      module: "qc",
      slaHours: 48,
      tags: ["qualité", "inspection"],
      dependsOnTaskTypes: ["monitor_production"],
      subtasks: [
        { title: "Coordonner avec le fournisseur", slaHours: 12 },
        { title: "Envoyer l'inspecteur", slaHours: 24, priority: "HIGH" },
        { title: "Rédiger le rapport QC", slaHours: 48 },
      ],
    },
    QC_VALIDE: {
      taskType: "book_freight",
      title: "Réserver le fret et organiser l'expédition",
      module: "logistics",
      slaHours: 24,
      priority: "HIGH",
      tags: ["fret", "expédition"],
      dependsOnTaskTypes: ["schedule_qc"],
      subtasks: [
        { title: "Obtenir les cotations transitaires", slaHours: 8, priority: "HIGH" },
        { title: "Réserver le conteneur/groupage", slaHours: 16 },
        { title: "Préparer les documents d'export", slaHours: 24 },
      ],
    },
    EN_TRANSIT: {
      taskType: "track_shipment",
      title: "Suivre l'expédition en transit",
      module: "logistics",
      slaHours: 720,
      tags: ["transit", "suivi"],
      dependsOnTaskTypes: ["book_freight"],
    },
    DEDOUANE: {
      taskType: "arrange_delivery",
      title: "Organiser la livraison au client",
      module: "logistics",
      slaHours: 24,
      priority: "HIGH",
      tags: ["livraison", "douane"],
      dependsOnTaskTypes: ["track_shipment"],
      subtasks: [
        { title: "Dédouanement et formalités", slaHours: 12, priority: "HIGH" },
        { title: "Planifier la livraison finale", slaHours: 24 },
      ],
    },
    LIVRE: {
      taskType: "calculate_margin",
      title: "Calculer la marge finale de la commande",
      module: "finance",
      slaHours: 4,
      automationAllowed: true,
      tags: ["marge", "comptabilité"],
      dependsOnTaskTypes: ["arrange_delivery"],
    },
  };

  const config = taskConfigs[newStatus];
  if (config) {
    await createTaskFromEvent(event, config);
  }
};

// ── Task Completion Handler (cross-module propagation) ──────────

const handleTaskCompleted: EventHandler = async (event) => {
  const taskId = event.entityId;
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, tenantId: true, title: true, taskType: true, entityId: true, parentTaskId: true },
  });

  if (!task) return;

  // 1. Resolve dependencies (unblock waiting tasks)
  const unblockedIds = await TaskDependencyService.resolveCompletedTask(taskId);

  // 2. Handle subtask completion (cascade to parent)
  if (task.parentTaskId) {
    await SubtaskService.onSubtaskCompleted(taskId);
  }

  // 3. Notify
  await NotificationService.onTaskCompleted(taskId, task.tenantId, task.title);

  // 4. Cross-module propagation based on task type
  if (task.taskType === "schedule_qc") {
    // QC completed → create sourcing feedback task
    await createTaskFromEvent(
      { entityType: "Order", entityId: task.entityId } as any,
      {
        taskType: "qc_feedback_to_supplier",
        title: "Envoyer le feedback QC au fournisseur",
        module: "sourcing",
        slaHours: 24,
        tags: ["qc", "feedback", "fournisseur"],
      }
    );
  }

  if (task.taskType === "calculate_margin") {
    // Finance margin calculated → create reporting task
    await createTaskFromEvent(
      { entityType: "Order", entityId: task.entityId } as any,
      {
        taskType: "generate_financial_report",
        title: "Générer le rapport financier de la commande",
        module: "finance",
        slaHours: 48,
        automationAllowed: true,
        tags: ["rapport", "finance"],
      }
    );
  }
};

// ── Task Blocked Handler ────────────────────────────────────────

const handleTaskBlocked: EventHandler = async (event) => {
  const taskId = event.entityId;
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, tenantId: true, title: true, parentTaskId: true },
  });

  if (!task) return;

  // Propagate block to parent
  if (task.parentTaskId) {
    await SubtaskService.onSubtaskBlocked(taskId);
  }

  // Notify assignees
  await NotificationService.notifyTaskAssignees(taskId, {
    tenantId: task.tenantId,
    type: "TASK_BLOCKED",
    title: `Tâche bloquée: ${task.title}`,
    message: "Cette tâche est bloquée — intervention requise",
  });
};

// ── SLA Breach Handler ──────────────────────────────────────────

const handleSLABreach: EventHandler = async (event) => {
  const taskId = event.entityId;
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, tenantId: true, title: true },
  });

  if (!task) return;

  await NotificationService.onSLABreach(taskId, task.tenantId, task.title);
};

// ── Registry ────────────────────────────────────────────────────

export const eventHandlerRegistry: Record<string, EventHandler[]> = {
  "order.created": [handleOrderCreated, handleCustomerIntelligenceFromOrder],
  "order.status_changed": [handleOrderStatusChanged, handleCustomerIntelligenceFromOrder],
  "payment.confirmed": [handleCustomerIntelligenceFromPayment],
  "payment.cancelled": [handleCustomerIntelligenceFromPayment],
  "dispute.created": [handleCustomerIntelligenceFromDispute],
  "dispute.resolved": [handleCustomerIntelligenceFromDispute],
  "task.completed": [handleTaskCompleted],
  "task.blocked": [handleTaskBlocked],
  "task.sla_breach": [handleSLABreach],
};
