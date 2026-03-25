import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AuditService } from "@/lib/services/audit.service";

/**
 * DELETE /api/gdpr/forget?contactId=xxx
 * Anonymises all personal data for a contact (right to be forgotten / RGPD).
 * Preserves orders/leads for accounting integrity but strips PII.
 * Requires ADMIN or DIRECTION role only.
 */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
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

  if (!["ADMIN", "DIRECTION"].includes(role)) {
    return NextResponse.json({ error: "Accès refusé — ADMIN/DIRECTION uniquement" }, { status: 403 });
  }

  const contact = await prisma.contact.findFirst({
    where: { id: contactId, tenantId },
  });

  if (!contact) {
    return NextResponse.json({ error: "Contact introuvable" }, { status: 404 });
  }

  const anonId = `anon_${contactId.slice(-8)}`;

  await prisma.$transaction(async (tx) => {
    // Anonymise the contact record — preserve id and tenantId for referential integrity
    await tx.contact.update({
      where: { id: contactId },
      data: {
        name: `[Supprimé ${anonId}]`,
        email: `deleted-${anonId}@gdpr.local`,
        phone: null,
        company: null,
        city: null,
        notes: "[Données supprimées — RGPD]",
        tags: [],
        customFields: {},
      },
    });

    // Strip PII from leads (keep pipeline/value for analytics)
    await tx.lead.updateMany({
      where: { contactId },
      data: {
        notes: "[Données supprimées — RGPD]",
        customFields: {},
      },
    });

    // Delete engagement events (contain interaction data)
    await tx.engagementEvent.deleteMany({
      where: { contactId },
    });

    // Delete email recipient records
    await tx.emailRecipient.deleteMany({
      where: { contactId },
    });

    // Anonymise email logs — strip subject but keep delivery status for audit
    await tx.emailLog.updateMany({
      where: { contactId, tenantId },
      data: { subject: "[Supprimé — RGPD]", body: "[Supprimé — RGPD]" },
    });

    // Log the GDPR forget action inside the transaction
    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        action: "gdpr.forget",
        entityType: "contact",
        entityId: contactId,
        oldValue: { name: contact.name, email: contact.email },
        newValue: { anonId, forgottenAt: new Date().toISOString() },
      },
    });
  });

  return NextResponse.json({
    success: true,
    message: `Contact ${contactId} anonymisé (RGPD). Commandes et leads conservés pour la comptabilité.`,
    anonId,
  });
}
