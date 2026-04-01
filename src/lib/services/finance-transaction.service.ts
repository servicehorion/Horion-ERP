import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type {
  FinanceTransaction,
  FinanceTransactionCategory,
  FinanceTransactionDirection,
  FinanceTransactionSourceType,
  FinanceTransactionStatus,
  FinanceWalletCode,
  PaymentDirection,
  PaymentStatus,
  PaymentType,
} from "@prisma/client";

type OrderMarginRow = {
  orderId: string;
  orderNumber: string;
  status: string;
  clientName: string;
  revenue: number;
  chinaPurchase: number;
  shippingFee: number;
  platformFee: number;
  insuranceFee: number;
  refund: number;
  netMargin: number;
  netMarginPercent: number;
};

export type InvoiceOpsRow = {
  orderId: string;
  orderNumber: string;
  clientName: string;
  invoiceNumber: string | null;
  invoiceStatus: string;
  billedAmount: number;
  collectedAmount: number;
  outstandingAmount: number;
  currency: string;
  lastCollectedAt: Date | null;
};

const CLIENT_PAYMENT_TYPES: PaymentType[] = ["CLIENT_DEPOSIT", "CLIENT_BALANCE"];
const SHIPPING_PAYMENT_TYPES: PaymentType[] = ["FREIGHT_PAYMENT", "CUSTOMS_DUTY"];
const PENDING_PAYMENT_STATUSES: PaymentStatus[] = ["PENDING", "PROCESSING", "PENDING_PROOF", "PROOF_UPLOADED"];

function toNumber(value: unknown) {
  return Number(value || 0);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function mapPaymentWalletCode(payment: {
  direction: PaymentDirection;
  type: PaymentType;
  methodKey: string | null;
  currency: string;
}): FinanceWalletCode {
  if (payment.direction === "INBOUND") {
    switch (payment.methodKey) {
      case "WIRE_TRANSFER":
        return "BANK_CONGO";
      case "CASH_DEPOSIT":
        return "CASH_DESK";
      default:
        return "PAWAPAY";
    }
  }

  if (payment.type === "SUPPLIER_PAYMENT") {
    return payment.currency === "CNY" ? "ALIPAY_CNY" : "PARTNER_PAYABLE";
  }

  if (SHIPPING_PAYMENT_TYPES.includes(payment.type) || payment.type === "QC_PAYMENT") {
    return "BANK_CONGO";
  }

  return payment.currency === "CNY" ? "ALIPAY_CNY" : "OPERATIONS";
}

function mapPaymentCategory(payment: {
  direction: PaymentDirection;
  type: PaymentType;
}): FinanceTransactionCategory {
  if (payment.direction === "INBOUND" && CLIENT_PAYMENT_TYPES.includes(payment.type)) {
    return "CLIENT_PAYMENT";
  }

  switch (payment.type) {
    case "SUPPLIER_PAYMENT":
      return "CHINA_PURCHASE";
    case "FREIGHT_PAYMENT":
    case "CUSTOMS_DUTY":
      return "SHIPPING_FEE";
    case "QC_PAYMENT":
      return "PARTNER_PAYMENT";
    case "COMMISSION":
      return "PLATFORM_FEE";
    case "REFUND":
      return "CLIENT_REFUND";
    default:
      return "MANUAL_ADJUSTMENT";
  }
}

function mapPaymentStatus(payment: {
  direction: PaymentDirection;
  type: PaymentType;
  status: PaymentStatus;
}): FinanceTransactionStatus {
  if (payment.status === "CONFIRMED" || payment.status === "REFUNDED") {
    return "COMPLETED";
  }

  if (
    payment.direction === "OUTBOUND" &&
    (payment.type === "SUPPLIER_PAYMENT" || SHIPPING_PAYMENT_TYPES.includes(payment.type) || payment.type === "QC_PAYMENT") &&
    PENDING_PAYMENT_STATUSES.includes(payment.status)
  ) {
    return "PENDING_APPROVAL";
  }

  return "CANCELLED";
}

function mapTreasuryWalletCode(label: string, currency: string): FinanceWalletCode {
  const normalized = `${label} ${currency}`.toUpperCase();
  if (normalized.includes("PAWAPAY") || normalized.includes("MOMO")) return "PAWAPAY";
  if (normalized.includes("ALIPAY") || currency === "CNY") return "ALIPAY_CNY";
  if (normalized.includes("CASH")) return "CASH_DESK";
  if (normalized.includes("USD")) return "USD_SETTLEMENT";
  if (normalized.includes("PARTNER")) return "PARTNER_PAYABLE";
  return "BANK_CONGO";
}

function mapTreasuryCategory(type: string): FinanceTransactionCategory {
  switch (type) {
    case "TOP_UP":
      return "FX_TOPUP";
    case "ORDER_DEBIT":
      return "CHINA_PURCHASE";
    case "FX_LOSS":
      return "FX_LOSS";
    default:
      return "MANUAL_ADJUSTMENT";
  }
}

function mapBankWalletCode(provider: string, accountName: string | null, currency: string): FinanceWalletCode {
  const normalized = `${provider} ${accountName || ""} ${currency}`.toUpperCase();
  if (normalized.includes("USD")) return "USD_SETTLEMENT";
  if (normalized.includes("CASH")) return "CASH_DESK";
  return "BANK_CONGO";
}

type ProjectionInput = {
  tenantId: string;
  orderId?: string | null;
  externalRef: string;
  walletCode: FinanceWalletCode;
  sourceType: FinanceTransactionSourceType;
  sourceId?: string | null;
  direction: FinanceTransactionDirection;
  category: FinanceTransactionCategory;
  amountLocal: number;
  currency: string;
  exchangeRate?: number | null;
  amountXAF: number;
  status: FinanceTransactionStatus;
  createdById?: string | null;
  approvedById?: string | null;
  reference?: string | null;
  notes?: string | null;
  completedAt?: Date | null;
  metadata?: Prisma.InputJsonValue;
};

const globalForFinanceSync = globalThis as unknown as {
  financeSyncInFlight?: Map<string, Promise<{ projected: number; skipped?: boolean }>>;
  financeSyncLastAt?: Map<string, number>;
};

function getFinanceSyncInFlight() {
  if (!globalForFinanceSync.financeSyncInFlight) {
    globalForFinanceSync.financeSyncInFlight = new Map();
  }
  return globalForFinanceSync.financeSyncInFlight;
}

function getFinanceSyncLastAt() {
  if (!globalForFinanceSync.financeSyncLastAt) {
    globalForFinanceSync.financeSyncLastAt = new Map();
  }
  return globalForFinanceSync.financeSyncLastAt;
}

function getFinanceSyncTtlMs() {
  return Number(process.env.FINANCE_SYNC_TTL_MS ?? (process.env.NODE_ENV === "production" ? "60000" : "15000"));
}

export class FinanceTransactionService {
  private static async upsertProjection(input: ProjectionInput) {
    return prisma.financeTransaction.upsert({
      where: { externalRef: input.externalRef },
      create: {
        tenantId: input.tenantId,
        orderId: input.orderId || undefined,
        externalRef: input.externalRef,
        walletCode: input.walletCode,
        sourceType: input.sourceType,
        sourceId: input.sourceId || undefined,
        direction: input.direction,
        category: input.category,
        amountLocal: input.amountLocal,
        currency: input.currency,
        exchangeRate: input.exchangeRate ?? undefined,
        amountXAF: input.amountXAF,
        status: input.status,
        createdById: input.createdById || undefined,
        approvedById: input.approvedById || undefined,
        reference: input.reference || undefined,
        notes: input.notes || undefined,
        completedAt: input.completedAt || undefined,
        metadata: input.metadata || {},
      },
      update: {
        orderId: input.orderId || undefined,
        walletCode: input.walletCode,
        sourceType: input.sourceType,
        sourceId: input.sourceId || undefined,
        direction: input.direction,
        category: input.category,
        amountLocal: input.amountLocal,
        currency: input.currency,
        exchangeRate: input.exchangeRate ?? undefined,
        amountXAF: input.amountXAF,
        status: input.status,
        approvedById: input.approvedById || undefined,
        reference: input.reference || undefined,
        notes: input.notes || undefined,
        completedAt: input.completedAt || undefined,
        metadata: input.metadata || {},
      },
    });
  }

  static async syncOrder(tenantId: string, orderId: string) {
    const [payments, treasuryTransactions] = await Promise.all([
      prisma.payment.findMany({
        where: {
          orderId,
          order: { tenantId },
        },
        select: {
          id: true,
          orderId: true,
          direction: true,
          type: true,
          status: true,
          amount: true,
          currency: true,
          amountXAF: true,
          fxRate: true,
          methodKey: true,
          reference: true,
          notes: true,
          createdAt: true,
          confirmedAt: true,
          paidAt: true,
        },
      }),
      prisma.treasuryTransaction.findMany({
        where: {
          orderId,
          account: { tenantId },
        },
        include: {
          account: {
            select: { id: true, label: true, currency: true },
          },
        },
      }),
    ]);

    let projected = 0;

    for (const payment of payments) {
      const status = mapPaymentStatus(payment);
      if (status === "CANCELLED" && !["FAILED", "CANCELLED", "EXPIRED", "REFUNDED"].includes(payment.status)) {
        continue;
      }

      await this.upsertProjection({
        tenantId,
        orderId: payment.orderId,
        externalRef: `PAYMENT:${payment.id}`,
        walletCode: mapPaymentWalletCode(payment),
        sourceType: "PAYMENT",
        sourceId: payment.id,
        direction: payment.direction === "INBOUND" ? "IN" : "OUT",
        category: mapPaymentCategory(payment),
        amountLocal: toNumber(payment.amount),
        currency: payment.currency,
        exchangeRate: payment.fxRate == null ? null : toNumber(payment.fxRate),
        amountXAF: toNumber(payment.amountXAF),
        status,
        reference: payment.reference || null,
        notes: payment.notes || null,
        completedAt: payment.confirmedAt || payment.paidAt || null,
        metadata: {
          paymentStatus: payment.status,
          paymentType: payment.type,
          methodKey: payment.methodKey,
        } as Prisma.InputJsonValue,
      });
      projected++;
    }

    for (const transaction of treasuryTransactions) {
      const amountXAF =
        transaction.account.currency === "XAF"
          ? toNumber(transaction.amount)
          : roundMoney(toNumber(transaction.amount) * toNumber(transaction.fxRate));

      await this.upsertProjection({
        tenantId,
        orderId: transaction.orderId || null,
        externalRef: `TREASURY:${transaction.id}`,
        walletCode: mapTreasuryWalletCode(transaction.account.label, transaction.account.currency),
        sourceType: "TREASURY",
        sourceId: transaction.id,
        direction: transaction.type === "TOP_UP" ? "IN" : "OUT",
        category: mapTreasuryCategory(transaction.type),
        amountLocal: toNumber(transaction.amount),
        currency: transaction.account.currency,
        exchangeRate: transaction.fxRate == null ? null : toNumber(transaction.fxRate),
        amountXAF,
        status: "COMPLETED",
        reference: transaction.reference || null,
        completedAt: transaction.createdAt,
        metadata: {
          treasuryType: transaction.type,
          reconciliationStatus: transaction.status,
          accountId: transaction.accountId,
        } as Prisma.InputJsonValue,
      });
      projected++;
    }

    return { projected };
  }

  static async syncTenant(tenantId: string, options: { force?: boolean } = {}) {
    const inFlight = getFinanceSyncInFlight();
    const lastAtMap = getFinanceSyncLastAt();
    const ttlMs = getFinanceSyncTtlMs();
    const now = Date.now();
    const lastAt = lastAtMap.get(tenantId) ?? 0;

    if (!options.force && lastAt > 0 && now - lastAt < ttlMs) {
      return { projected: 0, skipped: true };
    }

    const running = inFlight.get(tenantId);
    if (running) return running;

    const job = (async () => {
      const payments = await prisma.payment.findMany({
        where: { order: { tenantId } },
        select: {
          id: true,
          orderId: true,
          direction: true,
          type: true,
          status: true,
          amount: true,
          currency: true,
          amountXAF: true,
          fxRate: true,
          methodKey: true,
          reference: true,
          notes: true,
          createdAt: true,
          confirmedAt: true,
          paidAt: true,
        },
      });

      const treasuryTransactions = await prisma.treasuryTransaction.findMany({
        where: { account: { tenantId } },
        include: {
          account: {
            select: { id: true, label: true, currency: true },
          },
        },
      });

      const bankTransactions = await prisma.bankTransaction.findMany({
        where: { connection: { tenantId } },
        include: {
          connection: {
            select: { provider: true, accountName: true, currency: true },
          },
        },
      });

      let projected = 0;

      for (const payment of payments) {
        const status = mapPaymentStatus(payment);
        if (status === "CANCELLED" && !["FAILED", "CANCELLED", "EXPIRED", "REFUNDED"].includes(payment.status)) {
          continue;
        }

        await this.upsertProjection({
          tenantId,
          orderId: payment.orderId,
          externalRef: `PAYMENT:${payment.id}`,
          walletCode: mapPaymentWalletCode(payment),
          sourceType: "PAYMENT",
          sourceId: payment.id,
          direction: payment.direction === "INBOUND" ? "IN" : "OUT",
          category: mapPaymentCategory(payment),
          amountLocal: toNumber(payment.amount),
          currency: payment.currency,
          exchangeRate: payment.fxRate == null ? null : toNumber(payment.fxRate),
          amountXAF: toNumber(payment.amountXAF),
          status,
          reference: payment.reference || null,
          notes: payment.notes || null,
          completedAt: payment.confirmedAt || payment.paidAt || null,
          metadata: {
            paymentStatus: payment.status,
            paymentType: payment.type,
            methodKey: payment.methodKey,
          } as Prisma.InputJsonValue,
        });
        projected++;
      }

      for (const transaction of treasuryTransactions) {
        const amountXAF =
          transaction.account.currency === "XAF"
            ? toNumber(transaction.amount)
            : roundMoney(toNumber(transaction.amount) * toNumber(transaction.fxRate));

        await this.upsertProjection({
          tenantId,
          orderId: transaction.orderId || null,
          externalRef: `TREASURY:${transaction.id}`,
          walletCode: mapTreasuryWalletCode(transaction.account.label, transaction.account.currency),
          sourceType: "TREASURY",
          sourceId: transaction.id,
          direction: transaction.type === "TOP_UP" ? "IN" : "OUT",
          category: mapTreasuryCategory(transaction.type),
          amountLocal: toNumber(transaction.amount),
          currency: transaction.account.currency,
          exchangeRate: transaction.fxRate == null ? null : toNumber(transaction.fxRate),
          amountXAF,
          status: "COMPLETED",
          reference: transaction.reference || null,
          completedAt: transaction.createdAt,
          metadata: {
            treasuryType: transaction.type,
            reconciliationStatus: transaction.status,
            accountId: transaction.accountId,
          } as Prisma.InputJsonValue,
        });
        projected++;
      }

      for (const transaction of bankTransactions) {
        await this.upsertProjection({
          tenantId,
          orderId: null,
          externalRef: `BANK:${transaction.id}`,
          walletCode: mapBankWalletCode(
            transaction.connection.provider,
            transaction.connection.accountName,
            transaction.currency || transaction.connection.currency,
          ),
          sourceType: "BANK",
          sourceId: transaction.id,
          direction: String(transaction.direction).toUpperCase().startsWith("OUT") ? "OUT" : "IN",
          category: "BANK_SETTLEMENT",
          amountLocal: toNumber(transaction.amount),
          currency: transaction.currency || transaction.connection.currency,
          amountXAF: toNumber(transaction.amount),
          status: transaction.status === "RECONCILED" ? "COMPLETED" : "PENDING_APPROVAL",
          reference: transaction.reference || null,
          notes: transaction.description || null,
          completedAt: transaction.status === "RECONCILED" ? transaction.occurredAt : null,
          metadata: {
            bankStatus: transaction.status,
            matchedPaymentId: transaction.matchedPaymentId,
            provider: transaction.connection.provider,
            matchScore: transaction.matchScore == null ? null : toNumber(transaction.matchScore),
          } as Prisma.InputJsonValue,
        });
        projected++;
      }

      lastAtMap.set(tenantId, Date.now());
      return { projected };
    })().finally(() => {
      inFlight.delete(tenantId);
    });

    inFlight.set(tenantId, job);
    return job;
  }

  static async getPendingApprovals(tenantId: string) {
    await this.syncTenant(tenantId);
    return prisma.financeTransaction.findMany({
      where: {
        tenantId,
        status: "PENDING_APPROVAL",
        direction: "OUT",
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  static async getRecentTransactions(
    tenantId: string,
    options: {
      limit?: number;
      sourceType?: FinanceTransactionSourceType;
      direction?: FinanceTransactionDirection;
      categories?: FinanceTransactionCategory[];
      skipSync?: boolean;
    } = {},
  ) {
    if (!options.skipSync) {
      await this.syncTenant(tenantId);
    }
    return prisma.financeTransaction.findMany({
      where: {
        tenantId,
        ...(options.sourceType ? { sourceType: options.sourceType } : {}),
        ...(options.direction ? { direction: options.direction } : {}),
        ...(options.categories?.length ? { category: { in: options.categories } } : {}),
      },
      orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
      take: options.limit ?? 100,
    });
  }

  static async getBankLedger(tenantId: string) {
    await this.syncTenant(tenantId);
    return prisma.financeTransaction.findMany({
      where: {
        tenantId,
        OR: [{ sourceType: "BANK" }, { walletCode: "BANK_CONGO" }],
      },
      orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
      take: 200,
    });
  }

  static async getInvoiceRows(tenantId: string): Promise<InvoiceOpsRow[]> {
    await this.syncTenant(tenantId);

    const [transactions, orders, invoices] = await Promise.all([
      prisma.financeTransaction.findMany({
        where: {
          tenantId,
          orderId: { not: null },
          status: "COMPLETED",
          category: { in: ["CLIENT_PAYMENT", "CLIENT_REFUND"] },
        },
        select: {
          orderId: true,
          category: true,
          amountXAF: true,
          completedAt: true,
        },
      }),
      prisma.order.findMany({
        where: { tenantId },
        select: {
          id: true,
          orderNumber: true,
          contact: { select: { name: true } },
        },
      }),
      prisma.invoice.findMany({
        where: { tenantId },
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          orderId: true,
          invoiceNumber: true,
          status: true,
          total: true,
          currency: true,
          createdAt: true,
        },
      }),
    ]);

    const orderMap = new Map(
      orders.map((order) => [order.id, { orderNumber: order.orderNumber, clientName: order.contact?.name || "-" }]),
    );
    const latestInvoiceByOrder = new Map<string, (typeof invoices)[number]>();
    for (const invoice of invoices) {
      if (invoice.orderId && !latestInvoiceByOrder.has(invoice.orderId)) {
        latestInvoiceByOrder.set(invoice.orderId, invoice);
      }
    }

    const byOrder = new Map<string, InvoiceOpsRow>();
    for (const tx of transactions) {
      if (!tx.orderId || !orderMap.has(tx.orderId)) continue;

      const invoice = latestInvoiceByOrder.get(tx.orderId);
      const existing =
        byOrder.get(tx.orderId) ||
        {
          orderId: tx.orderId,
          orderNumber: orderMap.get(tx.orderId)!.orderNumber,
          clientName: orderMap.get(tx.orderId)!.clientName,
          invoiceNumber: invoice?.invoiceNumber || null,
          invoiceStatus: invoice?.status || "NO_INVOICE",
          billedAmount: invoice ? toNumber(invoice.total) : 0,
          collectedAmount: 0,
          outstandingAmount: 0,
          currency: invoice?.currency || "XAF",
          lastCollectedAt: null,
        };

      if (tx.category === "CLIENT_PAYMENT") {
        existing.collectedAmount += toNumber(tx.amountXAF);
        if (!existing.lastCollectedAt || (tx.completedAt && tx.completedAt > existing.lastCollectedAt)) {
          existing.lastCollectedAt = tx.completedAt;
        }
      }
      if (tx.category === "CLIENT_REFUND") {
        existing.collectedAmount -= toNumber(tx.amountXAF);
      }

      byOrder.set(tx.orderId, existing);
    }

    return [...byOrder.values()]
      .map((row) => ({
        ...row,
        outstandingAmount: Math.max(0, roundMoney(row.billedAmount - row.collectedAmount)),
      }))
      .sort((a, b) => b.collectedAmount - a.collectedAmount);
  }

  static async getMarginByOrder(tenantId: string): Promise<OrderMarginRow[]> {
    await this.syncTenant(tenantId);

    const transactions = await prisma.financeTransaction.findMany({
      where: {
        tenantId,
        orderId: { not: null },
        status: "COMPLETED",
      },
      select: {
        orderId: true,
        category: true,
        amountXAF: true,
      },
    });

    const orderIds = [...new Set(transactions.map((tx) => tx.orderId).filter(Boolean) as string[])];
    if (orderIds.length === 0) return [];

    const orders = await prisma.order.findMany({
      where: { tenantId, id: { in: orderIds } },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        contact: { select: { name: true } },
      },
    });

    const orderMap = new Map(
      orders.map((order) => [
        order.id,
        {
          orderNumber: order.orderNumber,
          status: order.status,
          clientName: order.contact?.name || "-",
        },
      ]),
    );

    const byOrder = new Map<string, OrderMarginRow>();
    for (const tx of transactions) {
      if (!tx.orderId || !orderMap.has(tx.orderId)) continue;
      const existing =
        byOrder.get(tx.orderId) ||
        {
          orderId: tx.orderId,
          orderNumber: orderMap.get(tx.orderId)!.orderNumber,
          status: orderMap.get(tx.orderId)!.status,
          clientName: orderMap.get(tx.orderId)!.clientName,
          revenue: 0,
          chinaPurchase: 0,
          shippingFee: 0,
          platformFee: 0,
          insuranceFee: 0,
          refund: 0,
          netMargin: 0,
          netMarginPercent: 0,
        };

      const amount = toNumber(tx.amountXAF);
      switch (tx.category) {
        case "CLIENT_PAYMENT":
          existing.revenue += amount;
          break;
        case "CHINA_PURCHASE":
          existing.chinaPurchase += amount;
          break;
        case "SHIPPING_FEE":
        case "PARTNER_PAYMENT":
          existing.shippingFee += amount;
          break;
        case "PLATFORM_FEE":
          existing.platformFee += amount;
          break;
        case "INSURANCE_FEE":
          existing.insuranceFee += amount;
          break;
        case "CLIENT_REFUND":
          existing.refund += amount;
          break;
        default:
          break;
      }

      byOrder.set(tx.orderId, existing);
    }

    return [...byOrder.values()]
      .map((row) => {
        const netMargin = row.revenue - row.chinaPurchase - row.shippingFee - row.platformFee - row.refund + row.insuranceFee;
        const netMarginPercent = row.revenue > 0 ? (netMargin / row.revenue) * 100 : 0;
        return {
          ...row,
          netMargin: roundMoney(netMargin),
          netMarginPercent,
        };
      })
      .sort((a, b) => b.netMargin - a.netMargin);
  }

  static async createRectification(params: {
    tenantId: string;
    transactionId: string;
    createdById?: string | null;
    reason: string;
    reference?: string | null;
  }) {
    const original = await prisma.financeTransaction.findFirst({
      where: { id: params.transactionId, tenantId: params.tenantId },
    });

    if (!original) {
      throw new Error("Transaction finance introuvable");
    }

    if (original.status !== "COMPLETED") {
      throw new Error("Seules les transactions completes peuvent etre rectifiees");
    }

    const existingRectification = await prisma.financeTransaction.findFirst({
      where: {
        tenantId: params.tenantId,
        reversalOfTransactionId: original.id,
      },
      select: { id: true },
    });

    if (existingRectification) {
      throw new Error("Une transaction de rectification existe deja pour cette ecriture");
    }

    return prisma.financeTransaction.create({
      data: {
        tenantId: params.tenantId,
        orderId: original.orderId || undefined,
        externalRef: `RECTIFY:${original.id}:${Date.now()}`,
        walletCode: original.walletCode,
        sourceType: "MANUAL",
        sourceId: original.id,
        direction: original.direction === "IN" ? "OUT" : "IN",
        category: original.category,
        amountLocal: original.amountLocal,
        currency: original.currency,
        exchangeRate: original.exchangeRate || undefined,
        amountXAF: original.amountXAF,
        status: "COMPLETED",
        createdById: params.createdById || undefined,
        approvedById: params.createdById || undefined,
        reference: params.reference || original.reference || undefined,
        notes: params.reason,
        completedAt: new Date(),
        reversalOfTransactionId: original.id,
        metadata: {
          rectificationOf: original.externalRef,
          reason: params.reason,
        } as Prisma.InputJsonValue,
      },
    });
  }
}
