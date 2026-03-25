import { prisma } from "@/lib/db";
import { CrmEmailService } from "@/lib/services/crm-email.service";

export class NurturingService {
  static async advanceEnrollment(enrollmentId: string, actorId?: string | null) {
    const enrollment = await prisma.nurturingEnrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        sequence: { include: { steps: { orderBy: { order: "asc" } } } },
        lead: { include: { contact: true } },
      },
    });

    if (!enrollment) return { error: "Enrollment introuvable" };
    return this.advanceEnrollmentRecord(enrollment, actorId);
  }

  static async advanceEnrollmentRecord(
    enrollment: any,
    actorId?: string | null
  ) {
    const steps = enrollment.sequence.steps;
    const stepIndex = enrollment.currentStep;

    if (stepIndex >= steps.length) {
      await prisma.nurturingEnrollment.update({
        where: { id: enrollment.id },
        data: { status: "COMPLETED", nextStepAt: null },
      });
      return { completed: true };
    }

    const step = steps[stepIndex];
    const channel = String((step as any).channel || "").toUpperCase();
    if (channel === "EMAIL") {
      const contact = enrollment.lead?.contact;
      const to = contact?.email;
      if (!to) {
        const retryAt = new Date(Date.now() + 6 * 3600 * 1000);
        await prisma.nurturingEnrollment.update({
          where: { id: enrollment.id },
          data: { nextStepAt: retryAt },
        });
        return { error: "Email contact manquant" };
      }

      const sendResult = await CrmEmailService.send({
        tenantId: contact.tenantId,
        contactId: contact.id,
        leadId: enrollment.leadId,
        to,
        subject: step.subject || `Suivi ${contact.name}`,
        body: step.body,
        contactName: contact.name,
        actorId,
        tag: "nurturing",
      });

      if (sendResult.error) {
        const retryAt = new Date(Date.now() + 2 * 3600 * 1000);
        await prisma.nurturingEnrollment.update({
          where: { id: enrollment.id },
          data: { nextStepAt: retryAt },
        });
        return { error: sendResult.error };
      }
    }

    const nextStepIndex = stepIndex + 1;
    if (nextStepIndex >= steps.length) {
      await prisma.nurturingEnrollment.update({
        where: { id: enrollment.id },
        data: { status: "COMPLETED", currentStep: nextStepIndex, nextStepAt: null },
      });
      return { completed: true };
    }

    const nextStep = steps[nextStepIndex];
    const nextStepAt = new Date(Date.now() + nextStep.delayDays * 86400000);
    await prisma.nurturingEnrollment.update({
      where: { id: enrollment.id },
      data: { currentStep: nextStepIndex, nextStepAt },
    });

    return { advanced: true };
  }
}


