import { NextResponse } from "next/server";

import { requireSecretHeader } from "@/lib/api/secret-auth";
import { prisma } from "@/lib/db";
import { cancelQuoteWorkflowTasks, syncDemandStatusForQuote } from "@/lib/quotes/workflow";
import { NotificationService } from "@/lib/services/notification.service";

const EXPIRABLE_PAYMENT_STATUSES = ["PENDING_PROOF", "PROOF_REJECTED"] as const;

function uniqueIds(ids: Array<string | null | undefined>) {
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
}

async function getOrderTeamUserIds(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      ownerId: true,
      onboardedById: true,
      collaborators: { select: { userId: true } },
    },
  });

  if (!order) return [];
  return uniqueIds([order.ownerId, order.onboardedById, ...order.collaborators.map((c) => c.userId)]);
}

export async function POST(req: Request) {
  try {
    const auth = requireSecretHeader(req, "CRON_SECRET");
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json().catch(() => ({}));
    const tenantId = body?.tenantId ? String(body.tenantId) : null;
    const now = new Date();

    const payments = await prisma.payment.findMany({
      where: {
        direction: "INBOUND",
        type: "CLIENT_DEPOSIT",
        status: { in: [...EXPIRABLE_PAYMENT_STATUSES] },
        expiresAt: { lt: now },
        ...(tenantId ? { order: { tenantId } } : {}),
      },
      select: {
        id: true,
        orderId: true,
        status: true,
        method: true,
        methodKey: true,
        depositCode: true,
        expiresAt: true,
        order: {
          select: {
            id: true,
            tenantId: true,
            orderNumber: true,
            status: true,
          },
        },
      },
      orderBy: { expiresAt: "asc" },
    });

    let paymentsExpired = 0;
    let quotesExpired = 0;
    let ordersRolledBack = 0;
    let notificationsSent = 0;

    for (const payment of payments) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "EXPIRED",
          notes: [
            `Paiement differe expire automatiquement le ${now.toISOString()}.`,
            payment.depositCode ? `Code depot: ${payment.depositCode}.` : null,
          ]
            .filter(Boolean)
            .join(" "),
        },
      });
      paymentsExpired += 1;

      const activeQuote = await prisma.quote.findFirst({
        where: {
          orderId: payment.orderId,
          isActive: true,
          paymentStatus: { in: ["PENDING", "SUBMITTED"] },
        },
        select: {
          id: true,
          orderId: true,
          status: true,
        },
        orderBy: { version: "desc" },
      });

      if (!activeQuote) {
        continue;
      }

      await prisma.quote.update({
        where: { id: activeQuote.id },
        data: {
          status: "EXPIRED",
          paymentStatus: "EXPIRED",
          paymentToken: null,
          paymentExpiry: null,
          paymentMethod: null,
          paidAt: null,
        },
      });
      quotesExpired += 1;

      if (payment.order.status === "PAIEMENT_EN_COURS") {
        await prisma.order.update({
          where: { id: payment.orderId },
          data: { status: "DEVIS" },
        });
        ordersRolledBack += 1;
      }

      await cancelQuoteWorkflowTasks({
        orderId: payment.orderId,
        includePaymentTasks: true,
        excludingQuoteId: activeQuote.id,
      });
      await syncDemandStatusForQuote(activeQuote.id);

      const teamIds = await getOrderTeamUserIds(payment.orderId);
      if (teamIds.length > 0) {
        await NotificationService.notifyMany(teamIds, {
          tenantId: payment.order.tenantId,
          type: "QUOTE_EXPIRED",
          title: `Paiement expire - ${payment.order.orderNumber}`,
          message:
            "Le delai de preuve de paiement est depasse. Le devis actif a ete expire et doit etre regenere avant tout nouvel encaissement.",
          entityType: "quote",
          entityId: activeQuote.id,
        });
        notificationsSent += teamIds.length;
      }
    }

    return NextResponse.json({
      data: {
        checked: payments.length,
        paymentsExpired,
        quotesExpired,
        ordersRolledBack,
        notificationsSent,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Expire payments cron error" },
      { status: 500 }
    );
  }
}
