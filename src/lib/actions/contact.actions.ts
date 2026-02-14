"use server";

import { auth } from "@/lib/auth";
import { ContactService } from "@/lib/services/contact.service";
import { LeadService } from "@/lib/services/lead.service";
import { AuditService } from "@/lib/services/audit.service";
import { createContactSchema, createLeadSchema, updateContactSchema } from "@/lib/validators/contact";
import { revalidatePath } from "next/cache";
import type { ContactType, LeadStatus, UserRole } from "@prisma/client";

async function getSession() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  return session.user as { id: string; email: string; name: string; role: UserRole; tenantId: string };
}

export async function createContact(formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    const validated = createContactSchema.parse(formData);
    const contact = await ContactService.create(user.tenantId, validated);

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "contact.created",
      entityType: "contact",
      entityId: contact.id,
      newValue: { name: contact.name, type: contact.type },
    });

    revalidatePath("/contacts");
    revalidatePath("/crm");
    return { data: contact };
  } catch (error) {
    console.error("Error creating contact:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la création du contact" };
  }
}

export async function updateContact(contactId: string, formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    const validated = updateContactSchema.parse(formData);
    const contact = await ContactService.update(contactId, validated);

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "contact.updated",
      entityType: "contact",
      entityId: contactId,
      newValue: JSON.parse(JSON.stringify(validated)),
    });

    revalidatePath("/contacts");
    revalidatePath(`/contacts/${contactId}`);
    return { data: contact };
  } catch (error) {
    console.error("Error updating contact:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la mise à jour" };
  }
}

export async function getContacts(options?: {
  type?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  try {
    const user = await getSession();
    const result = await ContactService.list(user.tenantId, {
      type: options?.type as ContactType | undefined,
      search: options?.search,
      page: options?.page,
      limit: options?.limit,
    });
    return { data: result.contacts };
  } catch (error) {
    console.error("Error fetching contacts:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la récupération" };
  }
}

export async function getContactById(contactId: string) {
  try {
    const user = await getSession();
    const contact = await ContactService.getById(contactId);
    if (!contact || contact.tenantId !== user.tenantId) {
      return { error: "Contact introuvable" };
    }
    return { data: contact };
  } catch (error) {
    console.error("Error fetching contact:", error);
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getContactTypeCount() {
  try {
    const user = await getSession();
    return { data: await ContactService.getTypeCount(user.tenantId) };
  } catch (error) {
    return { error: "Erreur" };
  }
}

// --- Leads ---

export async function createLead(formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    const validated = createLeadSchema.parse(formData);
    const lead = await LeadService.create(validated);

    revalidatePath("/crm");
    return { data: lead };
  } catch (error) {
    console.error("Error creating lead:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la création du lead" };
  }
}

export async function getLeads(options?: {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  try {
    const user = await getSession();
    const result = await LeadService.list(user.tenantId, {
      status: options?.status as LeadStatus | undefined,
      search: options?.search,
      page: options?.page,
      limit: options?.limit,
    });
    return { data: result.leads };
  } catch (error) {
    console.error("Error fetching leads:", error);
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function updateLeadStatus(leadId: string, status: string) {
  try {
    await getSession();
    const lead = await LeadService.updateStatus(leadId, status as LeadStatus);
    revalidatePath("/crm");
    return { data: lead };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getLeadPipeline() {
  try {
    const user = await getSession();
    return { data: await LeadService.getPipelineStats(user.tenantId) };
  } catch (error) {
    return { error: "Erreur" };
  }
}
