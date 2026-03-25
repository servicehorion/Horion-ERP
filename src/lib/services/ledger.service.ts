import { prisma } from "@/lib/db";
import type { AccountType, Prisma } from "@prisma/client";

export class LedgerService {
  static async createAccount(data: {
    tenantId: string;
    code: string;
    name: string;
    type: AccountType;
    currency?: string;
  }) {
    return prisma.ledgerAccount.create({
      data: {
        tenantId: data.tenantId,
        code: data.code,
        name: data.name,
        type: data.type,
        currency: data.currency || "XAF",
      },
    });
  }

  static async listAccounts(tenantId: string, options: { type?: AccountType } = {}) {
    return prisma.ledgerAccount.findMany({
      where: {
        tenantId,
        ...(options.type && { type: options.type }),
      },
      include: {
        _count: { select: { entries: true } },
      },
      orderBy: { code: "asc" },
    });
  }

  static async getAccountById(accountId: string) {
    return prisma.ledgerAccount.findUnique({
      where: { id: accountId },
      include: {
        entries: {
          orderBy: { createdAt: "desc" },
          take: 100,
        },
        _count: { select: { entries: true } },
      },
    });
  }

  static async createEntry(data: {
    accountId: string;
    orderId?: string;
    costCenterId?: string;
    type: string;
    amount: number;
    currency: string;
    description: string;
    reference?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const entry = await tx.ledgerEntry.create({
        data: {
          accountId: data.accountId,
          orderId: data.orderId,
          costCenterId: data.costCenterId || undefined,
          type: data.type,
          amount: data.amount,
          currency: data.currency,
          description: data.description,
          reference: data.reference,
        },
      });

      // Update account balance
      const account = await tx.ledgerAccount.findUnique({
        where: { id: data.accountId },
      });
      if (!account) throw new Error("Compte introuvable");

      // DEBIT increases ASSET/EXPENSE, decreases LIABILITY/EQUITY/REVENUE
      // CREDIT does the opposite
      const isDebitNormal = ["ASSET", "EXPENSE"].includes(account.type);
      const balanceChange = data.type === "DEBIT"
        ? (isDebitNormal ? data.amount : -data.amount)
        : (isDebitNormal ? -data.amount : data.amount);

      await tx.ledgerAccount.update({
        where: { id: data.accountId },
        data: { balance: { increment: balanceChange } },
      });

      return entry;
    });
  }

  static async getEntries(
    accountId: string,
    options: { page?: number; limit?: number; orderId?: string } = {}
  ) {
    const { page = 1, limit = 50, orderId } = options;

    const where: Prisma.LedgerEntryWhereInput = {
      accountId,
      ...(orderId && { orderId }),
    };

    const [entries, total] = await Promise.all([
      prisma.ledgerEntry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.ledgerEntry.count({ where }),
    ]);

    return { entries, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  static async getTrialBalance(tenantId: string) {
    const accounts = await prisma.ledgerAccount.findMany({
      where: { tenantId },
      orderBy: { code: "asc" },
    });

    let totalDebit = 0;
    let totalCredit = 0;

    const rows = accounts.map((a) => {
      const bal = Number(a.balance);
      const isDebitNormal = ["ASSET", "EXPENSE"].includes(a.type);
      const debit = isDebitNormal ? Math.max(0, bal) : Math.max(0, -bal);
      const credit = isDebitNormal ? Math.max(0, -bal) : Math.max(0, bal);
      totalDebit += debit;
      totalCredit += credit;

      return {
        id: a.id,
        code: a.code,
        name: a.name,
        type: a.type,
        currency: a.currency,
        balance: bal,
        debit,
        credit,
      };
    });

    return { rows, totalDebit, totalCredit, isBalanced: Math.abs(totalDebit - totalCredit) < 0.01 };
  }

  static async getAccountSummaryByType(tenantId: string) {
    const accounts = await prisma.ledgerAccount.findMany({
      where: { tenantId },
    });

    const summary: Record<string, { count: number; totalBalance: number }> = {};
    for (const a of accounts) {
      if (!summary[a.type]) summary[a.type] = { count: 0, totalBalance: 0 };
      summary[a.type].count++;
      summary[a.type].totalBalance += Number(a.balance);
    }

    return summary;
  }

  // Seed standard chart of accounts for import/export business
  static async seedChartOfAccounts(tenantId: string, template: "STANDARD" | "OHADA" | "PCG_CONGO" = "STANDARD") {
    const standard = [
      // Assets
      { code: "101", name: "Caisse XAF", type: "ASSET" as AccountType, currency: "XAF" },
      { code: "102", name: "Caisse USD", type: "ASSET" as AccountType, currency: "USD" },
      { code: "103", name: "Caisse RMB", type: "ASSET" as AccountType, currency: "RMB" },
      { code: "110", name: "Banque principale", type: "ASSET" as AccountType, currency: "XAF" },
      { code: "120", name: "Créances clients", type: "ASSET" as AccountType, currency: "XAF" },
      { code: "130", name: "Stock en transit", type: "ASSET" as AccountType, currency: "XAF" },
      { code: "140", name: "Avances fournisseurs", type: "ASSET" as AccountType, currency: "XAF" },
      // Liabilities
      { code: "201", name: "Dettes fournisseurs", type: "LIABILITY" as AccountType, currency: "XAF" },
      { code: "210", name: "Acomptes clients reçus", type: "LIABILITY" as AccountType, currency: "XAF" },
      { code: "220", name: "TVA collectée", type: "LIABILITY" as AccountType, currency: "XAF" },
      { code: "230", name: "Droits de douane à payer", type: "LIABILITY" as AccountType, currency: "XAF" },
      // Revenue
      { code: "401", name: "Ventes marchandises", type: "REVENUE" as AccountType, currency: "XAF" },
      { code: "410", name: "Commissions", type: "REVENUE" as AccountType, currency: "XAF" },
      { code: "420", name: "Services logistiques", type: "REVENUE" as AccountType, currency: "XAF" },
      // Expenses
      { code: "501", name: "Achats marchandises", type: "EXPENSE" as AccountType, currency: "XAF" },
      { code: "510", name: "Fret et transport", type: "EXPENSE" as AccountType, currency: "XAF" },
      { code: "520", name: "Douane et taxes", type: "EXPENSE" as AccountType, currency: "XAF" },
      { code: "530", name: "Contrôle qualité", type: "EXPENSE" as AccountType, currency: "XAF" },
      { code: "540", name: "Assurance transport", type: "EXPENSE" as AccountType, currency: "XAF" },
      { code: "550", name: "Frais bancaires", type: "EXPENSE" as AccountType, currency: "XAF" },
      { code: "560", name: "Pertes de change", type: "EXPENSE" as AccountType, currency: "XAF" },
      // Equity
      { code: "301", name: "Capital social", type: "EQUITY" as AccountType, currency: "XAF" },
      { code: "310", name: "Résultat exercice", type: "EQUITY" as AccountType, currency: "XAF" },
    ];

    const ohada = [
      { code: "10", name: "Capital", type: "EQUITY" as AccountType, currency: "XAF" },
      { code: "11", name: "Reserves", type: "EQUITY" as AccountType, currency: "XAF" },
      { code: "12", name: "Resultat", type: "EQUITY" as AccountType, currency: "XAF" },
      { code: "20", name: "Immobilisations", type: "ASSET" as AccountType, currency: "XAF" },
      { code: "30", name: "Stocks", type: "ASSET" as AccountType, currency: "XAF" },
      { code: "40", name: "Clients", type: "ASSET" as AccountType, currency: "XAF" },
      { code: "50", name: "Banques", type: "ASSET" as AccountType, currency: "XAF" },
      { code: "60", name: "Achats", type: "EXPENSE" as AccountType, currency: "XAF" },
      { code: "62", name: "Services exterieurs", type: "EXPENSE" as AccountType, currency: "XAF" },
      { code: "66", name: "Charges financieres", type: "EXPENSE" as AccountType, currency: "XAF" },
      { code: "70", name: "Ventes", type: "REVENUE" as AccountType, currency: "XAF" },
      { code: "71", name: "Services", type: "REVENUE" as AccountType, currency: "XAF" },
      { code: "44", name: "Etat - TVA", type: "LIABILITY" as AccountType, currency: "XAF" },
      { code: "45", name: "Dettes fournisseurs", type: "LIABILITY" as AccountType, currency: "XAF" },
    ];

    const pcgCongo = [
      { code: "101", name: "Capital social", type: "EQUITY" as AccountType, currency: "XAF" },
      { code: "106", name: "Reserves", type: "EQUITY" as AccountType, currency: "XAF" },
      { code: "12", name: "Resultat", type: "EQUITY" as AccountType, currency: "XAF" },
      { code: "20", name: "Immobilisations incorporelles", type: "ASSET" as AccountType, currency: "XAF" },
      { code: "21", name: "Immobilisations corporelles", type: "ASSET" as AccountType, currency: "XAF" },
      { code: "30", name: "Stocks", type: "ASSET" as AccountType, currency: "XAF" },
      { code: "40", name: "Clients", type: "ASSET" as AccountType, currency: "XAF" },
      { code: "50", name: "Banques", type: "ASSET" as AccountType, currency: "XAF" },
      { code: "60", name: "Achats", type: "EXPENSE" as AccountType, currency: "XAF" },
      { code: "61", name: "Services exterieurs", type: "EXPENSE" as AccountType, currency: "XAF" },
      { code: "63", name: "Impots et taxes", type: "EXPENSE" as AccountType, currency: "XAF" },
      { code: "70", name: "Ventes", type: "REVENUE" as AccountType, currency: "XAF" },
      { code: "44", name: "Etat - TVA", type: "LIABILITY" as AccountType, currency: "XAF" },
      { code: "45", name: "Fournisseurs", type: "LIABILITY" as AccountType, currency: "XAF" },
    ];

    const templateMap = {
      STANDARD: standard,
      OHADA: ohada,
      PCG_CONGO: pcgCongo,
    } as const;

    const selected = templateMap[template] || standard;

    const created = [];
    for (const acct of selected) {
      try {
        const a = await prisma.ledgerAccount.upsert({
          where: { tenantId_code: { tenantId, code: acct.code } },
          update: {},
          create: { tenantId, ...acct },
        });
        created.push(a);
      } catch {
        // Skip duplicates
      }
    }
    return created;
  }
}
