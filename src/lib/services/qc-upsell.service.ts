import { prisma } from "@/lib/db";
import { OperationalTaskService } from "@/lib/services/operational-task.service";
import { QC_UPSELL_PRICING, type QcUpsellOption } from "@/lib/qc-upsell";

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
        decisionNotes: `QC ${order.qcOption} cree automatiquement apres paiement confirme.`,
      },
    });

    await OperationalTaskService.create({
      tenantId: order.tenantId,
      entityType: "order",
      entityId: order.id,
      taskType: "qc_intake_prepare",
      title: `Preparer le QC ${order.qcOption.toLowerCase()} - ${order.orderNumber}`,
      description: "QC demande par le client. Le dossier QC est pret et attend la reception marchandise.",
      module: "qc",
      priority: "HIGH",
      ownerType: "SYSTEM",
      riskLevel: "MEDIUM",
      slaHours: 12,
      tags: ["qc-upsell", order.orderNumber, String(order.qcOption).toLowerCase()],
      customFields: {
        qcRequestId: request.id,
        actionType: "INTERNAL_ACTION",
        isAutomated: false,
      },
      completionRequirements: {
        requireAllSubtasks: true,
      },
      assigneeRoles: ["LOGISTICS_MANAGER", "LOGISTICS_ASSISTANT", "OPS"],
      reuseIfOpen: true,
      subtasks: [
        {
          title: "Verifier les exigences client et le niveau de QC",
          slaHours: 4,
          assigneeRoles: ["LOGISTICS_ASSISTANT", "LOGISTICS_MANAGER"],
        },
        {
          title: "Preparer le brief entrepot ou partenaire",
          slaHours: 8,
          assigneeRoles: ["LOGISTICS_MANAGER", "LOGISTICS_ASSISTANT"],
          dependsOnPrevious: true,
        },
      ],
    });

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
        qcRequests: {
          where: { status: { not: "CANCELLED" } },
          orderBy: [{ createdAt: "desc" }],
          take: 1,
          select: { id: true, status: true },
        },
      },
    });

    if (!order) return;

    if (order.qcOption === "NONE") {
      await OperationalTaskService.create({
        tenantId: order.tenantId,
        entityType: "order",
        entityId: order.id,
        taskType: "warehouse_visual_check",
        title: `Verification visuelle entrepot - ${order.orderNumber}`,
        description: "Comptage et verification visuelle simple a l'entrepot.",
        module: "qc",
        priority: "HIGH",
        ownerType: "SYSTEM",
        riskLevel: "LOW",
        slaHours: 24,
        tags: ["qc-basic", order.orderNumber],
        customFields: {
          actionType: "WHATSAPP_PARTNER",
          isAutomated: false,
          actionPayload: `Order ${order.orderNumber}: basic visual check required within 24h.`,
        },
        completionRequirements: {
          requireAllSubtasks: true,
          requiredAttachmentCount: 1,
        },
        assigneeRoles: ["LOGISTICS_ASSISTANT", "LOGISTICS_MANAGER", "OPS"],
        reuseIfOpen: true,
        subtasks: [
          {
            title: "Demander les photos de verification a l'entrepot",
            slaHours: 8,
            assigneeRoles: ["LOGISTICS_ASSISTANT", "OPS"],
          },
          {
            title: "Valider la conformite visuelle de base",
            slaHours: 24,
            assigneeRoles: ["LOGISTICS_ASSISTANT", "LOGISTICS_MANAGER"],
            dependsOnPrevious: true,
          },
        ],
      });
      return;
    }

    const request = order.qcRequests[0] ?? (await this.ensureGhostRequestAfterPayment(order.id));
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
      await OperationalTaskService.create({
        tenantId: order.tenantId,
        entityType: "order",
        entityId: order.id,
        taskType: "virtual_qc_execution",
        title: `QC virtuel a executer - ${order.orderNumber}`,
        description: "Photos HD, checklist de non-conformite et rapport QC sous 48h.",
        module: "qc",
        priority: "HIGH",
        ownerType: "SYSTEM",
        riskLevel: "MEDIUM",
        slaHours: QC_UPSELL_PRICING.VIRTUAL.slaHours ?? 48,
        tags: ["qc-upsell", "virtual", order.orderNumber],
        customFields: {
          qcRequestId: request.id,
          actionType: "WHATSAPP_PARTNER",
          isAutomated: false,
          actionPayload: `Hello partner, virtual QC is required for order ${order.orderNumber}. Please provide HD photos + defect checklist within 48h.`,
        },
        completionRequirements: {
          requireAllSubtasks: true,
          requiredAttachmentCount: 1,
          requiredComment: true,
        },
        assigneeRoles: ["LOGISTICS_MANAGER", "LOGISTICS_ASSISTANT", "OPS"],
        reuseIfOpen: true,
        subtasks: [
          {
            title: "Recueillir les photos HD et la checklist",
            slaHours: 24,
            assigneeRoles: ["LOGISTICS_ASSISTANT", "OPS"],
          },
          {
            title: "Analyser les non-conformites et rediger le rapport",
            slaHours: 48,
            assigneeRoles: ["LOGISTICS_MANAGER", "LOGISTICS_ASSISTANT"],
            dependsOnPrevious: true,
          },
        ],
      });
    }

    if (order.qcOption === "PHYSICAL") {
      await OperationalTaskService.create({
        tenantId: order.tenantId,
        entityType: "order",
        entityId: order.id,
        taskType: "physical_qc_booking",
        title: `Mandater l'inspection tierce - ${order.orderNumber}`,
        description: "Mandater SGS/Bureau Veritas et obtenir le rapport tiers sous 72h.",
        module: "qc",
        priority: "URGENT",
        ownerType: "SYSTEM",
        riskLevel: "HIGH",
        slaHours: QC_UPSELL_PRICING.PHYSICAL.slaHours ?? 72,
        tags: ["qc-upsell", "physical", order.orderNumber],
        customFields: {
          qcRequestId: request.id,
          actionType: "WHATSAPP_PARTNER",
          isAutomated: false,
          actionPayload: `Please book third-party inspection for order ${order.orderNumber} and share the report within 72h.`,
        },
        completionRequirements: {
          requireAllSubtasks: true,
          requiredAttachmentCount: 1,
          requiredComment: true,
        },
        assigneeRoles: ["LOGISTICS_MANAGER", "DIRECTION", "ADMIN"],
        reuseIfOpen: true,
        subtasks: [
          {
            title: "Contacter SGS ou Bureau Veritas",
            slaHours: 24,
            assigneeRoles: ["LOGISTICS_MANAGER", "ADMIN"],
          },
          {
            title: "Recueillir et verifier le rapport tiers",
            slaHours: 72,
            assigneeRoles: ["LOGISTICS_MANAGER", "LOGISTICS_ASSISTANT"],
            dependsOnPrevious: true,
          },
        ],
      });
    }

    await OperationalTaskService.create({
      tenantId: order.tenantId,
      entityType: "order",
      entityId: order.id,
      taskType: "client_notification_qc_stage",
      title: `Notifier le client - QC en cours ${order.orderNumber}`,
      description: "Informer le client que le controle qualite a demarre et rappeler le SLA annonce.",
      module: "whatsapp",
      priority: "HIGH",
      ownerType: "SYSTEM",
      riskLevel: "LOW",
      slaHours: 4,
      tags: ["client-notification", "qc", order.orderNumber],
      customFields: {
        actionType: "WHATSAPP_CLIENT",
        isAutomated: false,
        actionPayload:
          order.qcOption === "PHYSICAL"
            ? `Bonjour, l'inspection tierce de votre commande ${order.orderNumber} est en cours. Nous vous partageons le rapport des reception.`
            : `Bonjour, le QC virtuel de votre commande ${order.orderNumber} est lance. Vous recevrez les photos et le rapport des validation.`,
      },
      assigneeRoles: ["COMMUNITY_MANAGER", "CRM_MANAGER", "ADMIN"],
      reuseIfOpen: true,
    });
  }
}
