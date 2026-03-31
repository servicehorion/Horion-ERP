import type { WhatsAppConversationItem } from "@/lib/types/whatsapp";

export type WhatsAppQuickReply = {
  id: string;
  context: "payment" | "logistics" | "quote" | "incident" | "missing_info";
  label: string;
  message: string;
};

function orderRef(conversation: WhatsAppConversationItem) {
  return conversation.latestOrderNumber || "votre dossier";
}

function buildPaymentReply(conversation: WhatsAppConversationItem): WhatsAppQuickReply {
  return {
    id: "payment",
    context: "payment",
    label: "Suivi paiement",
    message: `Bonjour, nous suivons bien le paiement lie a ${orderRef(conversation)}. Merci de nous partager la preuve si ce n'est pas encore fait afin que nous puissions confirmer la suite rapidement.`,
  };
}

function buildLogisticsReply(conversation: WhatsAppConversationItem): WhatsAppQuickReply {
  return {
    id: "logistics",
    context: "logistics",
    label: "Suivi logistique",
    message: `Bonjour, pour ${orderRef(conversation)}, le statut logistique actuel est ${conversation.latestShipmentStatus || "en cours de mise a jour"}. Nous revenons vers vous des que la prochaine etape est confirmee.`,
  };
}

function buildQuoteReply(conversation: WhatsAppConversationItem): WhatsAppQuickReply {
  return {
    id: "quote",
    context: "quote",
    label: "Suivi devis",
    message: `Bonjour, nous preparons le devis pour ${orderRef(conversation)}. Si vous avez une quantite cible, un budget ou un delai prioritaire, partagez-les ici pour accelerer le traitement.`,
  };
}

function buildIncidentReply(conversation: WhatsAppConversationItem): WhatsAppQuickReply {
  return {
    id: "incident",
    context: "incident",
    label: "Incident / patience",
    message: `Bonjour, nous avons bien note le point bloque sur ${orderRef(conversation)}. L'equipe suit le sujet de pres et nous vous tenons informe(e) avec une mise a jour claire des qu'elle est confirmee.`,
  };
}

function buildMissingInfoReply(): WhatsAppQuickReply {
  return {
    id: "missing_info",
    context: "missing_info",
    label: "Infos manquantes",
    message:
      "Bonjour, pour bien avancer merci de nous confirmer le produit, la quantite souhaitee, le pays de livraison et votre delai cible. Si vous avez une photo ou une capture, vous pouvez aussi nous l'envoyer ici.",
  };
}

export function getWhatsAppQuickReplies(conversation: WhatsAppConversationItem): WhatsAppQuickReply[] {
  const replies: WhatsAppQuickReply[] = [];
  const tags = new Set((conversation.tags ?? []).map((tag) => tag.toLowerCase()));

  if (conversation.latestPaymentStatus || tags.has("paiement")) {
    replies.push(buildPaymentReply(conversation));
  }

  if (conversation.latestShipmentStatus || tags.has("logistique")) {
    replies.push(buildLogisticsReply(conversation));
  }

  if (
    conversation.linkedLeadId ||
    conversation.linkedDemandId ||
    ["HIGH", "URGENT"].includes(String(conversation.intentScore || "").toUpperCase())
  ) {
    replies.push(buildQuoteReply(conversation));
  }

  if (tags.has("litige") || tags.has("sav")) {
    replies.push(buildIncidentReply(conversation));
  }

  replies.push(buildMissingInfoReply());

  const seen = new Set<string>();
  return replies.filter((reply) => {
    if (seen.has(reply.id)) return false;
    seen.add(reply.id);
    return true;
  });
}
