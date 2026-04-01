import { prisma } from "@/lib/db";
import { OrderStatus } from "@prisma/client";

import { FinanceTransactionService } from "@/lib/services/finance-transaction.service";

type WalletSnapshot = {
  id: string;
  label: string;
  currency: string;
  balance: number;
  balanceXAF: number;
  belowThreshold: boolean;
};

export type UnifiedFinanceTransaction = {
  id: string;
  source: string;
  orderId: string | null;
  walletId: string;
  walletLabel: string;
  direction: "IN" | "OUT";
  category: string;
  amountLocal: number;
  currency: string;
  exchangeRate: number | null;
  amountXAF: number | null;
  status: string;
  reference: string | null;
  note: string | null;
  occurredAt: Date;
};

type OperationsSnapshot = {
  wallets: WalletSnapshot[];
  operationalPnl: {
    grossRevenue: number;
    chinaPurchases: number;
    shippingFees: number;
    platformFees: number;
    insuranceRevenue: number;
    refunds: number;
    netMargin: number;
    netMarginPercent: number;
  };
  cash: {
    lockedCash: number;
    operatingCash: number;
    chinaCash: number;
    netCashPosition: number;
  };
  cashReality: {
    confirmedCashXAF: number;
    pendingCashXAF: number;
    atRiskCashXAF: number;
    expectedTotalCashXAF: number;
  };
  balance: {
    assetsCash: number;
    liabilitiesCustomerOrders: number;
    liabilitiesPartnerPayables: number;
    liabilitiesTotal: number;
    simplifiedEquity: number;
  };
  approvals: {
    pendingCount: number;
    pendingCashOutXAF: number;
  };
  recentTransactions: UnifiedFinanceTransaction[];
};

const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  "DEMANDE",
  "RECHERCHE_PRODUIT",
  "DEVIS",
  "PAIEMENT_EN_COURS",
  "SOURCING",
  "EN_PRODUCTION",
  "RECU_ENTREPOT",
  "QC_EN_COURS",
  "QC_VALIDE",
  "EN_TRANSIT",
  "DEDOUANE",
  "LIVRE",
  "LITIGE",
];

function toNumber(value: unknown): number {
  return Number(value || 0);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export class FinanceOperationsService {
  private static async getFxRatesToXaf() {
    const rates = await prisma.fXRate.findMany({
      where: { toCurrency: "XAF" },
      orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
      take: 100,
    });

    const map = new Map<string, number>();
    for (const rate of rates) {
      if (!map.has(rate.fromCurrency)) {
        map.set(rate.fromCurrency, Number(rate.rate));
      }
    }
    map.set("XAF", 1);
    return map;
  }

  private static convertToXaf(amount: number, currency: string, fxRates: Map<string, number>) {
    if (currency === "XAF") return amount;
    const rate = fxRates.get(currency);
    return rate ? amount * rate : 0;
  }

  static async listUnifiedTransactions(tenantId: string, limit = 40): Promise<UnifiedFinanceTransaction[]> {
    const transactions = await FinanceTransactionService.getRecentTransactions(tenantId, { limit, skipSync: true });

    return transactions.map((transaction) => ({
      id: transaction.id,
      source: transaction.sourceType,
      orderId: transaction.orderId,
      walletId: transaction.walletCode,
      walletLabel: transaction.walletCode,
      direction: transaction.direction,
      category: transaction.category,
      amountLocal: Number(transaction.amountLocal),
      currency: transaction.currency,
      exchangeRate: transaction.exchangeRate == null ? null : Number(transaction.exchangeRate),
      amountXAF: Number(transaction.amountXAF),
      status: transaction.status,
      reference: transaction.reference || null,
      note: transaction.notes || null,
      occurredAt: transaction.completedAt || transaction.createdAt,
    }));
  }

  static async getOperationsSnapshot(tenantId: string): Promise<OperationsSnapshot> {
    await FinanceTransactionService.syncTenant(tenantId);

    // Keep the finance home snapshot intentionally low-concurrency.
    // This page tends to load alongside the global layout and nav badge queries,
    // so blasting 6 parallel DB reads can starve the connection pool in dev and
    // on smaller pooled environments.
    const fxRates = await this.getFxRatesToXaf();
    const treasuryAccounts = await prisma.treasuryAccount.findMany({
      where: { tenantId },
      orderBy: [{ currency: "asc" }, { label: "asc" }],
    });
    const recentTransactions = await this.listUnifiedTransactions(tenantId, 18);
    const completedTransactions = await prisma.financeTransaction.findMany({
      where: { tenantId, status: "COMPLETED" },
      select: {
        orderId: true,
        category: true,
        amountXAF: true,
        walletCode: true,
      },
    });
    const pendingApprovals = await prisma.financeTransaction.findMany({
      where: {
        tenantId,
        status: "PENDING_APPROVAL",
        direction: "OUT",
      },
      select: { amountXAF: true },
    });
    const activeOrders = await prisma.order.findMany({
      where: {
        tenantId,
        status: { in: ACTIVE_ORDER_STATUSES },
      },
      select: {
        id: true,
        status: true,
        payments: {
          where: {
            direction: "INBOUND",
            status: "CONFIRMED",
            type: { in: ["CLIENT_DEPOSIT", "CLIENT_BALANCE"] },
          },
          select: { amountXAF: true },
        },
      },
    });

    const wallets = treasuryAccounts.map((account) => {
      const balance = toNumber(account.balance);
      const balanceXAF = roundMoney(this.convertToXaf(balance, account.currency, fxRates));
      return {
        id: account.id,
        label: account.label,
        currency: account.currency,
        balance,
        balanceXAF,
        belowThreshold:
          account.alertBelowAmount != null &&
          balance < toNumber(account.alertBelowAmount),
      };
    });

    const grossRevenue = completedTransactions
      .filter((transaction) => transaction.category === "CLIENT_PAYMENT")
      .reduce((sum, transaction) => sum + toNumber(transaction.amountXAF), 0);

    const chinaPurchases = completedTransactions
      .filter((transaction) => transaction.category === "CHINA_PURCHASE")
      .reduce((sum, transaction) => sum + toNumber(transaction.amountXAF), 0);

    const shippingFees = completedTransactions
      .filter((transaction) => ["SHIPPING_FEE", "PARTNER_PAYMENT"].includes(transaction.category))
      .reduce((sum, transaction) => sum + toNumber(transaction.amountXAF), 0);

    const platformFees = completedTransactions
      .filter((transaction) => transaction.category === "PLATFORM_FEE")
      .reduce((sum, transaction) => sum + toNumber(transaction.amountXAF), 0);

    const refunds = completedTransactions
      .filter((transaction) => transaction.category === "CLIENT_REFUND")
      .reduce((sum, transaction) => sum + toNumber(transaction.amountXAF), 0);

    const insuranceRevenue = completedTransactions
      .filter((transaction) => transaction.category === "INSURANCE_FEE")
      .reduce((sum, transaction) => sum + toNumber(transaction.amountXAF), 0);

    const netMargin = grossRevenue - chinaPurchases - shippingFees - platformFees - refunds + insuranceRevenue;
    const netMarginPercent = grossRevenue > 0 ? (netMargin / grossRevenue) * 100 : 0;

    const lockedCash = completedTransactions
      .filter((transaction) => transaction.category === "CLIENT_PAYMENT" && transaction.walletCode === "PAWAPAY")
      .reduce((sum, transaction) => sum + toNumber(transaction.amountXAF), 0);

    const operatingCash = wallets
      .filter((wallet) => wallet.currency === "XAF")
      .reduce((sum, wallet) => sum + wallet.balanceXAF, 0);

    const chinaCash = wallets
      .filter((wallet) => wallet.currency === "CNY")
      .reduce((sum, wallet) => sum + wallet.balanceXAF, 0);

    const netCashPosition = wallets.reduce((sum, wallet) => sum + wallet.balanceXAF, 0);

    const liabilitiesCustomerOrders = activeOrders.reduce(
      (sum, order) => sum + order.payments.reduce((paymentSum, payment) => paymentSum + toNumber(payment.amountXAF), 0),
      0,
    );
    const liabilitiesPartnerPayables = pendingApprovals.reduce((sum, tx) => sum + toNumber(tx.amountXAF), 0);
    const liabilitiesTotal = liabilitiesCustomerOrders + liabilitiesPartnerPayables;
    const assetsCash = netCashPosition;
    const simplifiedEquity = assetsCash - liabilitiesTotal;

    // ── Cash reality breakdown ────────────────────────────────────────────────
    // Separate confirmed / pending / at-risk so the dashboard can show the
    // distinction between money we *have* and money we *expect* (or may lose).
    const allPaymentsIn = await prisma.payment.findMany({
      where: {
        order: { tenantId },
        direction: "INBOUND",
      },
      select: {
        status: true,
        amountXAF: true,
        orderId: true,
      },
    });

    // Join order status separately to avoid deep nested select type issues
    const atRiskOrderIds = new Set(
      activeOrders
        .filter((o) => o.status === "LITIGE")
        .map((o) => o.id)
    );

    const confirmedCashXAF = allPaymentsIn
      .filter((p) => p.status === "CONFIRMED")
      .reduce((s, p) => s + toNumber(p.amountXAF), 0);

    const pendingCashXAF = allPaymentsIn
      .filter((p) => ["PROOF_UPLOADED", "PROCESSING"].includes(p.status))
      .reduce((s, p) => s + toNumber(p.amountXAF), 0);

    const atRiskCashXAF = allPaymentsIn
      .filter(
        (p) =>
          (atRiskOrderIds.has(p.orderId) && p.status !== "CONFIRMED") ||
          p.status === "EXPIRED" ||
          p.status === "FAILED"
      )
      .reduce((s, p) => s + toNumber(p.amountXAF), 0);

    const expectedTotalCashXAF = confirmedCashXAF + pendingCashXAF;

    return {
      wallets,
      operationalPnl: {
        grossRevenue: roundMoney(grossRevenue),
        chinaPurchases: roundMoney(chinaPurchases),
        shippingFees: roundMoney(shippingFees),
        platformFees: roundMoney(platformFees),
        insuranceRevenue: roundMoney(insuranceRevenue),
        refunds: roundMoney(refunds),
        netMargin: roundMoney(netMargin),
        netMarginPercent,
      },
      cash: {
        lockedCash: roundMoney(lockedCash),
        operatingCash: roundMoney(operatingCash),
        chinaCash: roundMoney(chinaCash),
        netCashPosition: roundMoney(netCashPosition),
      },
      balance: {
        assetsCash: roundMoney(assetsCash),
        liabilitiesCustomerOrders: roundMoney(liabilitiesCustomerOrders),
        liabilitiesPartnerPayables: roundMoney(liabilitiesPartnerPayables),
        liabilitiesTotal: roundMoney(liabilitiesTotal),
        simplifiedEquity: roundMoney(simplifiedEquity),
      },
      approvals: {
        pendingCount: pendingApprovals.length,
        pendingCashOutXAF: roundMoney(liabilitiesPartnerPayables),
      },
      cashReality: {
        confirmedCashXAF: roundMoney(confirmedCashXAF),
        pendingCashXAF: roundMoney(pendingCashXAF),
        atRiskCashXAF: roundMoney(atRiskCashXAF),
        expectedTotalCashXAF: roundMoney(expectedTotalCashXAF),
      },
      recentTransactions,
    };
  }
}
