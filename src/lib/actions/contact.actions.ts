"use server";

import { getSession } from "@/lib/session";
import { ContactService } from "@/lib/services/contact.service";
import { LeadService } from "@/lib/services/lead.service";
import { AuditService } from "@/lib/services/audit.service";
import { checkPermission } from "@/lib/permissions";
import { createContactSchema, createLeadSchema, updateContactSchema } from "@/lib/validators/contact";
import { revalidatePath } from "next/cache";
import type { ContactType, LeadStatus } from "@prisma/client";

export async function createContact(formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "contact.manage");

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
    checkPermission(user.role, "contact.manage");

    // Verify tenant ownership
    const existing = await ContactService.getById(contactId);
    if (!existing || existing.tenantId !== user.tenantId) {
      return { error: "Contact introuvable" };
    }

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
    revalidatePath("/crm");
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
    return { error: error instanceof Error ? error.message : "Erreur lors de la récupération" };
  }
}

export async function getContactTypeCount() {
  try {
    const user = await getSession();
    return { data: await ContactService.getTypeCount(user.tenantId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la récupération" };
  }
}

// --- Leads ---

export async function createLead(formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "lead.manage");

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
    return { error: error instanceof Error ? error.message : "Erreur lors de la récupération" };
  }
}

export async function updateLeadStatus(leadId: string, status: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "lead.manage");

    const lead = await LeadService.updateStatus(leadId, status as LeadStatus);
    revalidatePath("/crm");
    return { data: lead };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la mise à jour" };
  }
}

export async function getLeadById(leadId: string) {
  try {
    const user = await getSession();
    const lead = await LeadService.getById(leadId);
    if (!lead || lead.contact.tenantId !== user.tenantId) {
      return { error: "Lead introuvable" };
    }
    return { data: lead };
  } catch (error) {
    console.error("Error fetching lead:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la récupération" };
  }
}

export async function updateLead(leadId: string, data: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "lead.manage");

    const existing = await LeadService.getById(leadId);
    if (!existing || existing.contact.tenantId !== user.tenantId) {
      return { error: "Lead introuvable" };
    }

    const lead = await LeadService.update(leadId, data as any);
    revalidatePath("/crm");
    revalidatePath(`/crm/leads/${leadId}`);
    return { data: lead };
  } catch (error) {
    console.error("Error updating lead:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la mise à jour" };
  }
}

export async function getLeadPipeline() {
  try {
    const user = await getSession();
    return { data: await LeadService.getPipelineStats(user.tenantId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la récupération" };
  }
}

export async function exportContactsCSV() {
  try {
    const user = await getSession();
    const result = await ContactService.list(user.tenantId, { limit: 10000 });
    const contacts = result.contacts;

    const TYPE_LABELS: Record<string, string> = {
      CLIENT: "Client",
      PROSPECT: "Prospect",
      SUPPLIER: "Fournisseur",
      FREIGHT_PARTNER: "Transitaire",
      CUSTOMS_BROKER: "Douanier",
      QC_PARTNER: "QC",
      OTHER: "Autre",
    };

    const headers = [
      "Nom",
      "Type",
      "Entreprise",
      "Téléphone",
      "Email",
      "WhatsApp",
      "Ville",
      "Pays",
      "Score de confiance",
      "Commandes",
      "Leads",
      "Créé le",
    ];

    const rows = contacts.map((c) => [
      c.name,
      TYPE_LABELS[c.type] || c.type,
      c.company || "",
      c.phone || "",
      c.email || "",
      c.whatsapp || "",
      c.city || "",
      c.country,
      String(c.trustScore),
      String(c._count.orders),
      String(c._count.leads),
      c.createdAt.toISOString().split("T")[0],
    ]);

    const escapeCsvField = (field: string) => {
      if (field.includes(",") || field.includes('"') || field.includes("\n")) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    const csv = [
      headers.map(escapeCsvField).join(","),
      ...rows.map((row) => row.map(escapeCsvField).join(",")),
    ].join("\n");

    return { data: csv };
  } catch (error) {
    console.error("Error exporting contacts:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de l'export" };
  }
}
