// @ts-nocheck
"use server";

import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { NurturingService } from "@/lib/services/nurturing.service";
import { OrderService } from "@/lib/services/order.service";
import { AuditService } from "@/lib/services/audit.service";
import { NotificationService } from "@/lib/services/notification.service";
import { hasPermission } from "@/lib/permissions";
import { runTenantCached } from "@/lib/server-cache";
import {
  attachQuoteToRelatedDemands,
  cancelQuoteWorkflowTasks,
  createQuoteVersion,
  ensureQuoteApprovalTask,
  resolveQuoteCreationApproval,
  syncDemandStatusForQuote,
} from "@/lib/quotes/workflow";

const prismaAny = prisma as any;

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function getTenantSettings(tenantId: string) {
  const tenant = await prismaAny.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  return (tenant?.settings as Record<string, unknown>) ?? {};
}

// â”€â”€ Analytics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getCrmAnalytics() {
  try {
    const user = await getSession();
    checkPermission(user.role, "crm.view");

    const data = await runTenantCached(
      "crm-analytics",
      user.tenantId,
      async () => {
        const now = new Date();

        const [allLeads, byStatus] = await Promise.all([
          prismaAny.lead.findMany({
            where: { contact: { tenantId: user.tenantId } },
            select: {
              id: true,
              status: true,
              source: true,
              estimatedValue: true,
              currency: true,
              winProbability: true,
              createdAt: true,
              updatedAt: true,
              salesTeamId: true,
            },
          }),
          prismaAny.lead.groupBy({
            by: ["status"],
            where: { contact: { tenantId: user.tenantId } },
            _count: { id: true },
            _sum: { estimatedValue: true },
          }),
        ]);

        const [bySource, teams] = await Promise.all([
          prismaAny.lead.groupBy({
            by: ["source"],
            where: { contact: { tenantId: user.tenantId } },
            _count: { id: true },
            _sum: { estimatedValue: true },
          }),
          prismaAny.salesTeam.findMany({
            where: { tenantId: user.tenantId },
            select: { id: true, name: true },
          }),
        ]);

        const STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "QUOTED", "WON", "LOST"];
        const funnel = STATUSES.map((s) => {
          const stat = byStatus.find((b) => b.status === s);
          return {
            status: s,
            count: stat?._count.id ?? 0,
            totalValue: Number(stat?._sum.estimatedValue ?? 0),
          };
        });

        const totalLeads = allLeads.length;
        const wonLeads = allLeads.filter((l) => l.status === "WON").length;
        const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;

        const openLeads = allLeads.filter((l) => l.status !== "LOST");
        const forecastExpectedValue = openLeads.reduce((sum, l) => {
          const value = Number(l.estimatedValue ?? 0);
          const prob = Number(l.winProbability ?? 0) / 100;
          return sum + value * prob;
        }, 0);

        const avgWinProbability =
          openLeads.length > 0
            ? Math.round(
                openLeads.reduce((sum, l) => sum + Number(l.winProbability ?? 0), 0) /
                  openLeads.length
              )
            : 0;

        const stageExpected = STATUSES.map((s) => {
          const stageLeads = openLeads.filter((l) => l.status === s);
          const expectedValue = stageLeads.reduce((sum, l) => {
            const value = Number(l.estimatedValue ?? 0);
            const prob = Number(l.winProbability ?? 0) / 100;
            return sum + value * prob;
          }, 0);
          return { status: s, expectedValue, count: stageLeads.length };
        });

        const stageCloseDays: Record<string, number> = {
          NEW: 30,
          CONTACTED: 20,
          QUALIFIED: 14,
          QUOTED: 7,
          WON: 0,
          LOST: 0,
        };

        const forecastByMonth: { month: string; expectedValue: number; count: number }[] = [];
        for (let i = 0; i < 6; i++) {
          const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
          const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
          const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

          let expectedValue = 0;
          let count = 0;
          for (const lead of openLeads) {
            const days = stageCloseDays[lead.status] ?? 30;
            const closeDate = new Date(lead.createdAt.getTime() + days * 86400000);
            if (closeDate >= monthStart && closeDate <= monthEnd) {
              const value = Number(lead.estimatedValue ?? 0);
              const prob = Number(lead.winProbability ?? 0) / 100;
              expectedValue += value * prob;
              count += 1;
            }
          }

          forecastByMonth.push({
            month: d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
            expectedValue,
            count,
          });
        }

        const teamMap = new Map(teams.map((t) => [t.id, t.name]));
        const pipelineByTeam = new Map<string, { team: string; expectedValue: number; count: number }>();
        for (const lead of openLeads) {
          const teamKey = lead.salesTeamId || "unassigned";
          const entry = pipelineByTeam.get(teamKey) || {
            team: teamKey === "unassigned" ? "Non assigne" : teamMap.get(teamKey) || teamKey,
            expectedValue: 0,
            count: 0,
          };
          const value = Number(lead.estimatedValue ?? 0);
          const prob = Number(lead.winProbability ?? 0) / 100;
          entry.expectedValue += value * prob;
          entry.count += 1;
          pipelineByTeam.set(teamKey, entry);
        }

        const velocityMap: Record<string, number[]> = {};
        for (const lead of allLeads) {
          const days = (lead.updatedAt.getTime() - lead.createdAt.getTime()) / 86400000;
          if (!velocityMap[lead.status]) velocityMap[lead.status] = [];
          velocityMap[lead.status].push(days);
        }

        const velocity = Object.entries(velocityMap).map(([status, days]) => ({
          status,
          avgDays: Math.round(days.reduce((a, b) => a + b, 0) / days.length),
        }));

        const sources = bySource.map((s) => {
          const wonFromSource = allLeads.filter(
            (l) => l.source === s.source && l.status === "WON"
          ).length;
          const totalFromSource = s._count.id;
          return {
            source: s.source ?? "(direct)",
            count: totalFromSource,
            totalValue: Number(s._sum.estimatedValue ?? 0),
            wonRate: totalFromSource > 0 ? Math.round((wonFromSource / totalFromSource) * 100) : 0,
          };
        });

        const cohorts: { month: string; created: number; won: number }[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
          const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
          const created = allLeads.filter(
            (l) => l.createdAt >= monthStart && l.createdAt <= monthEnd
          ).length;
          const won = allLeads.filter(
            (l) => l.status === "WON" && l.updatedAt >= monthStart && l.updatedAt <= monthEnd
          ).length;
          cohorts.push({
            month: d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
            created,
            won,
          });
        }

        const slaLeads = await prismaAny.lead.findMany({
          where: {
            contact: { tenantId: user.tenantId },
            slaStatus: { not: null },
          },
          select: { slaStatus: true },
        });

        const slaBreaches = slaLeads.filter((l) => l.slaStatus === "BREACH").length;
        const slaCompliance =
          slaLeads.length > 0
            ? Math.round(((slaLeads.length - slaBreaches) / slaLeads.length) * 100)
            : 100;

        return {
          funnel,
          conversionRate,
          velocity,
          sources,
          cohorts,
          slaCompliance,
          totalLeads,
          forecast: {
            expectedValue: forecastExpectedValue,
            avgWinProbability,
            byStage: stageExpected,
            byMonth: forecastByMonth,
            byTeam: Array.from(pipelineByTeam.values()),
          },
        };
      },
      30
    );

    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur analytics" };
  }
}

// â”€â”€ Pipelines â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getPipelines() {
  try {
    const user = await getSession();
    const pipelines = await prismaAny.pipeline.findMany({
      where: { tenantId: user.tenantId },
      include: { stages: { orderBy: { order: "asc" } } },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
    return { data: pipelines };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function createPipeline(data: {
  name: string;
  stages: { name: string; color: string; order: number }[];
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "crm.manage");

    const isFirst = (await prismaAny.pipeline.count({ where: { tenantId: user.tenantId } })) === 0;

    const pipeline = await prismaAny.pipeline.create({
      data: {
        tenantId: user.tenantId,
        name: data.name,
        isDefault: isFirst,
        stages: {
          create: data.stages.map((s) => ({
            name: s.name,
            color: s.color,
            order: s.order,
          })),
        },
      },
      include: { stages: { orderBy: { order: "asc" } } },
    });

    revalidatePath("/crm");
    return { data: pipeline };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function setDefaultPipeline(pipelineId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "crm.manage");

    await prismaAny.$transaction([
      prismaAny.pipeline.updateMany({
        where: { tenantId: user.tenantId },
        data: { isDefault: false },
      }),
      prismaAny.pipeline.update({
        where: { id: pipelineId },
        data: { isDefault: true },
      }),
    ]);

    revalidatePath("/crm");
    return { data: { success: true } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function deletePipeline(pipelineId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "crm.manage");

    await prismaAny.pipeline.delete({ where: { id: pipelineId } });
    revalidatePath("/crm");
    return { data: { success: true } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function createQuoteFromLead(leadId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "quote.create");

    const lead = await prismaAny.lead.findUnique({
      where: { id: leadId },
      include: { contact: true },
    });

    if (!lead || lead.contact?.tenantId !== user.tenantId) {
      return { error: "Lead introuvable" };
    }
    if (!lead.estimatedValue) {
      return { error: "Valeur estimÃ©e manquante" };
    }

    const order = await OrderService.create(user.tenantId, {
      contactId: lead.contactId,
      items: [
        {
          description: lead.description || lead.category || "Offre CRM",
          quantity: 1,
          unitPrice: Number(lead.estimatedValue),
          currency: lead.currency || "XAF",
        },
      ],
      priority: "NORMAL",
      destinationCity: lead.contact?.city || "Brazzaville",
      originCountry: lead.originCountry || "CN",
      notes: `Lead CRM ${lead.id}`,
      ownerId: user.id,
      onboardedById: user.id,
      collaboratorIds: [],
      leadId: lead.id,
    } as any);

    const approval = await resolveQuoteCreationApproval({
      tenantId: user.tenantId,
      totalXaf: Number(lead.estimatedValue),
      creatorRole: user.role,
      creatorId: user.id,
    });

    const quote = await prismaAny.$transaction(async (tx: any) =>
      createQuoteVersion(tx, {
        orderId: order.id,
        status: "DRAFT",
        ...approval.autoApprovalData,
        merchandiseTotal: Number(lead.estimatedValue),
        logisticsCost: 0,
        commission: 0,
        insuranceCost: 0,
        total: Number(lead.estimatedValue),
        currency: lead.currency || "XAF",
        pricingSnapshot: {
          source: "CRM_LEAD",
          items: [
            {
              description: lead.description || lead.category || "Offre CRM",
              quantity: 1,
              unitPrice: Number(lead.estimatedValue),
              currency: lead.currency || "XAF",
            },
          ],
        },
      })
    );

    await attachQuoteToRelatedDemands({ quoteId: quote.id, orderId: order.id });
    await cancelQuoteWorkflowTasks({
      orderId: order.id,
      includePaymentTasks: true,
      excludingQuoteId: quote.id,
    });

    if (!approval.creatorCanApprove) {
      await ensureQuoteApprovalTask({
        tenantId: user.tenantId,
        orderId: order.id,
        quoteId: quote.id,
        orderNumber: order.orderNumber,
        totalXaf: Number(lead.estimatedValue),
        customerName: lead.contact?.name ?? null,
      });
    }
    await syncDemandStatusForQuote(quote.id);

    await prismaAny.lead.update({
      where: { id: lead.id },
      data: { status: "QUOTED" },
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "crm.quote.created",
      entityType: "quote",
      entityId: quote.id,
      newValue: { leadId: lead.id, orderId: order.id },
    });

    await NotificationService.notifyMany(
      [lead.ownerId, lead.assignedTo].filter(Boolean) as string[],
      {
        tenantId: user.tenantId,
        type: "QUOTE_CREATED",
        title: `Devis crÃ©Ã© depuis CRM`,
        message: `Lead ${lead.id} converti en devis`,
        entityType: "quote",
        entityId: quote.id,
      }
    );

    revalidatePath("/crm");
    revalidatePath(`/crm/leads/${leadId}`);
    revalidatePath(`/orders/${order.id}`);
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    return { data: { orderId: order.id, quoteId: quote.id } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function assignLeadToPipeline(
  leadId: string,
  pipelineId: string,
  stageId: string
) {
  try {
    const user = await getSession();
    checkPermission(user.role, "lead.manage");

    await prismaAny.lead.update({
      where: { id: leadId },
      data: { pipelineId, pipelineStageId: stageId },
    });

    revalidatePath(`/crm/leads/${leadId}`);
    return { data: { success: true } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// â”€â”€ Custom Fields â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type FieldDef = {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "date";
  required: boolean;
};

export type LeadScoringWeights = {
  value: number;
  status: number;
  completeness: number;
  assignment: number;
  freshness: number;
};

const DEFAULT_LEAD_SCORING_WEIGHTS: LeadScoringWeights = {
  value: 30,
  status: 25,
  completeness: 20,
  assignment: 10,
  freshness: 15,
};

export async function getLeadScoringWeights() {
  try {
    const user = await getSession();
    checkPermission(user.role, "crm.view");
    const settings = await getTenantSettings(user.tenantId);
    const weights = settings.leadScoringWeights as LeadScoringWeights | undefined;
    return { data: { ...DEFAULT_LEAD_SCORING_WEIGHTS, ...(weights ?? {}) } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function saveLeadScoringWeights(weights: LeadScoringWeights) {
  try {
    const user = await getSession();
    checkPermission(user.role, "crm.manage");
    const settings = await getTenantSettings(user.tenantId);
    await prismaAny.tenant.update({
      where: { id: user.tenantId },
      data: { settings: { ...settings, leadScoringWeights: weights } },
    });
    revalidatePath("/crm/intelligence");
    revalidatePath("/crm/analytics");
    return { data: { success: true } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getCustomFieldsSchema(): Promise<{
  lead: FieldDef[];
  contact: FieldDef[];
}> {
  try {
    const user = await getSession();
    checkPermission(user.role, "crm.view");
    const settings = await getTenantSettings(user.tenantId);
    const schema = settings.customFieldsSchema as { lead?: FieldDef[]; contact?: FieldDef[] } | undefined;
    return {
      lead: schema?.lead ?? [],
      contact: schema?.contact ?? [],
    };
  } catch {
    return { lead: [], contact: [] };
  }
}

export async function saveCustomFieldsSchema(
  entity: "lead" | "contact",
  fields: FieldDef[]
): Promise<{ success?: boolean; error?: string }> {
  try {
    const user = await getSession();
    checkPermission(user.role, "crm.manage");

    const settings = await getTenantSettings(user.tenantId);
    const currentSchema = (settings.customFieldsSchema as { lead?: FieldDef[]; contact?: FieldDef[] }) ?? {};

    await prismaAny.tenant.update({
      where: { id: user.tenantId },
      data: {
        settings: {
          ...settings,
          customFieldsSchema: { ...currentSchema, [entity]: fields },
        },
      },
    });

    revalidatePath("/crm");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur" };
  }
}

export async function updateLeadCustomFields(
  leadId: string,
  fields: Record<string, unknown>
): Promise<{ success?: boolean; error?: string }> {
  try {
    const user = await getSession();
    const existing = await prismaAny.lead.findUnique({
      where: { id: leadId },
      select: { customFields: true, tenantId: true },
    });
    if (!existing || existing.tenantId !== user.tenantId) return { error: "Lead introuvable" };
    const current = (existing.customFields as Record<string, unknown>) ?? {};
    await prismaAny.lead.update({
      where: { id: leadId },
      data: { customFields: { ...current, ...fields } },
    });
    revalidatePath(`/crm/leads/${leadId}`);
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur" };
  }
}

export async function updateContactCustomFields(
  contactId: string,
  fields: Record<string, unknown>
): Promise<{ success?: boolean; error?: string }> {
  try {
    const user = await getSession();
    const existing = await prismaAny.contact.findUnique({
      where: { id: contactId },
      select: { customFields: true, tenantId: true },
    });
    if (!existing || existing.tenantId !== user.tenantId) return { error: "Contact introuvable" };
    const current = (existing.customFields as Record<string, unknown>) ?? {};
    await prismaAny.contact.update({
      where: { id: contactId },
      data: { customFields: { ...current, ...fields } },
    });
    revalidatePath(`/contacts/${contactId}`);
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur" };
  }
}

// â”€â”€ Meetings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getMeetings(filters: {
  contactId?: string;
  leadId?: string;
  from?: Date;
  to?: Date;
}) {
  try {
    const user = await getSession();

    const where: any = { tenantId: user.tenantId };
    if (filters.contactId) where.contactId = filters.contactId;
    if (filters.leadId) where.leadId = filters.leadId;
    if (filters.from || filters.to) {
      where.startAt = {};
      if (filters.from) where.startAt.gte = filters.from;
      if (filters.to) where.startAt.lte = filters.to;
    }

    const meetings = await prismaAny.meeting.findMany({
      where,
      include: {
        contact: { select: { id: true, name: true, company: true } },
        lead: { select: { id: true, description: true, status: true } },
      },
      orderBy: { startAt: "asc" },
    });

    return { data: meetings };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getUpcomingMeetings() {
  try {
    const user = await getSession();
    const now = new Date();
    const in14Days = new Date(Date.now() + 14 * 86400000);

    const meetings = await prismaAny.meeting.findMany({
      where: {
        tenantId: user.tenantId,
        startAt: { gte: now, lte: in14Days },
        status: "SCHEDULED",
      },
      include: {
        contact: { select: { id: true, name: true, company: true } },
      },
      orderBy: { startAt: "asc" },
      take: 20,
    });

    return { data: meetings };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function createMeeting(data: {
  contactId: string;
  leadId?: string;
  title: string;
  startAt: string;
  endAt: string;
  type?: string;
  location?: string;
  description?: string;
  notes?: string;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "crm.manage");

    const meeting = await prismaAny.meeting.create({
      data: {
        tenantId: user.tenantId,
        contactId: data.contactId,
        leadId: data.leadId,
        title: data.title,
        startAt: new Date(data.startAt),
        endAt: new Date(data.endAt),
        type: data.type ?? "CALL",
        location: data.location,
        description: data.description,
        notes: data.notes,
        createdById: user.id,
      },
    });

    revalidatePath("/crm/calendar");
    if (data.leadId) revalidatePath(`/crm/leads/${data.leadId}`);
    return { data: meeting };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function updateMeeting(
  id: string,
  data: {
    title?: string;
    startAt?: string;
    endAt?: string;
    type?: string;
    location?: string;
    description?: string;
    notes?: string;
    status?: string;
  }
) {
  try {
    const user = await getSession();
    checkPermission(user.role, "crm.manage");

    const meeting = await prismaAny.meeting.update({
      where: { id },
      data: {
        ...data,
        startAt: data.startAt ? new Date(data.startAt) : undefined,
        endAt: data.endAt ? new Date(data.endAt) : undefined,
      },
    });

    revalidatePath("/crm/calendar");
    return { data: meeting };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function deleteMeeting(id: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "crm.manage");
    await prismaAny.meeting.delete({ where: { id } });
    revalidatePath("/crm/calendar");
    return { data: { success: true } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// â”€â”€ Nurturing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getNurturingSequences() {
  try {
    const user = await getSession();

    const sequences = await prismaAny.nurturingSequence.findMany({
      where: { tenantId: user.tenantId },
      include: {
        steps: { orderBy: { order: "asc" } },
        _count: { select: { enrollments: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return { data: sequences };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function createNurturingSequence(data: {
  name: string;
  trigger: string;
  triggerStatus?: string;
  steps: { channel: string; delayDays: number; subject?: string; body: string; order: number }[];
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "crm.manage");

    const sequence = await prismaAny.nurturingSequence.create({
      data: {
        tenantId: user.tenantId,
        name: data.name,
        trigger: data.trigger,
        triggerStatus: data.triggerStatus,
        steps: {
          create: data.steps.map((s) => ({
            channel: s.channel,
            delayDays: s.delayDays,
            subject: s.subject,
            body: s.body,
            order: s.order,
          })),
        },
      },
      include: { steps: { orderBy: { order: "asc" } } },
    });

    revalidatePath("/crm");
    return { data: sequence };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function enrollLeadInSequence(leadId: string, sequenceId: string) {
  try {
    const user = await getSession();

    // Verify both the sequence and lead belong to the user's tenant
    const [sequence, lead] = await Promise.all([
      prismaAny.nurturingSequence.findUnique({
        where: { id: sequenceId },
        include: { steps: { orderBy: { order: "asc" }, take: 1 } },
      }),
      prismaAny.lead.findUnique({ where: { id: leadId }, select: { tenantId: true } }),
    ]);

    if (!sequence || sequence.tenantId !== user.tenantId) return { error: "Sequence introuvable" };
    if (!lead || lead.tenantId !== user.tenantId) return { error: "Lead introuvable" };

    const firstStep = sequence.steps[0];
    const nextStepAt = firstStep
      ? new Date(Date.now() + firstStep.delayDays * 86400000)
      : undefined;

    const enrollment = await prismaAny.nurturingEnrollment.upsert({
      where: { sequenceId_leadId: { sequenceId, leadId } },
      create: { sequenceId, leadId, currentStep: 0, nextStepAt },
      update: { status: "ACTIVE", currentStep: 0, nextStepAt },
    });

    revalidatePath(`/crm/leads/${leadId}`);
    return { data: enrollment };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function advanceNurturingStep(enrollmentId: string) {
  try {
    const user = await getSession();

    // Verify tenant ownership via the lead before advancing
    const enrollment = await prismaAny.nurturingEnrollment.findUnique({
      where: { id: enrollmentId },
      include: { lead: { select: { tenantId: true } } },
    });
    if (!enrollment || enrollment.lead.tenantId !== user.tenantId) {
      return { error: "Enrollment introuvable" };
    }

    const result = await NurturingService.advanceEnrollment(enrollmentId, user.id);
    if ((result as any)?.error) return { error: (result as any).error };

    if (enrollment.leadId) {
      revalidatePath(`/crm/leads/${enrollment.leadId}`);
    }
    return { data: { success: true } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function cancelNurturingEnrollment(enrollmentId: string) {
  try {
    await getSession();
    const enrollment = await prismaAny.nurturingEnrollment.update({
      where: { id: enrollmentId },
      data: { status: "CANCELLED" },
    });
    revalidatePath(`/crm/leads/${enrollment.leadId}`);
    return { data: { success: true } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getLeadNurturing(leadId: string) {
  try {
    await getSession();

    const enrollments = await prismaAny.nurturingEnrollment.findMany({
      where: { leadId },
      include: {
        sequence: {
          include: { steps: { orderBy: { order: "asc" } } },
        },
      },
      orderBy: { enrolledAt: "desc" },
    });

    return { data: enrollments };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}




