"use server";

import { getSession } from "@/lib/session";
import { ContactService } from "@/lib/services/contact.service";
import { LeadService } from "@/lib/services/lead.service";
import { AuditService } from "@/lib/services/audit.service";
import { NotificationService } from "@/lib/services/notification.service";
import { LeadScoringService } from "@/lib/services/lead-scoring.service";
import { CrmEmailService } from "@/lib/services/crm-email.service";
import { LeadSlaService } from "@/lib/services/lead-sla.service";
import { CrmTaskOrchestratorService } from "@/lib/services/crm-task-orchestrator.service";
import { OperationalTaskService } from "@/lib/services/operational-task.service";
import { checkPermission } from "@/lib/permissions";
import { canExportCrm, getCrmContactScopeWithDelegation, getCrmLeadScopeWithDelegation } from "@/lib/access-control";
import { createContactSchema, createLeadSchema, updateContactSchema } from "@/lib/validators/contact";
import { revalidatePath } from "next/cache";
import type { ContactType, LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

const uniqueIds = (ids: Array<string | null | undefined>) =>
  Array.from(new Set(ids.filter((id): id is string => Boolean(id))));

const normalizeCollaboratorIds = (ids: string[] | undefined, ownerId?: string | null) => {
  const cleaned = (ids || []).map((id) => id.trim()).filter(Boolean);
  return Array.from(new Set(cleaned.filter((id) => id !== ownerId)));
};

const extractCollaboratorIds = (collaborators: any): string[] => {
  if (!Array.isArray(collaborators)) return [];
  return collaborators
    .map((c) => c?.userId || c?.user?.id)
    .filter((id): id is string => Boolean(id));
};

export async function createContact(formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "contact.manage");

    const validated = createContactSchema.parse(formData);
    const ownerId = validated.ownerId || user.id;
    const collaboratorIds = normalizeCollaboratorIds(validated.collaboratorIds, ownerId);

    if (validated.phone) {
      const duplicate = await prisma.contact.findFirst({
        where: { tenantId: user.tenantId, phone: validated.phone },
        select: { name: true },
      });
      if (duplicate) {
        return { error: `Doublon : le contact "${duplicate.name}" utilise d�j� ce num�ro` };
      }
    }

    const contact = await ContactService.create(user.tenantId, {
      ...validated,
      ownerId,
      onboardedById: user.id,
      collaboratorIds,
    });

    await NotificationService.notifyMany(
      uniqueIds([ownerId, ...collaboratorIds]),
      {
        tenantId: user.tenantId,
        type: "CONTACT_CREATED",
        title: `Nouveau contact: ${contact.name}`,
        message: `${user.name || user.email} a cr�� un contact`,
        entityType: "contact",
        entityId: contact.id,
      }
    );

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
    return { error: error instanceof Error ? error.message : "Erreur lors de la cr�ation du contact" };
  }
}

export async function updateContact(contactId: string, formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "contact.manage");

    const scope = await getCrmContactScopeWithDelegation(user);
    if (!scope) {
      return { error: "Acc�s refus�" };
    }

    const existing = await ContactService.getById(contactId, scope);
    if (!existing) {
      return { error: "Contact introuvable" };
    }

    const validated = updateContactSchema.parse(formData);
    const ownerId = validated.ownerId !== undefined
      ? validated.ownerId
      : (existing as any).ownerId ?? null;
    const collaboratorIds = validated.collaboratorIds !== undefined
      ? normalizeCollaboratorIds(validated.collaboratorIds, ownerId)
      : undefined;

    const contact = await ContactService.update(contactId, {
      ...validated,
      ownerId,
      collaboratorIds,
    });

    await NotificationService.notifyMany(
      uniqueIds([contact.ownerId, ...extractCollaboratorIds(contact.collaborators)]),
      {
        tenantId: user.tenantId,
        type: "CONTACT_UPDATED",
        title: `Contact mis � jour: ${contact.name}`,
        message: `${user.name || user.email} a mis � jour le contact`,
        entityType: "contact",
        entityId: contactId,
      }
    );

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
    return { error: error instanceof Error ? error.message : "Erreur lors de la mise � jour" };
  }
}

export async function deleteContact(contactId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "contact.manage");

    const scope = await getCrmContactScopeWithDelegation(user);
    if (!scope) {
      return { error: "Acc�s refus�" };
    }

    const existing = await ContactService.getById(contactId, scope);
    if (!existing) {
      return { error: "Contact introuvable" };
    }

    await prisma.contact.delete({ where: { id: contactId } });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "contact.deleted",
      entityType: "contact",
      entityId: contactId,
      newValue: { name: existing.name },
    });

    revalidatePath("/contacts");
    revalidatePath("/crm");
    return { data: { success: true } };
  } catch (error) {
    console.error("Error deleting contact:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la suppression" };
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
    checkPermission(user.role, "contact.view");

    const scope = await getCrmContactScopeWithDelegation(user);
    if (!scope) {
      return { error: "Acc�s refus�" };
    }
    const result = await ContactService.list(user.tenantId, {
      type: options?.type as ContactType | undefined,
      search: options?.search,
      page: options?.page,
      limit: options?.limit,
      scopeWhere: scope,
    });
    return { data: result.contacts };
  } catch (error) {    return { error: error instanceof Error ? error.message : "Erreur lors de la r�cup�ration" };
  }
}

export async function getContactById(contactId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "contact.view");

    const scope = await getCrmContactScopeWithDelegation(user);
    if (!scope) {
      return { error: "Acc�s refus�" };
    }

    const contact = await ContactService.getById(contactId, scope);
    if (!contact) {
      return { error: "Contact introuvable" };
    }
    return { data: contact };
  } catch (error) {
    console.error("Error fetching contact:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la r�cup�ration" };
  }
}

export async function getContactTypeCount() {
  try {
    const user = await getSession();
    checkPermission(user.role, "contact.view");
    const scope = await getCrmContactScopeWithDelegation(user);
    if (!scope) {
      return { error: "Acc�s refus�" };
    }
    return { data: await ContactService.getTypeCount(user.tenantId, scope) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la r�cup�ration" };
  }
}

// --- Leads ---

export async function createLead(formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "lead.manage");

    const validated = createLeadSchema.parse(formData);
    const contactScope = await getCrmContactScopeWithDelegation(user);
    if (!contactScope) {
      return { error: "Acc�s refus�" };
    }
    const allowedContact = await ContactService.getById(validated.contactId, contactScope);
    if (!allowedContact) {
      return { error: "Contact introuvable" };
    }
    const ownerId = validated.ownerId || validated.assignedTo || user.id;
    const collaboratorIds = normalizeCollaboratorIds(validated.collaboratorIds, ownerId);

    const lead = await LeadService.create({
      ...validated,
      ownerId,
      onboardedById: user.id,
      collaboratorIds,
    });

    void LeadScoringService.recalculate(lead.id);
    await LeadSlaService.updateSla(lead.id, lead.status);
    await CrmTaskOrchestratorService.syncLeadWorkflow(user.tenantId, lead.id);

    await NotificationService.notifyMany(
      uniqueIds([ownerId, ...collaboratorIds]),
      {
        tenantId: user.tenantId,
        type: "LEAD_CREATED",
        title: `Nouveau lead: ${lead.contact?.name || "Lead"}`,
        message: `${user.name || user.email} a cr�� un lead`,
        entityType: "lead",
        entityId: lead.id,
      }
    );

    revalidatePath("/crm/leads");
    revalidatePath("/crm");
    return { data: lead };
  } catch (error) {
    console.error("Error creating lead:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la cr�ation du lead" };
  }
}

export async function getLeads(options?: {
  status?: string;
  assignedTo?: string;
  search?: string;
  page?: number;
  limit?: number;
  includeArchived?: boolean;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "lead.view");
    const scope = await getCrmLeadScopeWithDelegation(user);
    if (!scope) {
      return { error: "Acc�s refus�" };
    }
    const result = await LeadService.list(user.tenantId, {
      status: options?.status as LeadStatus | undefined,
      assignedTo: options?.assignedTo,
      search: options?.search,
      page: options?.page,
      limit: options?.limit,
      includeArchived: options?.includeArchived,
      scopeWhere: scope,
    });
    return {
      data: result.leads,
      total: result.total,
      totalPages: result.totalPages,
      page: result.page,
    };
  } catch (error) {    return { error: error instanceof Error ? error.message : "Erreur lors de la r�cup�ration" };
  }
}

export async function updateLeadStatus(leadId: string, status: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "lead.manage");

    const scope = await getCrmLeadScopeWithDelegation(user);
    if (!scope) {
      return { error: "Acc�s refus�" };
    }
    const existing = await LeadService.getById(leadId, scope);
    if (!existing) {
      return { error: "Lead introuvable" };
    }

    const lead = await LeadService.update(leadId, {
      status: status as LeadStatus,
      ...(status === "QUALIFIED" ? { ownerId: user.id } : {}),
    });

    // Fire-and-forget: recalculate score + SLA
    void LeadScoringService.recalculate(leadId);
    await LeadSlaService.updateSla(leadId, status);

    if (status === "QUALIFIED") {
      await prisma.contact.update({
        where: { id: existing.contactId },
        data: { ownerId: user.id },
      });
    }

    await CrmTaskOrchestratorService.syncLeadWorkflow(user.tenantId, leadId);

    await NotificationService.notifyMany(
      uniqueIds([lead.ownerId, ...extractCollaboratorIds(lead.collaborators)]),
      {
        tenantId: user.tenantId,
        type: status === "QUALIFIED" ? "LEAD_CONVERTED" : "LEAD_UPDATED",
        title: `Lead ${status === "QUALIFIED" ? "converti" : "mis � jour"}: ${lead.contact?.name || "Lead"}`,
        message: `${user.name || user.email} a mis � jour le statut`,
        entityType: "lead",
        entityId: leadId,
      }
    );

    revalidatePath("/crm/leads");
    revalidatePath(`/crm/leads/${leadId}`);
    revalidatePath("/crm");
    return { data: lead };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la mise � jour" };
  }
}

export async function validateLead(leadId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "lead.manage");

    const scope = await getCrmLeadScopeWithDelegation(user);
    if (!scope) {
      return { error: "Acc�s refus�" };
    }
    const existing = await LeadService.getById(leadId, scope);
    if (!existing) {
      return { error: "Lead introuvable" };
    }

    const lead = await LeadService.update(leadId, {
      status: "QUALIFIED",
      ownerId: user.id,
    });

    await prisma.contact.update({
      where: { id: existing.contactId },
      data: { ownerId: user.id },
    });

    await LeadSlaService.updateSla(leadId, "QUALIFIED");
    await CrmTaskOrchestratorService.syncLeadWorkflow(user.tenantId, leadId);

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "lead.validated",
      entityType: "lead",
      entityId: leadId,
      newValue: { status: "QUALIFIED" },
    });

    await NotificationService.notifyMany(
      uniqueIds([lead.ownerId, ...extractCollaboratorIds(lead.collaborators)]),
      {
        tenantId: user.tenantId,
        type: "LEAD_CONVERTED",
        title: `Lead converti: ${lead.contact?.name || "Lead"}`,
        message: `${user.name || user.email} a converti le lead`,
        entityType: "lead",
        entityId: leadId,
      }
    );

    revalidatePath("/crm/leads");
    revalidatePath(`/crm/leads/${leadId}`);
    revalidatePath("/crm");
    return { data: lead };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la validation" };
  }
}

export async function getLeadById(leadId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "lead.view");
    const scope = await getCrmLeadScopeWithDelegation(user);
    if (!scope) {
      return { error: "Acc�s refus�" };
    }
    const lead = await LeadService.getById(leadId, scope);
    if (!lead) {
      return { error: "Lead introuvable" };
    }
    return { data: lead };
  } catch (error) {
    console.error("Error fetching lead:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la r�cup�ration" };
  }
}

export async function updateLead(leadId: string, data: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "lead.manage");

    const scope = await getCrmLeadScopeWithDelegation(user);
    if (!scope) {
      return { error: "Acc�s refus�" };
    }
    const existing = await LeadService.getById(leadId, scope);
    if (!existing) {
      return { error: "Lead introuvable" };
    }

    const payload = data as any;
    const ownerId = payload.ownerId !== undefined ? payload.ownerId : (existing as any).ownerId ?? null;
    let collaboratorIds = payload.collaboratorIds !== undefined
      ? normalizeCollaboratorIds(payload.collaboratorIds, ownerId)
      : undefined;

    const assignedChanged = payload.assignedTo !== undefined && payload.assignedTo !== existing.assignedTo;

    if (assignedChanged && payload.assignedTo && collaboratorIds === undefined) {
      collaboratorIds = normalizeCollaboratorIds(
        [...extractCollaboratorIds(existing.collaborators), payload.assignedTo],
        ownerId
      );
    }

    const lead = await LeadService.update(leadId, {
      ...payload,
      ownerId,
      collaboratorIds,
    });

    // Fire-and-forget: recalculate score (skip if winProbability set manually)
    if (payload.winProbability === undefined) {
      void LeadScoringService.recalculate(leadId);
    }
    await LeadSlaService.updateSla(leadId, lead.status);
    await CrmTaskOrchestratorService.syncLeadWorkflow(user.tenantId, leadId);

    await NotificationService.notifyMany(
      uniqueIds([lead.ownerId, ...extractCollaboratorIds(lead.collaborators)]),
      {
        tenantId: user.tenantId,
        type: assignedChanged ? "LEAD_ASSIGNED" : "LEAD_UPDATED",
        title: `${assignedChanged ? "Lead assign�" : "Lead mis � jour"}: ${lead.contact?.name || "Lead"}`,
        message: `${user.name || user.email} a modifi� le lead`,
        entityType: "lead",
        entityId: leadId,
      }
    );
    revalidatePath("/crm/leads");
    revalidatePath(`/crm/leads/${leadId}`);
    revalidatePath("/crm");
    return { data: lead };
  } catch (error) {
    console.error("Error updating lead:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la mise � jour" };
  }
}


export async function updateLeadWinProbability(leadId: string, winProbability: number) {
  try {
    const user = await getSession();
    checkPermission(user.role, "lead.manage");

    const scope = await getCrmLeadScopeWithDelegation(user);
    if (!scope) {
      return { error: "Acces refuse" };
    }
    const existing = await LeadService.getById(leadId, scope);
    if (!existing) {
      return { error: "Lead introuvable" };
    }

    const clamped = Math.max(0, Math.min(100, Math.round(winProbability)));
    const lead = await LeadService.update(leadId, { winProbability: clamped });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "lead.win_probability_updated",
      entityType: "lead",
      entityId: leadId,
      newValue: { winProbability: clamped },
    });

    revalidatePath(`/crm/leads/${leadId}`);
    return { data: lead };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la mise a jour" };
  }
}

export async function getLeadPipeline() {
  try {
    const user = await getSession();
    checkPermission(user.role, "lead.view");
    const scope = await getCrmLeadScopeWithDelegation(user);
    if (!scope) {
      return { error: "Acc�s refus�" };
    }
    return { data: await LeadService.getPipelineStats(user.tenantId, scope) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la r�cup�ration" };
  }
}

export async function exportContactsCSV() {
  try {
    const user = await getSession();
    if (!canExportCrm(user.role)) {
      return { error: "Acc�s refus�" };
    }
    const scope = await getCrmContactScopeWithDelegation(user);
    if (!scope) {
      return { error: "Acc�s refus�" };
    }
    const result = await ContactService.list(user.tenantId, { limit: 10000, scopeWhere: scope });
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
      "T�l�phone",
      "Email",
      "WhatsApp",
      "Ville",
      "Pays",
      "Score de confiance",
      "Commandes",
      "Leads",
      "Cr�� le",
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

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "crm.contacts.export.csv",
      entityType: "contact",
      entityId: "bulk",
      newValue: { rows: contacts.length },
    });

    return { data: csv };
  } catch (error) {
    console.error("Error exporting contacts:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de l'export" };
  }
}

export async function addContactNote(contactId: string, note: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "contact.manage");

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { tenantId: true, notes: true },
    });
    if (!contact || contact.tenantId !== user.tenantId) {
      return { error: "Contact introuvable" };
    }

    const timestamp = new Date().toLocaleString("fr-FR", {
      timeZone: "Africa/Brazzaville",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const newNotes = (contact.notes ? contact.notes + "\n" : "") + `[${timestamp}] ${note}`;

    await prisma.contact.update({
      where: { id: contactId },
      data: { notes: newNotes },
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "contact.note_added",
      entityType: "contact",
      entityId: contactId,
      newValue: { note },
    });

    revalidatePath(`/contacts/${contactId}`);
    return { data: { success: true } };
  } catch (error) {
    console.error("Error adding contact note:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de l'ajout" };
  }
}

export async function createLeadTask(
  leadId: string,
  data: {
    title: string;
    description?: string;
    assigneeId?: string;
    priority?: string;
    slaHours?: number;
  }
) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const scope = await getCrmLeadScopeWithDelegation(user);
    if (!scope) {
      return { error: "Acces refuse" };
    }
    const lead = await LeadService.getById(leadId, scope);
    if (!lead) {
      return { error: "Lead introuvable" };
    }

    const title = data.title?.trim();
    if (!title) return { error: "Titre requis" };

    const assigneeId = data.assigneeId || lead.assignedTo || lead.ownerId || user.id;

    const result = await OperationalTaskService.create({
      tenantId: user.tenantId,
      entityType: "lead",
      entityId: leadId,
      taskType: "manual",
      title,
      description: data.description || undefined,
      module: "crm",
      priority: (data.priority as any) || "NORMAL",
      ownerType: "HUMAN",
      riskLevel: "LOW",
      slaHours: data.slaHours ? Number(data.slaHours) : undefined,
      tags: ["crm", "lead", leadId],
      assigneeId,
      assignedByName: user.name,
      completionRequirements: {
        requiredComment: true,
      },
    });
    const task = await prisma.task.findUnique({ where: { id: result.taskId } });
    if (!task) return { error: "Erreur creation tache" };

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "lead.task_created",
      entityType: "lead",
      entityId: leadId,
      newValue: { taskId: task.id, title: task.title },
    });

    revalidatePath(`/crm/leads/${leadId}`);
    revalidatePath("/tasks");
    return { data: task };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur creation tache" };
  }
}

export async function sendEmailToContact(
  contactId: string,
  data: { subject: string; body: string; leadId?: string | null }
) {
  try {
    const user = await getSession();
    checkPermission(user.role, "crm.manage");

    const scope = await getCrmContactScopeWithDelegation(user);
    if (!scope) {
      return { error: "Accès refusé" };
    }

    const contact = await ContactService.getById(contactId, scope);
    if (!contact) {
      return { error: "Contact introuvable" };
    }

    if (!data.subject?.trim() || !data.body?.trim()) {
      return { error: "Objet et message requis" };
    }

    if (!contact.email) {
      return { error: "Aucun email disponible pour ce contact" };
    }

    const result = await CrmEmailService.send({
      tenantId: contact.tenantId,
      contactId: contact.id,
      leadId: data.leadId ?? undefined,
      to: contact.email,
      subject: data.subject,
      body: data.body,
      contactName: contact.name,
      actorId: user.id,
      tag: "manual",
    });

    if (result.error) {
      return { error: result.error };
    }

    revalidatePath(`/contacts/${contactId}`);
    revalidatePath("/crm");
    return { data: result.data };
  } catch (error) {
    console.error("Error sending email:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de l'envoi" };
  }
}

export async function logContactActivity(
  contactId: string,
  data: {
    type: string;
    summary: string;
    outcome?: string;
    durationMinutes?: number;
    phoneNumber?: string;
    channel?: string;
  }
) {
  try {
    const user = await getSession();
    checkPermission(user.role, "contact.manage");

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { tenantId: true },
    });
    if (!contact || contact.tenantId !== user.tenantId) {
      return { error: "Contact introuvable" };
    }

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "contact.activity_logged",
      entityType: "contact",
      entityId: contactId,
      newValue: {
        type: data.type,
        summary: data.summary,
        outcome: data.outcome,
        durationMinutes: data.durationMinutes,
        phoneNumber: data.phoneNumber,
        channel: data.channel,
      },
    });

    revalidatePath(`/contacts/${contactId}`);
    return { data: { success: true } };
  } catch (error) {
    console.error("Error logging activity:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de l'ajout" };
  }
}

export async function getContactTimeline(contactId: string, limit = 100) {
  try {
    const user = await getSession();
    checkPermission(user.role, "contact.view");
    const scope = await getCrmContactScopeWithDelegation(user);
    if (!scope) {
      return { error: "Acc�s refus�" };
    }
    const contact = await ContactService.getById(contactId, scope);
    if (!contact) {
      return { error: "Contact introuvable" };
    }

    const orders = await prisma.order.findMany({
      where: { contactId },
      select: { id: true, orderNumber: true, createdAt: true },
    });
    const orderIds = orders.map((o) => o.id);

    const leads = await prisma.lead.findMany({
      where: { contactId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const [orderTimeline, payments, disputes, auditLogs, conversations, emailLogs, tasks, waContacts] = await Promise.all([
      prisma.orderTimeline.findMany({
        where: { orderId: { in: orderIds } },
        include: { order: { select: { orderNumber: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.payment.findMany({
        where: { orderId: { in: orderIds } },
        include: { order: { select: { orderNumber: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.dispute.findMany({
        where: { orderId: { in: orderIds } },
        include: { order: { select: { orderNumber: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.auditLog.findMany({
        where: {
          tenantId: user.tenantId,
          OR: [
            { entityType: "contact", entityId: contactId },
            { entityType: "lead", entityId: { in: leads.map((l) => l.id) } },
            { entityType: "order", entityId: { in: orderIds } },
          ],
        },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.conversation.findMany({
        where: { contactId },
        select: { id: true },
      }),
      prisma.emailLog.findMany({
        where: {
          tenantId: user.tenantId,
          OR: [
            { contactId },
            { leadId: { in: leads.map((l) => l.id) } },
          ],
        },
        orderBy: { sentAt: "desc" },
        take: 100,
      }),
      // Tasks linked to contact or related orders
      prisma.task.findMany({
        where: {
          tenantId: user.tenantId,
          OR: [
            { entityType: "contact", entityId: contactId },
            ...(orderIds.length > 0 ? [{ entityType: "order", entityId: { in: orderIds } }] : []),
          ],
        },
        select: { id: true, title: true, status: true, entityType: true, entityId: true, createdAt: true, slaDeadline: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      // WhatsApp conversations via linked WhatsappContact
      prisma.whatsappContact.findMany({
        where: { tenantId: user.tenantId, linkedContactId: contactId },
        select: {
          id: true,
          conversations: {
            select: { id: true, status: true, lastMessageAt: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 20,
          },
        },
      }),
    ]);

    const conversationIds = conversations.map((c) => c.id);
    const messages = conversationIds.length > 0
      ? await prisma.message.findMany({
          where: { conversationId: { in: conversationIds } },
          include: { conversation: { select: { platform: true } } },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      : [];

    type TimelineItem = {
      id: string;
      type: string;
      title: string;
      description?: string;
      date: Date;
      link?: string;
      meta?: string;
    };

    const activityLabels: Record<string, string> = {
      call: "Appel",
      meeting: "Reunion",
      email: "Email",
      whatsapp: "WhatsApp",
      visit: "Visite",
      task: "Tache",
    };

    const outcomeLabels: Record<string, string> = {
      POSITIVE: "Positif",
      NEUTRAL: "Neutre",
      NEGATIVE: "Negatif",
      NO_ANSWER: "Sans reponse",
    };

    const items: TimelineItem[] = [
      ...orderTimeline.map((t) => ({
        id: `order:${t.id}`,
        type: "order",
        title: `Commande ${t.order.orderNumber}`,
        description: `${t.event}${t.fromValue || t.toValue ? ` (${t.fromValue || "-"} � ${t.toValue || "-"})` : ""}${t.note ? `  ${t.note}` : ""}`,
        date: t.createdAt,
        link: `/orders/${t.orderId}`,
      })),
      ...payments.map((p) => ({
        id: `payment:${p.id}`,
        type: "payment",
        title: `Paiement ${p.status}`,
        description: `${p.direction}  ${p.amount} ${p.currency}  Cmd ${p.order.orderNumber}`,
        date: p.createdAt,
        link: `/orders/${p.orderId}`,
      })),
      ...disputes.map((d) => ({
        id: `dispute:${d.id}`,
        type: "dispute",
        title: `Litige ${d.type}`,
        description: `${d.status}  Cmd ${d.order.orderNumber}`,
        date: d.createdAt,
        link: `/orders/${d.orderId}`,
      })),
      ...leads.map((l) => ({
        id: `lead:${l.id}`,
        type: "lead",
        title: `Lead ${l.status}`,
        description: l.description || l.source || "Sans description",
        date: l.createdAt,
        link: `/crm/leads/${l.id}`,
      })),
      ...auditLogs.map((a) => {
        const isNote = a.action === "contact.note_added";
        const isActivity = a.action === "contact.activity_logged";
        const activityValue = isActivity && a.newValue && typeof a.newValue === "object"
          ? (a.newValue as any)
          : null;
        const activityLabel = activityValue?.type
          ? (activityLabels[String(activityValue.type)] || String(activityValue.type))
          : null;
        const activitySummary = activityValue?.summary ? String(activityValue.summary) : "";
        const activityOutcomeRaw = activityValue?.outcome ? String(activityValue.outcome) : "";
        const activityOutcome = outcomeLabels[activityOutcomeRaw] || activityOutcomeRaw;
        const activityDuration = activityValue?.durationMinutes
          ? `${activityValue.durationMinutes} min`
          : "";
        const activityPhone = activityValue?.phoneNumber
          ? `Tel ${String(activityValue.phoneNumber)}`
          : "";
        const activityMeta = [activityOutcome, activityDuration, activityPhone]
          .filter(Boolean)
          .join(" | ");

        return {
          id: `audit:${a.id}`,
          type: isNote ? "note" : isActivity ? "activity" : "audit",
          title: isNote
            ? "Note ajoutee"
            : isActivity
              ? `Activite ${activityLabel || ""}`.trim()
              : a.action,
          description: isActivity
            ? [activitySummary, activityMeta].filter(Boolean).join(" - ")
            : a.newValue && typeof a.newValue === "object"
              ? ((a.newValue as any).note ? String((a.newValue as any).note) : JSON.stringify(a.newValue))
              : undefined,
          date: a.createdAt,
          meta: a.user?.name || undefined,
        };
      }),
      ...messages.map((m) => ({
        id: `msg:${m.id}`,
        type: "message",
        title: m.direction === "INBOUND" ? "Message entrant" : "Message sortant",
        description: m.content?.slice(0, 120),
        date: m.createdAt,
        meta: m.conversation?.platform || undefined,
      })),
      ...emailLogs.map((e) => ({
        id: `email:${e.id}`,
        type: "email",
        title: e.subject,
        description: e.body?.slice(0, 160),
        date: e.sentAt ?? e.createdAt,
        meta: e.status,
      })),
      // Tasks linked to contact or related orders
      ...tasks.map((t) => ({
        id: `task:${t.id}`,
        type: "task",
        title: t.title,
        description: `Statut : ${t.status}${t.slaDeadline ? ` � �ch�ance SLA : ${t.slaDeadline.toLocaleDateString("fr-FR")}` : ""}`,
        date: t.createdAt,
        link: `/tasks?entity=${t.entityType}:${t.entityId}`,
      })),
      // WhatsApp conversations
      ...waContacts.flatMap((wc) =>
        wc.conversations.map((conv) => ({
          id: `wa:${conv.id}`,
          type: "whatsapp",
          title: `Conversation WhatsApp ${conv.status}`,
          description: conv.lastMessageAt
            ? `Dernier message : ${new Date(conv.lastMessageAt).toLocaleDateString("fr-FR")}`
            : undefined,
          date: conv.createdAt,
          link: `/whatsapp?conversationId=${conv.id}`,
        }))
      ),
    ];

    items.sort((a, b) => b.date.getTime() - a.date.getTime());
    return { data: items.slice(0, limit) };
  } catch (error) {
    console.error("Error fetching contact timeline:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors du chargement" };
  }
}

export async function deleteContacts(ids: string[]) {
  try {
    const user = await getSession();
    checkPermission(user.role, "contact.manage");

    if (!ids.length) return { error: "Aucun contact s�lectionn�" };

    const { count } = await prisma.contact.deleteMany({
      where: { id: { in: ids }, tenantId: user.tenantId },
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "contact.bulk_deleted",
      entityType: "contact",
      entityId: ids[0],
      newValue: { ids, count },
    });

    revalidatePath("/contacts");
    revalidatePath("/crm");
    return { data: { deleted: count } };
  } catch (error) {
    console.error("Error bulk deleting contacts:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la suppression" };
  }
}

export async function importContacts(rows: Record<string, string>[]) {
  try {
    const user = await getSession();
    checkPermission(user.role, "contact.manage");

    const TYPE_MAP: Record<string, string> = {
      client: "CLIENT",
      prospect: "PROSPECT",
      fournisseur: "SUPPLIER",
      transitaire: "FREIGHT_PARTNER",
      douanier: "CUSTOMS_BROKER",
      qc: "QC_PARTNER",
      autre: "OTHER",
    };

    let imported = 0;
    const errors: string[] = [];

    for (const [i, row] of rows.entries()) {
      try {
        const name = row.nom || row.name;
        if (!name) {
          errors.push(`Ligne ${i + 2} : nom manquant`);
          continue;
        }
        const rawType = (row.type || "OTHER").toLowerCase();
        const type = (TYPE_MAP[rawType] || "OTHER") as "CLIENT" | "PROSPECT" | "SUPPLIER" | "FREIGHT_PARTNER" | "CUSTOMS_BROKER" | "QC_PARTNER" | "OTHER";

        await ContactService.create(user.tenantId, {
          name,
          type,
          company: row.entreprise || row.company || undefined,
          phone: row.telephone || row.phone || undefined,
          email: row.email || undefined,
          whatsapp: row.whatsapp || undefined,
          city: row.ville || row.city || undefined,
          country: row.pays || row.country || "CG",
          ownerId: user.id,
          onboardedById: user.id,
          collaboratorIds: [],
          tags: [],
        });
        imported++;
      } catch (rowErr) {
        errors.push(`Ligne ${i + 2} : ${rowErr instanceof Error ? rowErr.message : "erreur inconnue"}`);
      }
    }

    revalidatePath("/contacts");
    revalidatePath("/crm");
    return { data: { imported, errors } };
  } catch (error) {
    console.error("Error importing contacts:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de l'import" };
  }
}

//     Lead Archive / Delete Actions                                           

export async function archiveLead(leadId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const user = await getSession();
    checkPermission(user.role, "lead.manage");
    const scope = await getCrmLeadScopeWithDelegation(user);
    const existing = await LeadService.getById(leadId, scope ?? undefined);
    if (!existing) return { error: "Lead introuvable ou acc�s refus�" };

    await LeadService.archive(leadId);
    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "LEAD_ARCHIVED",
      entityType: "Lead",
      entityId: leadId,
      newValue: { leadId },
    });
    revalidatePath("/crm/leads");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de l'archivage" };
  }
}

export async function restoreLead(leadId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const user = await getSession();
    checkPermission(user.role, "lead.manage");

    await LeadService.restore(leadId);
    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "LEAD_RESTORED",
      entityType: "Lead",
      entityId: leadId,
      newValue: { leadId },
    });
    revalidatePath("/crm/leads");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la restauration" };
  }
}

export async function deleteLead(leadId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const user = await getSession();
    checkPermission(user.role, "lead.manage");
    const scope = await getCrmLeadScopeWithDelegation(user);
    const existing = await LeadService.getById(leadId, scope ?? undefined);
    if (!existing) return { error: "Lead introuvable ou acc�s refus�" };

    await LeadService.deleteLead(leadId);
    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "LEAD_DELETED",
      entityType: "Lead",
      entityId: leadId,
      newValue: { leadId },
    });
    revalidatePath("/crm/leads");
    revalidatePath("/crm");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la suppression" };
  }
}

export async function bulkDeleteLeads(ids: string[]): Promise<{ deleted?: number; error?: string }> {
  try {
    const user = await getSession();
    checkPermission(user.role, "lead.manage");
    if (!ids.length) return { deleted: 0 };

    const count = await prisma.lead.deleteMany({
      where: { id: { in: ids }, contact: { tenantId: user.tenantId } },
    });
    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "LEADS_BULK_DELETED",
      entityType: "Lead",
      entityId: "bulk",
      newValue: { ids, count: count.count },
    });
    revalidatePath("/crm/leads");
    revalidatePath("/crm");
    return { deleted: count.count };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la suppression" };
  }
}

export async function bulkArchiveLeads(ids: string[]): Promise<{ archived?: number; error?: string }> {
  try {
    const user = await getSession();
    checkPermission(user.role, "lead.manage");
    if (!ids.length) return { archived: 0 };

    const result = await prisma.lead.updateMany({
      where: { id: { in: ids }, contact: { tenantId: user.tenantId } },
      data: { isArchived: true, archivedAt: new Date() },
    });
    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "LEADS_BULK_ARCHIVED",
      entityType: "Lead",
      entityId: "bulk",
      newValue: { ids, count: result.count },
    });
    revalidatePath("/crm/leads");
    return { archived: result.count };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de l'archivage" };
  }
}

//     Contact Merge / Deduplication                                           

export async function findDuplicateContacts(contactId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "contact.view");

    const target = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { phone: true, email: true, tenantId: true },
    });
    if (!target || target.tenantId !== user.tenantId) return { data: [], error: "Contact introuvable" };

    const orClauses: Array<{ phone?: string; email?: string }> = [];
    if (target.phone) orClauses.push({ phone: target.phone });
    if (target.email) orClauses.push({ email: target.email });
    if (!orClauses.length) return { data: [] };

    const duplicates = await prisma.contact.findMany({
      where: {
        tenantId: user.tenantId,
        id: { not: contactId },
        OR: orClauses,
      },
      select: {
        id: true,
        name: true,
        company: true,
        phone: true,
        email: true,
        whatsapp: true,
        type: true,
        tags: true,
        _count: { select: { orders: true, leads: true } },
      },
      take: 10,
    });

    return { data: duplicates };
  } catch (error) {
    return { data: [], error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function mergeContacts(
  keepId: string,
  mergeId: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const user = await getSession();
    checkPermission(user.role, "contact.manage");

    const [keep, merge] = await Promise.all([
      prisma.contact.findUnique({ where: { id: keepId }, select: { tenantId: true, phone: true, email: true, whatsapp: true, company: true, notes: true, tags: true } }),
      prisma.contact.findUnique({ where: { id: mergeId }, select: { tenantId: true, phone: true, email: true, whatsapp: true, company: true, notes: true, tags: true } }),
    ]);

    if (!keep || !merge) return { error: "Un des contacts est introuvable" };
    if (keep.tenantId !== user.tenantId || merge.tenantId !== user.tenantId)
      return { error: "Acc�s refus�" };

    // Merge tags (union without duplicates)
    const keepTags = Array.isArray(keep.tags) ? (keep.tags as string[]) : [];
    const mergeTags = Array.isArray(merge.tags) ? (merge.tags as string[]) : [];
    const mergedTags = Array.from(new Set([...keepTags, ...mergeTags]));

    // Concat notes
    const mergedNotes = [keep.notes, merge.notes].filter(Boolean).join("\n---\n") || null;

    // Patch missing fields from merge into keep
    const patchData: Record<string, string | null> = {};
    if (!keep.phone && merge.phone) patchData.phone = merge.phone;
    if (!keep.email && merge.email) patchData.email = merge.email;
    if (!keep.whatsapp && merge.whatsapp) patchData.whatsapp = merge.whatsapp;
    if (!keep.company && merge.company) patchData.company = merge.company;

    await prisma.$transaction([
      prisma.order.updateMany({ where: { contactId: mergeId }, data: { contactId: keepId } }),
      prisma.lead.updateMany({ where: { contactId: mergeId }, data: { contactId: keepId } }),
      prisma.contact.update({
        where: { id: keepId },
        data: { ...patchData, notes: mergedNotes, tags: mergedTags },
      }),
      prisma.contact.delete({ where: { id: mergeId } }),
    ]);

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "CONTACT_MERGED",
      entityType: "Contact",
      entityId: keepId,
      newValue: { keepId, mergeId },
    });
    revalidatePath("/contacts");
    revalidatePath("/crm");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la fusion" };
  }
}








