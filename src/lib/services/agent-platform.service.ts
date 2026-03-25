import { prisma } from "@/lib/db";
import {
  AGENT_TOOL_CATALOG,
  AGENT_TOOL_MAP,
  HORION_AGENT_DEFINITIONS,
  HORION_AGENT_IDS,
} from "@/lib/agents/catalog";
import type {
  AgentChannel,
  AgentRuntimeProfile,
  HorionAgentId,
  TenantAgentOverride,
} from "@/lib/agents/types";

type AgentRegistryEntry = {
  tenantId: string;
  secret: string;
  name?: string;
  active?: boolean;
};

type BuildContextInput = {
  taskId?: string;
  entityType?: string;
  entityId?: string;
};

export class AgentPlatformService {
  static getRecommendedAgentId(
    module: string,
    options: { entityType?: string; taskType?: string } = {}
  ): HorionAgentId | null {
    const normalizedModule = module.toLowerCase();
    const normalizedEntity = options.entityType?.toLowerCase();
    const normalizedTaskType = options.taskType?.toLowerCase();

    if (normalizedModule === "whatsapp") return "customer_service";
    if (normalizedModule === "marketing") return normalizedTaskType?.includes("community") ? "community_manager" : "marketing";
    if (normalizedModule === "finance" || normalizedEntity === "financeapproval") return "finance";
    if (normalizedModule === "sourcing" || normalizedModule === "catalog") return "sourcing";
    if (normalizedModule === "logistics" || normalizedModule === "qc") return "logistics_qc";
    if (normalizedModule === "crm") return normalizedTaskType?.includes("campaign") ? "marketing" : "customer_service";
    if (normalizedModule === "orders" && normalizedTaskType?.includes("dispute")) return "customer_service";
    return null;
  }

  static loadRuntimeRegistry(): Record<string, AgentRegistryEntry> {
    const raw =
      process.env.AGENT_REGISTRY_JSON ||
      (process.env.AGENT_REGISTRY_BASE64
        ? Buffer.from(process.env.AGENT_REGISTRY_BASE64, "base64").toString("utf8")
        : null);

    if (!raw) return {};

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return {};
      return parsed as Record<string, AgentRegistryEntry>;
    } catch {
      return {};
    }
  }

  static async getTenantOverrides(tenantId: string): Promise<Record<string, TenantAgentOverride>> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    const settings = (tenant?.settings as Record<string, unknown> | null) ?? {};
    const raw = settings.aiAgents;
    if (!raw || typeof raw !== "object") return {};
    return raw as Record<string, TenantAgentOverride>;
  }

  static async getAgentProfiles(tenantId: string): Promise<AgentRuntimeProfile[]> {
    const [overrides, registry] = await Promise.all([
      this.getTenantOverrides(tenantId),
      Promise.resolve(this.loadRuntimeRegistry()),
    ]);

    return HORION_AGENT_IDS.map((agentId) => {
      const def = HORION_AGENT_DEFINITIONS[agentId];
      const override = overrides[agentId] ?? {};
      const runtime = registry[agentId];

      return {
        ...def,
        enabled: override.enabled ?? true,
        displayName: override.displayName?.trim() || runtime?.name || def.name,
        registered: Boolean(runtime && runtime.active !== false && runtime.tenantId === tenantId),
        tenantId: runtime?.tenantId,
        escalationUserId: override.escalationUserId ?? null,
        autonomy: override.autonomy ?? def.autonomy,
        channels: sanitizeChannels(override.channels, def.modules),
        allowedModules: sanitizeChannels(override.allowedModules, def.modules),
        allowedTools: sanitizeTools(override.allowedTools, def.defaultTools),
        notes: override.notes,
      };
    });
  }

  static async getAgentProfile(tenantId: string, agentId: string) {
    const profiles = await this.getAgentProfiles(tenantId);
    return profiles.find((profile) => profile.id === agentId) ?? null;
  }

  static async getToolCatalogForAgent(tenantId: string, agentId: string) {
    const profile = await this.getAgentProfile(tenantId, agentId);
    if (!profile) return [];

    return profile.allowedTools
      .map((toolId) => AGENT_TOOL_MAP[toolId])
      .filter(Boolean)
      .sort((a, b) => a.module.localeCompare(b.module) || a.label.localeCompare(b.label));
  }

  static async assertToolAccess(tenantId: string, agentId: string, toolId: string) {
    const profile = await this.getAgentProfile(tenantId, agentId);
    if (!profile || !profile.enabled || !profile.registered) {
      throw new Error("Agent non disponible");
    }
    if (!profile.allowedTools.includes(toolId)) {
      throw new Error(`Acces refuse au tool ${toolId}`);
    }
    return profile;
  }

  static async getPlatformSnapshot(tenantId: string) {
    const [profiles, users] = await Promise.all([
      this.getAgentProfiles(tenantId),
      prisma.user.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, name: true, role: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const profileMetrics = await Promise.all(
      profiles.map(async (profile) => {
        const [queue, automatable, failed, executions] = await Promise.all([
          prisma.task.count({
            where: {
              tenantId,
              ownerType: "AI_AGENT",
              agentId: profile.id,
              status: { in: ["PENDING", "IN_PROGRESS", "BLOCKED"] },
            },
          }),
          prisma.task.count({
            where: {
              tenantId,
              automationAllowed: true,
              status: "PENDING",
              module: { in: profile.allowedModules },
            },
          }),
          prisma.agentExecution.count({
            where: {
              agentId: profile.id,
              task: { tenantId },
              status: "FAILED",
            },
          }),
          prisma.agentExecution.findMany({
            where: { agentId: profile.id, task: { tenantId } },
            select: { status: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 30,
          }),
        ]);

        const completed = executions.filter((item) => item.status === "COMPLETED").length;
        const successRate = executions.length > 0 ? Math.round((completed / executions.length) * 100) : 0;

        return {
          ...profile,
          metrics: {
            queue,
            automatable,
            failed,
            successRate,
          },
        };
      })
    );

    const enabledAgents = profileMetrics.filter((item) => item.enabled).length;
    const registeredAgents = profileMetrics.filter((item) => item.registered).length;
    const missingEscalationOwners = profileMetrics.filter(
      (item) => item.enabled && item.autonomy !== "assist" && !item.escalationUserId
    ).length;
    const totalQueue = profileMetrics.reduce((sum, item) => sum + item.metrics.queue, 0);
    const totalAutomatable = profileMetrics.reduce((sum, item) => sum + item.metrics.automatable, 0);
    const totalFailures = profileMetrics.reduce((sum, item) => sum + item.metrics.failed, 0);

    return {
      kpis: {
        configuredAgents: profileMetrics.length,
        enabledAgents,
        registeredAgents,
        missingEscalationOwners,
        totalQueue,
        totalAutomatable,
        totalFailures,
        readinessScore: computeReadinessScore({
          enabledAgents,
          registeredAgents,
          missingEscalationOwners,
          totalFailures,
          totalQueue,
        }),
      },
      agents: profileMetrics,
      users,
      tools: AGENT_TOOL_CATALOG,
    };
  }

  static async updateAgentOverride(
    tenantId: string,
    agentId: HorionAgentId,
    patch: TenantAgentOverride
  ) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    if (!tenant) throw new Error("Tenant introuvable");

    const settings = (tenant.settings as Record<string, unknown> | null) ?? {};
    const overrides = ((settings.aiAgents as Record<string, unknown> | null) ?? {}) as Record<
      string,
      TenantAgentOverride
    >;

    const current = overrides[agentId] ?? {};
    const next: TenantAgentOverride = {
      ...current,
      ...patch,
    };

    overrides[agentId] = {
      ...next,
      channels: next.channels ? sanitizeChannels(next.channels, HORION_AGENT_DEFINITIONS[agentId].modules) : undefined,
      allowedModules: next.allowedModules
        ? sanitizeChannels(next.allowedModules, HORION_AGENT_DEFINITIONS[agentId].modules)
        : undefined,
      allowedTools: next.allowedTools
        ? sanitizeTools(next.allowedTools, HORION_AGENT_DEFINITIONS[agentId].defaultTools)
        : undefined,
    };

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: {
          ...settings,
          aiAgents: overrides,
        } as any,
      },
    });
  }

  static async buildContext(
    tenantId: string,
    input: BuildContextInput
  ): Promise<Record<string, unknown>> {
    if (input.taskId) {
      const task = await prisma.task.findFirst({
        where: { id: input.taskId, tenantId },
        include: {
          assignments: { include: { user: { select: { id: true, name: true, role: true } } } },
          agentExecutions: { orderBy: { createdAt: "desc" }, take: 5 },
        },
      });
      if (!task) throw new Error("Tache introuvable");

      const entityContext: Record<string, unknown> | null = task.entityId && task.entityType && task.entityId !== "none"
        ? await this.buildContext(tenantId, { entityType: task.entityType, entityId: task.entityId })
        : null;

      return {
        scope: "task",
        task,
        entityContext,
      };
    }

    const entityType = input.entityType?.toLowerCase();
    const entityId = input.entityId;
    if (!entityType || !entityId) {
      throw new Error("entityType et entityId requis");
    }

    switch (entityType) {
      case "order":
        return {
          scope: "entity",
          entityType,
          data: await prisma.order.findFirst({
            where: { id: entityId, tenantId },
            include: {
              contact: { select: { id: true, name: true, phone: true, email: true } },
              shipments: {
                select: { id: true, status: true, mode: true, estimatedArrival: true, actualArrival: true },
                orderBy: { createdAt: "desc" },
                take: 3,
              },
              qcRequests: {
                select: { id: true, type: true, status: true, createdAt: true, scheduledAt: true },
                orderBy: { createdAt: "desc" },
                take: 3,
              },
              payments: {
                select: { id: true, status: true, amountXAF: true, dueAt: true, paidAt: true },
                orderBy: { createdAt: "desc" },
                take: 5,
              },
            },
          }),
        };
      case "lead":
        return {
          scope: "entity",
          entityType,
          data: await prisma.lead.findFirst({
            where: { id: entityId, contact: { tenantId } },
            include: {
              contact: { select: { id: true, name: true, phone: true, email: true } },
              collaborators: { include: { user: { select: { id: true, name: true, role: true } } } },
            },
          }),
        };
      case "contact":
        return {
          scope: "entity",
          entityType,
          data: await prisma.contact.findFirst({
            where: { id: entityId, tenantId },
            include: {
              leads: {
                select: { id: true, status: true, estimatedValue: true, updatedAt: true },
                orderBy: { updatedAt: "desc" },
                take: 5,
              },
              orders: {
                select: { id: true, orderNumber: true, status: true, updatedAt: true },
                orderBy: { updatedAt: "desc" },
                take: 5,
              },
            },
          }),
        };
      case "sourcing_case":
      case "sourcingcase":
        return {
          scope: "entity",
          entityType: "sourcing_case",
          data: await prisma.sourcingCase.findFirst({
            where: { id: entityId, order: { tenantId } },
            include: {
              order: { select: { id: true, orderNumber: true, status: true } },
              supplier: { select: { id: true, name: true, country: true, rating: true } },
              offers: {
                select: {
                  id: true,
                  unitPrice: true,
                  currency: true,
                  validTo: true,
                  supplier: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: "desc" },
                take: 5,
              },
            },
          }),
        };
      case "shipment":
        return {
          scope: "entity",
          entityType,
          data: await prisma.shipment.findFirst({
            where: { id: entityId, order: { tenantId } },
            include: {
              order: { select: { id: true, orderNumber: true, status: true } },
              trackingEvents: {
                select: { id: true, event: true, location: true, occurredAt: true },
                orderBy: { occurredAt: "desc" },
                take: 8,
              },
              incidents: {
                select: { id: true, type: true, status: true, severity: true, createdAt: true },
                orderBy: { createdAt: "desc" },
                take: 5,
              },
            },
          }),
        };
      case "qc_inspection":
      case "qcinspection":
        return {
          scope: "entity",
          entityType: "qc_inspection",
          data: await prisma.qcInspection.findFirst({
            where: { id: entityId, tenantId },
            include: {
              order: { select: { id: true, orderNumber: true, status: true } },
              supplier: { select: { id: true, name: true, country: true } },
              items: {
                select: { id: true, criterion: true, result: true, notes: true, defectCount: true },
                take: 20,
              },
            },
          }),
        };
      case "campaign":
        return {
          scope: "entity",
          entityType,
          data: null,
          warning: "Campaign n'est pas encore scope par tenant dans le schema. Context bloque jusqu'a normalisation marketing.",
        };
      default:
        return {
          scope: "entity",
          entityType,
          data: null,
          warning: "Aucun contexte structure n'est disponible pour ce type d'entite.",
        };
    }
  }
}

function sanitizeChannels(value: unknown, fallback: AgentChannel[]): AgentChannel[] {
  if (!Array.isArray(value)) return [...fallback];
  const allowed = new Set<AgentChannel>([
    "whatsapp",
    "crm",
    "marketing",
    "finance",
    "sourcing",
    "catalog",
    "orders",
    "logistics",
    "qc",
    "tasks",
  ]);
  const channels = value.filter((item): item is AgentChannel => typeof item === "string" && allowed.has(item as AgentChannel));
  return channels.length > 0 ? Array.from(new Set(channels)) : [...fallback];
}

function sanitizeTools(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return [...fallback];
  const tools = value.filter((item): item is string => typeof item === "string" && Boolean(AGENT_TOOL_MAP[item]));
  return tools.length > 0 ? Array.from(new Set(tools)) : [...fallback];
}

function computeReadinessScore(input: {
  enabledAgents: number;
  registeredAgents: number;
  missingEscalationOwners: number;
  totalFailures: number;
  totalQueue: number;
}) {
  let score = 100;
  const unregistered = Math.max(0, input.enabledAgents - input.registeredAgents);
  score -= unregistered * 12;
  score -= input.missingEscalationOwners * 8;
  score -= Math.min(20, input.totalFailures * 2);
  if (input.totalQueue > 40) score -= 10;
  return Math.max(0, Math.min(100, score));
}
