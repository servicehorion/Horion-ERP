import { prisma } from "@/lib/db";
import type { SourcingCommandCenterProjection, SourcingPriorityAction } from "@/lib/sourcing/types";
import { SourcingSlaService } from "@/lib/services/sourcing-sla.service";

function buildPriorityActions(input: {
  breachedCases: number;
  unassignedDemands: number;
  qualifiedWithoutTicket: number;
  selectedWithoutContract: number;
  lowMarginPendingApproval: number;
  overdueWorkflowTasks: number;
}): SourcingPriorityAction[] {
  const actions: SourcingPriorityAction[] = [];

  if (input.breachedCases > 0) {
    actions.push({
      id: "breached_cases",
      title: "Traiter les cas sourcing hors SLA",
      description: `${input.breachedCases} dossier(s) sourcing menacent le delai client.`,
      severity: "critical",
      href: "/sourcing",
      count: input.breachedCases,
    });
  }

  if (input.unassignedDemands > 0) {
    actions.push({
      id: "unassigned_demands",
      title: "Assigner les demandes non prises en charge",
      description: `${input.unassignedDemands} demande(s) attendent encore un proprietaire clair.`,
      severity: "warning",
      href: "/sourcing",
      count: input.unassignedDemands,
    });
  }

  if (input.qualifiedWithoutTicket > 0) {
    actions.push({
      id: "qualified_without_ticket",
      title: "Transformer les demandes qualifiees en travail sourcing",
      description: `${input.qualifiedWithoutTicket} demande(s) qualifiees n'ont pas encore de ticket ou de suite explicite.`,
      severity: "warning",
      href: "/sourcing/tickets",
      count: input.qualifiedWithoutTicket,
    });
  }

  if (input.selectedWithoutContract > 0) {
    actions.push({
      id: "selected_without_contract",
      title: "Verifier les selections sans contrat actif",
      description: `${input.selectedWithoutContract} dossier(s) sont selectionnes mais pas encore juridiquement defensables.`,
      severity: "critical",
      href: "/sourcing/cases",
      count: input.selectedWithoutContract,
    });
  }

  if (input.lowMarginPendingApproval > 0) {
    actions.push({
      id: "low_margin_pending_approval",
      title: "Arbitrer les marges faibles",
      description: `${input.lowMarginPendingApproval} dossier(s) exigent une validation direction/CEO avant confirmation.`,
      severity: "critical",
      href: "/sourcing/cases",
      count: input.lowMarginPendingApproval,
    });
  }

  if (input.overdueWorkflowTasks > 0) {
    actions.push({
      id: "overdue_workflow_tasks",
      title: "Nettoyer le backlog d'execution sourcing",
      description: `${input.overdueWorkflowTasks} tache(s) sourcing actives ont depasse leur echeance interne.`,
      severity: "warning",
      href: "/tasks/my?module=sourcing",
      count: input.overdueWorkflowTasks,
    });
  }

  return actions;
}

export class SourcingCommandCenterProjectionService {
  static async get(tenantId: string): Promise<SourcingCommandCenterProjection> {
    const [demands, tickets, cases, workflowTasks] = await Promise.all([
      prisma.demandIntake.findMany({
        where: { tenantId },
        select: {
          id: true,
          status: true,
          assignedToId: true,
          sourcingTickets: { select: { id: true }, take: 1 },
        },
        orderBy: { receivedAt: "desc" },
        take: 500,
      }),
      prisma.sourcingTicket.findMany({
        where: { tenantId },
        select: { id: true, status: true },
        take: 500,
      }),
      prisma.sourcingCase.findMany({
        where: { order: { tenantId } },
        select: {
          id: true,
          status: true,
          stageEnteredAt: true,
          createdAt: true,
          updatedAt: true,
          level: true,
          pipelineType: true,
          category: true,
          platform: true,
          sensitiveProduct: true,
          contractId: true,
          marginPct: true,
          marginApprovedByCeo: true,
          contract: { select: { status: true, endAt: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 500,
      }),
      prisma.task.findMany({
        where: {
          tenantId,
          module: "sourcing",
          status: { notIn: ["COMPLETED", "CANCELLED"] },
        },
        select: {
          id: true,
          dueDate: true,
          slaDeadline: true,
        },
        take: 500,
      }),
    ]);

    const rawDemands = demands.filter((item) => item.status === "RAW").length;
    const qualifiedDemands = demands.filter((item) => ["QUALIFIED", "INDICATIF_PENDING"].includes(item.status)).length;
    const convertedDemands = demands.filter((item) => item.status === "CONVERTED").length;
    const unassignedDemands = demands.filter(
      (item) => ["RAW", "QUALIFIED", "INDICATIF_PENDING"].includes(item.status) && !item.assignedToId
    ).length;
    const qualifiedWithoutTicket = demands.filter(
      (item) => ["QUALIFIED", "INDICATIF_PENDING"].includes(item.status) && item.sourcingTickets.length === 0
    ).length;

    const quoteStageCount = tickets.filter((item) =>
      ["QUOTE_READY", "QUOTED", "CLIENT_ACCEPTED"].includes(item.status)
    ).length;
    const activeCases = cases.filter((item) => !["CONFIRMED", "CANCELLED"].includes(item.status)).length;
    const confirmedCases = cases.filter((item) => item.status === "CONFIRMED").length;

    let breachedCases = 0;
    let warningCases = 0;
    let selectedWithoutContract = 0;
    let lowMarginPendingApproval = 0;

    for (const sourcingCase of cases) {
      const sla = SourcingSlaService.compute(
        sourcingCase.status,
        sourcingCase.stageEnteredAt || sourcingCase.updatedAt || sourcingCase.createdAt,
        {
          level: sourcingCase.level,
          pipelineType: sourcingCase.pipelineType,
          category: sourcingCase.category,
          platform: sourcingCase.platform,
          sensitiveProduct: sourcingCase.sensitiveProduct,
        }
      );

      if (sla.status === "BREACHED") breachedCases += 1;
      if (sla.status === "WARNING") warningCases += 1;

      if (
        sourcingCase.status === "SELECTED" &&
        (!sourcingCase.contractId ||
          sourcingCase.contract?.status !== "ACTIVE" ||
          (sourcingCase.contract?.endAt && sourcingCase.contract.endAt < new Date()))
      ) {
        selectedWithoutContract += 1;
      }

      if (
        sourcingCase.status !== "CANCELLED" &&
        sourcingCase.marginPct != null &&
        Number(sourcingCase.marginPct) < 8 &&
        !sourcingCase.marginApprovedByCeo
      ) {
        lowMarginPendingApproval += 1;
      }
    }

    const now = new Date();
    const overdueWorkflowTasks = workflowTasks.filter((task) => {
      const deadline = task.dueDate || task.slaDeadline;
      return deadline ? deadline < now : false;
    }).length;

    const totalDemands = demands.length;
    const conversionRate = totalDemands > 0 ? Math.round((convertedDemands / totalDemands) * 100) : 0;

    return {
      overview: {
        demandInbox: rawDemands,
        qualifiedDemandQueue: qualifiedDemands,
        activeCases,
        confirmedCases,
        breachedCases,
        warningCases,
        conversionRate,
        canonicalJourney: [
          {
            key: "inbound",
            label: "Demandes brutes",
            count: rawDemands,
            description: "Besoins entrants a qualifier avant toute promesse sourcing.",
          },
          {
            key: "pre_sourcing",
            label: "Pre-sourcing",
            count: qualifiedDemands,
            description: "Demandes qualifiees a transformer en ticket ou devis indicatif.",
          },
          {
            key: "quote",
            label: "Devis / indicatif",
            count: quoteStageCount,
            description: "Tickets deja suffisamment cadres pour une proposition economique.",
          },
          {
            key: "execution",
            label: "Sourcing profond",
            count: activeCases,
            description: "Dossiers fournisseurs actifs lies a une commande ou un engagement reel.",
          },
          {
            key: "confirmed",
            label: "Decision confirmee",
            count: confirmedCases,
            description: "Cas confirmes prets a alimenter la logistique et la suite d'execution.",
          },
        ],
      },
      priorityActions: buildPriorityActions({
        breachedCases,
        unassignedDemands,
        qualifiedWithoutTicket,
        selectedWithoutContract,
        lowMarginPendingApproval,
        overdueWorkflowTasks,
      }),
    };
  }
}
