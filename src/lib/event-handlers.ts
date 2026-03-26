import { prisma } from "@/lib/db";
import type { Event } from "@prisma/client";
import { TaskDependencyService } from "@/lib/services/task-dependency.service";
import { NotificationService } from "@/lib/services/notification.service";
import { SubtaskService } from "@/lib/services/subtask.service";
import { CustomerIntelligenceService } from "@/lib/services/customer-intelligence.service";
import { IndicatifSourcingOrchestratorService } from "@/lib/services/indicatif-sourcing-orchestrator.service";
import { OperationalTaskService } from "@/lib/services/operational-task.service";
import { QcUpsellService } from "@/lib/services/qc-upsell.service";
import {
  cancelQuoteWorkflowTasks,
  ensureCeoPaymentValidationTask,
  markDemandConvertedForQuote,
  syncDemandStatusForQuote,
} from "@/lib/quotes/workflow";
import { WhatsappMessageService } from "@/lib/services/whatsapp-message.service";

type EventHandler = (event: Event) => Promise<void>;
type TaskRoleHint =
  | "LOGISTICS_MANAGER"
  | "LOGISTICS_ASSISTANT"
  | "SOURCING_ASSISTANT"
  | "FINANCE_MANAGER"
  | "FINANCE";

type OrderOpsAssignees = {
  ownerId: string | null;
  logisticsManagerId: string | null;
  logisticsAssistantId: string | null;
  sourcingAssistantId: string | null;
  financeManagerId: string | null;
  financeId: string | null;
  adminFallbackId: string | null;
};

const AUTO_ASSIGNER_NAME = "Automatisation Horion";

async function recalcCustomerIntelligence(contactId?: string | null) {
  if (!contactId) return;
  await CustomerIntelligenceService.recalculateAll(contactId);
}

async function pickActiveUserByRoles(
  tenantId: string,
  roles: string[],
  preferredIds: string[] = []
) {
  const preferred = preferredIds.filter(Boolean);
  if (preferred.length > 0) {
    const preferredUser = await prisma.user.findFirst({
      where: {
        tenantId,
        isActive: true,
        id: { in: preferred },
        role: { in: roles as any[] },
      },
      orderBy: { name: "asc" },
      select: { id: true },
    });
    if (preferredUser) return preferredUser.id;
  }

  const fallback = await prisma.user.findFirst({
    where: {
      tenantId,
      isActive: true,
      role: { in: roles as any[] },
    },
    orderBy: { name: "asc" },
    select: { id: true },
  });

  return fallback?.id ?? null;
}

async function resolveOrderOpsAssignees(orderId: string, tenantId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      ownerId: true,
      owner: { select: { id: true, role: true, isActive: true } },
      collaborators: {
        select: {
          user: { select: { id: true, role: true, isActive: true } },
        },
      },
    },
  });

  const collaboratorIdsByRole = new Map<string, string[]>();
  for (const collaborator of order?.collaborators ?? []) {
    if (!collaborator.user.isActive) continue;
    const current = collaboratorIdsByRole.get(collaborator.user.role) ?? [];
    current.push(collaborator.user.id);
    collaboratorIdsByRole.set(collaborator.user.role, current);
  }

  if (order?.owner?.isActive) {
    const current = collaboratorIdsByRole.get(order.owner.role) ?? [];
    current.unshift(order.owner.id);
    collaboratorIdsByRole.set(order.owner.role, current);
  }

  const [logisticsManagerId, logisticsAssistantId, sourcingAssistantId, financeManagerId, financeId, adminFallbackId] =
    await Promise.all([
      pickActiveUserByRoles(tenantId, ["LOGISTICS_MANAGER"], collaboratorIdsByRole.get("LOGISTICS_MANAGER") ?? []),
      pickActiveUserByRoles(tenantId, ["LOGISTICS_ASSISTANT"], collaboratorIdsByRole.get("LOGISTICS_ASSISTANT") ?? []),
      pickActiveUserByRoles(tenantId, ["SOURCING_ASSISTANT"], collaboratorIdsByRole.get("SOURCING_ASSISTANT") ?? []),
      pickActiveUserByRoles(tenantId, ["FINANCE_MANAGER"], collaboratorIdsByRole.get("FINANCE_MANAGER") ?? []),
      pickActiveUserByRoles(tenantId, ["FINANCE"], collaboratorIdsByRole.get("FINANCE") ?? []),
      pickActiveUserByRoles(tenantId, ["ADMIN", "DIRECTION", "CEO"]),
    ]);

  return {
    ownerId: order?.ownerId ?? null,
    logisticsManagerId,
    logisticsAssistantId,
    sourcingAssistantId,
    financeManagerId,
    financeId,
    adminFallbackId,
  } satisfies OrderOpsAssignees;
}

function resolveTaskAssigneeId(
  module: string,
  assignees: OrderOpsAssignees,
  explicitRole?: TaskRoleHint
) {
  if (explicitRole === "LOGISTICS_MANAGER") {
    return assignees.logisticsManagerId ?? assignees.ownerId ?? assignees.adminFallbackId;
  }
  if (explicitRole === "LOGISTICS_ASSISTANT") {
    return (
      assignees.logisticsAssistantId ??
      assignees.logisticsManagerId ??
      assignees.ownerId ??
      assignees.adminFallbackId
    );
  }
  if (explicitRole === "SOURCING_ASSISTANT") {
    return (
      assignees.sourcingAssistantId ??
      assignees.logisticsManagerId ??
      assignees.ownerId ??
      assignees.adminFallbackId
    );
  }
  if (explicitRole === "FINANCE_MANAGER") {
    return assignees.financeManagerId ?? assignees.financeId ?? assignees.adminFallbackId;
  }
  if (explicitRole === "FINANCE") {
    return assignees.financeId ?? assignees.financeManagerId ?? assignees.adminFallbackId;
  }

  if (module === "sourcing") {
    return (
      assignees.sourcingAssistantId ??
      assignees.logisticsManagerId ??
      assignees.ownerId ??
      assignees.adminFallbackId
    );
  }
  if (module === "logistics" || module === "qc") {
    return (
      assignees.logisticsAssistantId ??
      assignees.logisticsManagerId ??
      assignees.ownerId ??
      assignees.adminFallbackId
    );
  }
  if (module === "finance") {
    return assignees.financeManagerId ?? assignees.financeId ?? assignees.adminFallbackId;
  }

  return assignees.ownerId ?? assignees.adminFallbackId;
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

const handlePaymentCreated: EventHandler = async (event) => {
  const payment = await prisma.payment.findUnique({
    where: { id: event.entityId },
    select: {
      id: true,
      status: true,
      direction: true,
      type: true,
      methodKey: true,
      method: true,
      reference: true,
      notes: true,
      amountXAF: true,
      currency: true,
      order: {
        select: {
          id: true,
          tenantId: true,
          orderNumber: true,
          currentQuote: {
            select: {
              id: true,
              qcOption: true,
              isActive: true,
            },
          },
        },
      },
    },
  });

  if (!payment || !payment.order) return;
  if (payment.direction !== "INBOUND" || payment.type !== "CLIENT_DEPOSIT") return;
  if (!["PENDING", "PROCESSING", "PROOF_UPLOADED"].includes(payment.status)) return;

  const activeQuote =
    payment.order.currentQuote && payment.order.currentQuote.isActive
      ? payment.order.currentQuote
      : await prisma.quote.findFirst({
          where: {
            orderId: payment.order.id,
            isActive: true,
          },
          select: {
            id: true,
            qcOption: true,
          },
          orderBy: { version: "desc" },
        });

  if (!activeQuote) return;

  const paymentEvidence =
    payment.reference?.trim() ||
    payment.notes?.trim() ||
    "Verification manuelle de la preuve de paiement requise.";

  await ensureCeoPaymentValidationTask({
    tenantId: payment.order.tenantId,
    orderId: payment.order.id,
    quoteId: activeQuote.id,
    orderNumber: payment.order.orderNumber,
    totalXaf: Number(payment.amountXAF || 0),
    currency: payment.currency || "XAF",
    paymentMethod: payment.methodKey || payment.method || "MANUAL_REVIEW",
    paymentEvidence,
    qcOption: activeQuote.qcOption,
  });
};

const handleIndicatifSourcingFromPayment: EventHandler = async (event) => {
  const payload = event.payload as Record<string, unknown>;
  const payloadOrderId = payload.orderId as string | undefined;
  const orderId =
    payloadOrderId ||
    (
      await prisma.payment.findUnique({
        where: { id: event.entityId },
        select: { orderId: true },
      })
    )?.orderId;

  if (!orderId) return;
  await IndicatifSourcingOrchestratorService.autoCreateSourcingFromConfirmedPayment({
    paymentId: event.entityId,
    orderId,
  });
};

const handleShippingLabelFromPayment: EventHandler = async (event) => {
  // When a payment is confirmed, notify the logistics team that the shipping label is ready.
  // The actual PDF is served on-demand via GET /api/orders/[id]/shipping-label
  const payment = await prisma.payment.findUnique({
    where: { id: event.entityId },
    select: {
      direction: true,
      status: true,
      order: {
        select: {
          id: true,
          tenantId: true,
          orderNumber: true,
        },
      },
    },
  });

  if (!payment?.order || payment.direction !== "INBOUND" || payment.status !== "CONFIRMED") return;

  const { tenantId, orderNumber, id: orderId } = payment.order;

  // Find logistics team
  const logisticsUsers = await prisma.user.findMany({
    where: {
      tenantId,
      isActive: true,
      role: { in: ["LOGISTICS_MANAGER", "LOGISTICS_ASSISTANT", "OPS"] as any[] },
    },
    select: { id: true },
  });

  if (logisticsUsers.length > 0) {
    await NotificationService.notifyMany(
      logisticsUsers.map((u) => u.id),
      {
        tenantId,
        type: "TASK_ASSIGNED",
        title: `Étiquette d'expédition prête — ${orderNumber}`,
        message: `Le paiement est confirmé. Téléchargez et envoyez l'étiquette au fournisseur via /api/orders/${orderId}/shipping-label`,
        entityType: "order",
        entityId: orderId,
      }
    );
  }
};

const handleDemandConversionFromPayment: EventHandler = async (event) => {
  const payment = await prisma.payment.findUnique({
    where: { id: event.entityId },
    select: {
      id: true,
      status: true,
      direction: true,
      order: {
        select: {
          id: true,
          currentQuote: {
            select: {
              id: true,
              pricingSnapshot: true,
              isActive: true,
            },
          },
        },
      },
    },
  });

  if (!payment?.order || payment.direction !== "INBOUND" || payment.status !== "CONFIRMED") return;

  const activeQuote =
    payment.order.currentQuote && payment.order.currentQuote.isActive
      ? payment.order.currentQuote
      : await prisma.quote.findFirst({
          where: { orderId: payment.order.id, isActive: true },
          select: { id: true, pricingSnapshot: true },
          orderBy: { version: "desc" },
        });

  if (!activeQuote) return;

  const snapshot = (activeQuote.pricingSnapshot as Record<string, unknown> | null) ?? {};
  const autoSourcing =
    snapshot.autoSourcing && typeof snapshot.autoSourcing === "object"
      ? (snapshot.autoSourcing as Record<string, unknown>)
      : null;
  const firstCaseId =
    autoSourcing && Array.isArray(autoSourcing.caseIds) && autoSourcing.caseIds.length > 0
      ? String(autoSourcing.caseIds[0])
      : null;

  await markDemandConvertedForQuote({
    quoteId: activeQuote.id,
    orderId: payment.order.id,
    convertedCaseId: firstCaseId,
  });
};

async function resolveActiveQuoteForPayment(orderId: string) {
  return prisma.quote.findFirst({
    where: {
      orderId,
      isActive: true,
    },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      paidAt: true,
    },
    orderBy: { version: "desc" },
  });
}

async function completePaymentWorkflowTasks(orderId: string) {
  await prisma.task.updateMany({
    where: {
      entityType: "order",
      entityId: orderId,
      taskType: { in: ["confirm_payment", "payment_validation", "ceo_payment_validation"] },
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });
}

const handleQuotePaymentConfirmed: EventHandler = async (event) => {
  const payment = await prisma.payment.findUnique({
    where: { id: event.entityId },
    select: {
      id: true,
      orderId: true,
      direction: true,
      status: true,
      methodKey: true,
      method: true,
      confirmedAt: true,
      paidAt: true,
    },
  });

  if (!payment || payment.direction !== "INBOUND" || payment.status !== "CONFIRMED") return;

  const activeQuote = await resolveActiveQuoteForPayment(payment.orderId);
  if (!activeQuote) return;

  if (activeQuote.paymentStatus !== "PAID") {
    await prisma.quote.update({
      where: { id: activeQuote.id },
      data: {
        paymentStatus: "PAID",
        paymentMethod: payment.methodKey ?? payment.method ?? activeQuote.paymentMethod,
        paidAt: payment.paidAt ?? payment.confirmedAt ?? new Date(),
      },
    });
  }

  await completePaymentWorkflowTasks(payment.orderId);
  await QcUpsellService.ensureGhostRequestAfterPayment(payment.orderId);
  await syncDemandStatusForQuote(activeQuote.id);
};

const handleQuotePaymentCancelled: EventHandler = async (event) => {
  const payment = await prisma.payment.findUnique({
    where: { id: event.entityId },
    select: {
      id: true,
      orderId: true,
      direction: true,
      status: true,
      order: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  if (!payment || payment.direction !== "INBOUND") return;

  const activeQuote = await resolveActiveQuoteForPayment(payment.orderId);
  if (!activeQuote || activeQuote.paymentStatus === "PAID") return;

  await prisma.quote.update({
    where: { id: activeQuote.id },
    data: {
      paymentStatus: "PENDING",
      paymentMethod: null,
      paidAt: null,
    },
  });

  if (payment.order?.status === "PAIEMENT_EN_COURS") {
    await prisma.order.update({
      where: { id: payment.orderId },
      data: { status: "DEVIS" },
    });
  }

  await cancelQuoteWorkflowTasks({
    orderId: payment.orderId,
    includePaymentTasks: true,
    excludingQuoteId: activeQuote.id,
  });
  await syncDemandStatusForQuote(activeQuote.id);
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
    subtasks?: {
      title: string;
      slaHours?: number;
      module?: string;
      priority?: string;
      assigneeRole?: TaskRoleHint;
    }[];
    dependsOnTaskTypes?: string[]; // block until these task types complete
  }
) {
  const order = await prisma.order.findUnique({
    where: { id: event.entityId },
    select: { tenantId: true, orderNumber: true },
  });

  if (!order) return;

  const assignees = await resolveOrderOpsAssignees(event.entityId, order.tenantId);
  const parentAssigneeId = resolveTaskAssigneeId(config.module, assignees);

  // Auto-add dependencies on previous task types in the same order
  const dependencyTaskIds: string[] = [];
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
        dependencyTaskIds.push(prev.id);
      }
    }
  }

  const taskResult = await OperationalTaskService.create({
    tenantId: order.tenantId,
    entityType: event.entityType,
    entityId: event.entityId,
    taskType: config.taskType,
    title: config.title,
    module: config.module,
    priority: config.priority || "NORMAL",
    ownerType: config.ownerType || "HUMAN",
    automationAllowed: config.automationAllowed ?? false,
    assigneeId: parentAssigneeId,
    assignedByName: AUTO_ASSIGNER_NAME,
    tags: config.tags ?? [],
    slaHours: config.slaHours,
    subtasks: config.subtasks?.map((sub, index) => ({
      title: sub.title,
      slaHours: sub.slaHours,
      module: sub.module,
      priority: sub.priority as any,
      assigneeId: resolveTaskAssigneeId(sub.module ?? config.module, assignees, sub.assigneeRole) ?? undefined,
      dependsOnPrevious: index > 0,
    })),
    dependencies: dependencyTaskIds.map((taskId) => ({
      dependsOnTaskId: taskId,
      type: "BLOCKS",
    })),
  });

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
        entityId: taskResult.taskId,
      }
    );
  }

  return prisma.task.findUnique({ where: { id: taskResult.taskId } });
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
        {
          title: "Identifier 3 fournisseurs potentiels",
          slaHours: 1,
          priority: "HIGH",
          assigneeRole: "SOURCING_ASSISTANT",
        },
        {
          title: "Demander les cotations",
          slaHours: 1,
          assigneeRole: "SOURCING_ASSISTANT",
        },
        {
          title: "Comparer et selectionner",
          slaHours: 1,
          assigneeRole: "LOGISTICS_MANAGER",
        },
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
    RECU_ENTREPOT: {
      taskType: "warehouse_intake",
      title: "Réceptionner la marchandise à l'entrepôt Chine",
      module: "logistics",
      slaHours: 12,
      priority: "HIGH",
      tags: ["entrepot", "reception", "mesure"],
      dependsOnTaskTypes: ["monitor_production"],
      subtasks: [
        { title: "Scanner la commande et réceptionner les colis", slaHours: 4, assigneeRole: "LOGISTICS_ASSISTANT" },
        { title: "Mesurer poids et dimensions réels", slaHours: 8, assigneeRole: "LOGISTICS_ASSISTANT" },
        { title: "Valider si le QC doit démarrer", slaHours: 12, assigneeRole: "LOGISTICS_MANAGER" },
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
        { title: "Coordonner avec le fournisseur", slaHours: 12, assigneeRole: "LOGISTICS_MANAGER" },
        {
          title: "Envoyer l'inspecteur",
          slaHours: 24,
          priority: "HIGH",
          assigneeRole: "LOGISTICS_ASSISTANT",
        },
        { title: "Rediger le rapport QC", slaHours: 48, assigneeRole: "LOGISTICS_ASSISTANT" },
      ],
    },
    QC_VALIDE: {
      taskType: "book_freight",
      title: "Réserver le fret et organiser l'expédition",
      module: "logistics",
      slaHours: 24,
      priority: "HIGH",
      tags: ["fret", "expédition"],
      // Dépend de l'une des tâches QC selon l'option choisie (NONE=visual_check, VIRTUAL, PHYSICAL)
      // Si aucune de ces tâches n'existe (bypass), aucune dépendance n'est créée et la tâche démarre immédiatement
      dependsOnTaskTypes: [
        "warehouse_visual_check",
        "virtual_qc_execution",
        "physical_qc_booking",
        "warehouse_intake",
      ],
      subtasks: [
        {
          title: "Obtenir les cotations transitaires",
          slaHours: 8,
          priority: "HIGH",
          assigneeRole: "LOGISTICS_ASSISTANT",
        },
        { title: "Reserver le conteneur/groupage", slaHours: 16, assigneeRole: "LOGISTICS_ASSISTANT" },
        { title: "Preparer les documents d'export", slaHours: 24, assigneeRole: "LOGISTICS_MANAGER" },
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
        {
          title: "Dedouanement et formalites",
          slaHours: 12,
          priority: "HIGH",
          assigneeRole: "LOGISTICS_ASSISTANT",
        },
        { title: "Planifier la livraison finale", slaHours: 24, assigneeRole: "LOGISTICS_MANAGER" },
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
  if (config && !["RECU_ENTREPOT", "QC_EN_COURS"].includes(newStatus)) {
    await createTaskFromEvent(event, config);
  }

  // ── LIVRE : tâche "Remettre la marchandise au client" pour l'agent local ──
  if (newStatus === "LIVRE") {
    await createTaskFromEvent(event, {
      taskType: "deliver_to_client",
      title: "Remettre la marchandise au client",
      module: "logistics",
      slaHours: 48,
      priority: "HIGH",
      tags: ["livraison-finale", "agent-local"],
      dependsOnTaskTypes: ["arrange_delivery"],
      subtasks: [
        { title: "Contacter le client pour convenir d'un rendez-vous", slaHours: 4, assigneeRole: "LOGISTICS_ASSISTANT" },
        { title: "Remettre le colis et faire signer le bon de livraison", slaHours: 48, assigneeRole: "LOGISTICS_ASSISTANT" },
      ],
    });
  }

  if (newStatus === "RECU_ENTREPOT") {
    await createTaskFromEvent(event, taskConfigs.RECU_ENTREPOT);
    await QcUpsellService.ensureStageTasks(event.entityId);
  }

  if (newStatus === "QC_EN_COURS") {
    await QcUpsellService.ensureStageTasks(event.entityId);
  }

  // ── Tâches de notification client (assignées au CM) ──────────────────────
  // Une tâche par jalon clé, assignée au Community Manager, avec SLA.
  const CLIENT_NOTIFICATION_CONFIGS: Record<
    string,
    { title: string; slaHours: number; clientMessage: string }
  > = {
    PAIEMENT_EN_COURS: {
      title: "Notifier le client : paiement en cours de vérification",
      slaHours: 4,
      clientMessage: "Votre paiement a bien été reçu et est en cours de vérification par notre équipe.",
    },
    SOURCING: {
      title: "Notifier le client : achat en cours",
      slaHours: 24,
      clientMessage: "Votre commande est lancée. Notre équipe recherche les meilleures offres fournisseurs pour vous. Nous vous tenons informé(e) dès la confirmation.",
    },
    RECU_ENTREPOT: {
      title: "Notifier le client : marchandise reçue à l'entrepôt Chine",
      slaHours: 4,
      clientMessage: "Votre marchandise a bien été reçue dans notre entrepôt partenaire en Chine. Nous lançons maintenant la mesure réelle et le contrôle qualité prévu.",
    },
    QC_EN_COURS: {
      title: "Notifier le client : contrôle qualité en cours en Chine",
      slaHours: 4,
      clientMessage: "Votre colis est en cours d'inspection qualité dans nos entrepôts en Chine.",
    },
    QC_VALIDE: {
      title: "Notifier le client : colis validé — arrivée estimée à communiquer",
      slaHours: 8,
      clientMessage: "Votre colis a été inspecté et validé. Il est prêt à être expédié. Communiquez la date d'arrivée estimée à Brazzaville.",
    },
    EN_TRANSIT: {
      title: "Notifier le client : colis en transit vers Brazzaville",
      slaHours: 4,
      clientMessage: "Votre colis a quitté la Chine et est en route vers Brazzaville.",
    },
    DEDOUANE: {
      title: "Notifier le client : dédouanement en cours",
      slaHours: 4,
      clientMessage: "Votre colis est arrivé à Brazzaville et est en cours de dédouanement.",
    },
    LIVRE: {
      title: "Confirmer la livraison avec le client et recueillir son retour",
      slaHours: 8,
      clientMessage: "Votre commande a été livrée. Confirmez la bonne réception et demandez un retour d'expérience.",
    },
  };

  const notifConfig = CLIENT_NOTIFICATION_CONFIGS[newStatus];
  if (notifConfig) {
    const orderId = event.entityId;
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { tenantId: true, orderNumber: true, ownerId: true, onboardedById: true },
    });

    if (order) {
      const cm = await prisma.user.findFirst({
        where: {
          tenantId: order.tenantId,
          role: { in: ["COMMUNITY_MANAGER", "CRM_MANAGER"] as any[] },
          isActive: true,
        },
        select: { id: true },
      });
      const fallbackAssigneeId = cm?.id || order.ownerId || order.onboardedById || null;

      const existing = await prisma.task.findFirst({
        where: {
          entityType: "order",
          entityId: orderId,
          taskType: "client_notification",
          title: { contains: notifConfig.title.slice(0, 40) },
          status: { notIn: ["CANCELLED"] },
        },
      });

      if (!existing) {
        const notifTask = await OperationalTaskService.create({
          tenantId: order.tenantId,
          entityType: "order",
          entityId: orderId,
          taskType: "client_notification",
          title: `[${order.orderNumber}] ${notifConfig.title}`,
          description: `Message suggéré au client :\n\n"${notifConfig.clientMessage}"`,
          module: "whatsapp",
          priority: "HIGH",
          ownerType: "SYSTEM",
          riskLevel: "LOW",
          slaHours: notifConfig.slaHours,
          assigneeId: fallbackAssigneeId,
          assigneeRoles: ["COMMUNITY_MANAGER", "CRM_MANAGER"],
          fallbackRoles: ["ADMIN", "DIRECTION", "CEO"],
          watcherRoles: ["ADMIN"],
          assignedByName: AUTO_ASSIGNER_NAME,
          tags: ["client-notification", order.orderNumber, newStatus.toLowerCase()],
        });

        if (!fallbackAssigneeId) {
          const fallbackUsers = await prisma.user.findMany({
            where: {
              tenantId: order.tenantId,
              isActive: true,
              role: { in: ["CEO", "DIRECTION", "ADMIN"] as any[] },
            },
            select: { id: true },
          });
          if (fallbackUsers.length > 0) {
            await NotificationService.notifyMany(
              fallbackUsers.map((user) => user.id),
              {
                tenantId: order.tenantId,
                type: "TASK_ASSIGNED",
                title: `Affectation requise - notification client ${order.orderNumber}`,
                message: "Aucun COMMUNITY_MANAGER n'est configuré pour cette notification client.",
                entityType: "task",
                entityId: notifTask.taskId,
              }
            );
          }
        }
      }
    }
  }

  // ── WhatsApp automatique sur jalons critiques (dernier kilomètre) ──────────
  // Pour DEDOUANE et LIVRE on envoie directement via WAHA sans attendre le CM.
  const AUTO_WA_STATUSES: Record<string, string> = {
    DEDOUANE: "🚨 Votre colis est arrivé à Brazzaville et est en cours de dédouanement. Notre équipe vous contactera dès que votre marchandise est prête à être retirée.",
    LIVRE: "🎉 Votre commande #{orderNumber} est arrivée à Brazzaville et est prête à être remise ! Notre agent vous contactera très bientôt pour convenir d'un rendez-vous de livraison.",
    CLOTURE: "✅ Votre commande #{orderNumber} est clôturée. Merci pour votre confiance ! 🙏 Avez-vous été satisfait(e) de nos services ? Votre avis nous aide à nous améliorer. Un nouveau projet ? Notre équipe est à votre disposition.",
  };

  const autoWaMessage = AUTO_WA_STATUSES[newStatus];
  if (autoWaMessage) {
    try {
      const orderForWa = await prisma.order.findUnique({
        where: { id: event.entityId },
        select: {
          tenantId: true,
          orderNumber: true,
          contact: {
            select: {
              id: true,
              phone: true,
              whatsappProfiles: {
                take: 1,
                select: {
                  conversations: {
                    orderBy: { updatedAt: "desc" },
                    take: 1,
                    select: { id: true },
                  },
                },
              },
            },
          },
        },
      });

      if (orderForWa?.contact?.phone) {
        const message = autoWaMessage.replace("{orderNumber}", orderForWa.orderNumber);
        const existingConv = orderForWa.contact.whatsappProfiles?.[0]?.conversations?.[0];

        if (existingConv) {
          await WhatsappMessageService.sendText({
            tenantId: orderForWa.tenantId,
            conversationId: existingConv.id,
            body: message,
          }).catch((err) =>
            console.error(`[handleOrderStatusChanged] WhatsApp auto-send failed for ${orderForWa.orderNumber}:`, err)
          );
        }
      }
    } catch (err) {
      console.error(`[handleOrderStatusChanged] WhatsApp auto lookup failed:`, err);
    }
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
  if (["schedule_qc", "warehouse_visual_check", "virtual_qc_execution", "physical_qc_booking"].includes(task.taskType)) {
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
    // Calcul automatique de la marge réelle
    await generateMarginReportForOrder(task.entityId).catch((err) =>
      console.error(`[handleTaskCompleted] MarginReport generation failed for order ${task.entityId}:`, err)
    );

    // Tâche de rapport financier final
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

// ── Quote Approved Handler ───────────────────────────────────────

const handleQuoteApproved: EventHandler = async (event) => {
  const payload = event.payload as Record<string, unknown>;
  const quoteId = event.entityId;
  const orderId = payload.orderId as string | undefined;

  if (!orderId) return;

  // Sync le statut DemandIntake lié
  await syncDemandStatusForQuote(quoteId);

  // Notifier l'équipe commerciale que le devis est approuvé et prêt à envoyer
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { tenantId: true, orderNumber: true, ownerId: true, onboardedById: true },
  });
  if (!order) return;

  const commercialUsers = await prisma.user.findMany({
    where: {
      tenantId: order.tenantId,
      isActive: true,
      role: { in: ["COMMERCIAL", "CRM_MANAGER", "OPS"] as any[] },
    },
    select: { id: true },
  });

  const notifyIds = Array.from(
    new Set([
      ...commercialUsers.map((u) => u.id),
      order.ownerId,
      order.onboardedById,
    ].filter(Boolean) as string[])
  );

  if (notifyIds.length > 0) {
    await NotificationService.notifyMany(notifyIds, {
      tenantId: order.tenantId,
      type: "APPROVAL_REQUIRED",
      title: `Devis approuvé — ${order.orderNumber}`,
      message: "Le devis est validé. Vous pouvez maintenant l'envoyer au client.",
      entityType: "order",
      entityId: orderId,
    });
  }
};

// ── MarginReport Auto-Generation ────────────────────────────────

async function generateMarginReportForOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      tenantId: true,
      totalClient: true,
      merchandiseTotal: true,
      logisticsCost: true,
      commissionAmount: true,
      qcCost: true,
      currency: true,
      payments: {
        where: { direction: "OUTBOUND", status: "CONFIRMED" },
        select: { amountXAF: true },
      },
      marginReport: { select: { id: true } },
    },
  });

  if (!order) return;

  const revenue = Number(order.totalClient || 0);
  const freightCost = Number(order.logisticsCost || 0);
  const qcCost = Number(order.qcCost || 0);
  const commission = Number(order.commissionAmount || 0);
  // COGS = paiements fournisseurs confirmés (OUTBOUND) ou merchandise total si pas de paiements
  const outboundPaid = order.payments.reduce((s, p) => s + Number(p.amountXAF || 0), 0);
  const cogs = outboundPaid > 0 ? outboundPaid : Number(order.merchandiseTotal || 0);

  const grossMargin = revenue - cogs - freightCost - qcCost;
  const marginPercent = revenue > 0 ? (grossMargin / revenue) * 100 : 0;
  const netMargin = grossMargin - commission;
  const netMarginPct = revenue > 0 ? (netMargin / revenue) * 100 : 0;

  if (order.marginReport) {
    await prisma.marginReport.update({
      where: { orderId },
      data: {
        revenue,
        cogs,
        freightCost,
        qcCost,
        commission,
        grossMargin,
        marginPercent,
        netMargin,
        netMarginPct,
        calculatedAt: new Date(),
      },
    });
  } else {
    await prisma.marginReport.create({
      data: {
        orderId,
        revenue,
        cogs,
        freightCost,
        qcCost,
        commission,
        grossMargin,
        marginPercent,
        netMargin,
        netMarginPct,
      },
    });
  }
}

// ── Registry ────────────────────────────────────────────────────

export const eventHandlerRegistry: Record<string, EventHandler[]> = {
    "order.created": [handleOrderCreated, handleCustomerIntelligenceFromOrder],
    "order.status_changed": [handleOrderStatusChanged, handleCustomerIntelligenceFromOrder],
  "payment.created": [handlePaymentCreated],
  "payment.proof_uploaded": [handlePaymentCreated, handleCustomerIntelligenceFromPayment],
  "payment.confirmed": [
      handleQuotePaymentConfirmed,
      handleCustomerIntelligenceFromPayment,
      handleIndicatifSourcingFromPayment,
      handleDemandConversionFromPayment,
      handleShippingLabelFromPayment,
    ],
  "payment.cancelled": [handleQuotePaymentCancelled, handleCustomerIntelligenceFromPayment],
  "quote.approved": [handleQuoteApproved],
  "dispute.created": [handleCustomerIntelligenceFromDispute],
  "dispute.resolved": [handleCustomerIntelligenceFromDispute],
  "task.completed": [handleTaskCompleted],
  "task.blocked": [handleTaskBlocked],
  "task.sla_breach": [handleSLABreach],
};
