import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { NotificationService } from "@/lib/services/notification.service";
import { requireSecretHeader } from "@/lib/api/secret-auth";

export async function POST(req: Request) {
  try {
    const auth = requireSecretHeader(req, "CRON_SECRET");
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const lowAccounts = await prisma.treasuryAccount.findMany({
      where: {
        currency: "CNY",
        alertBelowAmount: { not: null },
      },
      select: {
        id: true,
        tenantId: true,
        label: true,
        balance: true,
        alertBelowAmount: true,
      },
    });

    let notifications = 0;

    for (const account of lowAccounts) {
      if (account.alertBelowAmount == null) continue;
      if (Number(account.balance) >= Number(account.alertBelowAmount)) continue;

      const recipients = await prisma.user.findMany({
        where: {
          tenantId: account.tenantId,
          isActive: true,
          role: { in: ["CEO", "DIRECTION", "ADMIN", "FINANCE_MANAGER", "FINANCE"] as any[] },
        },
        select: { id: true },
      });

      if (recipients.length === 0) continue;

      await NotificationService.notifyMany(
        recipients.map((recipient) => recipient.id),
        {
          tenantId: account.tenantId,
          type: "SLA_BREACH",
          title: `Alerte wallet CNY - ${account.label}`,
          message: `Le solde ${Number(account.balance).toFixed(2)} est passe sous le seuil ${Number(account.alertBelowAmount).toFixed(2)}.`,
          entityType: "treasury_account",
          entityId: account.id,
        }
      );

      notifications += recipients.length;
    }

    return NextResponse.json({
      data: {
        checkedAccounts: lowAccounts.length,
        notifications,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur cron tresorerie" },
      { status: 500 }
    );
  }
}
