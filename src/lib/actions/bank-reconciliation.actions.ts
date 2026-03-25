"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { AuditService } from "@/lib/services/audit.service";
import { BankService } from "@/lib/services/bank.service";
import { prisma } from "@/lib/db";

type ParsedRow = {
  date: Date;
  description?: string;
  debit?: number;
  credit?: number;
  amount?: number;
  currency?: string;
  reference?: string;
};

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') {
      current += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  result.push(current.trim());
  return result;
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = (name: string) => header.indexOf(name.toLowerCase());
  const get = (row: string[], name: string) => {
    const i = idx(name);
    return i >= 0 ? row[i] : "";
  };

  const rows: ParsedRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const dateRaw = get(cols, "date") || get(cols, "transaction_date") || get(cols, "value_date");
    const date = dateRaw ? new Date(dateRaw) : null;
    if (!date || Number.isNaN(date.getTime())) continue;
    const debitRaw = get(cols, "debit");
    const creditRaw = get(cols, "credit");
    const amountRaw = get(cols, "amount") || get(cols, "montant");
    const debit = debitRaw ? Number(debitRaw.replace(",", ".")) : undefined;
    const credit = creditRaw ? Number(creditRaw.replace(",", ".")) : undefined;
    const amount = amountRaw ? Number(amountRaw.replace(",", ".")) : undefined;
    rows.push({
      date,
      description: get(cols, "description") || get(cols, "label") || get(cols, "libelle"),
      debit: Number.isNaN(debit ?? 0) ? undefined : debit,
      credit: Number.isNaN(credit ?? 0) ? undefined : credit,
      amount: Number.isNaN(amount ?? 0) ? undefined : amount,
      currency: get(cols, "currency") || get(cols, "devise") || undefined,
      reference: get(cols, "reference") || get(cols, "ref") || undefined,
    });
  }
  return rows;
}

async function autoMatchLedgerEntries(tenantId: string, transactionIds: string[]) {
  if (transactionIds.length === 0) return { reconciled: 0 };
  const transactions = await prisma.bankTransaction.findMany({
    where: { id: { in: transactionIds } },
  });
  if (transactions.length === 0) return { reconciled: 0 };

  const minDate = new Date(Math.min(...transactions.map((t) => t.occurredAt.getTime())));
  const maxDate = new Date(Math.max(...transactions.map((t) => t.occurredAt.getTime())));
  const start = new Date(minDate.getTime() - 3 * 86_400_000);
  const end = new Date(maxDate.getTime() + 3 * 86_400_000);

  const ledgerEntries = await prisma.ledgerEntry.findMany({
    where: {
      account: { tenantId },
      createdAt: { gte: start, lte: end },
    },
    include: { account: true },
  });

  let reconciled = 0;
  for (const tx of transactions) {
    const txAmount = Math.abs(Number(tx.amount));
    let best: { entry: typeof ledgerEntries[number]; score: number } | null = null;
    for (const entry of ledgerEntries) {
      const entryAmount = Math.abs(Number(entry.amount));
      const amountDiff = Math.abs(entryAmount - txAmount);
      if (amountDiff > 50) continue;
      const diffDays = Math.abs(
        (entry.createdAt.getTime() - tx.occurredAt.getTime()) / 86_400_000
      );
      if (diffDays > 3) continue;
      const score = Math.max(0, 100 - amountDiff * 0.5 - diffDays * 10);
      if (!best || score > best.score) best = { entry, score };
    }
    if (best && best.score >= 60) {
      await prisma.bankTransaction.update({
        where: { id: tx.id },
        data: {
          status: "RECONCILED",
          matchScore: best.score,
          matchMethod: "LEDGER",
          metadata: {
            ...(tx.metadata as Record<string, unknown>),
            ledgerEntryId: best.entry.id,
          },
        },
      });
      reconciled++;
    }
  }

  return { reconciled };
}

export async function importBankStatement(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const connectionId = String(formData.get("connectionId") || "");
    const file = formData.get("file");
    if (!connectionId || !(file instanceof File)) {
      throw new Error("Connexion et fichier requis");
    }

    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) throw new Error("CSV vide ou invalide");

    const importedIds: string[] = [];
    for (const row of rows) {
      const amount = row.amount ?? row.credit ?? row.debit ?? 0;
      const direction = row.credit && !row.debit ? "IN" : row.debit && !row.credit ? "OUT" : amount >= 0 ? "IN" : "OUT";
      const tx = await BankService.addTransaction({
        connectionId,
        occurredAt: row.date,
        amount: Math.abs(amount),
        currency: row.currency || "XAF",
        direction,
        description: row.description || undefined,
        reference: row.reference || undefined,
        counterparty: undefined,
        category: undefined,
        metadata: row as Record<string, unknown>,
      });
      importedIds.push(tx.id);
    }

    const matchResult = await autoMatchLedgerEntries(user.tenantId, importedIds);

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "bank.statement.imported",
      entityType: "bank_transaction",
      entityId: connectionId,
      newValue: { imported: importedIds.length, reconciled: matchResult.reconciled },
    });

    revalidatePath("/finance/banks");
    return { data: { imported: importedIds.length, reconciled: matchResult.reconciled } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur import" };
  }
}

export async function reconcileTransaction(transactionId: string, paymentId?: string, ledgerEntryId?: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const tx = await prisma.bankTransaction.update({
      where: { id: transactionId },
      data: {
        status: "RECONCILED",
        matchedPaymentId: paymentId || undefined,
        matchMethod: "MANUAL",
        metadata: ledgerEntryId ? { ledgerEntryId } : undefined,
      },
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "bank.transaction.manual_reconcile",
      entityType: "bank_transaction",
      entityId: tx.id,
      newValue: { paymentId: paymentId || null, ledgerEntryId: ledgerEntryId || null },
    });

    revalidatePath("/finance/banks");
    return { data: tx };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function markUnreconciled(transactionId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    const tx = await prisma.bankTransaction.update({
      where: { id: transactionId },
      data: {
        status: "PENDING",
        matchedPaymentId: null,
        matchScore: null,
        matchMethod: null,
      },
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "bank.transaction.unreconciled",
      entityType: "bank_transaction",
      entityId: tx.id,
    });

    revalidatePath("/finance/banks");
    return { data: tx };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}
