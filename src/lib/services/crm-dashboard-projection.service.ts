import type { Prisma, UserRole } from "@prisma/client";

import { formatCurrency } from "@/config/currencies";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { getCrmContactScopeWithDelegation, getCrmLeadScopeWithDelegation } from "@/lib/access-control";
import type {
  CrmDashboardProjection,
  CrmDemandListItem,
  CrmOverviewProjection,
  CrmPriorityAction,
  Customer,
  Lead,
  Prospect,
} from "@/lib/crm/types";

type CrmUser = {
  id: string;
  tenantId: string;
  role: UserRole;
  name?: string | null;
  email?: string | null;
};

type OpenTaskLite = {
  id: string;
  entityType: string;
  entityId: string;
  title: string;
  priority: string;
  dueDate: Date | null;
  slaDeadline: Date | null;
};

const TASK_PRIORITY_SCORE: Record<string, number> = {
  URGENT: 120,
  HIGH: 90,
  NORMAL: 60,
  LOW: 30,
};

const DEMAND_STATUS_LABELS: Record<string, string> = {
  RAW: "Brut",
  QUALIFIED: "Qualifie",
  INDICATIF_PENDING: "Sourcing",
  QUOTE_DRAFT: "Devis brouillon",
  QUOTE_PENDING_APPROVAL: "Approb. devis",
  QUOTE_APPROVED: "Devis approuve",
  QUOTE_SENT: "Devis envoye",
  CLIENT_ACCEPTED: "Client OK",
  PAYMENT_SUBMITTED: "Paiement soumis",
  PAYMENT_VALIDATED: "Paiement valide",
  CONVERTED: "Converti",
  LOST: "Perdu",
};

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function riskLabel(churnRisk?: number | null, trustScore?: number | null): Customer["riskScore"] {
  if (typeof churnRisk === "number") {
    if (churnRisk >= 0.6) return "High";
    if (churnRisk >= 0.3) return "Medium";
    return "Low";
  }
  if (typeof trustScore !== "number") return "Medium";
  if (trustScore >= 70) return "Low";
  if (trustScore >= 40) return "Medium";
  return "High";
}

function leadStatusLabel(status: string): Lead["status"] {
  switch (status) {
    case "WON":
      return "Paid";
    case "LOST":
      return "Lost";
    case "QUOTED":
      return "Quoted";
    case "QUALIFIED":
    case "CONTACTED":
      return "Qualified";
    default:
      return "New";
  }
}

function taskSortScore(task: OpenTaskLite) {
  const dueAt = task.dueDate?.getTime() ?? task.slaDeadline?.getTime() ?? Date.now() + 365 * 24 * 3_600_000;
  const priority = TASK_PRIORITY_SCORE[task.priority] ?? 0;
  return priority * 1_000_000_000 - dueAt;
}

function getBestTask(tasks: OpenTaskLite[]) {
  return [...tasks].sort((left, right) => taskSortScore(right) - taskSortScore(left))[0] ?? null;
}

function deriveLeadNextAction(status: string) {
  switch (status) {
    case "QUOTED":
      return "Relancer le devis et traiter les objections";
    case "QUALIFIED":
      return "Preparer le devis ou lancer le sourcing";
    case "CONTACTED":
      return "Qualifier le besoin et le budget";
    case "WON":
      return "Passer le relais a la commande";
    case "LOST":
      return "Capturer la raison de perte";
    default:
      return "Prendre contact et qualifier le besoin";
  }
}

function deriveCustomerNextAction(customer: {
  orders: number;
  churnRisk?: number | null;
  riskScore: Customer["riskScore"];
}) {
  if ((customer.churnRisk ?? 0) >= 0.6 || customer.riskScore === "High") {
    return "Lancer une relance de retention";
  }
  if (customer.orders === 0) {
    return "Activer la premiere opportunite commerciale";
  }
  return "Suivi portefeuille et upsell";
}

export class CrmDashboardProjectionService {
  static async get(user: CrmUser): Promise<CrmDashboardProjection> {
    const [contactScope, leadScope] = await Promise.all([
      getCrmContactScopeWithDelegation(user),
      getCrmLeadScopeWithDelegation(user),
    ]);

    if (!contactScope || !leadScope) {
      return {
        customers: [],
        leads: [],
        prospects: [],
        overview: {
          totalCustomers: 0,
          activeLeads: 0,
          newProspects: 0,
          whatsappConnected: 0,
          whatsappRate: 0,
          totalLtvXaf: 0,
          avgAiScore: 0,
          highIntentLeads: 0,
          atRiskCustomers: 0,
          nextActions: 0,
          rawDemands: 0,
          leadsOutsideSla: 0,
          canonicalJourney: [],
        },
        priorityActions: [],
        demandWidget: {
          kpis: { total: 0, raw: 0, qualified: 0, indicatifPending: 0, quoteFlow: 0, paymentFlow: 0, converted: 0, lost: 0 },
          recentDemands: [],
        },
      };
    }

    const [customersRaw, prospectsRaw, leadsRaw, demandsRaw, openTasks, users] = await Promise.all([
      prisma.contact.findMany({
        where: { ...(contactScope as Prisma.ContactWhereInput), type: "CLIENT" },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          onboardedBy: { select: { id: true, name: true, email: true } },
          collaborators: { select: { userId: true, user: { select: { id: true, name: true, email: true } } } },
          financialMetrics: { select: { lifetimeGrossRevenue: true } },
          aiProfile: { select: { predictedChurnRisk: true } },
          _count: { select: { orders: true, leads: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 250,
      }),
      prisma.contact.findMany({
        where: { ...(contactScope as Prisma.ContactWhereInput), type: "PROSPECT" },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          onboardedBy: { select: { id: true, name: true, email: true } },
          collaborators: { select: { userId: true, user: { select: { id: true, name: true, email: true } } } },
        },
        orderBy: { updatedAt: "desc" },
        take: 250,
      }),
      prisma.lead.findMany({
        where: leadScope as Prisma.LeadWhereInput,
        include: {
          contact: { select: { id: true, name: true, phone: true, country: true, trustScore: true } },
          owner: { select: { id: true, name: true, email: true } },
          onboardedBy: { select: { id: true, name: true, email: true } },
          collaborators: { select: { userId: true, user: { select: { id: true, name: true, email: true } } } },
        },
        orderBy: { updatedAt: "desc" },
        take: 250,
      }),
      prisma.demandIntake.findMany({
        where: { tenantId: user.tenantId },
        include: {
          assignedTo: { select: { id: true, name: true, email: true } },
          cm: { select: { id: true, name: true, email: true } },
        },
        orderBy: { receivedAt: "desc" },
        take: 250,
      }),
      prisma.task.findMany({
        where: {
          tenantId: user.tenantId,
          module: "crm",
          entityType: { in: ["contact", "lead", "demand"] },
          status: { notIn: ["COMPLETED", "CANCELLED"] },
        },
        select: {
          id: true,
          entityType: true,
          entityId: true,
          title: true,
          priority: true,
          dueDate: true,
          slaDeadline: true,
        },
      }),
      prisma.user.findMany({
        where: { tenantId: user.tenantId, isActive: true },
        select: { id: true, name: true, email: true },
      }),
    ]);

    const taskBuckets = new Map<string, OpenTaskLite[]>();
    for (const task of openTasks) {
      const key = `${task.entityType}:${task.entityId}`;
      const current = taskBuckets.get(key) ?? [];
      current.push(task);
      taskBuckets.set(key, current);
    }
    const userMap = new Map(users.map((item) => [item.id, item.name || item.email]));

    const customers: Customer[] = customersRaw.map((contact) => {
      const churnRisk = contact.aiProfile?.predictedChurnRisk != null ? Number(contact.aiProfile.predictedChurnRisk) : null;
      const riskScore = riskLabel(churnRisk, contact.trustScore);
      const bestTask = getBestTask(taskBuckets.get(`contact:${contact.id}`) ?? []);
      return {
        id: contact.id,
        ownerId: contact.ownerId ?? undefined,
        churnRisk: churnRisk ?? undefined,
        name: contact.name,
        phone: contact.phone || "",
        email: contact.email || undefined,
        country: contact.country || "—",
        city: contact.city || undefined,
        whatsapp: contact.whatsapp ? "Active" : "Inactive",
        orders: contact._count.orders ?? 0,
        ltv: contact.financialMetrics?.lifetimeGrossRevenue
          ? formatCurrency(Number(contact.financialMetrics.lifetimeGrossRevenue), "XAF")
          : "—",
        tags: Array.isArray(contact.tags) ? contact.tags.map((tag) => String(tag)) : [],
        riskScore,
        owner: contact.owner?.name || contact.owner?.email || (contact.ownerId ? userMap.get(contact.ownerId) : null) || "Non assigne",
        onboardedBy: contact.onboardedBy?.name || contact.onboardedBy?.email || (contact.onboardedById ? userMap.get(contact.onboardedById) : null) || user.name || "Horion",
        aiScore: Math.max(20, Math.min(100, contact.trustScore ?? 50)),
        nextAction: bestTask?.title || deriveCustomerNextAction({ orders: contact._count.orders ?? 0, churnRisk, riskScore }),
        collaborators: uniqueStrings(
          (contact.collaborators ?? []).map((item) => item.user?.name || item.user?.email || item.userId || "")
        ),
        lastContact: formatDate(contact.updatedAt),
        notes: contact.notes || undefined,
      };
    });

    const prospects: Prospect[] = prospectsRaw.map((contact) => ({
      id: contact.id,
      ownerId: contact.ownerId ?? undefined,
      name: contact.name,
      phone: contact.phone || "",
      country: contact.country || "—",
      inquiry: contact.notes || "Prospect CRM",
      source: "CRM",
      owner: contact.owner?.name || contact.owner?.email || (contact.ownerId ? userMap.get(contact.ownerId) : null) || "Non assigne",
      onboardedBy: contact.onboardedBy?.name || contact.onboardedBy?.email || (contact.onboardedById ? userMap.get(contact.onboardedById) : null) || user.name || "Horion",
      intentScore: Math.max(25, Math.min(100, contact.trustScore ?? 50)),
      collaborators: uniqueStrings(
        (contact.collaborators ?? []).map((item) => item.user?.name || item.user?.email || item.userId || "")
      ),
      status: "New",
      notes: contact.notes || undefined,
    }));

    const leads: Lead[] = leadsRaw.map((lead) => {
      const bestTask = getBestTask(taskBuckets.get(`lead:${lead.id}`) ?? []);
      return {
        id: lead.id,
        ownerId: lead.ownerId ?? undefined,
        name: lead.contact?.name || "—",
        phone: lead.contact?.phone || "",
        country: lead.contact?.country || "—",
        product: lead.description || lead.category || "—",
        estimatedValue: lead.estimatedValue ? formatCurrency(Number(lead.estimatedValue), lead.currency || "XAF") : "—",
        status: leadStatusLabel(lead.status),
        assignedAgent: lead.assignedTo ? userMap.get(lead.assignedTo) || lead.assignedTo : "Non assigne",
        owner: lead.owner?.name || lead.owner?.email || (lead.ownerId ? userMap.get(lead.ownerId) : null) || (lead.assignedTo ? userMap.get(lead.assignedTo) || lead.assignedTo : null) || "Non assigne",
        onboardedBy: lead.onboardedBy?.name || lead.onboardedBy?.email || (lead.onboardedById ? userMap.get(lead.onboardedById) : null) || user.name || "Horion",
        source: lead.source || "CRM",
        aiScore: Math.max(20, Math.min(100, lead.score || lead.winProbability || lead.contact?.trustScore || 50)),
        nextAction: bestTask?.title || deriveLeadNextAction(lead.status),
        collaborators: uniqueStrings(
          (lead.collaborators ?? []).map((item) => item.user?.name || item.user?.email || item.userId || "")
        ),
        lastContact: formatDate(lead.updatedAt),
        updatedAtTs: lead.updatedAt?.getTime(),
        containerType: (lead.containerType as Lead["containerType"]) || undefined,
        originCountry: lead.originCountry || undefined,
        notes: lead.notes || undefined,
        slaStatus: (lead.slaStatus as Lead["slaStatus"]) ?? null,
      };
    });

    const demandKpis = {
      total: demandsRaw.length,
      raw: demandsRaw.filter((demand) => demand.status === "RAW").length,
      qualified: demandsRaw.filter((demand) => demand.status === "QUALIFIED").length,
      indicatifPending: demandsRaw.filter((demand) => demand.status === "INDICATIF_PENDING").length,
      quoteFlow: demandsRaw.filter((demand) => ["QUOTE_DRAFT", "QUOTE_PENDING_APPROVAL", "QUOTE_APPROVED", "QUOTE_SENT"].includes(demand.status)).length,
      paymentFlow: demandsRaw.filter((demand) => ["CLIENT_ACCEPTED", "PAYMENT_SUBMITTED", "PAYMENT_VALIDATED"].includes(demand.status)).length,
      converted: demandsRaw.filter((demand) => demand.status === "CONVERTED").length,
      lost: demandsRaw.filter((demand) => demand.status === "LOST").length,
    };

    const recentDemands: CrmDemandListItem[] = demandsRaw.slice(0, 5).map((demand) => {
      const bestTask = getBestTask(taskBuckets.get(`demand:${demand.id}`) ?? []);
      return {
        id: demand.id,
        clientName: demand.clientName,
        rawDescription: demand.rawDescription,
        status: demand.status,
        urgency: demand.urgency,
        aiScore: demand.aiScore,
        assigneeName: demand.assignedTo?.name || demand.cm?.name || undefined,
        nextAction: bestTask?.title || (demand.status === "RAW" ? "Qualifier la demande" : demand.status === "QUALIFIED" ? "Orienter la demande" : undefined),
      };
    });

    const totalLtvXaf = customersRaw.reduce(
      (sum, contact) => sum + toNumber(contact.financialMetrics?.lifetimeGrossRevenue),
      0,
    );
    const whatsappConnected = customers.filter((customer) => customer.whatsapp === "Active").length;
    const atRiskCustomers = customers.filter((customer) => customer.riskScore === "High").length;
    const highIntentLeads = leads.filter((lead) => lead.aiScore >= 75).length;
    const avgAiScore = (() => {
      const scores = [...customers.map((customer) => customer.aiScore), ...leads.map((lead) => lead.aiScore)];
      if (scores.length === 0) return 0;
      return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    })();
    const leadsOutsideSla = leads.filter((lead) => lead.slaStatus === "WARNING" || lead.slaStatus === "BREACH").length;
    const nextActions = customers.filter((customer) => customer.nextAction).length + leads.filter((lead) => lead.nextAction).length + recentDemands.filter((demand) => demand.nextAction).length;

    const overview: CrmOverviewProjection = {
      totalCustomers: customers.length,
      activeLeads: leads.filter((lead) => !["Paid", "Lost"].includes(lead.status)).length,
      newProspects: prospects.filter((prospect) => prospect.status === "New").length,
      whatsappConnected,
      whatsappRate: customers.length > 0 ? Math.round((whatsappConnected / customers.length) * 100) : 0,
      totalLtvXaf,
      avgAiScore,
      highIntentLeads,
      atRiskCustomers,
      nextActions,
      rawDemands: demandKpis.raw,
      leadsOutsideSla,
      canonicalJourney: [
        { label: "Contacts", count: customers.length + prospects.length, tone: "default" },
        { label: "Demandes", count: demandKpis.total, tone: demandKpis.raw > 0 ? "warning" : "default" },
        { label: "Leads", count: leads.filter((lead) => lead.status !== "Lost").length, tone: "default" },
        { label: "Sourcing", count: demandKpis.indicatifPending, tone: demandKpis.indicatifPending > 0 ? "warning" : "default" },
        { label: "Devis", count: demandKpis.quoteFlow + leads.filter((lead) => lead.status === "Quoted").length, tone: "default" },
        { label: "Commandes", count: demandKpis.converted + leads.filter((lead) => lead.status === "Paid").length, tone: demandKpis.converted > 0 ? "success" : "default" },
      ],
    };

    const priorityActions: CrmPriorityAction[] = [
      ...recentDemands
        .filter((demand) => demand.status === "RAW" || demand.status === "QUALIFIED")
        .map((demand) => ({
          id: demand.id,
          entityType: "demand" as const,
          name: demand.clientName,
          owner: demand.assigneeName || "CM",
          score: (demand.urgency === "CRITICAL" ? 100 : demand.urgency === "HIGH" ? 85 : 70) + demand.aiScore,
          nextAction: demand.nextAction || "Qualifier la demande",
          tag: DEMAND_STATUS_LABELS[demand.status] || demand.status,
          href: `/crm/demands`,
        })),
      ...leads
        .filter((lead) => lead.status !== "Paid" && lead.status !== "Lost")
        .map((lead) => ({
          id: lead.id,
          entityType: "lead" as const,
          name: lead.name,
          owner: lead.owner,
          score: lead.aiScore + (lead.status === "Quoted" ? 20 : lead.status === "Qualified" ? 12 : 0) + (lead.slaStatus === "BREACH" ? 30 : lead.slaStatus === "WARNING" ? 15 : 0),
          nextAction: lead.nextAction,
          tag: lead.slaStatus === "BREACH" ? "SLA" : lead.status,
          href: `/crm/leads/${lead.id}`,
        })),
      ...customers
        .filter((customer) => customer.riskScore === "High" || (customer.churnRisk ?? 0) >= 0.6)
        .map((customer) => ({
          id: customer.id,
          entityType: "customer" as const,
          name: customer.name,
          owner: customer.owner,
          score: customer.aiScore + 35,
          nextAction: customer.nextAction,
          tag: "Retention",
          href: `/contacts/${customer.id}`,
        })),
    ]
      .sort((left, right) => right.score - left.score)
      .slice(0, 8);

    return {
      customers,
      leads,
      prospects,
      overview,
      priorityActions,
      demandWidget: {
        kpis: demandKpis,
        recentDemands,
      },
    };
  }
}
