"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { LeadMiningService } from "@/lib/services/lead-mining.service";

export async function getLeadMiningProviders() {
  try {
    const user = await getSession();
    checkPermission(user.role, "crm.view");

    const providers = await prisma.leadMiningProvider.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: "desc" },
    });
    return { data: providers };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function createLeadMiningProvider(data: {
  name: string;
  provider: string;
  apiUrl?: string | null;
  apiToken?: string | null;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "crm.manage");

    const provider = await prisma.leadMiningProvider.create({
      data: {
        tenantId: user.tenantId,
        name: data.name,
        provider: data.provider,
        apiUrl: data.apiUrl || undefined,
        apiToken: data.apiToken || undefined,
      },
    });

    revalidatePath("/crm/sources");
    return { data: provider };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getLeadMiningJobs() {
  try {
    const user = await getSession();
    checkPermission(user.role, "crm.view");

    const jobs = await prisma.leadMiningJob.findMany({
      where: { tenantId: user.tenantId },
      include: { provider: true },
      orderBy: { createdAt: "desc" },
    });
    return { data: jobs };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function createLeadMiningJob(data: { providerId?: string | null; query: string }) {
  try {
    const user = await getSession();
    checkPermission(user.role, "crm.manage");

    const job = await LeadMiningService.createJob(user.tenantId, data.providerId || null, data.query);
    revalidatePath("/crm/sources");
    return { data: job };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getLeadMiningResults(jobId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "crm.view");

    const results = await prisma.leadMiningResult.findMany({
      where: { tenantId: user.tenantId, jobId },
      include: {
        contact: { select: { id: true, name: true } },
        lead: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return { data: results };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}
