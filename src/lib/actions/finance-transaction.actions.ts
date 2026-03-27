"use server";

import { revalidatePath } from "next/cache";

import { checkPermission } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import { FinanceTransactionService } from "@/lib/services/finance-transaction.service";

export async function rectifyFinanceTransaction(params: {
  transactionId: string;
  reason: string;
  reference?: string;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");

    if (!params.reason?.trim()) {
      return { error: "Motif de rectification requis" };
    }

    const rectification = await FinanceTransactionService.createRectification({
      tenantId: user.tenantId,
      transactionId: params.transactionId,
      createdById: user.id,
      reason: params.reason.trim(),
      reference: params.reference?.trim() || undefined,
    });

    revalidatePath("/finance");
    revalidatePath("/finance/payments");
    revalidatePath("/finance/banks");
    revalidatePath("/finance/invoices");
    revalidatePath("/finance/margins");
    revalidatePath("/finance/statements");

    return { data: rectification };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Erreur lors de la rectification finance",
    };
  }
}
