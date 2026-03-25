import { prisma } from "@/lib/db";
import { CrmIngestionService } from "@/lib/services/crm-ingestion.service";

type LeadMiningPayload = {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  country?: string;
  city?: string;
  description?: string;
  category?: string;
  estimatedValue?: number;
  currency?: string;
  source?: string;
};

export class LeadMiningService {
  static async createJob(tenantId: string, providerId: string | null, query: string) {
    const job = await prisma.leadMiningJob.create({
      data: {
        tenantId,
        providerId: providerId || undefined,
        query,
        status: "QUEUED",
      },
    });

    if (providerId) {
      void this.triggerProvider(job.id);
    }

    return job;
  }

  static async triggerProvider(jobId: string) {
    const job = await prisma.leadMiningJob.findUnique({
      where: { id: jobId },
      include: { provider: true },
    });
    if (!job?.provider?.apiUrl) return;

    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
    const callbackUrl = appUrl ? `${appUrl}/api/crm/lead-mining/webhook` : null;

    await prisma.leadMiningJob.update({
      where: { id: jobId },
      data: { status: "RUNNING" },
    });

    try {
      await fetch(job.provider.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(job.provider.apiToken ? { Authorization: `Bearer ${job.provider.apiToken}` } : {}),
        },
        body: JSON.stringify({
          jobId: job.id,
          tenantId: job.tenantId,
          query: job.query,
          callbackUrl,
        }),
      });
    } catch (error: any) {
      await prisma.leadMiningJob.update({
        where: { id: jobId },
        data: { status: "FAILED", error: error?.message || "provider_call_failed" },
      });
    }
  }

  static async ingestResults(jobId: string, results: LeadMiningPayload[]) {
    const job = await prisma.leadMiningJob.findUnique({ where: { id: jobId } });
    if (!job) return { error: "job_not_found" };

    let created = 0;
    for (const result of results) {
      const sourceRef = `${jobId}:${result.id || result.email || result.phone || created}`;
      const ingestion = await CrmIngestionService.ingest({
        tenantId: job.tenantId,
        sourceType: "API",
        sourceRef,
        payload: result as Record<string, unknown>,
        contact: {
          name: result.name,
          email: result.email,
          phone: result.phone,
          company: result.company,
          country: result.country,
          city: result.city,
        },
        lead: {
          description: result.description,
          category: result.category,
          estimatedValue: result.estimatedValue ?? null,
          currency: result.currency || "XAF",
        },
      });

      await prisma.leadMiningResult.create({
        data: {
          tenantId: job.tenantId,
          jobId: job.id,
          payload: result as any,
          contactId: "contactId" in ingestion ? ingestion.contactId ?? undefined : undefined,
          leadId: "leadId" in ingestion ? ingestion.leadId ?? undefined : undefined,
          status: ingestion.status === "processed" ? "IMPORTED" : ingestion.status,
        },
      });

      if (ingestion.status === "processed") created += 1;
    }

    await prisma.leadMiningJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        resultCount: created,
        completedAt: new Date(),
      },
    });

    return { created };
  }
}
