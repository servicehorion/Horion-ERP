"use server";

import { getSession } from "@/lib/session";
import { LedgerService } from "@/lib/services/ledger.service";
import { FXRateService } from "@/lib/services/fx-rate.service";
import { FinanceIntelligenceService } from "@/lib/services/finance-intelligence.service";
import { AuditService } from "@/lib/services/audit.service";
import { checkPermission } from "@/lib/permissions";
import {
  createLedgerAccountSchema,
  createLedgerEntrySchema,
  createFXRateSchema,
} from "@/lib/validators/finance";
import { revalidatePath } from "next/cache";

// ============================================================
// LEDGER ACCOUNTS
// ============================================================

export async function createLedgerAccount(formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "payment.create");

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
    checkPermission(user.role, "payment.create");

    const validated = createLedgerEntrySchema.parse(formData);

    // Verify account belongs to tenant
    const account = await LedgerService.getAccountById(validated.accountId);
    if (!account || account.tenantId !== user.tenantId) {
      return { error: "Compte introuvable" };
    }

    const entry = await LedgerService.createEntry(validated);

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "ledger.entry.created",
      entityType: "ledger_entry",
      entityId: entry.id,
      newValue: { type: validated.type, amount: validated.amount, description: validated.description },
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
    return { data: await LedgerService.getTrialBalance(user.tenantId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function seedChartOfAccounts() {
  try {
    const user = await getSession();
    checkPermission(user.role, "payment.create");

    const accounts = await LedgerService.seedChartOfAccounts(user.tenantId);

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "ledger.chart_seeded",
      entityType: "ledger_account",
      entityId: "bulk",
      newValue: { count: accounts.length },
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

    revalidatePath("/finance/fx");
    return { data: rate };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la création" };
  }
}

export async function getLatestFXRates() {
  try {
    await getSession();
    return { data: await FXRateService.getLatestRates() };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getFXHistory(fromCurrency: string, toCurrency: string) {
  try {
    await getSession();
    return { data: await FXRateService.getHistory(fromCurrency, toCurrency, { limit: 30 }) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function convertAmount(amount: number, from: string, to: string) {
  try {
    await getSession();
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
    return { data: await FinanceIntelligenceService.getFinancialKPIs(user.tenantId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getCashflowAnalysis(months?: number) {
  try {
    const user = await getSession();
    return { data: await FinanceIntelligenceService.getCashflowAnalysis(user.tenantId, months) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getProfitAndLoss() {
  try {
    const user = await getSession();
    return { data: await FinanceIntelligenceService.getProfitAndLoss(user.tenantId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getAgingReport() {
  try {
    const user = await getSession();
    return { data: await FinanceIntelligenceService.getAgingReport(user.tenantId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getRevenueByClient() {
  try {
    const user = await getSession();
    return { data: await FinanceIntelligenceService.getRevenueByClient(user.tenantId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getPaymentMethodStats() {
  try {
    const user = await getSession();
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
    return { data: csv };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur export" };
  }
}
