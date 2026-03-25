"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";

export async function getInboundSources() {
  try {
    const user = await getSession();
    checkPermission(user.role, "crm.view");

    const sources = await prisma.crmInboundSource.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: "desc" },
    });
    return { data: sources };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function createInboundSource(data: {
  type: "EMAIL_ALIAS" | "WEB_FORM" | "API";
  name: string;
  emailAlias?: string | null;
  formToken?: string | null;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "crm.manage");

    const token = data.formToken || (data.type === "WEB_FORM" ? randomUUID() : null);

    const source = await prisma.crmInboundSource.create({
      data: {
        tenantId: user.tenantId,
        type: data.type,
        name: data.name,
        emailAlias: data.emailAlias || undefined,
        formToken: token || undefined,
      },
    });

    revalidatePath("/crm/sources");
    return { data: source };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function toggleInboundSource(sourceId: string, status: "ACTIVE" | "DISABLED") {
  try {
    const user = await getSession();
    checkPermission(user.role, "crm.manage");

    const source = await prisma.crmInboundSource.update({
      where: { id: sourceId },
      data: { status },
    });

    revalidatePath("/crm/sources");
    return { data: source };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function rotateInboundToken(sourceId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "crm.manage");

    const source = await prisma.crmInboundSource.update({
      where: { id: sourceId },
      data: { formToken: randomUUID() },
    });

    revalidatePath("/crm/sources");
    return { data: source };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getInboundEvents(limit = 50) {
  try {
    const user = await getSession();
    checkPermission(user.role, "crm.view");

    const events = await prisma.crmInboundEvent.findMany({
      where: { tenantId: user.tenantId },
      include: {
        source: { select: { id: true, name: true, type: true } },
        contact: { select: { id: true, name: true } },
        lead: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return { data: events };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}
