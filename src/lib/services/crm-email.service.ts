import { prisma } from "@/lib/db";
import { AuditService } from "@/lib/services/audit.service";
import { renderCrmEmail } from "@/lib/email-templates/crm-email";

export class CrmEmailService {
  static async send(params: {
    tenantId: string;
    contactId: string;
    leadId?: string | null;
    to: string;
    subject: string;
    body: string;
    contactName?: string | null;
    actorId?: string | null;
    tag?: string;
  }) {
    const fromAddress = process.env.EMAIL_FROM ?? "noreply@horion.cd";
    const apiKey = process.env.RESEND_API_KEY;

    let provider = "stub";
    let providerId: string | undefined;
    let error: string | undefined;

    if (apiKey) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(apiKey);
        const html = renderCrmEmail({
          title: params.subject,
          message: params.body,
          recipientName: params.contactName ?? undefined,
        });
        const result = await resend.emails.send({
          from: fromAddress,
          to: params.to,
          subject: params.subject,
          html,
          text: params.body,
        });
        provider = "resend";
        providerId = (result as any)?.data?.id ?? (result as any)?.id;
      } catch (err) {
        error = err instanceof Error ? err.message : "Erreur envoi email";
      }
    } else {
      if (process.env.NODE_ENV !== "production") {
        console.log("[CrmEmailService] STUB send", {
          to: params.to,
          subject: params.subject,
        });
      }
    }

    const log = await prisma.emailLog.create({
      data: {
        tenantId: params.tenantId,
        contactId: params.contactId,
        leadId: params.leadId ?? undefined,
        subject: params.subject,
        body: params.body,
        status: "SENT",
        provider,
        providerId,
        metadata: {
          tag: params.tag,
          error,
        },
      },
    });

    if (params.actorId) {
      await AuditService.log({
        tenantId: params.tenantId,
        userId: params.actorId,
        action: "crm.email_sent",
        entityType: "contact",
        entityId: params.contactId,
        newValue: {
          emailLogId: log.id,
          subject: params.subject,
          to: params.to,
        },
      });
    }

    return { data: log, error };
  }
}
