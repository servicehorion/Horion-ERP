import { prisma } from "@/lib/db";

export class FinanceStatementsService {
  static async getBalanceSheet(tenantId: string) {
    const accounts = await prisma.ledgerAccount.findMany({
      where: { tenantId },
      orderBy: { code: "asc" },
    });

    const assets = accounts.filter((a) => a.type === "ASSET");
    const liabilities = accounts.filter((a) => a.type === "LIABILITY");
    const equity = accounts.filter((a) => a.type === "EQUITY");

    const totalAssets = assets.reduce((sum, a) => sum + Number(a.balance), 0);
    const totalLiabilities = liabilities.reduce((sum, a) => sum + Math.abs(Number(a.balance)), 0);
    const totalEquity = equity.reduce((sum, a) => sum + Math.abs(Number(a.balance)), 0);

    return {
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      totalEquity,
    };
  }

  static async getIncomeStatement(tenantId: string) {
    const accounts = await prisma.ledgerAccount.findMany({
      where: { tenantId },
      orderBy: { code: "asc" },
    });
    const revenues = accounts.filter((a) => a.type === "REVENUE");
    const expenses = accounts.filter((a) => a.type === "EXPENSE");

    const totalRevenue = revenues.reduce((sum, a) => sum + Math.abs(Number(a.balance)), 0);
    const totalExpenses = expenses.reduce((sum, a) => sum + Math.abs(Number(a.balance)), 0);
    const netIncome = totalRevenue - totalExpenses;

    return {
      revenues,
      expenses,
      totalRevenue,
      totalExpenses,
      netIncome,
    };
  }
}
