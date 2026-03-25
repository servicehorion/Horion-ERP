import { prisma } from "@/lib/db";
import { AccountingService } from "@/lib/services/accounting.service";
import { FxService } from "@/lib/services/fx.service";

type Position = {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
  currency: string;
  signedForeignAmount: number;
  bookedXaf: number;
};

const TOLERANCE = 0.01;

function getLatestRate(rates: Record<string, number>, currency: string): number | null {
  const key = `${currency.toUpperCase()}_XAF`;
  return rates[key] ?? null;
}

function opposite(type: "DEBIT" | "CREDIT"): "DEBIT" | "CREDIT" {
  return type === "DEBIT" ? "CREDIT" : "DEBIT";
}

function accountIncreaseType(accountType: Position["accountType"]): "DEBIT" | "CREDIT" {
  return accountType === "ASSET" || accountType === "EXPENSE" ? "DEBIT" : "CREDIT";
}

async function getOrCreateFxAccount(params: {
  tenantId: string;
  code: string;
  name: string;
  type: "REVENUE" | "EXPENSE";
}) {
  return prisma.ledgerAccount.upsert({
    where: { tenantId_code: { tenantId: params.tenantId, code: params.code } },
    update: {},
    create: {
      tenantId: params.tenantId,
      code: params.code,
      name: params.name,
      type: params.type,
      currency: "XAF",
    },
  });
}

export class FxRevaluationService {
  static async runForTenant(params: { tenantId: string; userId?: string }) {
    const rates = await FxService.getLatestRates();

    const lines = await prisma.journalLine.findMany({
      where: {
        entry: {
          tenantId: params.tenantId,
          status: "POSTED",
        },
        currency: { not: "XAF" },
      },
      select: {
        accountId: true,
        type: true,
        amount: true,
        currency: true,
        fxRate: true,
        account: {
          select: {
            code: true,
            name: true,
            type: true,
          },
        },
      },
    });

    if (lines.length === 0) {
      return { adjustedEntries: 0, adjustedAmountXaf: 0, skipped: 0 };
    }

    const adjustments = await prisma.journalLine.findMany({
      where: {
        entry: {
          tenantId: params.tenantId,
          status: "POSTED",
          reference: { startsWith: "FXR:" },
        },
        currency: "XAF",
      },
      select: {
        accountId: true,
        type: true,
        amount: true,
      },
    });

    const adjustmentByAccount = adjustments.reduce<Record<string, number>>((acc, line) => {
      const signed = line.type === "DEBIT" ? Number(line.amount) : -Number(line.amount);
      acc[line.accountId] = (acc[line.accountId] || 0) + signed;
      return acc;
    }, {});

    const positionMap = new Map<string, Position>();

    for (const line of lines) {
      const rate = line.fxRate ? Number(line.fxRate) : getLatestRate(rates, line.currency);
      if (!rate) continue;

      const signed = line.type === "DEBIT" ? Number(line.amount) : -Number(line.amount);
      const key = `${line.accountId}:${line.currency.toUpperCase()}`;
      const existing = positionMap.get(key);

      if (!existing) {
        positionMap.set(key, {
          accountId: line.accountId,
          accountCode: line.account.code,
          accountName: line.account.name,
          accountType: line.account.type,
          currency: line.currency.toUpperCase(),
          signedForeignAmount: signed,
          bookedXaf: signed * rate,
        });
      } else {
        existing.signedForeignAmount += signed;
        existing.bookedXaf += signed * rate;
      }
    }

    const journal = await AccountingService.getOrCreateJournal({
      tenantId: params.tenantId,
      code: "FXR",
      name: "Revalorisation FX",
      type: "ADJUSTMENT",
    });

    const gainAccount = await getOrCreateFxAccount({
      tenantId: params.tenantId,
      code: "460",
      name: "Gains de change",
      type: "REVENUE",
    });

    const lossAccount = await getOrCreateFxAccount({
      tenantId: params.tenantId,
      code: "560",
      name: "Pertes de change",
      type: "EXPENSE",
    });

    let adjustedEntries = 0;
    let adjustedAmountXaf = 0;
    let skipped = 0;

    for (const position of positionMap.values()) {
      const latestRate = getLatestRate(rates, position.currency);
      if (!latestRate) {
        skipped += 1;
        continue;
      }

      const currentXaf = position.signedForeignAmount * latestRate;
      const previousAdjustments = adjustmentByAccount[position.accountId] || 0;
      const effectiveBookXaf = position.bookedXaf + previousAdjustments;
      const delta = currentXaf - effectiveBookXaf;

      if (Math.abs(delta) <= TOLERANCE) {
        skipped += 1;
        continue;
      }

      const increaseType = accountIncreaseType(position.accountType);
      const accountLineType = delta > 0 ? increaseType : opposite(increaseType);
      const isAssetExpense = position.accountType === "ASSET" || position.accountType === "EXPENSE";
      const isGain = (delta > 0 && isAssetExpense) || (delta < 0 && !isAssetExpense);
      const counterpart = isGain ? gainAccount : lossAccount;
      const amount = Math.abs(delta);

      await AccountingService.createJournalEntry({
        tenantId: params.tenantId,
        journalId: journal.id,
        reference: `FXR:${position.accountId}:${position.currency}`,
        memo: `FX revaluation ${position.accountCode} ${position.currency} @ ${latestRate.toFixed(6)}`,
        status: "POSTED",
        lines: [
          {
            accountId: position.accountId,
            type: accountLineType,
            amount,
            currency: "XAF",
            description: `FX revaluation ${position.currency}`,
          },
          {
            accountId: counterpart.id,
            type: opposite(accountLineType),
            amount,
            currency: "XAF",
            description: isGain ? "FX gain" : "FX loss",
          },
        ],
      });

      adjustedEntries += 1;
      adjustedAmountXaf += amount;
    }

    return {
      adjustedEntries,
      adjustedAmountXaf,
      skipped,
      totalPositions: positionMap.size,
    };
  }
}
