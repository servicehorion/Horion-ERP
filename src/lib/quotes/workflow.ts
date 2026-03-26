import type { DemandStatus, Prisma, UserRole } from "@prisma/client";

import { prisma } from "@/lib/db";
import { formatPublicMoney } from "@/lib/public-money";
import { NotificationService } from "@/lib/services/notification.service";
import { OperationalTaskService } from "@/lib/services/operational-task.service";
import { SourcingTicketService } from "@/lib/services/sourcing-ticket.service";

const DEFAULT_QUOTE_ASSISTANT_APPROVAL_THRESHOLD_XAF = 100_000;
const DEFAULT_QUOTE_MANAGER_APPROVAL_THRESHOLD_XAF = 500_000;
const QUOTE_PAYMENT_TASK_TYPES = ["confirm_payment", "payment_validation"] as const;

/** Résolution du validateur paiement selon le montant et les seuils */
function resolvePaymentValidatorRoles(totalXaf: number, thresholds: QuoteApprovalThresholds): UserRole[] {
  if (totalXaf <= thresholds.assistantThresholdXaf) {
    // ≤ 100k XAF → Finance peut valider
    return ["FINANCE", "FINANCE_MANAGER", "CEO", "DIRECTION", "ADMIN"];
  }
  if (totalXaf <= thresholds.managerThresholdXaf) {
    // ≤ 500k XAF → Finance Manager ou Direction
    return ["FINANCE_MANAGER", "CEO", "DIRECTION", "ADMIN"];
  }
  // > 500k XAF → CEO / Direction uniquement
  return ["CEO", "DIRECTION", "ADMIN"];
}

export type QuoteApprovalGate = "LOGISTICS_ASSISTANT" | "LOGISTICS_MANAGER" | "CEO";

export type QuoteApprovalThresholds = {
  assistantThresholdXaf: number;
  managerThresholdXaf: number;
};

export type QuoteApprovalPolicy = QuoteApprovalThresholds & {
  requiredGate: QuoteApprovalGate;
  approverRoles: UserRole[];
};

export type QuoteCreationApprovalResolution = {
  policy: QuoteApprovalPolicy;
  creatorCanApprove: boolean;
  autoApprovalData: Pick<Prisma.QuoteUncheckedCreateInput, "approvalStatus" | "approvedById" | "approvedAt" | "approvalNote">;
};

function parseThreshold(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

export async function getQuoteApprovalThresholds(tenantId: string): Promise<QuoteApprovalThresholds> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });

  const settings = (tenant?.settings as Record<string, unknown> | null) ?? {};

  const assistantThresholdXaf =
    parseThreshold(settings.quoteAssistantApprovalThresholdXAF) ??
    parseThreshold(process.env.QUOTE_ASSISTANT_APPROVAL_THRESHOLD_XAF) ??
    DEFAULT_QUOTE_ASSISTANT_APPROVAL_THRESHOLD_XAF;

  const managerThresholdCandidate =
    parseThreshold(settings.quoteManagerApprovalThresholdXAF) ??
    parseThreshold(settings.quoteCooApprovalThresholdXAF) ??
    parseThreshold(settings.quoteCeoApprovalThresholdXAF) ??
    parseThreshold(settings.quoteApprovalThresholdXAF) ??
    parseThreshold(process.env.QUOTE_MANAGER_APPROVAL_THRESHOLD_XAF) ??
    parseThreshold(process.env.QUOTE_CEO_APPROVAL_THRESHOLD_XAF) ??
    DEFAULT_QUOTE_MANAGER_APPROVAL_THRESHOLD_XAF;

  return {
    assistantThresholdXaf,
    managerThresholdXaf: Math.max(managerThresholdCandidate, assistantThresholdXaf),
  };
}

export async function getQuoteApprovalPolicy(tenantId: string, totalXaf: number): Promise<QuoteApprovalPolicy> {
  const thresholds = await getQuoteApprovalThresholds(tenantId);
  const requiresAssistant = totalXaf <= thresholds.assistantThresholdXaf;
  const requiresManager = totalXaf <= thresholds.managerThresholdXaf;

  return {
    ...thresholds,
    requiredGate: requiresAssistant ? "LOGISTICS_ASSISTANT" : requiresManager ? "LOGISTICS_MANAGER" : "CEO",
    approverRoles: requiresAssistant
      ? ["LOGISTICS_ASSISTANT", "LOGISTICS_MANAGER", "DIRECTION", "CEO", "ADMIN"]
      : requiresManager
        ? ["LOGISTICS_MANAGER", "DIRECTION", "CEO", "ADMIN"]
        : ["CEO", "DIRECTION", "ADMIN"],
  };
}

export function canRoleApproveQuote(userRole: UserRole, policy: QuoteApprovalPolicy) {
  return policy.approverRoles.includes(userRole);
}

export async function resolveQuoteCreationApproval(input: {
  tenantId: string;
  totalXaf: number;
  creatorRole: UserRole;
  creatorId: string;
}): Promise<QuoteCreationApprovalResolution> {
  const policy = await getQuoteApprovalPolicy(input.tenantId, input.totalXaf);
  const creatorCanApprove = canRoleApproveQuote(input.creatorRole, policy);

  return {
    policy,
    creatorCanApprove,
    autoApprovalData: creatorCanApprove
      ? {
          approvalStatus: "APPROVED",
          approvedById: input.creatorId,
          approvedAt: new Date(),
          approvalNote: `Validation interne appliquée à la création par ${getQuoteApprovalGateLabel(policy.requiredGate)}.`,
        }
      : {
          approvalStatus: "PENDING",
          approvedById: null,
          approvedAt: null,
          approvalNote: null,
        },
  };
}

export function getQuoteApprovalGateLabel(gate: QuoteApprovalGate) {
  if (gate === "LOGISTICS_ASSISTANT") return "Assistant logistique";
  return gate === "CEO" ? "CEO / Direction" : "COO / Logistics Manager";
}

async function findApproverUserId(tenantId: string, roles: UserRole[]) {
  for (const role of roles) {
    const user = await prisma.user.findFirst({
      where: {
        tenantId,
        role,
        isActive: true,
      },
      select: { id: true },
      orderBy: { name: "asc" },
    });
    if (user) return user.id;
  }

  return null;
}

async function findAdminWatcherIds(tenantId: string, excludingUserIds: string[]) {
  const excluded = excludingUserIds.filter(Boolean);
  const admins = await prisma.user.findMany({
    where: {
      tenantId,
      isActive: true,
      role: "ADMIN",
      ...(excluded.length > 0 ? { id: { notIn: excluded } } : {}),
    },
    select: { id: true },
    orderBy: { name: "asc" },
  });

  return admins.map((admin) => admin.id);
}

function getQuoteApprovalDeadline(gate: QuoteApprovalGate) {
  const hours = gate === "CEO" ? 1 : gate === "LOGISTICS_MANAGER" ? 2 : 1;
  return new Date(Date.now() + hours * 3_600_000);
}

function getQuoteApprovalSlaHours(gate: QuoteApprovalGate) {
  return gate === "LOGISTICS_MANAGER" ? 2 : 1;
}

export async function createQuoteVersion(
  tx: Prisma.TransactionClient,
  data: Prisma.QuoteUncheckedCreateInput & { orderId: string }
) {
  const latestQuote = await tx.quote.findFirst({
    where: { orderId: data.orderId },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  await tx.quote.updateMany({
    where: {
      orderId: data.orderId,
      isActive: true,
    },
    data: {
      isActive: false,
    },
  });

  const quote = await tx.quote.create({
    data: {
      ...data,
      version: (latestQuote?.version || 0) + 1,
      isActive: true,
    },
  });

  await tx.order.update({
    where: { id: data.orderId },
    data: { currentQuoteId: quote.id },
  });

  return quote;
}

export async function ensureQuoteIsActive(params: {
  quoteId: string;
  orderId: string;
  isActive: boolean;
}) {
  if (params.isActive) return;

  const currentQuote = await prisma.order.findUnique({
    where: { id: params.orderId },
    select: {
      currentQuote: {
        select: {
          id: true,
          version: true,
        },
      },
    },
  });

  const nextVersion = currentQuote?.currentQuote?.version;
  throw new Error(
    nextVersion
      ? `Ce devis n'est plus la version active. La version V${nextVersion} doit être utilisée.`
      : "Ce devis n'est plus la version active."
  );
}

export async function attachQuoteToRelatedDemands(params: {
  quoteId: string;
  orderId: string;
}) {
  const demands = await prisma.demandIntake.findMany({
    where: {
      OR: [{ quoteId: params.quoteId }, { orderId: params.orderId }],
      status: { not: "CONVERTED" },
    },
    select: { id: true, status: true },
  });

  for (const demand of demands) {
    const nextStatus: DemandStatus =
      demand.status === "PAYMENT_SUBMITTED" || demand.status === "PAYMENT_VALIDATED"
        ? demand.status
        : "QUOTE_DRAFT";

    await prisma.demandIntake.update({
      where: { id: demand.id },
      data: {
        quoteId: params.quoteId,
        orderId: params.orderId,
        status: nextStatus,
      },
    });
  }
}

export async function markDemandConvertedForQuote(params: {
  quoteId: string;
  orderId: string;
  convertedCaseId?: string | null;
}) {
  const demands = await prisma.demandIntake.findMany({
    where: {
      OR: [{ quoteId: params.quoteId }, { orderId: params.orderId }],
      status: { not: "LOST" },
    },
    select: { id: true },
  });

  for (const demand of demands) {
    await prisma.demandIntake.update({
      where: { id: demand.id },
      data: {
        status: "CONVERTED",
        orderId: params.orderId,
        quoteId: params.quoteId,
        ...(params.convertedCaseId ? { convertedCaseId: params.convertedCaseId } : {}),
      },
    });
  }
}

export async function ensureQuoteApprovalTask(input: {
  tenantId: string;
  orderId: string;
  quoteId: string;
  orderNumber: string;
  totalXaf: number;
  customerName?: string | null;
}) {
  const policy = await getQuoteApprovalPolicy(input.tenantId, input.totalXaf);
  const approverId = await findApproverUserId(input.tenantId, policy.approverRoles);
  const adminWatcherIds = await findAdminWatcherIds(input.tenantId, approverId ? [approverId] : []);

  const title = `Valider le devis - ${input.orderNumber}`;
  const description = [
    input.customerName ? `Client: ${input.customerName}.` : null,
    `Montant du devis: ${formatPublicMoney(input.totalXaf, "XAF")}.`,
    `Validation requise: ${getQuoteApprovalGateLabel(policy.requiredGate)}.`,
    `Assistant logistique jusqu'a ${formatPublicMoney(policy.assistantThresholdXaf, "XAF")}.`,
    `COO / Logistics Manager jusqu'a ${formatPublicMoney(policy.managerThresholdXaf, "XAF")}.`,
    `CEO / Direction au-dela.`,
  ]
    .filter(Boolean)
    .join(" ");

  const customFields: Prisma.InputJsonValue = {
    quoteId: input.quoteId,
    approvalGate: policy.requiredGate,
    assistantThresholdXaf: policy.assistantThresholdXaf,
    managerThresholdXaf: policy.managerThresholdXaf,
    totalXaf: input.totalXaf,
  };

  const task = await OperationalTaskService.create({
    tenantId: input.tenantId,
    entityType: "order",
    entityId: input.orderId,
    taskType: "quote_approval",
    title,
    description,
    module: "orders",
    priority: "URGENT",
    ownerType: "SYSTEM",
    riskLevel: policy.requiredGate === "CEO" ? "HIGH" : "MEDIUM",
    slaHours: getQuoteApprovalSlaHours(policy.requiredGate),
    assigneeId: approverId,
    fallbackRoles: ["ADMIN", "DIRECTION", "CEO"],
    watcherIds: adminWatcherIds,
    assignedByName: "Automatisation Horion",
    tags: ["devis-approval", input.orderNumber, policy.requiredGate.toLowerCase()],
    customFields: customFields as unknown as Record<string, unknown>,
    reuseIfOpen: true,
    completionRequirements: {
      requireApprovedDecision: true,
      requiredComment: true,
    },
  });

  await NotificationService.onApprovalRequired(task.taskId, input.tenantId, title);

  return { taskId: task.taskId, approverId, policy };
}

export async function ensureCeoPaymentValidationTask(input: {
  tenantId: string;
  orderId: string;
  quoteId: string;
  orderNumber: string;
  totalXaf: number;
  currency: string;
  paymentMethod: string;
  paymentEvidence: string;
  qcOption?: string | null;
}) {
  const thresholds = await getQuoteApprovalThresholds(input.tenantId);
  const validatorRoles = resolvePaymentValidatorRoles(input.totalXaf, thresholds);
  const approverId = await findApproverUserId(input.tenantId, validatorRoles);
  const isCritical = input.totalXaf > thresholds.managerThresholdXaf;
  const isManagerLevel = input.totalXaf > thresholds.assistantThresholdXaf && input.totalXaf <= thresholds.managerThresholdXaf;

  const validatorLabel = isCritical
    ? "CEO / Direction"
    : isManagerLevel
      ? "Finance Manager / Direction"
      : "Équipe Finance";

  const methodLabel = input.paymentMethod.replace(/_/g, " ");
  const description = [
    `Paiement client à valider pour ${input.orderNumber}.`,
    `Montant: ${formatPublicMoney(input.totalXaf, input.currency)}.`,
    `Méthode: ${methodLabel}.`,
    `Validation requise par: ${validatorLabel}.`,
    input.paymentEvidence,
    input.qcOption && input.qcOption !== "NONE" ? `QC demandé: ${input.qcOption}.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const customFields: Prisma.InputJsonValue = {
    quoteId: input.quoteId,
    paymentMethod: input.paymentMethod,
    paymentEvidence: input.paymentEvidence,
    totalXaf: input.totalXaf,
    qcOption: input.qcOption ?? "NONE",
    validatorRoles,
    validatorLabel,
  };

  const task = await OperationalTaskService.create({
    tenantId: input.tenantId,
    entityType: "order",
    entityId: input.orderId,
    taskType: "payment_validation",
    title: `Valider le paiement client - ${input.orderNumber}`,
    description,
    module: "finance",
    priority: isCritical ? "URGENT" : "HIGH",
    ownerType: "SYSTEM",
    riskLevel: isCritical ? "HIGH" : "MEDIUM",
    slaHours: 4,
    assigneeId: approverId,
    fallbackRoles: ["ADMIN", "DIRECTION", "CEO"],
    watcherRoles: ["ADMIN"],
    assignedByName: "Automatisation Horion",
    tags: ["payment-validation", input.orderNumber, validatorLabel.toLowerCase()],
    customFields: customFields as unknown as Record<string, unknown>,
    reuseIfOpen: true,
    completionRequirements: {
      requireApprovedDecision: true,
      requiredComment: true,
    },
  });

  if (approverId) {
    await prisma.notification.create({
      data: {
        tenantId: input.tenantId,
        userId: approverId,
        type: "APPROVAL_REQUIRED",
        title: `Paiement à valider - ${input.orderNumber}`,
        message: `${formatPublicMoney(input.totalXaf, input.currency)} via ${methodLabel}. Validation: ${validatorLabel}.`,
        entityType: "order",
        entityId: input.orderId,
      },
    });
  }

  return { taskId: task.taskId, approverId, validatorRoles, validatorLabel };
}

export async function cancelQuoteWorkflowTasks(input: {
  orderId: string;
  includePaymentTasks?: boolean;
  excludingQuoteId?: string;
}) {
  const includePaymentTasks = input.includePaymentTasks ?? true;

  const siblingQuotes = await prisma.quote.findMany({
    where: {
      orderId: input.orderId,
      isActive: true,
      ...(input.excludingQuoteId ? { id: { not: input.excludingQuoteId } } : {}),
    },
    select: {
      status: true,
      approvalStatus: true,
      paymentStatus: true,
    },
  });

  const keepApprovalTask = siblingQuotes.some(
    (quote) => quote.approvalStatus === "PENDING" && !["REJECTED", "EXPIRED"].includes(quote.status)
  );
  const keepPaymentTasks = siblingQuotes.some(
    (quote) =>
      quote.status === "ACCEPTED" &&
      ["PENDING", "SUBMITTED"].includes(quote.paymentStatus ?? "PENDING")
  );

  const orFilters: Prisma.TaskWhereInput[] = [];
  if (!keepApprovalTask) {
    orFilters.push({ taskType: "quote_approval" });
  }
  if (includePaymentTasks && !keepPaymentTasks) {
    orFilters.push({ taskType: { in: [...QUOTE_PAYMENT_TASK_TYPES] } });
    orFilters.push({ taskType: "client_notification", tags: { has: "paiement_en_cours" } });
  }

  if (orFilters.length === 0) return;

  const tasks = await prisma.task.findMany({
    where: {
      entityType: "order",
      entityId: input.orderId,
      status: { notIn: ["COMPLETED", "CANCELLED"] },
      OR: orFilters,
    },
    select: { id: true },
  });

  if (tasks.length === 0) return;

  const taskIds = tasks.map((task) => task.id);
  await prisma.task.updateMany({
    where: {
      OR: [{ id: { in: taskIds } }, { parentTaskId: { in: taskIds } }],
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    },
    data: {
      status: "CANCELLED",
      completedAt: new Date(),
    },
  });
}

function mapDemandStatusFromQuote(quote: {
  status: string;
  approvalStatus: string;
  paymentStatus: string | null;
}): DemandStatus {
  if (quote.paymentStatus === "PAID") return "PAYMENT_VALIDATED";
  if (quote.paymentStatus === "SUBMITTED") return "PAYMENT_SUBMITTED";
  if (quote.status === "ACCEPTED") return "CLIENT_ACCEPTED";
  if (quote.status === "SENT") return "QUOTE_SENT";
  if (quote.approvalStatus === "APPROVED") return "QUOTE_APPROVED";
  if (quote.status === "REJECTED" || quote.status === "EXPIRED" || quote.approvalStatus === "REJECTED") {
    return "QUALIFIED";
  }
  return "QUOTE_PENDING_APPROVAL";
}

export async function syncDemandStatusForQuote(quoteId: string) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: {
      id: true,
      orderId: true,
      status: true,
      approvalStatus: true,
      paymentStatus: true,
    },
  });

  if (!quote) return;

  const demands = await prisma.demandIntake.findMany({
    where: {
      OR: [{ quoteId }, { orderId: quote.orderId }],
    },
    select: { id: true, status: true },
  });

  if (demands.length > 0) {
    const nextStatus = mapDemandStatusFromQuote(quote);
    for (const demand of demands) {
      if (demand.status === "CONVERTED") continue;

      await prisma.demandIntake.update({
        where: { id: demand.id },
        data: {
          status: nextStatus,
          quoteId,
          orderId: quote.orderId,
        },
      });
    }
  }

  await SourcingTicketService.syncForQuote(quoteId);
}
