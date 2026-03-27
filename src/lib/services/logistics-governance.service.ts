import type {
  CustomsStatus,
  LogisticsRiskLevel,
  ShipmentMode,
  ShipmentStatus,
} from "@prisma/client";

import { prisma } from "@/lib/db";
import type {
  ShipmentResponsibilityProjection,
  ShipmentTransitionReadiness,
  ShipmentWorkflowSnapshot,
} from "@/lib/logistics/types";
import { TaskWorkflowService } from "@/lib/services/task-workflow.service";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MOVING_STATUSES: ShipmentStatus[] = ["PICKED_UP", "IN_TRANSIT", "ARRIVED_PORT", "CUSTOMS", "IN_DELIVERY"];

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  PENDING: "En attente",
  BOOKED: "Reservee",
  PICKED_UP: "Recuperee",
  IN_TRANSIT: "En transit",
  ARRIVED_PORT: "Arrivee au port",
  CUSTOMS: "Douane",
  CLEARED: "Dedouanee",
  IN_DELIVERY: "En livraison",
  DELIVERED: "Livree",
};

export const SHIPMENT_VALID_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  PENDING: ["BOOKED", "PICKED_UP"],
  BOOKED: ["PICKED_UP", "IN_TRANSIT"],
  PICKED_UP: ["IN_TRANSIT", "ARRIVED_PORT"],
  IN_TRANSIT: ["ARRIVED_PORT", "CUSTOMS"],
  ARRIVED_PORT: ["CUSTOMS", "CLEARED"],
  CUSTOMS: ["CLEARED"],
  CLEARED: ["IN_DELIVERY", "DELIVERED"],
  IN_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
};

type ShipmentGovernanceContext = {
  id: string;
  status: ShipmentStatus;
  mode: ShipmentMode;
  origin: string | null;
  destination: string | null;
  freightPartnerId: string | null;
  trackingProvider: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  lastTrackingSyncAt: Date | null;
  containerNumber: string | null;
  blNumber: string | null;
  proofImageUrl: string | null;
  estimatedDeparture: Date | null;
  actualDeparture: Date | null;
  estimatedArrival: Date | null;
  actualArrival: Date | null;
  updatedAt: Date;
  weightValidatedAt: Date | null;
  aiRiskLevel: LogisticsRiskLevel | null;
  warehouseReceipt:
    | {
        receivedAt: Date;
        readyToShip: boolean;
        condition: string;
      }
    | null;
  customsClearance:
    | {
        status: CustomsStatus;
        clearedAt: Date | null;
        documents: unknown;
      }
    | null;
  trackingEvents: Array<{
    event: string;
    location: string | null;
    occurredAt: Date;
  }>;
  incidents: Array<{
    id: string;
    type: string;
    severity: LogisticsRiskLevel;
    status: string;
  }>;
};

function diffDays(from: Date, to: Date) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY));
}

function normalizeEventName(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function hasTrackingEvent(context: ShipmentGovernanceContext, keywords: string[]) {
  return context.trackingEvents.some((event) => {
    const haystack = [event.event, event.location].map(normalizeEventName).join(" ");
    return keywords.some((keyword) => haystack.includes(keyword));
  });
}

function parseDocumentList(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function getTrackingFreshness(context: ShipmentGovernanceContext, now = new Date()) {
  const latestSignal = context.trackingEvents[0]?.occurredAt || context.lastTrackingSyncAt || context.updatedAt;
  const hasTrackingIdentity = Boolean(context.trackingProvider && context.trackingNumber);

  if (!hasTrackingIdentity && MOVING_STATUSES.includes(context.status)) {
    return "MISSING" as const;
  }

  if (!hasTrackingIdentity) {
    return "MISSING" as const;
  }

  const staleThresholdDays = context.mode === "SEA" ? 6 : 4;
  if (MOVING_STATUSES.includes(context.status) && diffDays(latestSignal, now) >= staleThresholdDays) {
    return "STALE" as const;
  }

  return "LIVE" as const;
}

function hasBookingEvidence(context: ShipmentGovernanceContext) {
  return Boolean(
    context.freightPartnerId ||
      context.trackingNumber ||
      context.trackingUrl ||
      context.containerNumber ||
      context.blNumber ||
      context.estimatedDeparture ||
      context.actualDeparture
  );
}

function hasDepartureSignal(context: ShipmentGovernanceContext) {
  return Boolean(
    context.actualDeparture ||
      hasTrackingEvent(context, ["pick", "pickup", "depart", "in transit", "transit"])
  );
}

function hasArrivalSignal(context: ShipmentGovernanceContext) {
  return Boolean(
    context.actualArrival ||
      hasTrackingEvent(context, ["arrived", "arrival", "port", "customs", "clearance", "dedouan"])
  );
}

function hasDeliveryProof(context: ShipmentGovernanceContext) {
  return Boolean(
    context.proofImageUrl ||
      context.actualArrival ||
      hasTrackingEvent(context, ["delivered", "delivery", "signed", "remis", "livre"])
  );
}

function isCustomsCleared(context: ShipmentGovernanceContext) {
  return Boolean(
    context.customsClearance &&
      (context.customsClearance.status === "CLEARED" || context.customsClearance.clearedAt)
  );
}

function hasValidatedCustomsDocument(context: ShipmentGovernanceContext) {
  const documents = parseDocumentList(context.customsClearance?.documents);
  return documents.some((document) => {
    if (!document || typeof document !== "object") return false;
    const status = String((document as Record<string, unknown>).status || "").toUpperCase();
    return ["APPROVED", "VALIDATED", "OK"].includes(status);
  });
}

function getOpenIncidents(context: ShipmentGovernanceContext) {
  return context.incidents.filter((incident) => !["RESOLVED", "CLOSED"].includes(incident.status));
}

function getTransitionBlockers(context: ShipmentGovernanceContext, nextStatus: ShipmentStatus) {
  const blockers: string[] = [];
  const openIncidents = getOpenIncidents(context);
  const criticalIncidents = openIncidents.filter((incident) =>
    ["HIGH", "CRITICAL"].includes(incident.severity)
  );
  const trackingFreshness = getTrackingFreshness(context);

  switch (nextStatus) {
    case "BOOKED":
      if (!context.origin || !context.destination) {
        blockers.push("Renseignez l'origine et la destination avant de reserver l'expedition.");
      }
      if (!context.warehouseReceipt && !context.weightValidatedAt) {
        blockers.push("La marchandise doit etre receptionnee ou mesuree avant de reserver le fret.");
      }
      break;
    case "PICKED_UP":
      if (!hasBookingEvidence(context)) {
        blockers.push("Le pickup exige une reservation ou un document transport deja saisi.");
      }
      break;
    case "IN_TRANSIT":
      if (!hasBookingEvidence(context)) {
        blockers.push("Impossible de basculer en transit sans booking, BL, tracking ou date de depart.");
      }
      if (!hasDepartureSignal(context)) {
        blockers.push("Confirmez le depart effectif ou un premier signal tracking avant le transit.");
      }
      break;
    case "ARRIVED_PORT":
      if (!hasArrivalSignal(context)) {
        blockers.push("Attendez un signal d'arrivee (tracking, port ou ETA confirmee) avant ce statut.");
      }
      break;
    case "CUSTOMS":
      if (!hasArrivalSignal(context)) {
        blockers.push("Le passage douane n'est pertinent qu'apres une arrivee physique confirmee.");
      }
      break;
    case "CLEARED":
      if (!context.customsClearance) {
        blockers.push("Le dedouanement exige un dossier douane rattache a l'expedition.");
      }
      if (!isCustomsCleared(context)) {
        blockers.push("La douane doit etre marquee CLEARED ou cloturee avant ce statut.");
      }
      if (!hasValidatedCustomsDocument(context) && !context.customsClearance?.clearedAt) {
        blockers.push("Ajoutez au moins une preuve ou validation douane avant de confirmer le dedouanement.");
      }
      break;
    case "IN_DELIVERY":
      if (!isCustomsCleared(context)) {
        blockers.push("La livraison finale ne peut demarrer qu'apres dedouanement effectif.");
      }
      if (criticalIncidents.length > 0) {
        blockers.push("Des incidents critiques restent ouverts. Le last mile ne doit pas partir dans cet etat.");
      }
      break;
    case "DELIVERED":
      if (!isCustomsCleared(context) && context.status !== "IN_DELIVERY") {
        blockers.push("La livraison finale doit passer par un dossier dedouane ou un statut in-delivery.");
      }
      if (!hasDeliveryProof(context)) {
        blockers.push("Une preuve de remise (tracking, POD ou confirmation terrain) est requise avant la livraison.");
      }
      if (criticalIncidents.length > 0) {
        blockers.push("Cloture impossible tant que des incidents critiques restent ouverts.");
      }
      break;
    default:
      break;
  }

  if (
    nextStatus === "CUSTOMS" &&
    context.customsClearance &&
    ["HELD", "REJECTED"].includes(context.customsClearance.status)
  ) {
    blockers.push("Le dossier douane est actuellement bloque ou rejete et doit etre traite explicitement.");
  }

  if (
    ["IN_TRANSIT", "ARRIVED_PORT", "CUSTOMS"].includes(nextStatus) &&
    trackingFreshness === "MISSING" &&
    !context.actualDeparture
  ) {
    blockers.push("Le shipment doit disposer d'un tracking ou d'un depart confirme avant de progresser.");
  }

  return blockers;
}

function inferNextAction(context: ShipmentGovernanceContext, blockers: string[]) {
  if (blockers.length > 0) return blockers[0];

  switch (context.status) {
    case "PENDING":
      return context.warehouseReceipt?.readyToShip
        ? "Reserver le fret et associer un tracking/BL a cette expedition."
        : "Confirmer la reception entrepot, les dimensions et la readiness logistique.";
    case "BOOKED":
      return "Suivre le pickup et obtenir un premier signal de depart effectif.";
    case "PICKED_UP":
      return "Confirmer le depart reel et basculer le shipment en transit avec tracking vivant.";
    case "IN_TRANSIT":
      return getTrackingFreshness(context) === "STALE"
        ? "Le tracking est stale: relancez le transitaire et rafraichissez les evenements."
        : "Maintenir le suivi transit, ETA et anomalies jusqu'a l'arrivee.";
    case "ARRIVED_PORT":
      return "Ouvrir la sequence douane et consolider les documents d'import.";
    case "CUSTOMS":
      return context.customsClearance?.status === "HELD"
        ? "Lever le blocage douane, clarifier les pieces et escalader le broker si besoin."
        : "Finaliser le dedouanement et preparer le last mile.";
    case "CLEARED":
      return "Planifier la livraison finale et aligner partenaire, client et preuve de remise.";
    case "IN_DELIVERY":
      return "Obtenir la confirmation de remise client et clore les couts restants.";
    case "DELIVERED":
      return "Clore le dossier logistique, confirmer les couts reels et archiver les preuves.";
    default:
      return "Verifier le shipment et sa prochaine etape.";
  }
}

function inferBusinessRisk(context: ShipmentGovernanceContext): "LOW" | "MEDIUM" | "HIGH" {
  const openIncidents = getOpenIncidents(context);
  const trackingFreshness = getTrackingFreshness(context);

  if (
    openIncidents.some((incident) => ["HIGH", "CRITICAL"].includes(incident.severity)) ||
    context.customsClearance?.status === "HELD" ||
    context.customsClearance?.status === "REJECTED" ||
    context.aiRiskLevel === "CRITICAL"
  ) {
    return "HIGH";
  }

  if (
    trackingFreshness !== "LIVE" ||
    openIncidents.length > 0 ||
    context.aiRiskLevel === "HIGH" ||
    context.status === "CUSTOMS"
  ) {
    return "MEDIUM";
  }

  return "LOW";
}

function inferShipmentHealth(context: ShipmentGovernanceContext, blockers: string[]): ShipmentWorkflowSnapshot["shipmentHealth"] {
  if (blockers.length > 0) return "BLOCKED";
  const openIncidents = getOpenIncidents(context);
  const trackingFreshness = getTrackingFreshness(context);

  if (
    openIncidents.some((incident) => ["HIGH", "CRITICAL"].includes(incident.severity)) ||
    context.customsClearance?.status === "HELD" ||
    context.aiRiskLevel === "CRITICAL"
  ) {
    return "AT_RISK";
  }

  if (trackingFreshness !== "LIVE" || openIncidents.length > 0 || context.status === "CUSTOMS") {
    return "WATCH";
  }

  return "STABLE";
}

async function hydrateResponsibility(shipmentId: string): Promise<ShipmentResponsibilityProjection | null> {
  const activeTask = await prisma.task.findFirst({
    where: {
      entityType: "shipment",
      entityId: shipmentId,
      module: "logistics",
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      slaDeadline: true,
    },
    orderBy: [{ dueDate: "asc" }, { slaDeadline: "asc" }, { createdAt: "asc" }],
  });

  if (!activeTask) return null;

  const workflow = await TaskWorkflowService.getTaskWorkflowSnapshot(activeTask.id);
  return {
    activeTaskId: activeTask.id,
    activeTaskTitle: activeTask.title,
    primaryOwner: workflow.responsibility.primaryOwner,
    backupOwner: workflow.responsibility.backupOwner,
    managerOwner: workflow.responsibility.managerOwner,
    assignmentReason: workflow.responsibility.assignmentReason,
    escalationLevel: workflow.responsibility.escalationLevel,
    escalationAt: workflow.responsibility.escalationAt,
  };
}

export class LogisticsGovernanceService {
  static buildWorkflowSnapshotFromContext(
    context: ShipmentGovernanceContext,
    responsibility: ShipmentResponsibilityProjection | null = null
  ): ShipmentWorkflowSnapshot {
    const allowedTransitions: ShipmentTransitionReadiness[] = SHIPMENT_VALID_TRANSITIONS[context.status].map(
      (candidateStatus) => {
        const blockers = getTransitionBlockers(context, candidateStatus);
        return {
          status: candidateStatus,
          label: SHIPMENT_STATUS_LABELS[candidateStatus],
          allowed: blockers.length === 0,
          blockers,
        };
      }
    );

    const primaryTransition =
      allowedTransitions.find((candidate) => candidate.status !== "DELIVERED") ??
      allowedTransitions[0] ??
      null;
    const blockers = primaryTransition?.blockers ?? [];

    return {
      currentStatus: context.status,
      nextAction: inferNextAction(context, blockers),
      blockers,
      allowedTransitions,
      businessRisk: inferBusinessRisk(context),
      trackingFreshness: getTrackingFreshness(context),
      shipmentHealth: inferShipmentHealth(context, blockers),
      responsibility,
    };
  }

  static async getShipmentContext(shipmentId: string): Promise<ShipmentGovernanceContext | null> {
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: {
        id: true,
        status: true,
        mode: true,
        origin: true,
        destination: true,
        freightPartnerId: true,
        trackingProvider: true,
        trackingNumber: true,
        trackingUrl: true,
        lastTrackingSyncAt: true,
        containerNumber: true,
        blNumber: true,
        proofImageUrl: true,
        estimatedDeparture: true,
        actualDeparture: true,
        estimatedArrival: true,
        actualArrival: true,
        updatedAt: true,
        weightValidatedAt: true,
        aiInsight: { select: { riskLevel: true } },
        warehouseReceipt: {
          select: {
            receivedAt: true,
            readyToShip: true,
            condition: true,
          },
        },
        customsClearance: {
          select: {
            status: true,
            clearedAt: true,
            documents: true,
          },
        },
        trackingEvents: {
          orderBy: { occurredAt: "desc" },
          take: 12,
          select: {
            event: true,
            location: true,
            occurredAt: true,
          },
        },
        incidents: {
          where: { status: { notIn: ["RESOLVED", "CLOSED"] } },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            type: true,
            severity: true,
            status: true,
          },
        },
      },
    });

    if (!shipment) return null;

    return {
      id: shipment.id,
      status: shipment.status,
      mode: shipment.mode,
      origin: shipment.origin ?? null,
      destination: shipment.destination ?? null,
      freightPartnerId: shipment.freightPartnerId ?? null,
      trackingProvider: shipment.trackingProvider ?? null,
      trackingNumber: shipment.trackingNumber ?? null,
      trackingUrl: shipment.trackingUrl ?? null,
      lastTrackingSyncAt: shipment.lastTrackingSyncAt ?? null,
      containerNumber: shipment.containerNumber ?? null,
      blNumber: shipment.blNumber ?? null,
      proofImageUrl: shipment.proofImageUrl ?? null,
      estimatedDeparture: shipment.estimatedDeparture ?? null,
      actualDeparture: shipment.actualDeparture ?? null,
      estimatedArrival: shipment.estimatedArrival ?? null,
      actualArrival: shipment.actualArrival ?? null,
      updatedAt: shipment.updatedAt,
      weightValidatedAt: shipment.weightValidatedAt ?? null,
      aiRiskLevel: shipment.aiInsight?.riskLevel ?? null,
      warehouseReceipt: shipment.warehouseReceipt
        ? {
            receivedAt: shipment.warehouseReceipt.receivedAt,
            readyToShip: shipment.warehouseReceipt.readyToShip,
            condition: shipment.warehouseReceipt.condition,
          }
        : null,
      customsClearance: shipment.customsClearance
        ? {
            status: shipment.customsClearance.status,
            clearedAt: shipment.customsClearance.clearedAt ?? null,
            documents: shipment.customsClearance.documents,
          }
        : null,
      trackingEvents: shipment.trackingEvents,
      incidents: shipment.incidents,
    };
  }

  static async getShipmentWorkflowSnapshot(shipmentId: string): Promise<ShipmentWorkflowSnapshot | null> {
    const context = await this.getShipmentContext(shipmentId);
    if (!context) return null;

    const responsibility = await hydrateResponsibility(shipmentId).catch(() => null);
    return this.buildWorkflowSnapshotFromContext(context, responsibility);
  }

  static async assertShipmentTransition(shipmentId: string, nextStatus: ShipmentStatus) {
    const context = await this.getShipmentContext(shipmentId);
    if (!context) {
      throw new Error("Expedition introuvable");
    }

    if (context.status === nextStatus) return;

    const allowedStatuses = SHIPMENT_VALID_TRANSITIONS[context.status];
    if (!allowedStatuses.includes(nextStatus)) {
      throw new Error(
        `Transition invalide: ${SHIPMENT_STATUS_LABELS[context.status]} -> ${SHIPMENT_STATUS_LABELS[nextStatus]}.`
      );
    }

    const blockers = getTransitionBlockers(context, nextStatus);
    if (blockers.length > 0) {
      throw new Error(blockers[0]);
    }
  }
}
