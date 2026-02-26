"use server";

import { getSession } from "@/lib/session";
import { PaymentService } from "@/lib/services/payment.service";
import { MarginService } from "@/lib/services/margin.service";
import { AuditService } from "@/lib/services/audit.service";
import { checkPermission } from "@/lib/permissions";
import { createPaymentSchema } from "@/lib/validators/payment";
import { revalidatePath } from "next/cache";
import type { PaymentDirection, PaymentStatus } from "@prisma/client";

export async function createPayment(formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "payment.create");

    const validated = createPaymentSchema.parse(formData);
    const payment = await PaymentService.create(validated);

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "payment.created",
      entityType: "payment",
      entityId: payment.id,
      newValue: {
        orderId: validated.orderId,
        direction: validated.direction,
        amount: validated.amount,
        currency: validated.currency,
      },
    });

    revalidatePath("/finance/payments");
    revalidatePath("/dashboard");
    return { data: payment };
  } catch (error) {
    console.error("Error creating payment:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la création du paiement" };
  }
}

export async function getPayments(options?: {
  orderId?: string;
  direction?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.view");
    const result = await PaymentService.list({
      tenantId: user.tenantId,
      orderId: options?.orderId,
      direction: options?.direction as PaymentDirection | undefined,
      status: options?.status as PaymentStatus | undefined,
      page: options?.page,
      limit: options?.limit,
    });
    return { data: result.payments };
  } catch (error) {
    console.error("Error fetching payments:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la récupération des paiements" };
  }
}

export async function confirmPayment(paymentId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "payment.confirm");

    const payment = await PaymentService.confirm(paymentId, user.tenantId);

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "payment.confirmed",
      entityType: "payment",
      entityId: paymentId,
    });

    revalidatePath("/finance/payments");
    revalidatePath("/dashboard");
    return { data: payment };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la confirmation" };
  }
}

export async function cancelPayment(paymentId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "payment.confirm");

    const payment = await PaymentService.cancel(paymentId, user.tenantId);

    revalidatePath("/finance/payments");
    revalidatePath("/dashboard");
    return { data: payment };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de l'annulation" };
  }
}

export async function getPaymentSummary(orderId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.view");
    return { data: await PaymentService.getOrderPaymentSummary(orderId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la récupération" };
  }
}

export async function getMonthlyPaymentStats() {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.view");
    return { data: await PaymentService.getMonthlyStats(user.tenantId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la récupération" };
  }
}

// --- Margins ---

export async function calculateMargin(orderId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.manage");
    const report = await MarginService.calculateForOrder(orderId);

    revalidatePath("/finance/margins");
    revalidatePath("/dashboard");
    return { data: report };
  } catch (error) {
    console.error("Error calculating margin:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors du calcul de la marge" };
  }
}

export async function getMargins(options?: { page?: number; limit?: number }) {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.view");
    const result = await MarginService.list(user.tenantId, options);
    return { data: result.reports };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la récupération des marges" };
  }
}

export async function getAverageMargin() {
  try {
    const user = await getSession();
    checkPermission(user.role, "finance.view");
    return { data: await MarginService.getAverageMargin(user.tenantId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la récupération" };
  }
}
