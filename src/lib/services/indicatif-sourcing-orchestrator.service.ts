import { prisma } from "@/lib/db";
import { AuditService } from "@/lib/services/audit.service";
import { OrderService } from "@/lib/services/order.service";
import type { Prisma } from "@prisma/client";

type SnapshotTransport = {
  key?: string;
  label?: string;
  mode?: string;
  serviceLevel?: string;
  costXAF?: number;
  delayLabel?: string;
};

type SnapshotItem = {
  description?: string;
  category?: string;
  platform?: string;
  catalogProductId?: string;
  catalogMatchScore?: number;
  catalogConfidenceScore?: number;
  isCatalogMatch?: boolean;
  quantity?: number;
  platformUnitPriceRmb?: number;
  exchangeRate?: number;
  productSellXAF?: number;
  serviceFeeXAF?: number;
  totalXAF?: number;
  weightKg?: number;
  productBufferPct?: number;
  compliance?: Record<string, unknown>;
  selectedTransport?: SnapshotTransport;
};

type IndicatifSnapshot = {
  source?: string;
  items?: SnapshotItem[];
  autoSourcing?: {
    createdAt?: string;
    paymentId?: string;
    caseIds?: string[];
  };
};

const SOURCE_KEY = "SOURCING_INDICATIF";
const AUTO_AGENT = "AUTO_INDICATIF";
const ORDER_STATUS_READY_FOR_SOURCING = new Set([
  "DEMANDE",
  "RECHERCHE_PRODUIT",
  "DEVIS",
  "PAIEMENT_EN_COURS",
]);

function asNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function isSensitiveCategory(category?: string) {
  return ["SPECIAL", "MEDICAL", "SMARTPHONE", "LAPTOP"].includes((category || "").toUpperCase());
}

function normalizeSnapshotItems(snapshot: IndicatifSnapshot): SnapshotItem[] {
  if (Array.isArray(snapshot.items) && snapshot.items.length > 0) return snapshot.items;
  return [];
}

type DeepSourcingAssignments = {
  logisticsManagerId: string | null;
  logisticsAssistantId: string | null;
  sourcingAssistantId: string | null;
};

async function pickUserByRoles(tenantId: string, roles: string[], preferredIds: string[] = []) {
  const preferred = preferredIds.filter(Boolean);

  if (preferred.length > 0) {
    const preferredUser = await prisma.user.findFirst({
      where: {
        id: { in: preferred },
        tenantId,
        isActive: true,
        role: { in: roles as any[] },
      },
      orderBy: { name: "asc" },
      select: { id: true },
    });
    if (preferredUser) return preferredUser.id;
  }

  const fallback = await prisma.user.findFirst({
    where: {
      tenantId,
      isActive: true,
      role: { in: roles as any[] },
    },
    orderBy: { name: "asc" },
    select: { id: true },
  });

  return fallback?.id ?? null;
}

async function resolveDeepSourcingAssignments(tenantId: string, ownerId?: string | null) {
  const [logisticsManagerId, logisticsAssistantId, sourcingAssistantId] = await Promise.all([
    pickUserByRoles(tenantId, ["LOGISTICS_MANAGER"], ownerId ? [ownerId] : []),
    pickUserByRoles(tenantId, ["LOGISTICS_ASSISTANT"]),
    pickUserByRoles(tenantId, ["SOURCING_ASSISTANT"]),
  ]);

  return {
    logisticsManagerId,
    logisticsAssistantId,
    sourcingAssistantId,
  } satisfies DeepSourcingAssignments;
}

async function syncOrderCollaborators(orderId: string, userIds: Array<string | null | undefined>) {
  const uniqueIds = Array.from(new Set(userIds.filter((value): value is string => Boolean(value))));
  if (uniqueIds.length === 0) return;

  await prisma.orderCollaborator.createMany({
    data: uniqueIds.map((userId) => ({ orderId, userId })),
    skipDuplicates: true,
  });
}

async function completePaymentConfirmationTasks(orderId: string) {
  await prisma.task.updateMany({
    where: {
      entityType: "order",
      entityId: orderId,
      taskType: "confirm_payment",
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });
}

export class IndicatifSourcingOrchestratorService {
  static async autoCreateSourcingFromConfirmedPayment(params: {
    paymentId: string;
    orderId: string;
  }) {
    const order = await prisma.order.findUnique({
      where: { id: params.orderId },
      select: {
        id: true,
        tenantId: true,
        status: true,
        orderNumber: true,
        ownerId: true,
      },
    });
    if (!order) return { createdCaseIds: [], skipped: "ORDER_NOT_FOUND" };

    const candidateQuotes = await prisma.quote.findMany({
      where: {
        orderId: params.orderId,
        status: { in: ["SENT", "ACCEPTED"] },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true,
        total: true,
        pricingSnapshot: true,
      },
    });

    const quote = candidateQuotes.find((q) => {
      const snapshot = (q.pricingSnapshot || {}) as IndicatifSnapshot;
      return snapshot.source === SOURCE_KEY;
    });
    if (!quote) return { createdCaseIds: [], skipped: "NO_INDICATIF_QUOTE" };

    const snapshot = (quote.pricingSnapshot || {}) as IndicatifSnapshot;
    if (snapshot.autoSourcing?.createdAt) {
      return { createdCaseIds: snapshot.autoSourcing.caseIds || [], skipped: "ALREADY_CREATED" };
    }

    const confirmedInbound = await prisma.payment.aggregate({
      where: {
        orderId: params.orderId,
        direction: "INBOUND",
        status: "CONFIRMED",
      },
      _sum: { amountXAF: true },
    });
    const confirmedInboundXaf = Number(confirmedInbound._sum.amountXAF || 0);
    const quoteTotalXaf = Number(quote.total || 0);
    if (confirmedInboundXaf < quoteTotalXaf) {
      return {
        createdCaseIds: [],
        skipped: "PAYMENT_NOT_FULLY_CONFIRMED",
        details: { confirmedInboundXaf, quoteTotalXaf },
      };
    }

    const items = normalizeSnapshotItems(snapshot);
    if (items.length === 0) return { createdCaseIds: [], skipped: "NO_ITEMS" };

    const assignments = await resolveDeepSourcingAssignments(order.tenantId, order.ownerId);
    await syncOrderCollaborators(order.id, [
      assignments.logisticsManagerId,
      assignments.logisticsAssistantId,
      assignments.sourcingAssistantId,
    ]);

    const createdCaseIds: string[] = [];
    const createdProductIds: string[] = [];

    for (const item of items) {
      const description = asString(item.description).trim();
      if (!description) continue;
      const quantity = Math.max(1, Math.round(asNumber(item.quantity, 1)));
      const category = asString(item.category, "STANDARD");
      const platform = asString(item.platform, "WEB");
      const platformUnitPriceRmb = asNumber(item.platformUnitPriceRmb, 0);
      const exchangeRate = asNumber(item.exchangeRate, 78);
      const selectedTransport = item.selectedTransport || {};
      const transportCostXaf = asNumber(selectedTransport.costXAF, 0);
      const totalXaf = asNumber(item.totalXAF, 0);
      const productSellXaf = asNumber(item.productSellXAF, 0);
      const serviceFeeXaf = asNumber(item.serviceFeeXAF, 0);
      const weightKg = asNumber(item.weightKg, 0);
      const productBufferPct = asNumber(item.productBufferPct, 0.175);

      const existingCase = await prisma.sourcingCase.findFirst({
        where: {
          orderId: params.orderId,
          requirement: description,
          status: { not: "CANCELLED" },
        },
        select: { id: true },
      });
      if (existingCase) {
        createdCaseIds.push(existingCase.id);
        continue;
      }

      const existingProduct = item.catalogProductId
        ? await prisma.catalogProduct.findFirst({
            where: {
              tenantId: order.tenantId,
              id: item.catalogProductId,
            },
            select: { id: true, shippingHints: true },
          })
        : await prisma.catalogProduct.findFirst({
            where: {
              tenantId: order.tenantId,
              name: { equals: description, mode: "insensitive" },
            },
            select: { id: true, shippingHints: true },
          });

      const shippingHints = {
        source: SOURCE_KEY,
        category,
        selectedTransport,
        compliance: item.compliance || {},
        catalogMatchScore: item.catalogMatchScore,
        catalogConfidenceScore: item.catalogConfidenceScore,
        isCatalogMatch: item.isCatalogMatch,
      } as Prisma.InputJsonValue;

      const product = existingProduct
        ? await prisma.catalogProduct.update({
            where: { id: existingProduct.id },
            data: {
              categoryId: undefined,
              status: "TESTING",
              priceMin: platformUnitPriceRmb > 0 ? platformUnitPriceRmb : undefined,
              priceCurrency: "RMB",
              weightEstimate: weightKg > 0 ? weightKg : undefined,
              lastOrderedAt: new Date(),
              lastQuotedAt: new Date(),
              shippingHints,
            },
            select: { id: true },
          })
        : await prisma.catalogProduct.create({
            data: {
              tenantId: order.tenantId,
              name: description,
              status: "TESTING",
              priceMin: platformUnitPriceRmb > 0 ? platformUnitPriceRmb : undefined,
              priceCurrency: "RMB",
              weightEstimate: weightKg > 0 ? weightKg : undefined,
              preferredPlatform: platform,
              estimatedCost: platformUnitPriceRmb > 0 ? platformUnitPriceRmb : undefined,
              shippingHints,
              notes: "Cree automatiquement depuis devis sourcing indicatif paye.",
            },
            select: { id: true },
          });
      createdProductIds.push(product.id);

      const sourcingCase = await prisma.sourcingCase.create({
        data: {
          orderId: params.orderId,
          requirement: description,
          status: "SEARCHING",
          level: "PROFOND",
          category,
          platform,
          pipelineType: quantity >= 100 ? "WHOLESALE" : "RETAIL",
          assignedToId:
            assignments.sourcingAssistantId ||
            assignments.logisticsAssistantId ||
            assignments.logisticsManagerId ||
            order.ownerId ||
            undefined,
          assignedAgent: AUTO_AGENT,
          stageEnteredAt: new Date(),
          sensitiveProduct: isSensitiveCategory(category),
          budget: platformUnitPriceRmb * quantity,
          currency: "RMB",
          bufferPercent: productBufferPct * 100,
          unitPriceRmb: platformUnitPriceRmb > 0 ? platformUnitPriceRmb : undefined,
          quantity,
          transportCostEst: transportCostXaf > 0 ? transportCostXaf : undefined,
          transportCurrency: "XAF",
          totalCostXAF: totalXaf > 0 ? totalXaf - serviceFeeXaf : undefined,
          prixFinalXAF: totalXaf > 0 ? totalXaf : undefined,
          marginPct:
            totalXaf > 0 && productSellXaf > 0
              ? ((totalXaf - (productSellXaf + transportCostXaf)) / totalXaf) * 100
              : undefined,
          weightKg: weightKg > 0 ? weightKg : undefined,
          weightEstimated: weightKg > 0 ? weightKg : undefined,
        },
        select: { id: true },
      });
      createdCaseIds.push(sourcingCase.id);

      await prisma.orderItem.create({
        data: {
          orderId: params.orderId,
          productId: product.id,
          description,
          quantity,
          unitPrice: platformUnitPriceRmb > 0 ? platformUnitPriceRmb : 0,
          currency: "RMB",
          unitPriceXAF:
            platformUnitPriceRmb > 0 ? Math.round(platformUnitPriceRmb * exchangeRate) : 0,
          totalXAF: totalXaf,
          notes: `Auto from ${SOURCE_KEY}`,
        },
      });

      const candidateSuppliers = await prisma.supplierProduct.findMany({
        where: {
          productId: product.id,
          status: "ACTIVE",
          supplier: { status: "ACTIVE" },
        },
        include: {
          supplier: { select: { id: true } },
        },
        orderBy: [{ isPrimary: "desc" }, { lastVerifiedAt: "desc" }],
        take: 3,
      });
      if (candidateSuppliers.length > 0) {
        await prisma.offer.createMany({
          data: candidateSuppliers.map((candidate) => ({
            sourcingCaseId: sourcingCase.id,
            supplierId: candidate.supplierId,
            supplierProductId: candidate.id,
            productId: product.id,
            unitPrice: Number(candidate.priceMin || 0),
            currency: candidate.currency || "RMB",
            moq: candidate.moq || null,
            leadTimeDays: candidate.leadTimeDays || null,
            sampleAvailable: false,
            notes: "Pre-charge auto depuis catalogue fournisseur.",
            sourceType: "catalog",
            sourceId: candidate.id,
          })),
        });
      }
    }

    await prisma.quote.update({
      where: { id: quote.id },
      data: {
        pricingSnapshot: {
          ...snapshot,
          autoSourcing: {
            createdAt: new Date().toISOString(),
            paymentId: params.paymentId,
            caseIds: createdCaseIds,
          },
        } as Prisma.InputJsonValue,
      },
    });

    if (ORDER_STATUS_READY_FOR_SOURCING.has(order.status)) {
      await completePaymentConfirmationTasks(order.id);
      await OrderService.updateStatus(
        order.id,
        "SOURCING",
        order.ownerId || undefined,
        "Paiement confirme - creation automatique du sourcing profond"
      );
    }

    await AuditService.log({
      tenantId: order.tenantId,
      userId: order.ownerId || undefined,
      action: "sourcing.auto.created_from_indicatif_payment",
      entityType: "order",
      entityId: order.id,
      newValue: {
        paymentId: params.paymentId,
        quoteId: quote.id,
        createdCaseIds,
        createdProductIds,
        assignments,
      },
    });

    return { createdCaseIds, createdProductIds, skipped: null };
  }
}
