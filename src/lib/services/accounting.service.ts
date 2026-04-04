import { prisma } from "@/lib/db";
import { LedgerService } from "@/lib/services/ledger.service";
import type { JournalType, LedgerLineType, Payment, PaymentDirection, PaymentType } from "@prisma/client";

const BALANCE_TOLERANCE = 0.01;

function sumLines(lines: { type: LedgerLineType; amount: number }[]) {
  return lines.reduce(
    (acc, line) => {
      if (line.type === "DEBIT") acc.debit += line.amount;
      else acc.credit += line.amount;
      return acc;
    },
    { debit: 0, credit: 0 }
  );
}

function isBalanced(lines: { type: LedgerLineType; amount: number }[]) {
  const { debit, credit } = sumLines(lines);
  return Math.abs(debit - credit) <= BALANCE_TOLERANCE;
}

export class AccountingService {
  private static async assertPeriodOpen(params: {
    tenantId: string;
    periodId?: string | null;
    date?: Date;
  }) {
    if (params.periodId) {
      const period = await prisma.accountingPeriod.findUnique({
        where: { id: params.periodId },
      });
      if (!period || period.tenantId !== params.tenantId) {
        throw new Error("Periode comptable introuvable");
      }
      if (period.status === "CLOSED") {
        throw new Error(`Periode comptable verrouillee: ${period.name}`);
      }
      return;
    }

    const at = params.date || new Date();
    const closedPeriod = await prisma.accountingPeriod.findFirst({
      where: {
        tenantId: params.tenantId,
        status: "CLOSED",
        startAt: { lte: at },
        endAt: { gte: at },
      },
      select: { id: true, name: true },
    });

    if (closedPeriod) {
      throw new Error(`La periode ${closedPeriod.name} est cloturee`);
    }
  }

  static async listPeriods(tenantId: string) {
    return prisma.accountingPeriod.findMany({
      where: { tenantId },
      orderBy: { startAt: "desc" },
    });
  }

  static async createPeriod(params: {
    tenantId: string;
    name: string;
    startAt: Date;
    endAt: Date;
  }) {
    return prisma.accountingPeriod.create({
      data: {
        tenantId: params.tenantId,
        name: params.name,
        startAt: params.startAt,
        endAt: params.endAt,
      },
    });
  }

  static async closePeriod(params: { tenantId: string; periodId: string; userId: string }) {
    const period = await prisma.accountingPeriod.findUnique({ where: { id: params.periodId } });
    if (!period || period.tenantId !== params.tenantId) {
      throw new Error("Periode introuvable");
    }
    if (period.status === "CLOSED") return period;

    const draftEntries = await prisma.journalEntry.count({
      where: {
        tenantId: params.tenantId,
        periodId: period.id,
        status: "DRAFT",
      },
    });
    if (draftEntries > 0) {
      throw new Error("Impossible de cloturer: des ecritures brouillon existent sur la periode");
    }

    return prisma.accountingPeriod.update({
      where: { id: params.periodId },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closedById: params.userId,
      },
    });
  }

  static async listJournals(tenantId: string) {
    return prisma.journal.findMany({
      where: { tenantId },
      orderBy: { code: "asc" },
    });
  }

  static async getOrCreateJournal(params: {
    tenantId: string;
    code: string;
    name: string;
    type?: JournalType;
  }) {
    return prisma.journal.upsert({
      where: { tenantId_code: { tenantId: params.tenantId, code: params.code } },
      update: {},
      create: {
        tenantId: params.tenantId,
        code: params.code,
        name: params.name,
        type: params.type || "GENERAL",
      },
    });
  }

  static async createJournal(params: {
    tenantId: string;
    code: string;
    name: string;
    type: JournalType;
  }) {
    return prisma.journal.create({
      data: {
        tenantId: params.tenantId,
        code: params.code,
        name: params.name,
        type: params.type,
      },
    });
  }

  static async listJournalEntries(tenantId: string, limit = 50) {
    return prisma.journalEntry.findMany({
      where: { tenantId },
      include: {
        journal: true,
        lines: { include: { account: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  static async createJournalEntry(params: {
    tenantId: string;
    journalId: string;
    periodId?: string | null;
    reference?: string | null;
    memo?: string | null;
    status?: "DRAFT" | "POSTED";
    lines: Array<{
      accountId: string;
      type: LedgerLineType;
      amount: number;
      currency: string;
      description?: string | null;
      orderId?: string | null;
      paymentId?: string | null;
      invoiceId?: string | null;
    }>;
  }) {
    if (!params.lines || params.lines.length < 2) {
      throw new Error("Au moins deux lignes sont requises");
    }

    await this.assertPeriodOpen({
      tenantId: params.tenantId,
      periodId: params.periodId,
      date: new Date(),
    });

    if (params.status === "POSTED" && !isBalanced(params.lines)) {
      throw new Error("Ecriture desequilibree");
    }

    const shouldPost = params.status === "POSTED";
    const entry = await prisma.journalEntry.create({
      data: {
        tenantId: params.tenantId,
        journalId: params.journalId,
        periodId: params.periodId || undefined,
        reference: params.reference || undefined,
        memo: params.memo || undefined,
        status: shouldPost ? "DRAFT" : params.status || "DRAFT",
        postedAt: shouldPost ? undefined : params.status === "POSTED" ? new Date() : undefined,
        lines: {
          create: params.lines.map((line) => ({
            accountId: line.accountId,
            type: line.type,
            amount: line.amount,
            currency: line.currency,
            description: line.description || undefined,
            orderId: line.orderId || undefined,
            paymentId: line.paymentId || undefined,
            invoiceId: line.invoiceId || undefined,
          })),
        },
      },
      include: { lines: true },
    });

    if (shouldPost) {
      await this.postJournalEntry({ entryId: entry.id, tenantId: params.tenantId });
    }

    return entry;
  }

  static async postJournalEntry(params: { entryId: string; tenantId: string; userId?: string }) {
    const entry = await prisma.journalEntry.findUnique({
      where: { id: params.entryId },
      include: { lines: true },
    });

    if (!entry || entry.tenantId !== params.tenantId) {
      throw new Error("Ecriture introuvable");
    }
    if (entry.status === "POSTED") return entry;

    await this.assertPeriodOpen({
      tenantId: params.tenantId,
      periodId: entry.periodId || undefined,
      date: entry.createdAt,
    });

    if (!isBalanced(entry.lines.map((l) => ({ type: l.type, amount: Number(l.amount) })))) {
      throw new Error("Ecriture desequilibree");
    }

    await prisma.journalEntry.update({
      where: { id: params.entryId },
      data: {
        status: "POSTED",
        postedAt: new Date(),
        postedById: params.userId || null,
      },
    });

    for (const line of entry.lines) {
      await LedgerService.createEntry({
        accountId: line.accountId,
        orderId: line.orderId || undefined,
        type: line.type,
        amount: Number(line.amount),
        currency: line.currency,
        description: line.description || "Journal entry",
        reference: entry.reference || undefined,
      });
    }

    return entry;
  }

  static async recordPayment(params: { paymentId: string; tenantId: string; userId?: string }) {
    const payment = await prisma.payment.findUnique({
      where: { id: params.paymentId },
      include: { order: true },
    });
    if (!payment || payment.order.tenantId !== params.tenantId) {
      throw new Error("Paiement introuvable");
    }

    const existingEntryLine = await prisma.journalLine.findFirst({
      where: { paymentId: params.paymentId },
      orderBy: { createdAt: "asc" },
      include: {
        entry: {
          include: { lines: true },
        },
      },
    });
    if (existingEntryLine) {
      if (existingEntryLine.entry.tenantId !== params.tenantId) {
        throw new Error("Paiement introuvable");
      }
      return existingEntryLine.entry;
    }

    const journal = await this.getOrCreateJournal({
      tenantId: params.tenantId,
      code: "BANK",
      name: "Banque",
      type: "BANK",
    });

    const cashLike = (payment.method || "").toLowerCase();
    const isCash = cashLike.includes("cash") || cashLike.includes("caisse") || cashLike.includes("espece");

    const bankAccount = await this.getOrCreateAccount({
      tenantId: params.tenantId,
      code: isCash ? "101" : "110",
      name: isCash ? "Caisse XAF" : "Banque principale",
      type: "ASSET",
      currency: "XAF",
    });

    const { debitAccount, creditAccount } = await this.resolvePaymentAccounts({
      tenantId: params.tenantId,
      payment,
    });

    const lines = [
      {
        accountId: debitAccount.id,
        type: "DEBIT" as LedgerLineType,
        amount: Number(payment.amountXAF),
        currency: "XAF",
        description: `Payment ${payment.type}`,
        orderId: payment.orderId,
        paymentId: payment.id,
      },
      {
        accountId: creditAccount.id,
        type: "CREDIT" as LedgerLineType,
        amount: Number(payment.amountXAF),
        currency: "XAF",
        description: `Payment ${payment.type}`,
        orderId: payment.orderId,
        paymentId: payment.id,
      },
    ];

    // For inbound payments, debit bank/cash; credit receivable or deposits
    if (payment.direction === "INBOUND") {
      lines[0].accountId = bankAccount.id;
      lines[1].accountId = creditAccount.id;
    } else {
      // Outbound payments: debit expense / payable, credit bank
      lines[0].accountId = debitAccount.id;
      lines[1].accountId = bankAccount.id;
    }

    const entry = await this.createJournalEntry({
      tenantId: params.tenantId,
      journalId: journal.id,
      reference: payment.reference || payment.id,
      memo: `Payment ${payment.type} ${payment.direction}`,
      status: "POSTED",
      lines,
    });

    return entry;
  }

  static async recordOrderRevenue(params: { orderId: string; tenantId: string; userId?: string }) {
    const order = await prisma.order.findUnique({
      where: { id: params.orderId },
      include: { marginReport: true },
    });
    if (!order || order.tenantId !== params.tenantId) {
      throw new Error("Commande introuvable");
    }

    const revenue = order.marginReport ? Number(order.marginReport.revenue) : Number(order.totalClient);
    const cogs = order.marginReport
      ? Number(order.marginReport.cogs)
      : Number(order.merchandiseTotal) + Number(order.logisticsCost) + Number(order.insuranceAmount);

    if (revenue <= 0 && cogs <= 0) return null;

    const journal = await this.getOrCreateJournal({
      tenantId: params.tenantId,
      code: "SALES",
      name: "Ventes",
      type: "SALES",
    });

    const arAccount = await this.getOrCreateAccount({
      tenantId: params.tenantId,
      code: "120",
      name: "Creances clients",
      type: "ASSET",
      currency: order.currency,
    });
    const revenueAccount = await this.getOrCreateAccount({
      tenantId: params.tenantId,
      code: "401",
      name: "Ventes marchandises",
      type: "REVENUE",
      currency: order.currency,
    });

    const inventoryAccount = await this.getOrCreateAccount({
      tenantId: params.tenantId,
      code: "130",
      name: "Stock en transit",
      type: "ASSET",
      currency: order.currency,
    });
    const cogsAccount = await this.getOrCreateAccount({
      tenantId: params.tenantId,
      code: "501",
      name: "Achats marchandises",
      type: "EXPENSE",
      currency: order.currency,
    });

    const lines = [] as Array<{
      accountId: string;
      type: LedgerLineType;
      amount: number;
      currency: string;
      description?: string | null;
      orderId?: string | null;
    }>;

    if (revenue > 0) {
      lines.push({
        accountId: arAccount.id,
        type: "DEBIT",
        amount: revenue,
        currency: order.currency,
        description: "Revenue recognition",
        orderId: order.id,
      });
      lines.push({
        accountId: revenueAccount.id,
        type: "CREDIT",
        amount: revenue,
        currency: order.currency,
        description: "Revenue recognition",
        orderId: order.id,
      });
    }

    if (cogs > 0) {
      lines.push({
        accountId: cogsAccount.id,
        type: "DEBIT",
        amount: cogs,
        currency: order.currency,
        description: "COGS recognition",
        orderId: order.id,
      });
      lines.push({
        accountId: inventoryAccount.id,
        type: "CREDIT",
        amount: cogs,
        currency: order.currency,
        description: "COGS recognition",
        orderId: order.id,
      });
    }

    if (!isBalanced(lines)) {
      throw new Error("Ecriture desequilibree");
    }

    return this.createJournalEntry({
      tenantId: params.tenantId,
      journalId: journal.id,
      reference: order.orderNumber,
      memo: "Order revenue posting",
      status: "POSTED",
      lines,
    });
  }

  private static async getOrCreateAccount(params: {
    tenantId: string;
    code: string;
    name: string;
    type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
    currency: string;
  }) {
    return prisma.ledgerAccount.upsert({
      where: { tenantId_code: { tenantId: params.tenantId, code: params.code } },
      update: {},
      create: {
        tenantId: params.tenantId,
        code: params.code,
        name: params.name,
        type: params.type,
        currency: params.currency || "XAF",
      },
    });
  }

  private static async resolvePaymentAccounts(params: { tenantId: string; payment: Payment }) {
    const payment = params.payment;

    const mapOutbound: Record<PaymentType, { code: string; name: string; type: "ASSET" | "LIABILITY" | "REVENUE" | "EXPENSE" }> = {
      CLIENT_DEPOSIT: { code: "210", name: "Acomptes clients recus", type: "LIABILITY" },
      CLIENT_BALANCE: { code: "120", name: "Creances clients", type: "ASSET" },
      SUPPLIER_PAYMENT: { code: "201", name: "Dettes fournisseurs", type: "LIABILITY" },
      FREIGHT_PAYMENT: { code: "510", name: "Fret et transport", type: "EXPENSE" },
      CUSTOMS_DUTY: { code: "520", name: "Douane et taxes", type: "EXPENSE" },
      QC_PAYMENT: { code: "530", name: "Controle qualite", type: "EXPENSE" },
      COMMISSION: { code: "410", name: "Commissions", type: "REVENUE" },
      REFUND: { code: "210", name: "Acomptes clients recus", type: "LIABILITY" },
    };

    if (payment.direction === "INBOUND") {
      const account = mapOutbound[payment.type] || mapOutbound.CLIENT_BALANCE;
      return {
        debitAccount: await this.getOrCreateAccount({
          tenantId: params.tenantId,
          code: account.code,
          name: account.name,
          type: account.type,
          currency: "XAF",
        }),
        creditAccount: await this.getOrCreateAccount({
          tenantId: params.tenantId,
          code: account.code,
          name: account.name,
          type: account.type,
          currency: "XAF",
        }),
      };
    }

    const outboundAccount = mapOutbound[payment.type] || mapOutbound.SUPPLIER_PAYMENT;

    return {
      debitAccount: await this.getOrCreateAccount({
        tenantId: params.tenantId,
        code: outboundAccount.code,
        name: outboundAccount.name,
        type: outboundAccount.type,
        currency: "XAF",
      }),
      creditAccount: await this.getOrCreateAccount({
        tenantId: params.tenantId,
        code: outboundAccount.code,
        name: outboundAccount.name,
        type: outboundAccount.type,
        currency: "XAF",
      }),
    };
  }
}
