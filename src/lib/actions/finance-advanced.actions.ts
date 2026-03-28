
"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { AuditService } from "@/lib/services/audit.service";
import { AccountingService } from "@/lib/services/accounting.service";
import { BudgetService } from "@/lib/services/budget.service";
import { ForecastService } from "@/lib/services/forecast.service";
import { CashPlanService } from "@/lib/services/cash-plan.service";
import { TaxService } from "@/lib/services/tax.service";
import { BankService } from "@/lib/services/bank.service";
import { CostCenterService } from "@/lib/services/cost-center.service";
import { AssetService } from "@/lib/services/asset.service";
import { PayrollService } from "@/lib/services/payroll.service";
import { InvoiceService } from "@/lib/services/invoice.service";
import { ConsolidationService } from "@/lib/services/consolidation.service";
import { MarketService } from "@/lib/services/market.service";
import { FinanceApprovalService } from "@/lib/services/finance-approval.service";
import { FinanceTransactionService } from "@/lib/services/finance-transaction.service";
import { prisma } from "@/lib/db";

const toNumber = (value: FormDataEntryValue | null, field: string) => {
  const n = Number(value);
  if (Number.isNaN(n)) throw new Error(`Champ invalide: ${field}`);
  return n;
};

const toDate = (value: FormDataEntryValue | null) => {
  if (!value) return undefined;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
};

// =============================
// Accounting Periods & Journals
// =============================

export async function createAccountingPeriod(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const name = String(formData.get("name") || "").trim();
    const startAt = toDate(formData.get("startAt"));
    const endAt = toDate(formData.get("endAt"));

    if (!name || !startAt || !endAt) throw new Error("Champs obligatoires manquants");

    const period = await AccountingService.createPeriod({
      tenantId: user.tenantId,
      name,
      startAt,
      endAt,
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "finance.period.created",
      entityType: "accounting_period",
      entityId: period.id,
      newValue: { name, startAt, endAt },
    });

    revalidatePath("/finance/periods");
    return { data: period };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function closeAccountingPeriod(periodId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const period = await AccountingService.closePeriod({
      tenantId: user.tenantId,
      periodId,
      userId: user.id,
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "finance.period.closed",
      entityType: "accounting_period",
      entityId: period.id,
    });

    revalidatePath("/finance/periods");
    return { data: period };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function createJournal(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const code = String(formData.get("code") || "").trim();
    const name = String(formData.get("name") || "").trim();
    const type = String(formData.get("type") || "GENERAL");
    if (!code || !name) throw new Error("Code et nom obligatoires");

    const journal = await AccountingService.createJournal({
      tenantId: user.tenantId,
      code,
      name,
      type: type as any,
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "finance.journal.created",
      entityType: "journal",
      entityId: journal.id,
      newValue: { code, name, type },
    });

    revalidatePath("/finance/journals");
    return { data: journal };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function createJournalEntry(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const journalId = String(formData.get("journalId") || "");
    const debitAccountId = String(formData.get("debitAccountId") || "");
    const creditAccountId = String(formData.get("creditAccountId") || "");
    const amount = toNumber(formData.get("amount"), "amount");
    const currency = String(formData.get("currency") || "XAF");
    const description = String(formData.get("description") || "");
    const reference = String(formData.get("reference") || "") || undefined;
    const orderId = String(formData.get("orderId") || "") || undefined;
    const paymentId = String(formData.get("paymentId") || "") || undefined;
    const invoiceId = String(formData.get("invoiceId") || "") || undefined;
    const postNow = String(formData.get("postNow") || "true") === "true";

    if (!journalId || !debitAccountId || !creditAccountId || !description) {
      throw new Error("Champs obligatoires manquants");
    }

    const entry = await AccountingService.createJournalEntry({
      tenantId: user.tenantId,
      journalId,
      reference,
      memo: description,
      status: postNow ? "POSTED" : "DRAFT",
      lines: [
        {
          accountId: debitAccountId,
          type: "DEBIT",
          amount,
          currency,
          description,
          orderId,
          paymentId,
          invoiceId,
        },
        {
          accountId: creditAccountId,
          type: "CREDIT",
          amount,
          currency,
          description,
          orderId,
          paymentId,
          invoiceId,
        },
      ],
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "finance.journal_entry.created",
      entityType: "journal_entry",
      entityId: entry.id,
    });

    revalidatePath("/finance/journals");
    revalidatePath("/finance/ledger");
    return { data: entry };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// =============================
// Invoices (AP/AR)
// =============================

export async function createInvoice(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const direction = String(formData.get("direction") || "AR");
    const invoiceNumber = String(formData.get("invoiceNumber") || "").trim();
    const contactId = String(formData.get("contactId") || "") || undefined;
    const supplierId = String(formData.get("supplierId") || "") || undefined;
    const orderId = String(formData.get("orderId") || "") || undefined;
    const currency = String(formData.get("currency") || "XAF");
    const issuedAt = toDate(formData.get("issuedAt"));
    const dueAt = toDate(formData.get("dueAt"));
    const periodStart = toDate(formData.get("periodStart"));
    const periodEnd = toDate(formData.get("periodEnd"));
    const notes = String(formData.get("notes") || "") || undefined;

    const description = String(formData.get("lineDescription") || "");
    const quantity = toNumber(formData.get("quantity"), "quantity");
    const unitPrice = toNumber(formData.get("unitPrice"), "unitPrice");
    const taxRateRaw = formData.get("taxRate");
    const taxRate = taxRateRaw ? toNumber(taxRateRaw, "taxRate") : undefined;

    if (!invoiceNumber || !description) throw new Error("Champs obligatoires manquants");

    const invoice = await InvoiceService.create({
      tenantId: user.tenantId,
      direction: direction as any,
      invoiceNumber,
      contactId,
      supplierId,
      orderId,
      currency,
      issuedAt,
      dueAt,
      notes,
      lines: [
        {
          description,
          quantity,
          unitPrice,
          taxRate: taxRate ?? null,
        },
      ],
    });

    const scheduleDueAt = toDate(formData.get("scheduleDueAt"));
    const scheduleAmountRaw = formData.get("scheduleAmount");
    if (scheduleDueAt && scheduleAmountRaw) {
      await InvoiceService.addSchedule({
        invoiceId: invoice.id,
        dueAt: scheduleDueAt,
        amount: toNumber(scheduleAmountRaw, "scheduleAmount"),
      });
    }

    const requireApproval = String(formData.get("requireApproval") || "") === "true";
    if (requireApproval) {
      await FinanceApprovalService.requestApproval({
        tenantId: user.tenantId,
        entityType: "invoice",
        entityId: invoice.id,
        requestedById: user.id,
        notes: "Approval requested on creation",
      });
    }

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "invoice.created",
      entityType: "invoice",
      entityId: invoice.id,
      newValue: { invoiceNumber, direction },
    });

    revalidatePath("/finance/invoices");
    return { data: invoice };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function updateInvoiceStatus(invoiceId: string, status: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");
    const invoice = await InvoiceService.updateStatus(user.tenantId, invoiceId, status as any);

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "invoice.status",
      entityType: "invoice",
      entityId: invoiceId,
      newValue: { status },
    });

    revalidatePath("/finance/invoices");
    return { data: invoice };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function addInvoiceSchedule(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const invoiceId = String(formData.get("invoiceId") || "");
    const dueAt = toDate(formData.get("dueAt"));
    const amount = toNumber(formData.get("amount"), "amount");

    if (!invoiceId || !dueAt) throw new Error("Champs obligatoires manquants");

    const schedule = await InvoiceService.addSchedule({
      invoiceId,
      dueAt,
      amount,
    });

    revalidatePath("/finance/invoices");
    return { data: schedule };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function addInvoiceReminder(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const invoiceId = String(formData.get("invoiceId") || "");
    const channel = String(formData.get("channel") || "email");
    if (!invoiceId) throw new Error("Facture manquante");

    const reminder = await InvoiceService.createReminder({ invoiceId, channel });
    revalidatePath("/finance/invoices");
    return { data: reminder };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}
// =============================
// Budgets / Forecast / Cash Plan
// =============================

export async function createBudgetPlan(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const name = String(formData.get("name") || "");
    const year = toNumber(formData.get("year"), "year");
    const currency = String(formData.get("currency") || "XAF");

    if (!name) throw new Error("Nom obligatoire");

    const budget = await BudgetService.create({
      tenantId: user.tenantId,
      name,
      year,
      currency,
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "budget.created",
      entityType: "budget_plan",
      entityId: budget.id,
      newValue: { name, year, currency },
    });

    revalidatePath("/finance/budgets");
    return { data: budget };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function addBudgetLine(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const budgetId = String(formData.get("budgetId") || "");
    const category = String(formData.get("category") || "");
    const amount = toNumber(formData.get("amount"), "amount");
    const monthRaw = formData.get("month");
    const month = monthRaw ? toNumber(monthRaw, "month") : undefined;
    const costCenterId = String(formData.get("costCenterId") || "") || undefined;

    if (!budgetId || !category) throw new Error("Champs obligatoires manquants");

    const line = await BudgetService.addLine({
      budgetId,
      category,
      amount,
      month: month ?? undefined,
      costCenterId,
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "budget.line_added",
      entityType: "budget_line",
      entityId: line.id,
      newValue: { budgetId, category, amount, month },
    });

    revalidatePath("/finance/budgets");
    return { data: line };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function createForecastScenario(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const name = String(formData.get("name") || "");
    const type = String(formData.get("type") || "BASE");

    if (!name) throw new Error("Nom obligatoire");

    const scenario = await ForecastService.create({
      tenantId: user.tenantId,
      name,
      type: type as any,
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "forecast.created",
      entityType: "forecast_scenario",
      entityId: scenario.id,
      newValue: { name, type },
    });

    revalidatePath("/finance/forecast");
    return { data: scenario };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function addForecastLine(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const scenarioId = String(formData.get("scenarioId") || "");
    const month = String(formData.get("month") || "");
    const revenue = toNumber(formData.get("revenue"), "revenue");
    const cogs = toNumber(formData.get("cogs"), "cogs");
    const expenses = toNumber(formData.get("expenses"), "expenses");
    const cashIn = toNumber(formData.get("cashIn"), "cashIn");
    const cashOut = toNumber(formData.get("cashOut"), "cashOut");

    if (!scenarioId || !month) throw new Error("Champs obligatoires manquants");

    const line = await ForecastService.addLine({
      scenarioId,
      month,
      revenue,
      cogs,
      expenses,
      cashIn,
      cashOut,
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "forecast.line_added",
      entityType: "forecast_line",
      entityId: line.id,
      newValue: { scenarioId, month, revenue, cogs, expenses, cashIn, cashOut },
    });

    revalidatePath("/finance/forecast");
    return { data: line };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function createCashPlan(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const name = String(formData.get("name") || "");
    const startAt = toDate(formData.get("startAt"));
    const endAt = toDate(formData.get("endAt"));
    const currency = String(formData.get("currency") || "XAF");

    if (!name || !startAt || !endAt) throw new Error("Champs obligatoires manquants");

    const plan = await CashPlanService.create({
      tenantId: user.tenantId,
      name,
      startAt,
      endAt,
      currency,
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "cash_plan.created",
      entityType: "cash_plan",
      entityId: plan.id,
      newValue: { name, startAt, endAt, currency },
    });

    revalidatePath("/finance/cash-planning");
    return { data: plan };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function addCashPlanLine(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const planId = String(formData.get("planId") || "");
    const date = toDate(formData.get("date"));
    const direction = String(formData.get("direction") || "IN");
    const amount = toNumber(formData.get("amount"), "amount");
    const description = String(formData.get("description") || "") || undefined;

    if (!planId || !date) throw new Error("Champs obligatoires manquants");

    const line = await CashPlanService.addLine({
      planId,
      date,
      direction,
      amount,
      description,
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "cash_plan.line_added",
      entityType: "cash_plan_line",
      entityId: line.id,
      newValue: { planId, date, direction, amount },
    });

    revalidatePath("/finance/cash-planning");
    return { data: line };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// =============================
// Tax / Compliance
// =============================

export async function createTaxRate(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const name = String(formData.get("name") || "");
    const rate = toNumber(formData.get("rate"), "rate");
    const type = String(formData.get("type") || "VAT");
    const country = String(formData.get("country") || "") || undefined;

    if (!name) throw new Error("Nom obligatoire");

    const tax = await TaxService.createRate({
      tenantId: user.tenantId,
      name,
      rate,
      type,
      country,
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "tax.rate_created",
      entityType: "tax_rate",
      entityId: tax.id,
      newValue: { name, rate, type },
    });

    revalidatePath("/finance/tax");
    return { data: tax };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function createTaxReport(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const type = String(formData.get("type") || "VAT");
    const currency = String(formData.get("currency") || "XAF");
    const dueAt = toDate(formData.get("dueAt"));
    const periodStart = toDate(formData.get("periodStart"));
    const periodEnd = toDate(formData.get("periodEnd"));

    const report = await TaxService.createReport({
      tenantId: user.tenantId,
      type,
      currency,
      dueAt,
      periodStart,
      periodEnd,
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "tax.report_created",
      entityType: "tax_report",
      entityId: report.id,
      newValue: { type, currency, dueAt, periodStart, periodEnd },
    });

    revalidatePath("/finance/tax");
    return { data: report };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function addTaxLine(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const reportId = String(formData.get("reportId") || "");
    const name = String(formData.get("name") || "");
    const base = toNumber(formData.get("base"), "base");
    const taxAmount = toNumber(formData.get("taxAmount"), "taxAmount");

    if (!reportId || !name) throw new Error("Champs obligatoires manquants");

    const line = await TaxService.addLine({ reportId, name, base, taxAmount });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "tax.line_added",
      entityType: "tax_line",
      entityId: line.id,
      newValue: { reportId, name, base, taxAmount },
    });

    revalidatePath("/finance/tax");
    return { data: line };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function markTaxReportFiled(reportId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const report = await TaxService.markFiled(reportId);
    revalidatePath("/finance/tax");
    return { data: report };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// =============================
// Bank Integrations & Reconciliation
// =============================

export async function createBankConnection(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const provider = String(formData.get("provider") || "");
    const accountName = String(formData.get("accountName") || "") || undefined;
    const accountNumber = String(formData.get("accountNumber") || "") || undefined;
    const currency = String(formData.get("currency") || "XAF");
    const apiBaseUrl = String(formData.get("apiBaseUrl") || "") || undefined;
    const clientId = String(formData.get("clientId") || "") || undefined;
    const clientSecret = String(formData.get("clientSecret") || "") || undefined;
    const accessToken = String(formData.get("accessToken") || "") || undefined;
    const refreshToken = String(formData.get("refreshToken") || "") || undefined;
    const webhookSecret = String(formData.get("webhookSecret") || "") || undefined;

    if (!provider) throw new Error("Provider obligatoire");

    const connection = await BankService.createConnection({
      tenantId: user.tenantId,
      provider,
      accountName,
      accountNumber,
      currency,
      apiBaseUrl,
      clientId,
      clientSecret,
      accessToken,
      refreshToken,
      webhookSecret,
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "bank.connection_created",
      entityType: "bank_connection",
      entityId: connection.id,
      newValue: { provider, accountName, currency },
    });

    revalidatePath("/finance/banks");
    return { data: connection };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function syncBankTransactions(connectionId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const result = await BankService.syncTransactions({ connectionId });

      await AuditService.log({
        tenantId: user.tenantId,
        userId: user.id,
        action: "bank.transactions_synced",
      entityType: "bank_connection",
      entityId: connectionId,
      newValue: { imported: result.imported, error: result.error || null },
      });

      await FinanceTransactionService.syncTenant(user.tenantId);
      revalidatePath("/finance/banks");
      revalidatePath("/finance/statements");
      return { data: result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur sync banque" };
  }
}

export async function addBankTransaction(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const connectionId = String(formData.get("connectionId") || "");
    const occurredAt = toDate(formData.get("occurredAt"));
    const amount = toNumber(formData.get("amount"), "amount");
    const currency = String(formData.get("currency") || "XAF");
    const direction = String(formData.get("direction") || "IN");
    const counterparty = String(formData.get("counterparty") || "") || undefined;
    const category = String(formData.get("category") || "") || undefined;
    const description = String(formData.get("description") || "") || undefined;
    const reference = String(formData.get("reference") || "") || undefined;

    if (!connectionId || !occurredAt) throw new Error("Champs obligatoires manquants");

    const tx = await BankService.addTransaction({
      connectionId,
      occurredAt,
      amount,
      currency,
      direction,
      counterparty,
      category,
      description,
      reference,
    });

      await AuditService.log({
        tenantId: user.tenantId,
        userId: user.id,
        action: "bank.transaction_added",
      entityType: "bank_transaction",
      entityId: tx.id,
      newValue: { connectionId, amount, currency, direction },
      });

      await FinanceTransactionService.syncTenant(user.tenantId);
      revalidatePath("/finance/banks");
      revalidatePath("/finance/statements");
      return { data: tx };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function reconcileBankTransaction(transactionId: string, paymentId?: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const tx = await BankService.reconcileTransaction({ transactionId, paymentId: paymentId || undefined });

      await AuditService.log({
        tenantId: user.tenantId,
        userId: user.id,
        action: "bank.transaction_reconciled",
      entityType: "bank_transaction",
      entityId: tx.id,
      newValue: { paymentId: paymentId || null },
      });

      await FinanceTransactionService.syncTenant(user.tenantId);
      revalidatePath("/finance/banks");
      revalidatePath("/finance/statements");
      return { data: tx };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function createBankReconciliation(periodId?: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const rec = await BankService.createReconciliation({
      tenantId: user.tenantId,
      periodId: periodId || undefined,
      createdById: user.id,
    });

    revalidatePath("/finance/banks");
    return { data: rec };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}
// =============================
// Consolidation & Entities
// =============================

export async function createLegalEntity(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const name = String(formData.get("name") || "");
    const country = String(formData.get("country") || "") || undefined;
    const baseCurrency = String(formData.get("baseCurrency") || "XAF");
    const taxId = String(formData.get("taxId") || "") || undefined;

    if (!name) throw new Error("Nom obligatoire");

    const entity = await ConsolidationService.createEntity({
      tenantId: user.tenantId,
      name,
      country,
      baseCurrency,
      taxId,
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "consolidation.entity_created",
      entityType: "legal_entity",
      entityId: entity.id,
      newValue: { name, baseCurrency, country },
    });

    revalidatePath("/finance/consolidation");
    return { data: entity };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function createConsolidationRun(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const baseCurrency = String(formData.get("baseCurrency") || "XAF");
    const notes = String(formData.get("notes") || "") || undefined;

    const run = await ConsolidationService.createRun({
      tenantId: user.tenantId,
      baseCurrency,
      notes,
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "consolidation.run_created",
      entityType: "consolidation_run",
      entityId: run.id,
      newValue: { baseCurrency, notes },
    });

    revalidatePath("/finance/consolidation");
    return { data: run };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function addConsolidationLine(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const runId = String(formData.get("runId") || "");
    const entityId = String(formData.get("entityId") || "");
    const metric = String(formData.get("metric") || "");
    const amount = toNumber(formData.get("amount"), "amount");
    const currency = String(formData.get("currency") || "XAF");

    if (!runId || !entityId || !metric) throw new Error("Champs obligatoires manquants");

    const line = await ConsolidationService.addLine({ runId, entityId, metric, amount, currency });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "consolidation.line_added",
      entityType: "consolidation_line",
      entityId: line.id,
      newValue: { runId, entityId, metric, amount, currency },
    });

    revalidatePath("/finance/consolidation");
    return { data: line };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// =============================
// Market Data & Risk
// =============================

export async function upsertMarketData(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const symbol = String(formData.get("symbol") || "");
    const name = String(formData.get("name") || "") || undefined;
    const type = String(formData.get("type") || "") || undefined;
    const lastPrice = toNumber(formData.get("lastPrice"), "lastPrice");
    const changePctRaw = formData.get("changePct");
    const changePct = changePctRaw ? toNumber(changePctRaw, "changePct") : undefined;

    if (!symbol) throw new Error("Symbol obligatoire");

    const record = await MarketService.upsertMarketData({
      tenantId: user.tenantId,
      symbol,
      name,
      type,
      lastPrice,
      changePct,
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "market.data_upserted",
      entityType: "market_data",
      entityId: record.id,
      newValue: { symbol, lastPrice, changePct },
    });

    revalidatePath("/finance/risk");
    return { data: record };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function createExposure(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const type = String(formData.get("type") || "FX");
    const currency = String(formData.get("currency") || "") || undefined;
    const amount = toNumber(formData.get("amount"), "amount");
    const counterparty = String(formData.get("counterparty") || "") || undefined;
    const dueAt = toDate(formData.get("dueAt"));

    const exp = await MarketService.createExposure({
      tenantId: user.tenantId,
      type: type as any,
      currency,
      amount,
      counterparty,
      dueAt,
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "risk.exposure_created",
      entityType: "exposure",
      entityId: exp.id,
      newValue: { type, amount, currency },
    });

    revalidatePath("/finance/risk");
    return { data: exp };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function createRiskMetric(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const type = String(formData.get("type") || "FX");
    const value = toNumber(formData.get("value"), "value");
    const status = String(formData.get("status") || "OK");

    const metric = await MarketService.createRiskMetric({
      tenantId: user.tenantId,
      type: type as any,
      value,
      status,
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "risk.metric_created",
      entityType: "risk_metric",
      entityId: metric.id,
      newValue: { type, value, status },
    });

    revalidatePath("/finance/risk");
    return { data: metric };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// =============================
// Approvals & Auto Reconciliation
// =============================

export async function requestFinanceApproval(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const entityType = String(formData.get("entityType") || "");
    const entityId = String(formData.get("entityId") || "");
    const notes = String(formData.get("notes") || "") || undefined;
    if (!entityType || !entityId) throw new Error("Champs obligatoires manquants");

    const approval = await FinanceApprovalService.requestApproval({
      tenantId: user.tenantId,
      entityType,
      entityId,
      requestedById: user.id,
      notes,
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "finance.approval.requested",
      entityType: "finance_approval",
      entityId: approval.workflowId,
      newValue: {
        entityType,
        entityId,
        steps: approval.steps.length,
        amountXaf: approval.amountXaf,
      },
    });

    revalidatePath("/finance/approvals");
    return { data: approval };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function approveFinanceApproval(approvalId: string, decision: "APPROVED" | "REJECTED") {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const result = await FinanceApprovalService.decideApproval({
      tenantId: user.tenantId,
      approvalId,
      userId: user.id,
      decision,
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "finance.approval.decided",
      entityType: "finance_approval",
      entityId: approvalId,
      newValue: {
        status: decision,
        completed: result.completed,
        rejected: result.rejected,
        nextStepId: result.nextStep?.id || null,
      },
    });

    revalidatePath("/finance/approvals");
    return { data: result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function runFinanceApprovalEscalation() {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const result = await FinanceApprovalService.escalateOverdue({
      tenantId: user.tenantId,
      escalatedById: user.id,
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "finance.approval.escalation_run",
      entityType: "finance_approval",
      entityId: "bulk",
      newValue: result as any,
    });

    revalidatePath("/finance/approvals");
    return { data: result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur escalation approbations" };
  }
}

export async function createFinanceApprovalRule(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const entityType = String(formData.get("entityType") || "").trim().toLowerCase();
    const name = String(formData.get("name") || "").trim();
    const minAmountXAF = toNumber(formData.get("minAmountXAF"), "minAmountXAF");
    const sequence = toNumber(formData.get("sequence"), "sequence");
    const APPROVAL_ROLES = new Set([
      "ADMIN", "DIRECTION", "CEO", "CTO",
      "FINANCE", "FINANCE_MANAGER", "OPS", "LOGISTICS_MANAGER",
    ]);
    const rawRole = String(formData.get("requiredRole") || "FINANCE_MANAGER");
    const requiredRole = APPROVAL_ROLES.has(rawRole) ? rawRole : "FINANCE_MANAGER";
    const slaHours = toNumber(formData.get("slaHours"), "slaHours");

    if (!entityType || !name) throw new Error("entityType et name sont obligatoires");

    const rule = await prisma.financeApprovalRule.create({
      data: {
        tenantId: user.tenantId,
        entityType,
        name,
        minAmountXAF,
        sequence,
        requiredRole: requiredRole as any,
        slaHours,
      },
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "finance.approval_rule.created",
      entityType: "finance_approval_rule",
      entityId: rule.id,
      newValue: { entityType, sequence, requiredRole, minAmountXAF, slaHours },
    });

    revalidatePath("/finance/approvals");
    return { data: rule };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur creation regle approbation" };
  }
}

export async function updateFinanceApprovalRule(ruleId: string, formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const existing = await prisma.financeApprovalRule.findUnique({ where: { id: ruleId } });
    if (!existing || existing.tenantId !== user.tenantId) throw new Error("Regle introuvable");

    const payload: any = {};
    if (formData.get("name")) payload.name = String(formData.get("name"));
    if (formData.get("entityType")) payload.entityType = String(formData.get("entityType")).toLowerCase();
    if (formData.get("minAmountXAF")) payload.minAmountXAF = toNumber(formData.get("minAmountXAF"), "minAmountXAF");
    if (formData.get("sequence")) payload.sequence = toNumber(formData.get("sequence"), "sequence");
    if (formData.get("requiredRole")) payload.requiredRole = String(formData.get("requiredRole"));
    if (formData.get("slaHours")) payload.slaHours = toNumber(formData.get("slaHours"), "slaHours");
    if (formData.get("isActive") !== null) payload.isActive = String(formData.get("isActive")) === "true";

    const rule = await prisma.financeApprovalRule.update({
      where: { id: ruleId },
      data: payload,
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "finance.approval_rule.updated",
      entityType: "finance_approval_rule",
      entityId: rule.id,
      newValue: payload,
    });

    revalidatePath("/finance/approvals");
    return { data: rule };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur mise a jour regle approbation" };
  }
}

export async function deleteFinanceApprovalRule(ruleId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const existing = await prisma.financeApprovalRule.findUnique({ where: { id: ruleId } });
    if (!existing || existing.tenantId !== user.tenantId) throw new Error("Regle introuvable");

    await prisma.financeApprovalRule.delete({ where: { id: ruleId } });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "finance.approval_rule.deleted",
      entityType: "finance_approval_rule",
      entityId: ruleId,
    });

    revalidatePath("/finance/approvals");
    return { data: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur suppression regle approbation" };
  }
}

export async function autoReconcileBankTransactions() {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const result = await BankService.autoReconcile(user.tenantId);

      await AuditService.log({
        tenantId: user.tenantId,
        userId: user.id,
        action: "bank.auto_reconcile",
      entityType: "bank_transactions",
      entityId: "bulk",
      newValue: { reconciled: result.reconciled },
      });

      await FinanceTransactionService.syncTenant(user.tenantId);
      revalidatePath("/finance/banks");
      revalidatePath("/finance/statements");
      return { data: result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// =============================
// Cost Centers
// =============================

export async function createCostCenter(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const code = String(formData.get("code") || "").trim();
    const name = String(formData.get("name") || "").trim();
    const description = String(formData.get("description") || "") || undefined;
    if (!code || !name) throw new Error("Champs obligatoires manquants");

    const center = await CostCenterService.create({
      tenantId: user.tenantId,
      code,
      name,
      description,
    });

    revalidatePath("/finance/cost-centers");
    return { data: center };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// =============================
// Assets & Depreciation
// =============================

export async function createAssetCategory(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const name = String(formData.get("name") || "").trim();
    const code = String(formData.get("code") || "") || undefined;
    if (!name) throw new Error("Nom obligatoire");

    const category = await AssetService.createCategory({
      tenantId: user.tenantId,
      name,
      code,
    });

    revalidatePath("/finance/assets");
    return { data: category };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function createFixedAsset(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const name = String(formData.get("name") || "").trim();
    const categoryId = String(formData.get("categoryId") || "") || undefined;
    const acquisitionDate = toDate(formData.get("acquisitionDate"));
    const acquisitionCost = toNumber(formData.get("acquisitionCost"), "Coût");
    const currency = String(formData.get("currency") || "XAF");
    const usefulLifeMonths = toNumber(formData.get("usefulLifeMonths"), "Duree");
    const salvageValue = Number(formData.get("salvageValue") || 0);

    if (!name || !acquisitionDate) throw new Error("Champs obligatoires manquants");

    const asset = await AssetService.createAsset({
      tenantId: user.tenantId,
      categoryId,
      name,
      acquisitionDate,
      acquisitionCost,
      currency,
      usefulLifeMonths,
      salvageValue,
    });

    revalidatePath("/finance/assets");
    return { data: asset };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function runAssetDepreciation(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const period = String(formData.get("period") || "").trim();
    if (!period) throw new Error("Periode obligatoire");

    const result = await AssetService.runDepreciation({ tenantId: user.tenantId, period });
    revalidatePath("/finance/assets");
    return { data: result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// =============================
// Payroll
// =============================

export async function upsertPayrollProfile(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const userId = String(formData.get("userId") || "");
    const baseSalary = toNumber(formData.get("baseSalary"), "Salaire");
    const currency = String(formData.get("currency") || "XAF");
    const bankAccount = String(formData.get("bankAccount") || "") || undefined;

    if (!userId) throw new Error("Employe manquant");

    const profile = await PayrollService.upsertProfile({
      tenantId: user.tenantId,
      userId,
      baseSalary,
      currency,
      bankAccount,
    });

    revalidatePath("/finance/payroll");
    return { data: profile };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function createPayrollRun(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const periodStart = toDate(formData.get("periodStart"));
    const periodEnd = toDate(formData.get("periodEnd"));
    if (!periodStart || !periodEnd) throw new Error("Periode invalide");

    const run = await PayrollService.createRun({
      tenantId: user.tenantId,
      periodStart,
      periodEnd,
      createdById: user.id,
    });

    revalidatePath("/finance/payroll");
    return { data: run };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function addPayrollLine(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const runId = String(formData.get("runId") || "");
    const userId = String(formData.get("userId") || "");
    const baseSalary = toNumber(formData.get("baseSalary"), "Salaire");
    const allowances = Number(formData.get("allowances") || 0);
    const deductions = Number(formData.get("deductions") || 0);

    if (!runId || !userId) throw new Error("Champs manquants");

    const line = await PayrollService.addLine({
      runId,
      userId,
      baseSalary,
      allowances,
      deductions,
    });

    revalidatePath("/finance/payroll");
    return { data: line };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function markPayrollRunPaid(runId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");
    await PayrollService.markRunPaid(runId);
    revalidatePath("/finance/payroll");
    return { data: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// =============================
// VAT Export & AR reminders
// =============================

export async function exportVatReport(reportId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.view");
    const report = await TaxService.exportVatReport(user.tenantId, reportId);
    return { data: report };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur TVA" };
  }
}

export async function autoSendInvoiceReminders() {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");
    const result = await InvoiceService.autoRemindOverdue(user.tenantId);
    revalidatePath("/finance/invoices");
    return { data: result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur relance" };
  }
}
