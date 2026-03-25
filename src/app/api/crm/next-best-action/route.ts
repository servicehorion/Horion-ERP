import { NextRequest } from "next/server";

type NbaPayload = {
  status: string;
  score: number;
  estimatedValue?: number;
  contactName: string;
  daysSince: number;
  source?: string;
};

type NbaResult = {
  action: string;
  reason: string;
  urgency: "low" | "medium" | "high";
  nextSteps: string[];
};

function demoNba(status: string, score: number, daysSince: number): NbaResult {
  if (status === "NEW") {
    return {
      action: "Premier contact téléphonique",
      reason: "Ce lead vient d'être créé — un contact rapide maximise les chances de conversion.",
      urgency: "high",
      nextSteps: [
        "Appeler dans les 2 heures",
        "Envoyer un message WhatsApp de bienvenue",
        "Qualifier le besoin exact (type fret, origine, volume)",
      ],
    };
  }
  if (status === "CONTACTED") {
    return {
      action: "Envoyer une proposition de valeur",
      reason: "Le prospect a été contacté. C'est le moment de partager des références et de positionner l'offre.",
      urgency: score < 40 ? "high" : "medium",
      nextSteps: [
        "Envoyer un devis indicatif ou des tarifs de référence",
        "Proposer un appel de 30 min pour cadrer les besoins",
        "Partager 2-3 études de cas similaires",
      ],
    };
  }
  if (status === "QUALIFIED") {
    return {
      action: "Accélérer vers le devis formel",
      reason: "Ce lead est qualifié. Chaque jour supplémentaire sans devis réduit la probabilité de closing.",
      urgency: daysSince > 7 ? "high" : "medium",
      nextSteps: [
        "Préparer un devis détaillé sous 24h",
        "Planifier une réunion de présentation avec le décideur",
        "Clarifier les conditions de paiement",
      ],
    };
  }
  if (status === "QUOTED") {
    return {
      action: "Relance de closing",
      reason: "Un devis a été envoyé. Une relance proactive augmente significativement le taux de conversion.",
      urgency: daysSince > 5 ? "high" : "medium",
      nextSteps: [
        "Relancer par téléphone (pas email)",
        "Identifier les objections restantes",
        "Proposer une contre-offre si besoin (frais de transit, délai…)",
      ],
    };
  }
  if (status === "WON") {
    return {
      action: "Upsell et fidélisation",
      reason: "Ce client a été converti — c'est le moment de maximiser la valeur et de sécuriser la relation.",
      urgency: "low",
      nextSteps: [
        "Envoyer un message de bienvenue personnalisé",
        "Proposer un contrat-cadre ou un volume discount",
        "Planifier un point de suivi à J+30",
      ],
    };
  }
  return {
    action: "Requalifier ou clore ce lead",
    reason: "Ce lead est en statut terminal — décider de le réactiver ou de le clore proprement.",
    urgency: "low",
    nextSteps: [
      "Comprendre la raison du refus",
      "Archiver avec une note de contexte",
      "Programmer un suivi dans 3 mois",
    ],
  };
}

function buildPrompt(body: NbaPayload): string {
  return `Tu es un expert CRM commercial spécialisé dans la logistique Chine-Afrique (fret maritime, aérien, groupage).

Analyse ce lead et donne la meilleure action commerciale immédiate :

- Contact : ${body.contactName}
- Statut pipeline : ${body.status}
- Score lead : ${body.score}/100
- Valeur estimée : ${body.estimatedValue ? `${Number(body.estimatedValue).toLocaleString("fr-FR")} XAF` : "non renseignée"}
- Jours depuis création : ${body.daysSince}j
- Source : ${body.source ?? "inconnue"}

Réponds UNIQUEMENT en JSON valide avec ce format exact :
{
  "action": "Action principale recommandée (1 phrase courte)",
  "reason": "Raison stratégique (1-2 phrases)",
  "urgency": "low|medium|high",
  "nextSteps": ["Étape 1", "Étape 2", "Étape 3"]
}`;
}

function parseResponse(text: string): NbaResult {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.action && parsed.reason && parsed.urgency && Array.isArray(parsed.nextSteps)) {
        return parsed as NbaResult;
      }
    }
  } catch {
    // fallback below
  }
  return {
    action: text.slice(0, 100),
    reason: "Suggestion générée par IA",
    urgency: "medium",
    nextSteps: [],
  };
}

export async function POST(req: NextRequest) {
  try {
    const body: NbaPayload = await req.json();

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json(demoNba(body.status, body.score, body.daysSince));
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 400,
        messages: [{ role: "user", content: buildPrompt(body) }],
      }),
    });

    if (!res.ok) {
      return Response.json(demoNba(body.status, body.score, body.daysSince));
    }

    const data = await res.json();
    const text: string = data.content?.[0]?.text ?? "";
    return Response.json(parseResponse(text));
  } catch {
    return Response.json(
      { error: "Erreur lors de la génération" },
      { status: 500 }
    );
  }
}
