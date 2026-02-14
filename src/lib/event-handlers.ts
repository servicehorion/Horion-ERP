import { prisma } from "@/lib/db";
import type { Event } from "@prisma/client";

type EventHandler = (event: Event) => Promise<void>;

async function createTaskFromEvent(
  event: Event,
  config: {
    taskType: string;
    title: string;
    module: string;
    slaHours: number;
    priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  }
) {
  // Get tenantId from the related order
  const order = await prisma.order.findUnique({
    where: { id: event.entityId },
    select: { tenantId: true },
  });

  if (!order) return;

  const slaDeadline = new Date();
  slaDeadline.setHours(slaDeadline.getHours() + config.slaHours);

  await prisma.task.create({
    data: {
      tenantId: order.tenantId,
      entityType: event.entityType,
      entityId: event.entityId,
      taskType: config.taskType,
      title: config.title,
      module: config.module,
      priority: config.priority || "NORMAL",
      slaDeadline,
      ownerType: "HUMAN",
      status: "PENDING",
      riskLevel: "LOW",
    },
  });
}

const handleOrderCreated: EventHandler = async (event) => {
  await createTaskFromEvent(event, {
    taskType: "send_quote",
    title: "Preparer et envoyer le devis au client",
    module: "orders",
    slaHours: 4,
    priority: "HIGH",
  });
};

const handleOrderStatusChanged: EventHandler = async (event) => {
  const payload = event.payload as Record<string, unknown>;
  const newStatus = payload.newStatus as string;

  const taskConfigs: Record<string, { taskType: string; title: string; module: string; slaHours: number; priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT" }> = {
    PAIEMENT_EN_COURS: {
      taskType: "confirm_payment",
      title: "Confirmer la reception du paiement client",
      module: "finance",
      slaHours: 24,
      priority: "HIGH",
    },
    SOURCING: {
      taskType: "find_supplier",
      title: "Rechercher et selectionner un fournisseur",
      module: "sourcing",
      slaHours: 2,
      priority: "HIGH",
    },
    EN_PRODUCTION: {
      taskType: "monitor_production",
      title: "Suivre la production chez le fournisseur",
      module: "sourcing",
      slaHours: 168, // 7 days
    },
    QC_EN_COURS: {
      taskType: "schedule_qc",
      title: "Planifier l'inspection qualite",
      module: "qc",
      slaHours: 48,
    },
    QC_VALIDE: {
      taskType: "book_freight",
      title: "Reserver le fret et organiser l'expedition",
      module: "logistics",
      slaHours: 24,
      priority: "HIGH",
    },
    EN_TRANSIT: {
      taskType: "track_shipment",
      title: "Suivre l'expedition en transit",
      module: "logistics",
      slaHours: 720, // 30 days
    },
    DEDOUANE: {
      taskType: "arrange_delivery",
      title: "Organiser la livraison au client",
      module: "logistics",
      slaHours: 24,
      priority: "HIGH",
    },
    LIVRE: {
      taskType: "calculate_margin",
      title: "Calculer la marge finale de la commande",
      module: "finance",
      slaHours: 4,
    },
  };

  const config = taskConfigs[newStatus];
  if (config) {
    await createTaskFromEvent(event, config);
  }
};

export const eventHandlerRegistry: Record<string, EventHandler[]> = {
  "order.created": [handleOrderCreated],
  "order.status_changed": [handleOrderStatusChanged],
};
