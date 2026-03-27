"use server";

import { z } from "zod";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { LedgerService } from "@/lib/services/ledger.service";
import { FXRateService } from "@/lib/services/fx-rate.service";
import { FinanceIntelligenceService } from "@/lib/services/finance-intelligence.service";
import { AuditService } from "@/lib/services/audit.service";
import { AccountingService } from "@/lib/services/accounting.service";
import { FxRevaluationService } from "@/lib/services/fx-revaluation.service";
import { NotificationService } from "@/lib/services/notification.service";
import { FinanceTransactionService } from "@/lib/services/finance-transaction.service";
import { checkPermission } from "@/lib/permissions";
import {
  createLedgerAccountSchema,
  createLedgerEntrySchema,
  createFXRateSchema,
} from "@/lib/validators/finance";
import { revalidatePath } from "next/cache";

const treasuryAccountSchema = z.object({
  label: z.string().min(2, "Libelle requis"),
  currency: z.string().min(3, "Devise requise"),
  balance: z.coerce.number().nonnegative("Solde initial invalide"),
  alertBelowAmount: z.coerce.number().nonnegative().optional(),
});

const treasuryTransactionSchema = z.object({
  accountId: z.string().min(1, "Compte requis"),
  type: z.enum(["TOP_UP", "ORDER_DEBIT", "FX_LOSS"]),
  amount: z.coerce.number().positive("Montant invalide"),
  fxRate: z.coerce.number().positive().optional(),
  orderId: z.string().optional(),
  reference: z.string().optional(),
});

// ============================================================
// LEDGER ACCOUNTS
// ============================================================

export async function createLedgerAccount(formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const validated = createLedgerAccountSchema.parse(formData);
    const account = await LedgerService.createAccount({
      tenantId: user.tenantId,
      ...validated,
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "ledger.account.created",
      entityType: "ledger_account",
      entityId: account.id,
      newValue: { code: account.code, name: account.name, type: account.type },
    });

    revalidatePath("/finance/ledger");
    return { data: account };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la création" };
  }
}

export async function getLedgerAccounts(type?: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.view");
    const accounts = await LedgerService.listAccounts(user.tenantId, {
      type: type as "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE" | undefined,
    });
    return { data: accounts };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getLedgerAccountById(accountId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.view");
    const account = await LedgerService.getAccountById(accountId);
    if (!account || account.tenantId !== user.tenantId) {
      return { error: "Compte introuvable" };
    }
    return { data: account };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function createLedgerEntry(formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const validated = createLedgerEntrySchema.parse(formData);

    if (validated.accountId === validated.contraAccountId) {
      return { error: "La contrepartie doit etre differente du compte principal" };
    }

    const [account, contraAccount] = await Promise.all([
      LedgerService.getAccountById(validated.accountId),
      LedgerService.getAccountById(validated.contraAccountId),
    ]);
    if (!account || account.tenantId !== user.tenantId) {
      return { error: "Compte principal introuvable" };
    }
    if (!contraAccount || contraAccount.tenantId !== user.tenantId) {
      return { error: "Compte de contrepartie introuvable" };
    }

    const journal = await AccountingService.getOrCreateJournal({
      tenantId: user.tenantId,
      code: "GEN",
      name: "Journal general",
      type: "GENERAL",
    });

    const debitAccountId = validated.type === "DEBIT" ? validated.accountId : validated.contraAccountId;
    const creditAccountId = validated.type === "DEBIT" ? validated.contraAccountId : validated.accountId;

    const entry = await AccountingService.createJournalEntry({
      tenantId: user.tenantId,
      journalId: journal.id,
      reference: validated.reference,
      memo: validated.description,
      status: "POSTED",
      lines: [
        {
          accountId: debitAccountId,
          type: "DEBIT",
          amount: validated.amount,
          currency: validated.currency,
          description: validated.description,
          orderId: validated.orderId,
        },
        {
          accountId: creditAccountId,
          type: "CREDIT",
          amount: validated.amount,
          currency: validated.currency,
          description: validated.description,
          orderId: validated.orderId,
        },
      ],
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "ledger.double_entry.created",
      entityType: "journal_entry",
      entityId: entry.id,
      newValue: {
        amount: validated.amount,
        currency: validated.currency,
        debitAccountId,
        creditAccountId,
        reference: validated.reference || null,
      },
    });

    revalidatePath("/finance/ledger");
    return { data: entry };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la création" };
  }
}

export async function getTrialBalance() {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.view");
    return { data: await LedgerService.getTrialBalance(user.tenantId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function seedChartOfAccounts(template?: "STANDARD" | "OHADA" | "PCG_CONGO") {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const accounts = await LedgerService.seedChartOfAccounts(user.tenantId, template || "STANDARD");

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "ledger.chart_seeded",
      entityType: "ledger_account",
      entityId: "bulk",
      newValue: { count: accounts.length, template: template || "STANDARD" },
    });

    revalidatePath("/finance/ledger");
    return { data: accounts };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// FX RATES
// ============================================================

export async function createFXRate(formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "payment.create");

    const validated = createFXRateSchema.parse(formData);
    const rate = await FXRateService.create({
      ...validated,
      effectiveAt: validated.effectiveAt ? new Date(validated.effectiveAt) : undefined,
    });

    const revaluation = await FxRevaluationService.runForTenant({
      tenantId: user.tenantId,
      userId: user.id,
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "finance.fx.rate_created",
      entityType: "fx_rate",
      entityId: rate.id,
      newValue: {
        fromCurrency: rate.fromCurrency,
        toCurrency: rate.toCurrency,
        rate: Number(rate.rate),
        revaluation,
      },
    });

    revalidatePath("/finance/fx");
    revalidatePath("/finance/ledger");
    return { data: { rate, revaluation } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la création" };
  }
}

export async function getLatestFXRates() {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.view");
    return { data: await FXRateService.getLatestRates() };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getFXHistory(fromCurrency: string, toCurrency: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.view");
    return { data: await FXRateService.getHistory(fromCurrency, toCurrency, { limit: 30 }) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function convertAmount(amount: number, from: string, to: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.view");
    const result = await FXRateService.convert(amount, from, to);
    return { data: { amount: result, from, to } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur de conversion" };
  }
}

// ============================================================
// FINANCE INTELLIGENCE
// ============================================================

export async function getFinancialKPIs() {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.view");
    return { data: await FinanceIntelligenceService.getFinancialKPIs(user.tenantId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getCashflowAnalysis(months?: number) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.view");
    return { data: await FinanceIntelligenceService.getCashflowAnalysis(user.tenantId, months) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getProfitAndLoss() {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.view");
    return { data: await FinanceIntelligenceService.getProfitAndLoss(user.tenantId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getAgingReport() {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.view");
    return { data: await FinanceIntelligenceService.getAgingReport(user.tenantId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getRevenueByClient() {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.view");
    return { data: await FinanceIntelligenceService.getRevenueByClient(user.tenantId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getPaymentMethodStats() {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.view");
    return { data: await FinanceIntelligenceService.getPaymentMethodStats(user.tenantId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// CSV EXPORT
// ============================================================

export async function exportFinanceCSV() {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");
    const { payments } = await (await import("@/lib/services/payment.service")).PaymentService.list({
      tenantId: user.tenantId,
      limit: 5000,
    });

    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;

    const headers = [
      "Commande", "Client", "Direction", "Type", "Statut", "Montant",
      "Devise", "Montant XAF", "Taux FX", "Méthode", "Référence", "Date",
    ];

    const typeLabels: Record<string, string> = {
      CLIENT_DEPOSIT: "Acompte client",
      CLIENT_BALANCE: "Solde client",
      SUPPLIER_PAYMENT: "Paiement fournisseur",
      FREIGHT_PAYMENT: "Fret",
      CUSTOMS_DUTY: "Douane",
      QC_PAYMENT: "QC",
      COMMISSION: "Commission",
      REFUND: "Remboursement",
    };

    const rows = payments.map((p) => [
      esc(p.order.orderNumber),
      esc(p.order.contact.name),
      p.direction === "INBOUND" ? "Entrant" : "Sortant",
      typeLabels[p.type] || p.type,
      p.status,
      Number(p.amount).toFixed(2),
      p.currency,
      Number(p.amountXAF).toFixed(0),
      p.fxRate ? Number(p.fxRate).toFixed(4) : "",
      p.method || "",
      p.reference || "",
      new Date(p.createdAt).toLocaleDateString("fr-FR"),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "finance.export.csv",
      entityType: "payment",
      entityId: "bulk",
      newValue: { rows: payments.length },
    });

    return { data: csv };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur export" };
  }
}

export async function runFxRevaluation() {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const result = await FxRevaluationService.runForTenant({
      tenantId: user.tenantId,
      userId: user.id,
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "finance.fx.revaluation.run",
      entityType: "journal_entry",
      entityId: "bulk",
      newValue: result as any,
    });

    revalidatePath("/finance/ledger");
    revalidatePath("/finance");
    return { data: result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur revalorisation FX" };
  }
}

export async function getTreasuryAccounts() {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.view");

    const accounts = await prisma.treasuryAccount.findMany({
      where: { tenantId: user.tenantId },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
      orderBy: [{ currency: "asc" }, { label: "asc" }],
    });

    return {
      data: accounts.map((account) => ({
        ...account,
        belowThreshold:
          account.alertBelowAmount != null &&
          Number(account.balance) < Number(account.alertBelowAmount),
      })),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur chargement tresorerie" };
  }
}

export async function getTreasuryTransactions(limit = 20) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.view");

    const transactions = await prisma.treasuryTransaction.findMany({
      where: {
        account: {
          tenantId: user.tenantId,
        },
      },
      include: {
        account: {
          select: {
            id: true,
            label: true,
            currency: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return { data: transactions };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur chargement mouvements" };
  }
}

export async function createTreasuryAccount(formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const validated = treasuryAccountSchema.parse(formData);
    const account = await prisma.treasuryAccount.create({
      data: {
        tenantId: user.tenantId,
        label: validated.label,
        currency: validated.currency.toUpperCase(),
        balance: validated.balance,
        alertBelowAmount: validated.alertBelowAmount,
      },
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "treasury.account.created",
      entityType: "treasury_account",
      entityId: account.id,
      newValue: {
        label: account.label,
        currency: account.currency,
        balance: Number(account.balance),
        alertBelowAmount: account.alertBelowAmount != null ? Number(account.alertBelowAmount) : null,
      },
    });

    revalidatePath("/finance/treasury");
    return { data: account };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur creation compte de tresorerie" };
  }
}

export async function createTreasuryTransaction(formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const validated = treasuryTransactionSchema.parse(formData);
    const account = await prisma.treasuryAccount.findFirst({
      where: { id: validated.accountId, tenantId: user.tenantId },
      select: {
        id: true,
        tenantId: true,
        label: true,
        currency: true,
        balance: true,
        alertBelowAmount: true,
      },
    });

    if (!account) {
      return { error: "Compte de tresorerie introuvable" };
    }

    const signedDelta =
      validated.type === "TOP_UP" ? validated.amount : -validated.amount;

    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.treasuryTransaction.create({
        data: {
          accountId: account.id,
          type: validated.type,
          amount: validated.amount,
          fxRate: validated.fxRate,
          orderId: validated.orderId || undefined,
          reference: validated.reference || undefined,
        },
      });

      const updatedAccount = await tx.treasuryAccount.update({
        where: { id: account.id },
        data: {
          balance: {
            increment: signedDelta,
          },
        },
      });

      return { transaction, updatedAccount };
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "treasury.transaction.created",
      entityType: "treasury_account",
      entityId: account.id,
      newValue: {
        type: validated.type,
        amount: validated.amount,
        orderId: validated.orderId || null,
        reference: validated.reference || null,
      },
    });

    const belowThreshold =
      result.updatedAccount.alertBelowAmount != null &&
      Number(result.updatedAccount.balance) < Number(result.updatedAccount.alertBelowAmount);

      if (belowThreshold) {
      const leadership = await prisma.user.findMany({
        where: {
          tenantId: user.tenantId,
          isActive: true,
          role: { in: ["CEO", "DIRECTION", "ADMIN", "FINANCE_MANAGER", "FINANCE"] as any[] },
        },
        select: { id: true },
      });

      if (leadership.length > 0) {
        await NotificationService.notifyMany(
          leadership.map((member) => member.id),
          {
            tenantId: user.tenantId,
            type: "SLA_BREACH",
            title: `Alerte tresorerie - ${result.updatedAccount.label}`,
            message: `Le compte ${result.updatedAccount.label} est passe sous son seuil d'alerte.`,
            entityType: "treasury_account",
            entityId: result.updatedAccount.id,
          }
        );
      }
      }

      await FinanceTransactionService.syncTenant(user.tenantId);
  
      revalidatePath("/finance/treasury");
      revalidatePath("/finance/approvals");
      revalidatePath("/finance/margins");
      revalidatePath("/finance/statements");
      return { data: result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur creation mouvement de tresorerie" };
  }
}
