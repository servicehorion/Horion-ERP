type CopilotSnapshotInput = {
  status?: string | null;
  lastMessage?: string | null;
  intentScore?: string | null;
  latestIntentSummary?: string | null;
  linkedContactId?: string | null;
  linkedLeadId?: string | null;
  linkedDemandId?: string | null;
  latestOrderId?: string | null;
  latestOrderStatus?: string | null;
  latestPaymentStatus?: string | null;
  latestShipmentStatus?: string | null;
  assignedToId?: string | null;
  lastInboundAt?: Date | null;
  lastOutboundAt?: Date | null;
  slaDueAt?: Date | null;
  tags?: string[] | null;
};

type CopilotResult = {
  responseState: "WAITING_ON_US" | "WAITING_ON_CLIENT" | "CLOSED";
  slaState: "NO_SLA" | "ON_TRACK" | "WARNING" | "BREACHED";
  summary: string;
  nextAction: string;
  missingFields: string[];
};

function trimText(value?: string | null, length = 140) {
  if (!value) return "";
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= length) return normalized;
  return `${normalized.slice(0, length - 1)}…`;
}

function hasCustomerWaiting(input: CopilotSnapshotInput) {
  if (String(input.status || "").toUpperCase() === "CLOSED") return false;
  if (!input.lastInboundAt) return false;
  if (!input.lastOutboundAt) return true;
  return input.lastInboundAt.getTime() > input.lastOutboundAt.getTime();
}

function computeSlaState(input: CopilotSnapshotInput, waitingOnUs: boolean): CopilotResult["slaState"] {
  if (!waitingOnUs || !input.slaDueAt) return "NO_SLA";

  const now = Date.now();
  const dueAt = input.slaDueAt.getTime();
  if (dueAt <= now) return "BREACHED";
  if (dueAt - now <= 60 * 60 * 1000) return "WARNING";
  return "ON_TRACK";
}

function deriveMissingFields(input: CopilotSnapshotInput, waitingOnUs: boolean) {
  const missing: string[] = [];

  if (!input.linkedContactId) missing.push("identite CRM");
  if (!input.assignedToId && waitingOnUs) missing.push("owner");
  if (!input.linkedDemandId && ["HIGH", "URGENT"].includes(String(input.intentScore || "").toUpperCase())) {
    missing.push("demande structuree");
  }
  if (!Array.isArray(input.tags) || input.tags.length === 0) missing.push("qualification legere");

  return missing;
}

function deriveSummary(input: CopilotSnapshotInput, waitingOnUs: boolean) {
  const orderContext = input.latestOrderId
    ? `Contexte commande ${input.latestOrderStatus || "-"}`
    : input.linkedDemandId
      ? `Demande ${input.linkedDemandId ? "ouverte" : ""}`.trim()
      : input.linkedLeadId
        ? "Lead CRM lie"
        : input.linkedContactId
          ? "Contact CRM lie"
          : "Conversation non reliee au CRM";

  const signal = trimText(input.latestIntentSummary || input.lastMessage, 160) || "Aucun signal textuel exploitable";
  const ownership = waitingOnUs ? "reponse attendue de l'equipe" : "en attente de retour client";

  return `${orderContext}. ${ownership}. ${signal}`;
}

function deriveNextAction(input: CopilotSnapshotInput, waitingOnUs: boolean, missingFields: string[]) {
  if (!input.linkedContactId) return "Creer ou lier le contact CRM avant de poursuivre.";
  if (!input.linkedDemandId && ["HIGH", "URGENT"].includes(String(input.intentScore || "").toUpperCase())) {
    return "Creer une Demand Intake pour structurer le besoin et lancer le workflow.";
  }
  if (input.latestOrderId && waitingOnUs) {
    if (input.latestPaymentStatus && !["PAID", "CONFIRMED", "COMPLETED", "VALIDATED"].includes(String(input.latestPaymentStatus).toUpperCase())) {
      return "Repondre avec le contexte commande et confirmer la situation paiement.";
    }
    if (input.latestShipmentStatus && !["DELIVERED", "CLOSED"].includes(String(input.latestShipmentStatus).toUpperCase())) {
      return "Repondre avec le statut logistique et la prochaine etape client.";
    }
    return "Repondre depuis le contexte commande pour garder une promesse precise.";
  }
  if (waitingOnUs) {
    if (missingFields.includes("qualification legere")) {
      return "Taguer la conversation puis demander les informations manquantes.";
    }
    return "Repondre rapidement et confirmer la prochaine action concrete.";
  }
  return "Surveiller la reponse client et garder la conversation en suivi leger.";
}

export class WhatsappCopilotService {
  static buildSnapshot(input: CopilotSnapshotInput): CopilotResult {
    const normalizedStatus = String(input.status || "").toUpperCase();
    const waitingOnUs = hasCustomerWaiting(input);
    const responseState: CopilotResult["responseState"] =
      normalizedStatus === "CLOSED"
        ? "CLOSED"
        : waitingOnUs
          ? "WAITING_ON_US"
          : "WAITING_ON_CLIENT";

    const missingFields = deriveMissingFields(input, waitingOnUs);

    return {
      responseState,
      slaState: computeSlaState(input, waitingOnUs),
      summary: deriveSummary(input, waitingOnUs),
      nextAction: deriveNextAction(input, waitingOnUs, missingFields),
      missingFields,
    };
  }
}
