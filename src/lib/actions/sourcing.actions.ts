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
import type { DemandStatus, DemandUrgency, SourcingStatus } from "@prisma/client";
import { TransportCalculatorService, HORION_TRANSPORT_RATES } from "@/lib/services/transport-calculator.service";
import { SourcingSlaService } from "@/lib/services/sourcing-sla.service";
import { SourcingSlaAlertService } from "@/lib/services/sourcing-sla-alert.service";
import { SourcingAssignmentService } from "@/lib/services/sourcing-assignment.service";
import { SourcingIngestionService } from "@/lib/services/sourcing-ingestion.service";
import { SourcingTaskOrchestratorService } from "@/lib/services/sourcing-task-orchestrator.service";
import { SourcingTicketService } from "@/lib/services/sourcing-ticket.service";
import { LogisticsBatchService } from "@/lib/services/logistics-batch.service";
import { OrderService } from "@/lib/services/order.service";
import { SupplierContractService } from "@/lib/services/supplier-contract.service";
import { convertCurrency } from "@/config/currencies";
import { z } from "zod";
import { serializeDecimals } from "@/lib/utils";

// ============================================================
// SOURCING CASES CRUD
// ============================================================

export async function createSourcingCase(formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.manage");

    const validated = createSourcingCaseSchema.parse(formData);
    let contractId = validated.contractId;
    let assignedToId = validated.assignedToId;

    // Verify order belongs to tenant
    const order = await prisma.order.findUnique({
      where: { id: validated.orderId },
      select: { tenantId: true },
    });
    if (!order || order.tenantId !== user.tenantId) {
      return { error: "Commande introuvable" };
    }
    if (assignedToId) {
      const assignee = await prisma.user.findFirst({
        where: { id: assignedToId, tenantId: user.tenantId },
        select: { id: true },
      });
      if (!assignee) return { error: "Assigne introuvable" };
    }

    if (!assignedToId) {
      const suggestedAssignee = await SourcingAssignmentService.pickAssignee(user.tenantId, {
        entityType: "sourcing_case",
        category: validated.category ?? null,
        pipelineType: validated.pipelineType ?? null,
      });
      assignedToId = suggestedAssignee?.id ?? undefined;
    }

    if (validated.supplierId) {
      const activeContract = await SupplierContractService.getActiveContractForSupplier({
        tenantId: user.tenantId,
        supplierId: validated.supplierId,
      });
      if (!activeContract && !contractId) {
        return { error: "Aucun contrat fournisseur actif. Creez/associez un contrat avant de lancer le sourcing." };
      }
      if (!contractId && activeContract) {
        contractId = activeContract.id;
      }
    }

    if (contractId) {
      const contract = await prisma.supplierContract.findFirst({
        where: { id: contractId, tenantId: user.tenantId },
        select: { id: true, supplierId: true, status: true, endAt: true },
      });
      if (!contract) return { error: "Contrat fournisseur introuvable" };
      if (validated.supplierId && contract.supplierId !== validated.supplierId) {
        return { error: "Le contrat selectionne ne correspond pas au fournisseur" };
      }
      if (contract.status !== "ACTIVE") {
        return { error: "Le contrat selectionne n'est pas actif" };
      }
      if (contract.endAt && contract.endAt < new Date()) {
        return { error: "Le contrat selectionne est expire" };
      }
    }

    const sc = await SourcingCaseService.create({
      ...validated,
      contractId,
      assignedToId,
    });

    await SourcingTicketService.syncForSourcingCase(sc.id);
    await SourcingTaskOrchestratorService.syncCaseWorkflow(sc.id);

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
    return { error: error instanceof Error ? error.message : "Erreur lors de la cr�ation" };
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
    checkPermission(user.role, "sourcing.view");
    const result = await SourcingCaseService.list(user.tenantId, {
      status: options?.status as SourcingStatus | undefined,
      search: options?.search,
      page: options?.page,
      limit: options?.limit,
    });
    return { data: result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la r�cup�ration" };
  }
}

export async function getSourcingCaseById(id: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.view");
    const sc = await SourcingCaseService.getById(id);
    if (!sc || sc.order.tenantId !== user.tenantId) {
      return { error: "Cas de sourcing introuvable" };
    }
    return { data: sc };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la r�cup�ration" };
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
    await SourcingTicketService.syncForSourcingCase(id);
    await SourcingTaskOrchestratorService.syncCaseWorkflow(id);

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
    return { error: error instanceof Error ? error.message : "Erreur lors de la mise � jour" };
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
    await SourcingTaskOrchestratorService.syncCaseWorkflow(validated.sourcingCaseId);

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
    const contract = await SupplierContractService.getActiveContractForSupplier({
      tenantId: user.tenantId,
      supplierId,
    });
    if (!contract) {
      return { error: "Fournisseur hors-contrat: aucun contrat actif detecte" };
    }

    const sc = await SourcingCaseService.selectSupplier(id, supplierId, offerId);
    await SupplierContractService.attachContractToSourcingCase({
      sourcingCaseId: id,
      contractId: contract.id,
    });
    await SourcingTaskOrchestratorService.syncCaseWorkflow(id);

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
    return { error: error instanceof Error ? error.message : "Erreur lors de la s�lection" };
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
    if (!existing.contractId) {
      return { error: "Impossible de confirmer: aucun contrat fournisseur n'est lie a ce dossier" };
    }

    const sc = await SourcingCaseService.confirmSelection(id);
    await SourcingTicketService.syncForSourcingCase(id);
    await SourcingTaskOrchestratorService.syncCaseWorkflow(id);

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
    await SourcingTaskOrchestratorService.syncCaseWorkflow(validated.sourcingCaseId);

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
    checkPermission(user.role, "sourcing.view");
    return { data: await SourcingCaseService.getPipelineStats(user.tenantId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getSourcingKanban() {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.view");
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
    checkPermission(user.role, "sourcing.manage");
    const { cases } = await SourcingCaseService.list(user.tenantId, { limit: 5000 });

    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;

    const headers = [
      "Commande", "Client", "Besoin", "Statut", "Budget", "Devise",
      "Fournisseur", "Offres", "N�gociations", "Cr�� le",
    ];

    const statusLabels: Record<string, string> = {
      SEARCHING: "Recherche",
      OFFERS_RECEIVED: "Offres re�ues",
      NEGOTIATING: "N�gociation",
      SELECTED: "S�lectionn�",
      CONFIRMED: "Confirm�",
      CANCELLED: "Annul�",
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

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "sourcing.export.csv",
      entityType: "sourcing_case",
      entityId: "bulk",
      newValue: { rows: cases.length },
    });

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
    checkPermission(user.role, "sourcing.view");
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
    return { data: serializeDecimals(orders) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getSuppliersForSourcing() {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.view");
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

export async function getSupplierContracts(options?: { supplierId?: string; status?: string }) {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.view");
    const contracts = await SupplierContractService.list(user.tenantId, {
      supplierId: options?.supplierId,
      status: options?.status,
    });
    return { data: contracts };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur contrats fournisseurs" };
  }
}

export async function createSupplierContract(formData: {
  supplierId: string;
  contractNumber: string;
  title: string;
  startAt: string;
  endAt?: string;
  status?: "DRAFT" | "ACTIVE" | "EXPIRED" | "TERMINATED";
  currency?: string;
  negotiatedBy?: string;
  termsJson?: Record<string, unknown>;
  priceGrid?: Record<string, unknown>;
  penaltyClauses?: Record<string, unknown>;
  notes?: string;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.manage");

    const supplier = await prisma.supplier.findUnique({
      where: { id: formData.supplierId },
      select: { id: true },
    });
    if (!supplier) return { error: "Fournisseur introuvable" };

    const contract = await SupplierContractService.create({
      tenantId: user.tenantId,
      supplierId: formData.supplierId,
      contractNumber: formData.contractNumber.trim(),
      title: formData.title.trim(),
      startAt: new Date(formData.startAt),
      endAt: formData.endAt ? new Date(formData.endAt) : undefined,
      status: formData.status || "DRAFT",
      currency: formData.currency || "USD",
      negotiatedBy: formData.negotiatedBy,
      termsJson: formData.termsJson,
      priceGrid: formData.priceGrid,
      penaltyClauses: formData.penaltyClauses,
      notes: formData.notes,
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "supplier.contract.created",
      entityType: "supplier_contract",
      entityId: contract.id,
      newValue: {
        supplierId: contract.supplierId,
        contractNumber: contract.contractNumber,
        status: contract.status,
      },
    });

    revalidatePath("/sourcing");
    revalidatePath("/sourcing/cases");
    return { data: contract };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur creation contrat fournisseur" };
  }
}

export async function linkSourcingCaseContract(caseId: string, contractId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.manage");

    const [sc, contract] = await Promise.all([
      SourcingCaseService.getById(caseId),
      prisma.supplierContract.findFirst({
        where: { id: contractId, tenantId: user.tenantId },
      }),
    ]);

    if (!sc || sc.order.tenantId !== user.tenantId) return { error: "Cas introuvable" };
    if (!contract) return { error: "Contrat introuvable" };
    if (sc.supplierId && sc.supplierId !== contract.supplierId) {
      return { error: "Contrat incompatible avec le fournisseur du dossier" };
    }

    const updated = await SupplierContractService.attachContractToSourcingCase({
      sourcingCaseId: caseId,
      contractId,
    });
    await SourcingTaskOrchestratorService.syncCaseWorkflow(caseId);

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "sourcing.case.contract_linked",
      entityType: "sourcing_case",
      entityId: caseId,
      newValue: { contractId },
    });

    revalidatePath(`/sourcing/cases/${caseId}`);
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur liaison contrat sourcing" };
  }
}

export async function getSourcingAssignees() {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.view");
    const members = await prisma.user.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    });
    return { data: members };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// SOURCING LEVEL  PROMOTE TO PROFOND
// ============================================================

export async function promoteToProFond(caseId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.manage");

    const existing = await SourcingCaseService.getById(caseId);
    if (!existing || existing.order.tenantId !== user.tenantId) {
      return { error: "Cas introuvable" };
    }

    const updated = await prisma.sourcingCase.update({
      where: { id: caseId },
      data: { level: "PROFOND" },
    });

    await SourcingTaskOrchestratorService.syncCaseWorkflow(caseId);

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "sourcing.case.promoted_profond",
      entityType: "sourcing_case",
      entityId: caseId,
    });

    revalidatePath(`/sourcing/cases/${caseId}`);
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur promotion" };
  }
}

// ============================================================
// SOURCING PROFOND  POIDS & DIMENSIONS
// ============================================================

export async function updateSourcingWeights(
  caseId: string,
  data: {
    weightKg: number;
    lengthCm?: number;
    widthCm?: number;
    heightCm?: number;
    cartonCount?: number;
    isSensitive?: boolean;
    platform?: string;
    bufferTransportPct?: number;
    unitPriceRmb?: number;
    quantity?: number;
    exchangeRate?: number;
  }
) {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.manage");

    const existing = await SourcingCaseService.getById(caseId);
    if (!existing || existing.order.tenantId !== user.tenantId) {
      return { error: "Cas introuvable" };
    }

    // Calcul transport automatique
    const transport = TransportCalculatorService.calculate({
      weightKg: data.weightKg,
      lengthCm: data.lengthCm,
      widthCm: data.widthCm,
      heightCm: data.heightCm,
      cartonCount: data.cartonCount,
      isSensitive: data.isSensitive ?? false,
      mode: "AIR",
      bufferPct: data.bufferTransportPct ?? HORION_TRANSPORT_RATES.DEFAULT_BUFFER_PCT,
    });

    // Simulation marge si prix fournisseur fourni
    let marginData = {};
    if (data.unitPriceRmb && data.quantity) {
      const margin = TransportCalculatorService.simulateMargin({
        unitPriceRmb: data.unitPriceRmb,
        quantity: data.quantity,
        transportCostXAF: transport.transportCostWithBufferXAF,
        exchangeRate: data.exchangeRate ?? HORION_TRANSPORT_RATES.DEFAULT_EXCHANGE_RATE,
      });
      marginData = {
        unitPriceRmb: data.unitPriceRmb,
        quantity: data.quantity,
        totalCostXAF: margin.coutTotalXAF,
        prixFinalXAF: margin.prixFinalXAF,
        marginPct: margin.marginPct,
        marginPrevue: margin.marginPct,
      };
    }

    const updated = await prisma.sourcingCase.update({
      where: { id: caseId },
      data: {
        weightKg: data.weightKg,
        lengthCm: data.lengthCm,
        widthCm: data.widthCm,
        heightCm: data.heightCm,
        cartonCount: data.cartonCount,
        sensitiveProduct: data.isSensitive ?? false,
        platform: data.platform,
        volumetricWeightKg: transport.volumetricWeightKg,
        taxableWeightKg: transport.taxableWeightKg,
        transportCostEst: transport.transportCostWithBufferXAF,
        transportCurrency: "XAF",
        transportBufferPct: (data.bufferTransportPct ?? HORION_TRANSPORT_RATES.DEFAULT_BUFFER_PCT) * 100,
        weightEstimated: data.weightKg,
        ...marginData,
      },
    });

    await SourcingTaskOrchestratorService.syncCaseWorkflow(caseId);

    revalidatePath(`/sourcing/cases/${caseId}`);
    return { data: updated, transport };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur mise � jour poids" };
  }
}

// ============================================================
// SIMULATE MARGIN ON A SOURCING CASE
// ============================================================

export async function simulateSourcingMargin(
  caseId: string,
  data: {
    unitPriceRmb: number;
    quantity: number;
    exchangeRate?: number;
    customsDutyPct?: number;
  }
) {
  try {
    const user = await getSession();
    const existing = await SourcingCaseService.getById(caseId);
    if (!existing || existing.order.tenantId !== user.tenantId) {
      return { error: "Cas introuvable" };
    }

    const transportCostXAF = existing.transportCostEst
      ? Number(existing.transportCostEst)
      : 0;

    const simulation = TransportCalculatorService.simulateMargin({
      unitPriceRmb: data.unitPriceRmb,
      quantity: data.quantity,
      transportCostXAF,
      exchangeRate: data.exchangeRate,
      customsDutyPct: data.customsDutyPct,
    });

    await prisma.sourcingCase.update({
      where: { id: caseId },
      data: {
        unitPriceRmb: data.unitPriceRmb,
        quantity: data.quantity,
        totalCostXAF: simulation.coutTotalXAF,
        prixFinalXAF: simulation.prixFinalXAF,
        marginPct: simulation.marginPct,
        marginPrevue: simulation.marginPct,
      },
    });

    await SourcingTaskOrchestratorService.syncCaseWorkflow(caseId);

    revalidatePath(`/sourcing/cases/${caseId}`);
    return { data: simulation };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur simulation marge" };
  }
}

// ============================================================
// CEO  APPROUVER MARGE < 30%
// ============================================================

export async function approveSourcingMarginCeo(caseId: string) {
  try {
    const user = await getSession();
    if (!["ADMIN", "CEO", "DIRECTION"].includes(user.role)) {
      return { error: "R�serv� CEO / Direction" };
    }

    const existing = await SourcingCaseService.getById(caseId);
    if (!existing || existing.order.tenantId !== user.tenantId) {
      return { error: "Cas introuvable" };
    }

    const updated = await prisma.sourcingCase.update({
      where: { id: caseId },
      data: { marginApprovedByCeo: true, ceoApprovedAt: new Date() },
    });

    await SourcingTaskOrchestratorService.syncCaseWorkflow(caseId);

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "sourcing.margin.approved_ceo",
      entityType: "sourcing_case",
      entityId: caseId,
      newValue: { marginPct: String(existing.marginPct) },
    });

    revalidatePath(`/sourcing/cases/${caseId}`);
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur approbation" };
  }
}

// ============================================================
// CAPITALISATION  CONFIRMED � CATALOGUE
// ============================================================

export async function capitalizeToCatalog(caseId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.manage");

    const sc = await SourcingCaseService.getById(caseId);
    if (!sc || sc.order.tenantId !== user.tenantId) {
      return { error: "Cas introuvable" };
    }
    if (sc.status !== "CONFIRMED") {
      return { error: "Cas non confirm�" };
    }

    const existing = await prisma.catalogProduct.findFirst({
      where: { tenantId: user.tenantId, name: sc.requirement },
    });

    let product;
    if (existing) {
      product = await prisma.catalogProduct.update({
        where: { id: existing.id },
        data: {
          ...(sc.weightKg && { weightEstimate: sc.weightKg }),
          ...(sc.marginPct && { averageMargin: sc.marginPct }),
          lastOrderedAt: new Date(),
          status: "CURATED",
        },
      });
    } else {
      product = await prisma.catalogProduct.create({
        data: {
          tenantId: user.tenantId,
          name: sc.requirement,
          status: "TESTED",
          weightEstimate: sc.weightKg ?? undefined,
          priceMin: sc.unitPriceRmb ?? undefined,
          averageMargin: sc.marginPct ?? undefined,
          lastOrderedAt: new Date(),
        },
      });
    }

    if (sc.supplierId && product) {
      const selectedOffer = sc.offers.find((o) => o.isSelected);
      await prisma.supplierProduct.upsert({
        where: { supplierId_productId: { supplierId: sc.supplierId, productId: product.id } },
        update: {
          ...(selectedOffer && { priceMin: selectedOffer.unitPrice }),
          lastVerifiedAt: new Date(),
        },
        create: {
          supplierId: sc.supplierId,
          productId: product.id,
          priceMin: selectedOffer?.unitPrice ?? undefined,
          currency: selectedOffer?.currency ?? "RMB",
          leadTimeDays: selectedOffer?.leadTimeDays ?? undefined,
          lastVerifiedAt: new Date(),
        },
      });
    }

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "sourcing.capitalized_to_catalog",
      entityType: "catalog_product",
      entityId: product.id,
      newValue: { sourcingCaseId: caseId },
    });

    revalidatePath("/catalog");
    revalidatePath(`/sourcing/cases/${caseId}`);
    return { data: product };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur capitalisation" };
  }
}

// ============================================================
// GROUPAGE BATCHES
// ============================================================

export async function createGroupageBatch(data: {
  name: string;
  destination?: string;
  mode?: string;
  etd?: string;
  notes?: string;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.manage");

    const batch = await prisma.groupageBatch.create({
      data: {
        tenantId: user.tenantId,
        name: data.name,
        destination: data.destination ?? "CG",
        mode: data.mode ?? "SEA",
        etd: data.etd ? new Date(data.etd) : undefined,
        notes: data.notes,
      },
    });

    await LogisticsBatchService.ensureFromGroupageBatch(batch.id);

    revalidatePath("/sourcing/groupage");
    return { data: batch };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur cr�ation batch" };
  }
}

export async function addToGroupageBatch(batchId: string, sourcingCaseId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.manage");

    const batch = await prisma.groupageBatch.findUnique({ where: { id: batchId } });
    if (!batch || batch.tenantId !== user.tenantId) return { error: "Batch introuvable" };
    const canonicalBatch = await LogisticsBatchService.ensureFromGroupageBatch(batchId);

    const sc = await SourcingCaseService.getById(sourcingCaseId);
    if (!sc || sc.order.tenantId !== user.tenantId) return { error: "Cas introuvable" };

    let cbm: number | undefined;
    if (sc.lengthCm && sc.widthCm && sc.heightCm && sc.cartonCount) {
      cbm = (Number(sc.lengthCm) * Number(sc.widthCm) * Number(sc.heightCm) / 1_000_000)
        * sc.cartonCount;
    }

    const item = await prisma.groupageBatchItem.create({
      data: {
        batchId,
        sourcingCaseId,
        weightKg: sc.weightKg ? Number(sc.weightKg) : undefined,
        cbm,
      },
    });

    const allItems = await prisma.groupageBatchItem.findMany({ where: { batchId } });
    await prisma.groupageBatch.update({
      where: { id: batchId },
      data: {
        logisticsBatchId: canonicalBatch?.id,
        totalWeight: allItems.reduce((s, i) => s + Number(i.weightKg ?? 0), 0),
        totalCbm: allItems.reduce((s, i) => s + Number(i.cbm ?? 0), 0),
      },
    });

    revalidatePath("/sourcing/groupage");
    return { data: item };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur ajout batch" };
  }
}

export async function removeFromGroupageBatch(itemId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.manage");

    const item = await prisma.groupageBatchItem.findUnique({
      where: { id: itemId },
      include: { batch: { select: { id: true, tenantId: true } } },
    });
    if (!item || item.batch.tenantId !== user.tenantId) return { error: "Item introuvable" };

    await prisma.groupageBatchItem.delete({ where: { id: itemId } });

    const remaining = await prisma.groupageBatchItem.findMany({ where: { batchId: item.batchId } });
    await prisma.groupageBatch.update({
      where: { id: item.batchId },
      data: {
        totalWeight: remaining.reduce((s, i) => s + Number(i.weightKg ?? 0), 0),
        totalCbm: remaining.reduce((s, i) => s + Number(i.cbm ?? 0), 0),
      },
    });

    await LogisticsBatchService.ensureFromGroupageBatch(item.batchId);

    revalidatePath("/sourcing/groupage");
    return { data: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur suppression" };
  }
}

export async function updateGroupageBatchStatus(batchId: string, status: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.manage");

    const batch = await prisma.groupageBatch.findUnique({ where: { id: batchId } });
    if (!batch || batch.tenantId !== user.tenantId) return { error: "Batch introuvable" };
    const canonicalBatch = await LogisticsBatchService.ensureFromGroupageBatch(batchId);

    const updated = await prisma.groupageBatch.update({
      where: { id: batchId },
      data: {
        status,
        logisticsBatchId: canonicalBatch?.id,
      },
    });

    if (canonicalBatch?.id) {
      await prisma.logisticsBatch.update({
        where: { id: canonicalBatch.id },
        data: { status },
      });
    }

    const statusMap: Record<string, string | null> = {
      OPEN: "PENDING",
      FORMING: "PENDING",
      READY: "BOOKED",
      CONFIRMED: "BOOKED",
      IN_TRANSIT: "IN_TRANSIT",
      SHIPPED: "IN_TRANSIT",
      DELIVERED: "DELIVERED",
      CLOSED: "DELIVERED",
      CANCELLED: null,
    };

    const shipmentStatus = statusMap[status];
    if (shipmentStatus) {
      await prisma.shipment.updateMany({
        where: { groupageBatchId: batchId },
        data: { status: shipmentStatus as any },
      });
    }

    revalidatePath("/sourcing/groupage");
    revalidatePath("/logistics");
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur statut" };
  }
}

export async function createShipmentsFromGroupageBatch(batchId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "logistics.manage");

    const batch = await prisma.groupageBatch.findUnique({
      where: { id: batchId },
      include: {
        items: {
          include: {
            sourcingCase: {
              include: {
                order: true,
              },
            },
          },
        },
      },
    });
    if (!batch || batch.tenantId !== user.tenantId) return { error: "Batch introuvable" };
    const canonicalBatch = await LogisticsBatchService.ensureFromGroupageBatch(batchId);

    let created = 0;
    let skipped = 0;

    for (const item of batch.items) {
      const order = item.sourcingCase?.order;
      if (!order) {
        skipped += 1;
        continue;
      }

      const existing = await prisma.shipment.findFirst({
        where: { orderId: order.id, groupageBatchId: batchId },
        select: { id: true },
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      const modeRaw = (batch.mode || "SEA").toUpperCase();
      const mode = ["SEA", "AIR", "ROAD", "RAIL", "MULTIMODAL"].includes(modeRaw)
        ? modeRaw
        : "SEA";

      const shipmentStatusMap: Record<string, string> = {
        OPEN: "PENDING",
        FORMING: "PENDING",
        READY: "BOOKED",
        CONFIRMED: "BOOKED",
        IN_TRANSIT: "IN_TRANSIT",
        SHIPPED: "IN_TRANSIT",
        DELIVERED: "DELIVERED",
        CLOSED: "DELIVERED",
      };

      await prisma.shipment.create({
        data: {
          orderId: order.id,
          groupageBatchId: batchId,
          logisticsBatchId: canonicalBatch?.id,
          mode: mode as any,
          status: (shipmentStatusMap[batch.status] || "PENDING") as any,
          deliveryScope: "FULL",
          shipmentRole: "PRIMARY",
          origin: order.originCountry || "Guangzhou",
          destination: order.destinationCity || batch.destination,
          estimatedDeparture: batch.etd ?? undefined,
          estimatedArrival: batch.eta ?? undefined,
          weight: item.weightKg ?? undefined,
          volume: item.cbm ?? undefined,
          currency: order.currency || "USD",
        },
      });
      created += 1;
    }

    revalidatePath("/sourcing/groupage");
    revalidatePath("/logistics");
    return { data: { created, skipped } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur creation expéditions" };
  }
}

export async function getGroupageBatches() {
  try {
    const user = await getSession();
    const batches = await prisma.groupageBatch.findMany({
      where: { tenantId: user.tenantId },
      include: {
        shipments: { select: { id: true, status: true } },
        items: {
          include: {
            sourcingCase: {
              include: {
                order: { select: { orderNumber: true, contact: { select: { name: true } } } },
                supplier: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return { data: batches };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function detectGroupageOpportunities() {
  try {
    const user = await getSession();
    const cases = await prisma.sourcingCase.findMany({
      where: {
        order: { tenantId: user.tenantId, archivedAt: null },
        status: { in: ["CONFIRMED", "SELECTED"] },
        weightKg: { not: null },
        groupageBatchItems: { none: {} },
      },
      include: {
        order: {
          select: {
            orderNumber: true,
            destinationCity: true,
            contact: { select: { name: true } },
          },
        },
        supplier: { select: { name: true, country: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const byDestination = cases.reduce<Record<string, typeof cases>>((acc, c) => {
      const dest = c.order.destinationCity ?? "CG";
      if (!acc[dest]) acc[dest] = [];
      acc[dest].push(c);
      return acc;
    }, {});

    return { data: { cases, byDestination } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur d�tection" };
  }
}

// ============================================================
// DEMAND INTAKE / INBOX
// ============================================================

const demandSchema = z.object({
  source: z.enum(["WHATSAPP", "CRM", "APP", "MANUAL"]),
  sourceRef: z.string().optional(),
  clientName: z.string().min(2),
  clientSegment: z.enum(["VIP", "STANDARD", "RISK"]).default("STANDARD"),
  rawDescription: z.string().min(3),
  category: z.string().optional(),
  quantity: z.coerce.number().int().positive().optional(),
  targetPrice: z.coerce.number().positive().optional(),
  currency: z.string().optional(),
  urgency: z.enum(["NORMAL", "HIGH", "CRITICAL"]).default("NORMAL"),
  country: z.string().optional(),
  estimatedRevenue: z.coerce.number().positive().optional(),
  aiScore: z.coerce.number().min(0).max(100).optional(),
  assignedToId: z.string().optional(),
  autoAssign: z.coerce.boolean().optional(),
});

const demandAttachmentSchema = z.object({
  demandId: z.string().min(1),
  name: z.string().min(2),
  url: z.string().url(),
  type: z.string().optional(),
});

export async function getDemandIntakes(params?: {
  status?: DemandStatus;
  source?: string;
  search?: string;
  limit?: number;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.view");
    const limit = params?.limit ?? 100;

    const where: any = {
      tenantId: user.tenantId,
      ...(params?.status && { status: params.status }),
      ...(params?.source && params.source !== "ALL" && { source: params.source }),
      ...(params?.search && {
        OR: [
          { clientName: { contains: params.search, mode: "insensitive" as const } },
          { rawDescription: { contains: params.search, mode: "insensitive" as const } },
        ],
      }),
    };

    const demands = await prisma.demandIntake.findMany({
      where,
      include: {
        attachments: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        qualifiedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { receivedAt: "desc" },
      take: limit,
    });

    return { data: serializeDecimals(demands) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur demand intake" };
  }
}

export async function createDemandIntake(formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.manage");
    const validated = demandSchema.parse(formData);

    let assignedToId = validated.assignedToId;
    if (assignedToId) {
      const assignee = await prisma.user.findFirst({
        where: { id: assignedToId, tenantId: user.tenantId },
        select: { id: true },
      });
      if (!assignee) return { error: "Assigne introuvable" };
    }

    if (!assignedToId && validated.autoAssign) {
      const aiAssignee = await SourcingAssignmentService.pickAssignee(user.tenantId, {
        entityType: "demand",
        category: validated.category ?? null,
        urgency: validated.urgency,
      });
      assignedToId = aiAssignee?.id;
    }

    const demand = await prisma.demandIntake.create({
      data: {
        tenantId: user.tenantId,
        source: validated.source as any,
        sourceRef: validated.sourceRef ?? undefined,
        clientName: validated.clientName,
        clientSegment: validated.clientSegment as any,
        rawDescription: validated.rawDescription,
        category: validated.category,
        quantity: validated.quantity ?? undefined,
        targetPrice: validated.targetPrice ?? undefined,
        currency: validated.currency || "USD",
        urgency: validated.urgency as any,
        country: validated.country,
        estimatedRevenue: validated.estimatedRevenue ?? undefined,
        aiScore: validated.aiScore ?? 50,
        assignedToId: assignedToId ?? undefined,
      },
    });

      await AuditService.log({
        tenantId: user.tenantId,
        userId: user.id,
        action: "sourcing.demand.created",
        entityType: "demand_intake",
        entityId: demand.id,
      });

      await SourcingTicketService.ensureFromDemand(demand.id);
      await SourcingTaskOrchestratorService.syncDemandWorkflow(user.tenantId, demand.id);

      revalidatePath("/sourcing");
    return { data: demand };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur creation demande" };
  }
}

export async function syncDemandIntakeFromWhatsapp(limit = 80) {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.manage");

    const result = await SourcingIngestionService.ingestFromWhatsappIntents({
      tenantId: user.tenantId,
      limit,
      autoAssign: true,
    });

    revalidatePath("/sourcing");
    return { data: result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur sync WhatsApp" };
  }
}

export async function syncDemandIntakeFromCrm(limit = 80) {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.manage");

    const result = await SourcingIngestionService.ingestFromCrmLeads({
      tenantId: user.tenantId,
      limit,
      autoAssign: true,
    });

    revalidatePath("/sourcing");
    return { data: result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur sync CRM" };
  }
}

export async function syncDemandIntakeFromAll(limit = 80) {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.manage");

    const [wa, crm] = await Promise.all([
      SourcingIngestionService.ingestFromWhatsappIntents({ tenantId: user.tenantId, limit, autoAssign: true }),
      SourcingIngestionService.ingestFromCrmLeads({ tenantId: user.tenantId, limit, autoAssign: true }),
    ]);

    const created = (wa?.created ?? 0) + (crm?.created ?? 0);
    const skipped = (wa?.skipped ?? 0) + (crm?.skipped ?? 0);

    revalidatePath("/sourcing");
    return { data: { created, skipped } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur sync complet" };
  }
}

export async function autoAssignUnassignedDemands(limit = 50) {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.manage");

      const demands = await prisma.demandIntake.findMany({
        where: {
          tenantId: user.tenantId,
          assignedToId: null,
          status: { in: ["RAW", "QUALIFIED"] as DemandStatus[] },
        },
        orderBy: { receivedAt: "desc" },
        take: limit,
        select: {
          id: true,
          category: true,
          urgency: true,
        },
      });

      let updated = 0;
      for (const demand of demands) {
        const assignee = await SourcingAssignmentService.pickAssignee(user.tenantId, {
          entityType: "demand",
          category: demand.category,
          urgency: demand.urgency,
        });
        if (!assignee) break;
        await prisma.demandIntake.update({
          where: { id: demand.id },
          data: { assignedToId: assignee.id },
        });
        await SourcingTaskOrchestratorService.syncDemandWorkflow(user.tenantId, demand.id);
        updated += 1;
      }

    revalidatePath("/sourcing");
    return { data: { updated } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur auto-assignation" };
  }
}

export async function addDemandAttachment(formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.manage");
    const validated = demandAttachmentSchema.parse(formData);

    const demand = await prisma.demandIntake.findUnique({
      where: { id: validated.demandId },
      select: { tenantId: true },
    });
    if (!demand || demand.tenantId !== user.tenantId) return { error: "Demande introuvable" };

    const attachment = await prisma.demandAttachment.create({
      data: {
        demandId: validated.demandId,
        name: validated.name,
        url: validated.url,
        type: validated.type || "link",
      },
    });

    revalidatePath("/sourcing");
    return { data: attachment };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur ajout document" };
  }
}

export async function qualifyDemand(demandId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.manage");

    const demand = await prisma.demandIntake.findUnique({ where: { id: demandId } });
    if (!demand || demand.tenantId !== user.tenantId) return { error: "Demande introuvable" };

      const updated = await prisma.demandIntake.update({
        where: { id: demandId },
        data: { status: "QUALIFIED", qualifiedById: user.id },
      });

      await SourcingTicketService.ensureFromDemand(demandId);
      await SourcingTaskOrchestratorService.syncDemandWorkflow(user.tenantId, demandId);

      await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "sourcing.demand.qualified",
      entityType: "demand_intake",
      entityId: demandId,
    });

    revalidatePath("/sourcing");
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur qualification" };
  }
}

export async function rejectDemand(demandId: string, reason?: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.manage");

    const demand = await prisma.demandIntake.findUnique({ where: { id: demandId } });
    if (!demand || demand.tenantId !== user.tenantId) return { error: "Demande introuvable" };

      const updated = await prisma.demandIntake.update({
        where: { id: demandId },
        data: { status: "LOST", rejectionReason: reason },
      });

      await SourcingTicketService.ensureFromDemand(demandId);
      await SourcingTaskOrchestratorService.syncDemandWorkflow(user.tenantId, demandId);

      await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "sourcing.demand.rejected",
      entityType: "demand_intake",
      entityId: demandId,
      newValue: { reason },
    });

    revalidatePath("/sourcing");
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur rejet" };
  }
}

export async function assignDemand(demandId: string, assignedToId?: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.manage");

    const demand = await prisma.demandIntake.findUnique({ where: { id: demandId } });
    if (!demand || demand.tenantId !== user.tenantId) return { error: "Demande introuvable" };

    if (assignedToId) {
      const assignee = await prisma.user.findFirst({
        where: { id: assignedToId, tenantId: user.tenantId },
        select: { id: true },
      });
      if (!assignee) return { error: "Assigne introuvable" };
    }

      const updated = await prisma.demandIntake.update({
        where: { id: demandId },
        data: { assignedToId: assignedToId ?? null },
      });

      await SourcingTaskOrchestratorService.syncDemandWorkflow(user.tenantId, demandId);

      await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "sourcing.demand.assigned",
      entityType: "demand_intake",
      entityId: demandId,
      newValue: { assignedToId: assignedToId ?? null },
    });

    revalidatePath("/sourcing");
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur assignation" };
  }
}

export async function assignDemandAI(demandId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.manage");

    const demand = await prisma.demandIntake.findUnique({ where: { id: demandId } });
    if (!demand || demand.tenantId !== user.tenantId) return { error: "Demande introuvable" };

      const assignee = await SourcingAssignmentService.pickAssignee(user.tenantId, {
        entityType: "demand",
        category: demand.category,
        urgency: demand.urgency,
      });
      if (!assignee) return { error: "Aucun assigne disponible" };

      const updated = await prisma.demandIntake.update({
        where: { id: demandId },
        data: { assignedToId: assignee.id },
      });

      await SourcingTaskOrchestratorService.syncDemandWorkflow(user.tenantId, demandId);

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "sourcing.demand.assigned_ai",
      entityType: "demand_intake",
      entityId: demandId,
      newValue: { assignedToId: assignee.id },
    });

    revalidatePath("/sourcing");
    return { data: updated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur assignation AI" };
  }
}

function mapUrgencyToPriority(urgency: DemandUrgency) {
  if (urgency === "CRITICAL") return "URGENT";
  if (urgency === "HIGH") return "HIGH";
  return "NORMAL";
}

function mapPipelineType(segment: string) {
  if (segment === "VIP") return "VIP";
  if (segment === "RISK") return "RETAIL";
  return "RETAIL";
}

export async function convertDemandToSourcing(demandId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.manage");

    const demand = await prisma.demandIntake.findUnique({
      where: { id: demandId },
      include: { attachments: true },
    });
    if (!demand || demand.tenantId !== user.tenantId) return { error: "Demande introuvable" };
    if (demand.status === "CONVERTED") return { error: "Deja convertie" };

    const contact =
      (await prisma.contact.findFirst({
        where: { tenantId: user.tenantId, name: demand.clientName },
      })) ||
      (await prisma.contact.create({
        data: {
          tenantId: user.tenantId,
          type: "PROSPECT",
          name: demand.clientName,
          notes: "Cree depuis Demand Intake",
        },
      }));

      const quantity = demand.quantity ?? 1;
      const unitPrice = Number(demand.targetPrice || 0);
      const currency = demand.currency || "RMB";
      const suggestedAssignee =
        demand.assignedToId ??
        (
          await SourcingAssignmentService.pickAssignee(user.tenantId, {
            entityType: "sourcing_case",
            category: demand.category,
            pipelineType: mapPipelineType(demand.clientSegment),
            urgency: demand.urgency,
            preferredIds: demand.assignedToId ? [demand.assignedToId] : [],
          })
        )?.id;

      const order = await OrderService.create(user.tenantId, {
        contactId: contact.id,
      items: [
        {
          description: demand.rawDescription,
          quantity,
          unitPrice,
          currency,
        },
      ],
      priority: mapUrgencyToPriority(demand.urgency as DemandUrgency),
      destinationCity: "Brazzaville",
      notes: `Cree depuis Demand Intake ${demand.id}`,
      ownerId: user.id,
      onboardedById: user.id,
    });

      const sc = await SourcingCaseService.create({
        orderId: order.id,
        requirement: demand.rawDescription,
      budget:
        (demand.estimatedRevenue != null ? Number(demand.estimatedRevenue) : undefined) ??
        (demand.targetPrice != null ? Number(demand.targetPrice) * quantity : undefined),
        currency: demand.currency || "USD",
        category: demand.category || undefined,
        pipelineType: mapPipelineType(demand.clientSegment),
        assignedToId: suggestedAssignee ?? undefined,
        assignedAgent: suggestedAssignee ? undefined : "AI Agent Alpha",
      });

      await prisma.demandIntake.update({
        where: { id: demandId },
        data: {
          status: "CONVERTED",
          convertedCaseId: sc.id,
          orderId: order.id,
          convertedAt: new Date(),
        },
      });

      await SourcingTicketService.ensureFromDemand(demandId);
      await SourcingTicketService.syncForSourcingCase(sc.id);
      await SourcingTaskOrchestratorService.syncDemandWorkflow(user.tenantId, demandId);
      await SourcingTaskOrchestratorService.syncCaseWorkflow(sc.id);

      await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "sourcing.demand.converted",
      entityType: "demand_intake",
      entityId: demandId,
      newValue: { sourcingCaseId: sc.id, orderId: order.id },
    });

    revalidatePath("/sourcing");
    revalidatePath("/sourcing/cases");
    return { data: sc };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur conversion" };
  }
}

// ============================================================
// PIPELINE ADVANCED
// ============================================================

export async function getSourcingPipelineAdvanced() {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.view");

    const cases = await prisma.sourcingCase.findMany({
      where: { order: { tenantId: user.tenantId } },
      include: {
        order: { select: { orderNumber: true, contact: { select: { name: true } } } },
        supplier: { select: { id: true, name: true, country: true } },
        assignedTo: { select: { id: true, name: true } },
        _count: { select: { offers: true, negotiations: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });

    await SourcingSlaAlertService.notifyForCases({
      tenantId: user.tenantId,
      cases: cases.map((sc) => ({
        id: sc.id,
        status: sc.status,
        stageEnteredAt: sc.stageEnteredAt,
        createdAt: sc.createdAt,
        updatedAt: sc.updatedAt,
        assignedToId: sc.assignedToId ?? null,
      })),
    });

    const payload = cases.map((sc) => {
      const sla = SourcingSlaService.compute(
        sc.status,
        sc.stageEnteredAt || sc.updatedAt || sc.createdAt,
        {
          level: sc.level,
          pipelineType: sc.pipelineType,
          category: sc.category,
          platform: sc.platform,
          sensitiveProduct: sc.sensitiveProduct,
        }
      );
      return {
        id: sc.id,
        orderNumber: sc.order.orderNumber,
        clientName: sc.order.contact.name,
        requirement: sc.requirement,
        status: sc.status,
        pipelineType: sc.pipelineType,
        assignedTo: sc.assignedTo?.name || sc.assignedAgent || "AI Agent",
        suppliersFound: sc._count.offers,
        expectedShippingCost: sc.transportCostEst ? Number(sc.transportCostEst) : 0,
        qcCostEst: sc.qcCostEst ? Number(sc.qcCostEst) : 0,
        slaStatus: sla.status,
        slaLabel: sla.label,
        slaHoursRemaining: Math.round(sla.hoursRemaining),
        slaPercentUsed: Math.round(sla.percentUsed),
        stageEnteredAt: sc.stageEnteredAt,
        supplier: sc.supplier ? sc.supplier.name : null,
        country: sc.supplier?.country || "",
      };
    });

    return { data: payload };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur pipeline" };
  }
}

export async function runSourcingSlaCheck() {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.manage");

    const cases = await prisma.sourcingCase.findMany({
      where: { order: { tenantId: user.tenantId } },
      select: {
        id: true,
        status: true,
        stageEnteredAt: true,
        createdAt: true,
        updatedAt: true,
        assignedToId: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });

    await SourcingSlaAlertService.notifyForCases({
      tenantId: user.tenantId,
      cases: cases.map((sc) => ({
        id: sc.id,
        status: sc.status,
        stageEnteredAt: sc.stageEnteredAt,
        createdAt: sc.createdAt,
        updatedAt: sc.updatedAt,
        assignedToId: sc.assignedToId ?? null,
      })),
    });

    return { data: { scanned: cases.length } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur check SLA sourcing" };
  }
}

// ============================================================
// DECISION ENGINE
// ============================================================

function computeSupplierScore(params: {
  unitPrice: number;
  currency: string;
  reliability?: number;
  quality?: number;
  delivery?: number;
  risk?: number;
}) {
  const priceScore = Math.max(0, 100 - params.unitPrice);
  const reliability = params.reliability ?? 50;
  const quality = params.quality ?? 50;
  const delivery = params.delivery ?? 50;
  const risk = params.risk ?? 50;
  const riskScore = Math.max(0, 100 - risk);
  const score =
    priceScore * 0.4 +
    reliability * 0.2 +
    quality * 0.2 +
    delivery * 0.2 +
    riskScore * 0.1;
  return Math.round(score);
}

export async function getSourcingDecisionData(caseId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.view");

    const sc = await prisma.sourcingCase.findUnique({
      where: { id: caseId },
      include: {
        order: { select: { tenantId: true, totalClient: true, currency: true } },
        offers: {
          include: {
            supplier: {
              include: {
                performanceProfile: true,
                riskProfile: true,
              },
            },
          },
        },
      },
    });
    if (!sc || sc.order.tenantId !== user.tenantId) return { error: "Cas introuvable" };

    const quantity = sc.quantity ?? 1;
    const clientTotal = Number(sc.order.totalClient || 0);
    const clientPerUnit = quantity > 0 ? clientTotal / quantity : 0;

    const scored = sc.offers.map((offer) => {
      const supplierPerf = offer.supplier.performanceProfile;
      const supplierRisk = offer.supplier.riskProfile;
      const score = computeSupplierScore({
        unitPrice: Number(offer.unitPrice),
        currency: offer.currency,
        reliability: supplierPerf ? Number(supplierPerf.reliabilityIndex) : offer.supplier.rating,
        quality: supplierPerf ? Number(supplierPerf.qualityScore) : 50,
        delivery: supplierPerf ? Number(supplierPerf.onTimeDeliveryRate) : 50,
        risk: supplierRisk ? supplierRisk.globalRiskScore : 50,
      });

      let marginPct = null;
      if (clientPerUnit > 0) {
        const unitCostXAF = convertCurrency(Number(offer.unitPrice), offer.currency, "XAF");
        const sellXAF = convertCurrency(clientPerUnit, sc.order.currency || "XAF", "XAF");
        if (sellXAF > 0) marginPct = Math.round(((sellXAF - unitCostXAF) / sellXAF) * 100);
      }

      return {
        offerId: offer.id,
        supplierId: offer.supplierId,
        supplierName: offer.supplier.name,
        unitPrice: Number(offer.unitPrice),
        currency: offer.currency,
        leadTimeDays: offer.leadTimeDays ?? null,
        reliability: supplierPerf ? Number(supplierPerf.reliabilityIndex) : offer.supplier.rating,
        risk: supplierRisk ? supplierRisk.globalRiskScore : 50,
        quality: supplierPerf ? Number(supplierPerf.qualityScore) : 50,
        delivery: supplierPerf ? Number(supplierPerf.onTimeDeliveryRate) : 50,
        score,
        marginPct,
      };
    });

    const ranked = scored.sort((a, b) => b.score - a.score);
    const recommended = ranked[0] || null;
    const alternatives = ranked.slice(1, 3);

    return { data: { recommended, alternatives, all: ranked } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur decision engine" };
  }
}

export async function approveSourcingDecision(
  caseId: string,
  data: { supplierId: string; offerId?: string; note?: string; marginImpact?: number }
) {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.manage");

    const sc = await SourcingCaseService.getById(caseId);
    if (!sc || sc.order.tenantId !== user.tenantId) return { error: "Cas introuvable" };

    const candidateOffer =
      (data.offerId
        ? sc.offers.find((offer) => offer.id === data.offerId && offer.supplierId === data.supplierId)
        : null) ??
      sc.offers.find((offer) => offer.supplierId === data.supplierId);

    if (!candidateOffer) {
      return { error: "Selection fournisseur impossible sans offre rattachee." };
    }

    const decision = await prisma.sourcingDecision.create({
      data: {
        sourcingCaseId: caseId,
        supplierId: data.supplierId,
        status: "APPROVED",
        note: data.note,
        marginImpact: data.marginImpact ?? undefined,
        decidedById: user.id,
      },
    });

    await SourcingCaseService.selectSupplier(caseId, data.supplierId, candidateOffer.id);
    await SourcingTaskOrchestratorService.syncCaseWorkflow(caseId);

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "sourcing.decision.approved",
      entityType: "sourcing_case",
      entityId: caseId,
      newValue: { supplierId: data.supplierId, offerId: candidateOffer.id },
    });

    revalidatePath(`/sourcing/cases/${caseId}`);
    revalidatePath("/sourcing");
    return { data: decision };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur approval" };
  }
}

export async function rejectSourcingDecision(caseId: string, data: { note?: string }) {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.manage");

    const sc = await SourcingCaseService.getById(caseId);
    if (!sc || sc.order.tenantId !== user.tenantId) return { error: "Cas introuvable" };

    const decision = await prisma.sourcingDecision.create({
      data: {
        sourcingCaseId: caseId,
        status: "REJECTED",
        note: data.note,
        decidedById: user.id,
      },
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "sourcing.decision.rejected",
      entityType: "sourcing_case",
      entityId: caseId,
      newValue: { note: data.note },
    });

    revalidatePath(`/sourcing/cases/${caseId}`);
    revalidatePath("/sourcing");
    return { data: decision };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur rejection" };
  }
}

// ============================================================
// MARKET INTELLIGENCE
// ============================================================

const marketSchema = z.object({
  product: z.string().min(2),
  category: z.string().optional(),
  currentPrice: z.coerce.number().positive(),
  priceChange30d: z.coerce.number(),
  volatilityScore: z.coerce.number().min(0).max(100).default(0),
  marketTrend: z.enum(["TIGHTENING", "LOOSENING", "STABLE"]).default("STABLE"),
  recommendedTiming: z.enum(["BUY_NOW", "WAIT", "URGENT"]).default("WAIT"),
  averageMOQ: z.coerce.number().int().nonnegative().default(0),
  supplierCount: z.coerce.number().int().nonnegative().default(0),
});

export async function getMarketInsights() {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.view");
    const insights = await prisma.sourcingMarketInsight.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
    return { data: serializeDecimals(insights) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur market" };
  }
}

export async function createMarketInsight(formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.manage");
    const validated = marketSchema.parse(formData);

    const insight = await prisma.sourcingMarketInsight.create({
      data: {
        tenantId: user.tenantId,
        product: validated.product,
        category: validated.category,
        currentPrice: validated.currentPrice,
        priceChange30d: validated.priceChange30d,
        volatilityScore: validated.volatilityScore,
        marketTrend: validated.marketTrend as any,
        recommendedTiming: validated.recommendedTiming as any,
        averageMOQ: validated.averageMOQ,
        supplierCount: validated.supplierCount,
      },
    });

    revalidatePath("/sourcing");
    return { data: insight };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur creation market" };
  }
}

// ============================================================
// GOVERNANCE & AUDIT
// ============================================================

export async function getSourcingAuditLogs(limit = 100) {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.view");

    const logs = await prisma.auditLog.findMany({
      where: {
        tenantId: user.tenantId,
        OR: [
          { action: { startsWith: "sourcing." } },
          { action: { startsWith: "supplier." } },
        ],
      },
      include: {
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return { data: logs };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur audit" };
  }
}

export async function exportSourcingAuditCSV() {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.manage");
    const logs = await prisma.auditLog.findMany({
      where: {
        tenantId: user.tenantId,
        OR: [
          { action: { startsWith: "sourcing." } },
          { action: { startsWith: "supplier." } },
        ],
      },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });

    const headers = ["Date", "Utilisateur", "Action", "Entite", "Entite ID", "Details"];
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = logs.map((log) => [
      esc(new Date(log.createdAt).toISOString()),
      esc(log.user?.name || log.user?.email || "system"),
      esc(log.action),
      esc(log.entityType || ""),
      esc(log.entityId || ""),
      esc(JSON.stringify(log.newValue || log.oldValue || {})),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "sourcing.audit.export.csv",
      entityType: "audit_log",
      entityId: "bulk",
      newValue: { rows: logs.length },
    });

    return { data: csv };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur export audit" };
  }
}

// ============================================================
// PERFORMANCE & RISK
// ============================================================

export async function getSourcingPerformance() {
  try {
    const user = await getSession();
    checkPermission(user.role, "sourcing.view");

    const [financials, riskProfiles, cases] = await Promise.all([
      prisma.supplierFinancialMetrics.findMany({
        include: { supplier: { select: { id: true, name: true, country: true } } },
        orderBy: { supplierDependency: "desc" },
        take: 20,
      }),
      prisma.supplierRiskProfile.findMany({
        include: { supplier: { select: { id: true, name: true } } },
        orderBy: { globalRiskScore: "desc" },
        take: 20,
      }),
      prisma.sourcingCase.findMany({
        where: { order: { tenantId: user.tenantId } },
        select: { category: true },
      }),
    ]);

    const dependency = financials.slice(0, 6).map((f) => ({
      supplier: f.supplier.name,
      dependency: Number(f.supplierDependency || 0),
      spend: Number(f.lifetimeSpend || 0),
    }));

    const categoryCounts = cases.reduce<Record<string, number>>((acc, c) => {
      const key = c.category || "Uncategorized";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const categoryConcentration = Object.entries(categoryCounts).map(([category, count]) => ({
      category,
      count,
    }));

    const heatmap = riskProfiles.map((r) => ({
      supplier: r.supplier.name,
      globalRisk: r.globalRiskScore,
      quality: r.qualityRisk,
      delivery: r.deliveryRisk,
      compliance: r.complianceRisk,
      financial: r.financialRisk,
    }));

    return { data: { dependency, categoryConcentration, heatmap } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur performance" };
  }
}

// ============================================================
// SUPPLIER DOCUMENTS
// ============================================================

export async function addSupplierDocument(supplierId: string, data: { name: string; url: string; type?: string }) {
  try {
    const user = await getSession();
    checkPermission(user.role, "catalog.manage");

    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) return { error: "Fournisseur introuvable" };

    const doc = await prisma.supplierDocument.create({
      data: {
        supplierId,
        name: data.name,
        url: data.url,
        type: data.type || "document",
      },
    });

    revalidatePath(`/catalog/suppliers/${supplierId}`);
    revalidatePath("/sourcing");
    return { data: doc };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur document" };
  }
}

export async function removeSupplierDocument(documentId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "catalog.manage");

    const doc = await prisma.supplierDocument.findUnique({
      where: { id: documentId },
      include: { supplier: { select: { id: true } } },
    });
    if (!doc) return { error: "Document introuvable" };

    await prisma.supplierDocument.delete({ where: { id: documentId } });
    revalidatePath(`/catalog/suppliers/${doc.supplier.id}`);
    revalidatePath("/sourcing");
    return { data: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur suppression document" };
  }
}
