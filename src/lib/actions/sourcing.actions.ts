"use server";

import { getSession } from "@/lib/session";
import { SourcingCaseService } from "@/lib/services/sourcing-case.service";
import { AuditService } from "@/lib/services/audit.service";
import { checkPermission } from "@/lib/permissions";
import {
  createSourcingCaseSchema,
  updateSourcingStatusSchema,
  addOfferToSourcingSchema,
  addNegotiationLogSchema,
  selectSupplierSchema,
} from "@/lib/validators/sourcing";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import type { SourcingStatus } from "@prisma/client";

// ============================================================
// SOURCING CASES CRUD
// ============================================================

export async function createSourcingCase(formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.manage");

    const validated = createSourcingCaseSchema.parse(formData);

    // Verify order belongs to tenant
    const order = await prisma.order.findUnique({
      where: { id: validated.orderId },
      select: { tenantId: true },
    });
    if (!order || order.tenantId !== user.tenantId) {
      return { error: "Commande introuvable" };
    }

    const sc = await SourcingCaseService.create(validated);

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "sourcing.case.created",
      entityType: "sourcing_case",
      entityId: sc.id,
      newValue: { requirement: sc.requirement, orderId: sc.orderId },
    });

    revalidatePath("/sourcing/cases");
    revalidatePath("/sourcing");
    return { data: sc };
  } catch (error) {
    console.error("Error creating sourcing case:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la création" };
  }
}

export async function getSourcingCases(options?: {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  try {
    const user = await getSession();
    const result = await SourcingCaseService.list(user.tenantId, {
      status: options?.status as SourcingStatus | undefined,
      search: options?.search,
      page: options?.page,
      limit: options?.limit,
    });
    return { data: result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la récupération" };
  }
}

export async function getSourcingCaseById(id: string) {
  try {
    const user = await getSession();
    const sc = await SourcingCaseService.getById(id);
    if (!sc || sc.order.tenantId !== user.tenantId) {
      return { error: "Cas de sourcing introuvable" };
    }
    return { data: sc };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la récupération" };
  }
}

export async function updateSourcingStatus(id: string, formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.manage");

    // Verify tenant
    const existing = await SourcingCaseService.getById(id);
    if (!existing || existing.order.tenantId !== user.tenantId) {
      return { error: "Cas de sourcing introuvable" };
    }

    const { status } = updateSourcingStatusSchema.parse(formData);
    const sc = await SourcingCaseService.updateStatus(id, status);

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "sourcing.case.status_updated",
      entityType: "sourcing_case",
      entityId: id,
      oldValue: { status: existing.status },
      newValue: { status },
    });

    revalidatePath(`/sourcing/cases/${id}`);
    revalidatePath("/sourcing/cases");
    return { data: sc };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la mise à jour" };
  }
}

// ============================================================
// OFFERS ON SOURCING CASE
// ============================================================

export async function addOfferToSourcing(formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.manage");

    const validated = addOfferToSourcingSchema.parse(formData);

    // Verify tenant
    const sc = await SourcingCaseService.getById(validated.sourcingCaseId);
    if (!sc || sc.order.tenantId !== user.tenantId) {
      return { error: "Cas de sourcing introuvable" };
    }

    const offer = await SourcingCaseService.addOffer({
      ...validated,
      validTo: validated.validTo ? new Date(validated.validTo) : undefined,
    });

    revalidatePath(`/sourcing/cases/${validated.sourcingCaseId}`);
    return { data: offer };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de l'ajout de l'offre" };
  }
}

// ============================================================
// SUPPLIER SELECTION
// ============================================================

export async function selectSourcingSupplier(id: string, formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.manage");

    const existing = await SourcingCaseService.getById(id);
    if (!existing || existing.order.tenantId !== user.tenantId) {
      return { error: "Cas de sourcing introuvable" };
    }

    const { supplierId, offerId } = selectSupplierSchema.parse(formData);
    const sc = await SourcingCaseService.selectSupplier(id, supplierId, offerId);

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "sourcing.supplier.selected",
      entityType: "sourcing_case",
      entityId: id,
      newValue: { supplierId, offerId },
    });

    revalidatePath(`/sourcing/cases/${id}`);
    revalidatePath("/sourcing/cases");
    return { data: sc };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la sélection" };
  }
}

export async function confirmSourcingSelection(id: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.manage");

    const existing = await SourcingCaseService.getById(id);
    if (!existing || existing.order.tenantId !== user.tenantId) {
      return { error: "Cas de sourcing introuvable" };
    }

    const sc = await SourcingCaseService.confirmSelection(id);

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "sourcing.selection.confirmed",
      entityType: "sourcing_case",
      entityId: id,
      newValue: { supplierId: existing.supplierId },
    });

    revalidatePath(`/sourcing/cases/${id}`);
    revalidatePath("/sourcing/cases");
    return { data: sc };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la confirmation" };
  }
}

// ============================================================
// NEGOTIATION LOGS
// ============================================================

export async function addNegotiationLog(formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.manage");

    const validated = addNegotiationLogSchema.parse(formData);

    // Verify tenant
    const sc = await SourcingCaseService.getById(validated.sourcingCaseId);
    if (!sc || sc.order.tenantId !== user.tenantId) {
      return { error: "Cas de sourcing introuvable" };
    }

    const log = await SourcingCaseService.addNegotiationLog(validated);

    revalidatePath(`/sourcing/cases/${validated.sourcingCaseId}`);
    return { data: log };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de l'ajout" };
  }
}

// ============================================================
// PIPELINE / KANBAN
// ============================================================

export async function getSourcingPipeline() {
  try {
    const user = await getSession();
    return { data: await SourcingCaseService.getPipelineStats(user.tenantId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getSourcingKanban() {
  try {
    const user = await getSession();
    const cases = await SourcingCaseService.getKanbanData(user.tenantId);
    return { data: cases };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// CSV EXPORT
// ============================================================

export async function exportSourcingCasesCSV() {
  try {
    const user = await getSession();
    const { cases } = await SourcingCaseService.list(user.tenantId, { limit: 5000 });

    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;

    const headers = [
      "Commande", "Client", "Besoin", "Statut", "Budget", "Devise",
      "Fournisseur", "Offres", "Négociations", "Créé le",
    ];

    const statusLabels: Record<string, string> = {
      SEARCHING: "Recherche",
      OFFERS_RECEIVED: "Offres reçues",
      NEGOTIATING: "Négociation",
      SELECTED: "Sélectionné",
      CONFIRMED: "Confirmé",
      CANCELLED: "Annulé",
    };

    const rows = cases.map((c) => [
      esc(c.order.orderNumber),
      esc(c.order.contact.name),
      esc(c.requirement),
      statusLabels[c.status] || c.status,
      c.budget ? Number(c.budget).toFixed(2) : "",
      c.currency,
      c.supplier ? esc(c.supplier.name) : "",
      c._count.offers,
      c._count.negotiations,
      new Date(c.createdAt).toLocaleDateString("fr-FR"),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    return { data: csv };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur export" };
  }
}

// ============================================================
// ORDERS LIST (for sourcing case creation form)
// ============================================================

export async function getOrdersForSourcing() {
  try {
    const user = await getSession();
    const orders = await prisma.order.findMany({
      where: {
        tenantId: user.tenantId,
        status: { in: ["DEMANDE", "RECHERCHE_PRODUIT", "SOURCING"] },
      },
      select: {
        id: true,
        orderNumber: true,
        contact: { select: { name: true } },
        merchandiseTotal: true,
        currency: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return { data: orders };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getSuppliersForSourcing() {
  try {
    await getSession();
    const suppliers = await prisma.supplier.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        country: true,
        city: true,
        rating: true,
      },
      orderBy: { name: "asc" },
      take: 200,
    });
    return { data: suppliers };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}
