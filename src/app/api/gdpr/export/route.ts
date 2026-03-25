import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

import { AuditService } from "@/lib/services/audit.service";

const prismaAny = prisma as any;

/**
 * GET /api/gdpr/export?contactId=xxx
 * Returns all personal data for a contact as a JSON export.
 * Requires ADMIN or DIRECTION role (or the authenticated user's own data).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifiÃ©" }, { status: 401 });
  }

  const { role, tenantId, id: userId } = session.user as {
    role: string;
    tenantId: string;
    id: string;
  };

  const contactId = req.nextUrl.searchParams.get("contactId");
  if (!contactId) {
    return NextResponse.json({ error: "contactId requis" }, { status: 400 });
  }

  const allowed = ["ADMIN", "DIRECTION", "CEO"].includes(role);
  if (!allowed) {
    return NextResponse.json({ error: "AccÃ¨s refusÃ©" }, { status: 403 });
  }

  const contact = await prismaAny.contact.findFirst({
    where: { id: contactId, tenantId },
    include: {
      orders: {
        select: {
          id: true,
          reference: true,
          status: true,
          totalAmount: true,
          currency: true,
          createdAt: true,
        },
      },
      leads: {
        select: {
          id: true,
          status: true,
          source: true,
          estimatedValue: true,
          createdAt: true,
        },
      },
      engagementEvents: {
        select: {
          id: true,
          eventType: true,
          channelId: true,
          createdAt: true,
        },
      },
      emailLogs: {
        select: {
          id: true,
          subject: true,
          status: true,
          sentAt: true,
          openedAt: true,
        },
      },
      emailRecipients: {
        select: {
          id: true,
          status: true,
          sentAt: true,
          openedAt: true,
          clickedAt: true,
          campaign: { select: { name: true, subject: true } },
        },
      },
    },
  });

  if (!contact) {
    return NextResponse.json({ error: "Contact introuvable" }, { status: 404 });
  }

  await AuditService.log({
    tenantId,
    userId,
    action: "gdpr.export",
    entityType: "contact",
    entityId: contactId,
    newValue: { exportedAt: new Date().toISOString() },
  });

  const exportData = {
    exportedAt: new Date().toISOString(),
    exportedBy: session.user.email,
    contact: {
      id: contact.id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      company: contact.company,
      type: contact.type,
      tags: contact.tags,
      notes: contact.notes,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
    },
    orders: contact.orders,
    leads: contact.leads,
    engagementEvents: contact.engagementEvents,
    emailLogs: contact.emailLogs,
    emailCampaigns: contact.emailRecipients,
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="gdpr-export-${contactId}-${Date.now()}.json"`,
    },
  });
}

