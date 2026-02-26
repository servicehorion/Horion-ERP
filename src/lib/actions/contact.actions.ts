"use server";

import { getSession } from "@/lib/session";
import { ContactService } from "@/lib/services/contact.service";
import { LeadService } from "@/lib/services/lead.service";
import { AuditService } from "@/lib/services/audit.service";
import { NotificationService } from "@/lib/services/notification.service";
import { checkPermission } from "@/lib/permissions";
import { canExportCrm, getCrmContactScope, getCrmLeadScope } from "@/lib/access-control";
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
        message: `${user.name || user.email} a créé un contact`,
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
    return { error: error instanceof Error ? error.message : "Erreur lors de la création du contact" };
  }
}

export async function updateContact(contactId: string, formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "contact.manage");

    const scope = getCrmContactScope(user);
    if (!scope) {
      return { error: "AccÃ¨s refusÃ©" };
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
        title: `Contact mis à jour: ${contact.name}`,
        message: `${user.name || user.email} a mis à jour le contact`,
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
    return { error: error instanceof Error ? error.message : "Erreur lors de la mise à jour" };
  }
}

export async function deleteContact(contactId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "contact.manage");

    const scope = getCrmContactScope(user);
    if (!scope) {
      return { error: "AccÃ¨s refusÃ©" };
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

    const scope = getCrmContactScope(user);
    if (!scope) {
      return { error: "AccÃ¨s refusÃ©" };
    }
    const result = await ContactService.list(user.tenantId, {
      type: options?.type as ContactType | undefined,
      search: options?.search,
      page: options?.page,
      limit: options?.limit,
      scopeWhere: scope,
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
    checkPermission(user.role, "contact.view");

    const scope = getCrmContactScope(user);
    if (!scope) {
      return { error: "AccÃ¨s refusÃ©" };
    }

    const contact = await ContactService.getById(contactId, scope);
    if (!contact) {
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
    checkPermission(user.role, "contact.view");
    const scope = getCrmContactScope(user);
    if (!scope) {
      return { error: "AccÃ¨s refusÃ©" };
    }
    return { data: await ContactService.getTypeCount(user.tenantId, scope) };
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
    const contactScope = getCrmContactScope(user);
    if (!contactScope) {
      return { error: "AccÃ¨s refusÃ©" };
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

    await NotificationService.notifyMany(
      uniqueIds([ownerId, ...collaboratorIds]),
      {
        tenantId: user.tenantId,
        type: "LEAD_CREATED",
        title: `Nouveau lead: ${lead.contact?.name || "Lead"}`,
        message: `${user.name || user.email} a créé un lead`,
        entityType: "lead",
        entityId: lead.id,
      }
    );

    revalidatePath("/crm/leads");
    revalidatePath("/crm");
    return { data: lead };
  } catch (error) {
    console.error("Error creating lead:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la création du lead" };
  }
}

export async function getLeads(options?: {
  status?: string;
  assignedTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "lead.view");
    const scope = getCrmLeadScope(user);
    if (!scope) {
      return { error: "AccÃ¨s refusÃ©" };
    }
    const result = await LeadService.list(user.tenantId, {
      status: options?.status as LeadStatus | undefined,
      assignedTo: options?.assignedTo,
      search: options?.search,
      page: options?.page,
      limit: options?.limit,
      scopeWhere: scope,
    });
    return {
      data: result.leads,
      total: result.total,
      totalPages: result.totalPages,
      page: result.page,
    };
  } catch (error) {
    console.error("Error fetching leads:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la récupération" };
  }
}

export async function updateLeadStatus(leadId: string, status: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "lead.manage");

    const scope = getCrmLeadScope(user);
    if (!scope) {
      return { error: "AccÃ¨s refusÃ©" };
    }
    const existing = await LeadService.getById(leadId, scope);
    if (!existing) {
      return { error: "Lead introuvable" };
    }

    const lead = await LeadService.update(leadId, {
      status: status as LeadStatus,
      ...(status === "QUALIFIED" ? { ownerId: user.id } : {}),
    });

    if (status === "QUALIFIED") {
      await prisma.contact.update({
        where: { id: existing.contactId },
        data: { ownerId: user.id },
      });
    }

    await NotificationService.notifyMany(
      uniqueIds([lead.ownerId, ...extractCollaboratorIds(lead.collaborators)]),
      {
        tenantId: user.tenantId,
        type: status === "QUALIFIED" ? "LEAD_CONVERTED" : "LEAD_UPDATED",
        title: `Lead ${status === "QUALIFIED" ? "converti" : "mis à jour"}: ${lead.contact?.name || "Lead"}`,
        message: `${user.name || user.email} a mis à jour le statut`,
        entityType: "lead",
        entityId: leadId,
      }
    );

    revalidatePath("/crm/leads");
    revalidatePath(`/crm/leads/${leadId}`);
    revalidatePath("/crm");
    return { data: lead };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la mise à jour" };
  }
}

export async function validateLead(leadId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "lead.manage");

    const scope = getCrmLeadScope(user);
    if (!scope) {
      return { error: "AccÃ¨s refusÃ©" };
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
    const scope = getCrmLeadScope(user);
    if (!scope) {
      return { error: "AccÃ¨s refusÃ©" };
    }
    const lead = await LeadService.getById(leadId, scope);
    if (!lead) {
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

    const scope = getCrmLeadScope(user);
    if (!scope) {
      return { error: "AccÃ¨s refusÃ©" };
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

    await NotificationService.notifyMany(
      uniqueIds([lead.ownerId, ...extractCollaboratorIds(lead.collaborators)]),
      {
        tenantId: user.tenantId,
        type: assignedChanged ? "LEAD_ASSIGNED" : "LEAD_UPDATED",
        title: `${assignedChanged ? "Lead assigné" : "Lead mis à jour"}: ${lead.contact?.name || "Lead"}`,
        message: `${user.name || user.email} a modifié le lead`,
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
    return { error: error instanceof Error ? error.message : "Erreur lors de la mise à jour" };
  }
}

export async function getLeadPipeline() {
  try {
    const user = await getSession();
    checkPermission(user.role, "lead.view");
    const scope = getCrmLeadScope(user);
    if (!scope) {
      return { error: "AccÃ¨s refusÃ©" };
    }
    return { data: await LeadService.getPipelineStats(user.tenantId, scope) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la récupération" };
  }
}

export async function exportContactsCSV() {
  try {
    const user = await getSession();
    if (!canExportCrm(user.role)) {
      return { error: "AccÃ¨s refusÃ©" };
    }
    const scope = getCrmContactScope(user);
    if (!scope) {
      return { error: "AccÃ¨s refusÃ©" };
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

export async function addContactNote(contactId: string, note: string) {
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

export async function logContactActivity(
  contactId: string,
  data: {
    type: string;
    summary: string;
    outcome?: string;
    durationMinutes?: number;
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
    const scope = getCrmContactScope(user);
    if (!scope) {
      return { error: "AccÃ¨s refusÃ©" };
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

    const [orderTimeline, payments, disputes, auditLogs, conversations] = await Promise.all([
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

    const items: TimelineItem[] = [
      ...orderTimeline.map((t) => ({
        id: `order:${t.id}`,
        type: "order",
        title: `Commande ${t.order.orderNumber}`,
        description: `${t.event}${t.fromValue || t.toValue ? ` (${t.fromValue || "-"} → ${t.toValue || "-"})` : ""}${t.note ? ` — ${t.note}` : ""}`,
        date: t.createdAt,
        link: `/orders/${t.orderId}`,
      })),
      ...payments.map((p) => ({
        id: `payment:${p.id}`,
        type: "payment",
        title: `Paiement ${p.status}`,
        description: `${p.direction} — ${p.amount} ${p.currency} — Cmd ${p.order.orderNumber}`,
        date: p.createdAt,
        link: `/orders/${p.orderId}`,
      })),
      ...disputes.map((d) => ({
        id: `dispute:${d.id}`,
        type: "dispute",
        title: `Litige ${d.type}`,
        description: `${d.status} — Cmd ${d.order.orderNumber}`,
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
        const activityOutcome = activityValue?.outcome ? String(activityValue.outcome) : "";
        const activityDuration = activityValue?.durationMinutes
          ? `${activityValue.durationMinutes} min`
          : "";
        const activityMeta = [activityOutcome, activityDuration].filter(Boolean).join(" | ");

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
    ];

    items.sort((a, b) => b.date.getTime() - a.date.getTime());
    return { data: items.slice(0, limit) };
  } catch (error) {
    console.error("Error fetching contact timeline:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors du chargement" };
  }
}
