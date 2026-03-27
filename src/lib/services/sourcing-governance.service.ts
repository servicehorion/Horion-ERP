import type { PipelineType, SourcingLevel, SourcingStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import type { SourcingTransitionReadiness, SourcingWorkflowSnapshot } from "@/lib/sourcing/types";

export const SOURCING_STATUS_LABELS: Record<string, string> = {
  SEARCHING: "Recherche",
  OFFERS_RECEIVED: "Offres recues",
  NEGOTIATING: "Negociation",
  SELECTED: "Selectionne",
  CONFIRMED: "Confirme",
  CANCELLED: "Annule",
};

export const SOURCING_VALID_TRANSITIONS: Record<SourcingStatus, SourcingStatus[]> = {
  SEARCHING: ["OFFERS_RECEIVED", "CANCELLED"],
  OFFERS_RECEIVED: ["NEGOTIATING", "SELECTED", "CANCELLED"],
  NEGOTIATING: ["SELECTED", "OFFERS_RECEIVED", "CANCELLED"],
  SELECTED: ["CONFIRMED", "NEGOTIATING", "CANCELLED"],
  CONFIRMED: [],
  CANCELLED: ["SEARCHING"],
};

type SourcingCaseContext = {
  id: string;
  status: SourcingStatus;
  level: SourcingLevel;
  pipelineType: PipelineType;
  requirement: string;
  supplierId: string | null;
  contractId: string | null;
  sensitiveProduct: boolean;
  marginPct: number | null;
  marginApprovedByCeo: boolean;
  weightKg: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  transportCostEst: number | null;
  orderId: string;
  orderStatus: string;
  offerCount: number;
  selectedOfferCount: number;
  negotiationCount: number;
  contractStatus: string | null;
  contractEndAt: Date | null;
};

function isContractActive(contractStatus: string | null, contractEndAt: Date | null) {
  if (!contractStatus) return false;
  if (contractStatus !== "ACTIVE") return false;
  if (contractEndAt && contractEndAt < new Date()) return false;
  return true;
}

function hasProfondDimensions(context: SourcingCaseContext) {
  return Boolean(
    context.weightKg &&
      context.weightKg > 0 &&
      context.lengthCm &&
      context.lengthCm > 0 &&
      context.widthCm &&
      context.widthCm > 0 &&
      context.heightCm &&
      context.heightCm > 0
  );
}

function getTransitionBlockers(context: SourcingCaseContext, nextStatus: SourcingStatus) {
  const blockers: string[] = [];

  switch (nextStatus) {
    case "OFFERS_RECEIVED":
      if (context.offerCount === 0) {
        blockers.push("Ajoutez au moins une offre fournisseur avant de marquer le dossier en offres recues.");
      }
      break;
    case "NEGOTIATING":
      if (context.offerCount === 0) {
        blockers.push("Impossible de negocier sans offre fournisseur chargee.");
      }
      break;
    case "SELECTED":
      if (context.offerCount === 0) {
        blockers.push("Selection fournisseur impossible sans offre comparee.");
      }
      if (!context.supplierId && context.selectedOfferCount === 0) {
        blockers.push("Selectionnez un fournisseur ou une offre avant de passer ce dossier en selection.");
      }
      break;
    case "CONFIRMED":
      if (!context.supplierId) {
        blockers.push("Confirmez d'abord le fournisseur retenu.");
      }
      if (context.selectedOfferCount === 0) {
        blockers.push("Une offre doit etre marquee comme selectionnee avant confirmation.");
      }
      if (!isContractActive(context.contractStatus, context.contractEndAt)) {
        blockers.push("Un contrat fournisseur actif est obligatoire avant confirmation.");
      }
      if (context.level === "PROFOND" && !hasProfondDimensions(context)) {
        blockers.push("Le sourcing profond exige poids et dimensions reels/estimes avant confirmation.");
      }
      if (context.level === "PROFOND" && (!context.transportCostEst || context.transportCostEst <= 0)) {
        blockers.push("Le cout transport estime doit etre renseigne avant confirmation.");
      }
      if (context.marginPct != null && context.marginPct < 8 && !context.marginApprovedByCeo) {
        blockers.push("La marge est trop basse: approbation direction/CEO requise avant confirmation.");
      }
      break;
    case "SEARCHING":
    case "CANCELLED":
    default:
      break;
  }

  return blockers;
}

function inferNextAction(context: SourcingCaseContext, blockers: string[]) {
  if (blockers.length > 0) return blockers[0];

  switch (context.status) {
    case "SEARCHING":
      return "Identifier 3 fournisseurs et charger les premieres cotations.";
    case "OFFERS_RECEIVED":
      return context.negotiationCount > 0
        ? "Finaliser la comparaison et choisir le fournisseur le plus defensable."
        : "Ouvrir la negociation et valider les hypotheses cout/delai.";
    case "NEGOTIATING":
      return "Converger vers une offre selectionnable avec risque fournisseur maitrise.";
    case "SELECTED":
      return "Verifier contrat, marge et readiness logistique avant confirmation.";
    case "CONFIRMED":
      return "Le dossier est confirme: preparer la bascule vers execution logistique.";
    case "CANCELLED":
      return "Dossier annule. Verifier si une reprise ou une re-ouverture est necessaire.";
    default:
      return "Verifier le dossier sourcing et sa prochaine etape.";
  }
}

function inferBusinessRisk(context: SourcingCaseContext): "LOW" | "MEDIUM" | "HIGH" {
  if (
    context.sensitiveProduct ||
    context.pipelineType === "STRATEGIC" ||
    context.pipelineType === "VIP" ||
    (context.marginPct != null && context.marginPct < 8)
  ) {
    return "HIGH";
  }

  if (context.level === "PROFOND" || context.offerCount === 0 || context.negotiationCount > 3) {
    return "MEDIUM";
  }

  return "LOW";
}

export class SourcingGovernanceService {
  static async getCaseContext(caseId: string): Promise<SourcingCaseContext | null> {
    const sourcingCase = await prisma.sourcingCase.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        status: true,
        level: true,
        pipelineType: true,
        requirement: true,
        supplierId: true,
        contractId: true,
        sensitiveProduct: true,
        marginPct: true,
        marginApprovedByCeo: true,
        weightKg: true,
        lengthCm: true,
        widthCm: true,
        heightCm: true,
        transportCostEst: true,
        orderId: true,
        order: { select: { status: true } },
        contract: { select: { status: true, endAt: true } },
        _count: { select: { offers: true, negotiations: true } },
        offers: {
          where: { isSelected: true },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!sourcingCase) return null;

    return {
      id: sourcingCase.id,
      status: sourcingCase.status,
      level: sourcingCase.level,
      pipelineType: sourcingCase.pipelineType,
      requirement: sourcingCase.requirement,
      supplierId: sourcingCase.supplierId,
      contractId: sourcingCase.contractId,
      sensitiveProduct: sourcingCase.sensitiveProduct,
      marginPct: sourcingCase.marginPct != null ? Number(sourcingCase.marginPct) : null,
      marginApprovedByCeo: sourcingCase.marginApprovedByCeo,
      weightKg: sourcingCase.weightKg != null ? Number(sourcingCase.weightKg) : null,
      lengthCm: sourcingCase.lengthCm != null ? Number(sourcingCase.lengthCm) : null,
      widthCm: sourcingCase.widthCm != null ? Number(sourcingCase.widthCm) : null,
      heightCm: sourcingCase.heightCm != null ? Number(sourcingCase.heightCm) : null,
      transportCostEst: sourcingCase.transportCostEst != null ? Number(sourcingCase.transportCostEst) : null,
      orderId: sourcingCase.orderId,
      orderStatus: sourcingCase.order.status,
      offerCount: sourcingCase._count.offers,
      selectedOfferCount: sourcingCase.offers.length,
      negotiationCount: sourcingCase._count.negotiations,
      contractStatus: sourcingCase.contract?.status ?? null,
      contractEndAt: sourcingCase.contract?.endAt ?? null,
    };
  }

  static async getCaseWorkflowSnapshot(caseId: string): Promise<SourcingWorkflowSnapshot | null> {
    const context = await this.getCaseContext(caseId);
    if (!context) return null;

    const allowedTransitions: SourcingTransitionReadiness[] = SOURCING_VALID_TRANSITIONS[context.status].map(
      (candidateStatus) => {
        const blockers = getTransitionBlockers(context, candidateStatus);
        return {
          status: candidateStatus,
          label: SOURCING_STATUS_LABELS[candidateStatus],
          allowed: blockers.length === 0,
          blockers,
        };
      }
    );

    const primaryNext = allowedTransitions.find((item) => item.status !== "CANCELLED") ?? null;
    const blockers = primaryNext?.blockers ?? [];

    return {
      currentStatus: context.status,
      nextAction: inferNextAction(context, blockers),
      blockers,
      allowedTransitions,
      businessRisk: inferBusinessRisk(context),
    };
  }

  static async assertCaseTransition(caseId: string, nextStatus: SourcingStatus) {
    const context = await this.getCaseContext(caseId);
    if (!context) throw new Error("Cas de sourcing introuvable");

    const allowed = SOURCING_VALID_TRANSITIONS[context.status];
    if (!allowed.includes(nextStatus)) {
      throw new Error(
        `Transition invalide : ${context.status} -> ${nextStatus}. Transitions permises : ${allowed.join(", ")}`
      );
    }

    const blockers = getTransitionBlockers(context, nextStatus);
    if (blockers.length > 0) {
      throw new Error(blockers[0]);
    }
  }
}
