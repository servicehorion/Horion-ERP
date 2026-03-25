import { prisma } from "@/lib/db";
import { QC_UPSELL_PRICING, type QcUpsellOption } from "@/lib/qc-upsell";

async function pickUserId(tenantId: string, roles: string[]) {
  const user = await prisma.user.findFirst({
    where: {
      tenantId,
      isActive: true,
      role: { in: roles as any[] },
    },
    orderBy: { name: "asc" },
    select: { id: true },
  });
  return user?.id ?? null;
}

async function assignTask(taskId: string, userId?: string | null) {
  if (!userId) return;
  await prisma.taskAssignment.deleteMany({ where: { taskId } });
  await prisma.taskAssignment.create({
    data: {
      taskId,
      userId,
      assignedAt: new Date(),
    },
  });
}

function qcLevelFromOption(option: QcUpsellOption) {
  return option === "PHYSICAL" ? "PHYSICAL" : "VIRTUAL";
}

export class QcUpsellService {
  static async ensureGhostRequestAfterPayment(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        tenantId: true,
        orderNumber: true,
        qcOption: true,
        qcCost: true,
        qcRequests: {
          where: { status: { not: "CANCELLED" } },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!order || order.qcOption === "NONE") return null;
    if (order.qcRequests.length > 0) return order.qcRequests[0];

    const request = await prisma.qCRequest.create({
      data: {
        orderId: order.id,
        type: "PRE_SHIPMENT",
        level: qcLevelFromOption(order.qcOption as QcUpsellOption),
        status: "PENDING",
        cost: Number(order.qcCost || QC_UPSELL_PRICING[order.qcOption as QcUpsellOption].costXaf),
        currency: "XAF",
        decisionNotes: `QC ${order.qcOption} créé automatiquement après paiement confirmé.`,
      },
    });

    const existingTask = await prisma.task.findFirst({
      where: {
        entityType: "order",
        entityId: order.id,
        taskType: "qc_intake_prepare",
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      select: { id: true },
    });
    if (!existingTask) {
      const task = await prisma.task.create({
        data: {
          tenantId: order.tenantId,
          entityType: "order",
          entityId: order.id,
          taskType: "qc_intake_prepare",
          title: `Préparer le QC ${order.qcOption.toLowerCase()} - ${order.orderNumber}`,
          description: `QC demandé par le client. Le dossier QC est prêt et attend la réception marchandise.`,
          module: "qc",
          priority: "HIGH",
          ownerType: "HUMAN",
          status: "PENDING",
          riskLevel: "MEDIUM",
          slaDeadline: new Date(Date.now() + 12 * 3_600_000),
          tags: ["qc-upsell", order.orderNumber, String(order.qcOption).toLowerCase()],
          customFields: {
            qcRequestId: request.id,
            actionType: "INTERNAL_ACTION",
            isAutomated: false,
          },
        },
      });
      const assigneeId = await pickUserId(order.tenantId, ["LOGISTICS_MANAGER", "LOGISTICS_ASSISTANT"]);
      await assignTask(task.id, assigneeId);
    }

    return request;
  }

  static async ensureStageTasks(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        tenantId: true,
        orderNumber: true,
        qcOption: true,
        qcCost: true,
        qcRequests: {
          where: { status: { not: "CANCELLED" } },
          orderBy: [{ createdAt: "desc" }],
          take: 1,
          select: { id: true, status: true, level: true },
        },
      },
    });

    if (!order) return;

    const logisticsManagerId = await pickUserId(order.tenantId, ["LOGISTICS_MANAGER", "DIRECTION", "CEO", "ADMIN"]);
    const logisticsAssistantId = await pickUserId(order.tenantId, ["LOGISTICS_ASSISTANT", "LOGISTICS_MANAGER"]);
    const communityManagerId = await pickUserId(order.tenantId, ["COMMUNITY_MANAGER", "CRM_MANAGER"]);

    if (order.qcOption === "NONE") {
      const existing = await prisma.task.findFirst({
        where: {
          entityType: "order",
          entityId: order.id,
          taskType: "warehouse_visual_check",
          status: { notIn: ["COMPLETED", "CANCELLED"] },
        },
        select: { id: true },
      });
      if (!existing) {
        const task = await prisma.task.create({
          data: {
            tenantId: order.tenantId,
            entityType: "order",
            entityId: order.id,
            taskType: "warehouse_visual_check",
            title: `Vérification visuelle entrepôt - ${order.orderNumber}`,
            description: "Comptage + vérification visuelle simple à l'entrepôt.",
            module: "qc",
            priority: "HIGH",
            ownerType: "HUMAN",
            status: "PENDING",
            riskLevel: "LOW",
            slaDeadline: new Date(Date.now() + 24 * 3_600_000),
            tags: ["qc-basic", order.orderNumber],
            customFields: {
              actionType: "WHATSAPP_PARTNER",
              isAutomated: false,
              actionPayload: `Order ${order.orderNumber}: basic visual check required within 24h.`,
            },
          },
        });
        await assignTask(task.id, logisticsAssistantId);
      }
      return;
    }

    const request =
      order.qcRequests[0] ??
      (await this.ensureGhostRequestAfterPayment(order.id));
    if (!request) return;

    if (request.status === "PENDING" || request.status === "SCHEDULED") {
      await prisma.qCRequest.update({
        where: { id: request.id },
        data: {
          status: "IN_PROGRESS",
          scheduledAt: request.status === "PENDING" ? new Date() : undefined,
        },
      });
    }

    if (order.qcOption === "VIRTUAL") {
      const existing = await prisma.task.findFirst({
        where: {
          entityType: "order",
          entityId: order.id,
          taskType: "virtual_qc_execution",
          status: { notIn: ["COMPLETED", "CANCELLED"] },
        },
        select: { id: true },
      });
      if (!existing) {
        const task = await prisma.task.create({
          data: {
            tenantId: order.tenantId,
            entityType: "order",
            entityId: order.id,
            taskType: "virtual_qc_execution",
            title: `QC virtuel à exécuter - ${order.orderNumber}`,
            description: "Photos HD, checklist de non-conformité et rapport QC sous 48h.",
            module: "qc",
            priority: "HIGH",
            ownerType: "HUMAN",
            status: "PENDING",
            riskLevel: "MEDIUM",
            slaDeadline: new Date(Date.now() + (QC_UPSELL_PRICING.VIRTUAL.slaHours ?? 48) * 3_600_000),
            tags: ["qc-upsell", "virtual", order.orderNumber],
            customFields: {
              qcRequestId: request.id,
              actionType: "WHATSAPP_PARTNER",
              isAutomated: false,
              actionPayload: `Hello partner, virtual QC is required for order ${order.orderNumber}. Please provide HD photos + defect checklist within 48h.`,
            },
          },
        });
        await assignTask(task.id, logisticsManagerId ?? logisticsAssistantId);
      }
    }

    if (order.qcOption === "PHYSICAL") {
      const existing = await prisma.task.findFirst({
        where: {
          entityType: "order",
          entityId: order.id,
          taskType: "physical_qc_booking",
          status: { notIn: ["COMPLETED", "CANCELLED"] },
        },
        select: { id: true },
      });
      if (!existing) {
        const task = await prisma.task.create({
          data: {
            tenantId: order.tenantId,
            entityType: "order",
            entityId: order.id,
            taskType: "physical_qc_booking",
            title: `Mandater l'inspection tierce - ${order.orderNumber}`,
            description: "Mandater SGS/Bureau Veritas et obtenir le rapport tiers sous 72h.",
            module: "qc",
            priority: "URGENT",
            ownerType: "HUMAN",
            status: "PENDING",
            riskLevel: "HIGH",
            slaDeadline: new Date(Date.now() + (QC_UPSELL_PRICING.PHYSICAL.slaHours ?? 72) * 3_600_000),
            tags: ["qc-upsell", "physical", order.orderNumber],
            customFields: {
              qcRequestId: request.id,
              actionType: "WHATSAPP_PARTNER",
              isAutomated: false,
              actionPayload: `Please book third-party inspection for order ${order.orderNumber} and share the report within 72h.`,
            },
          },
        });
        await assignTask(task.id, logisticsManagerId);
      }
    }

    const existingClientTask = await prisma.task.findFirst({
      where: {
        entityType: "order",
        entityId: order.id,
        taskType: "client_notification_qc_stage",
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      select: { id: true },
    });
    if (!existingClientTask) {
      const task = await prisma.task.create({
        data: {
          tenantId: order.tenantId,
          entityType: "order",
          entityId: order.id,
          taskType: "client_notification_qc_stage",
          title: `Notifier le client - QC en cours ${order.orderNumber}`,
          description: "Informer le client que le contrôle qualité a démarré et rappeler le SLA annoncé.",
          module: "whatsapp",
          priority: "HIGH",
          ownerType: "HUMAN",
          status: "PENDING",
          riskLevel: "LOW",
          slaDeadline: new Date(Date.now() + 4 * 3_600_000),
          tags: ["client-notification", "qc", order.orderNumber],
          customFields: {
            actionType: "WHATSAPP_CLIENT",
            isAutomated: false,
            actionPayload:
              order.qcOption === "PHYSICAL"
                ? `Bonjour, l'inspection tierce de votre commande ${order.orderNumber} est en cours. Nous vous partageons le rapport dès réception.`
                : `Bonjour, le QC virtuel de votre commande ${order.orderNumber} est lancé. Vous recevrez les photos et le rapport dès validation.`,
          },
        },
      });
      await assignTask(task.id, communityManagerId);
    }
  }
}
