"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { AuditService } from "@/lib/services/audit.service";
import { NotificationService } from "@/lib/services/notification.service";
import { EmailNotificationChannel } from "@/lib/services/notification-channels.service";

// ���� Dashboard ������������������������������������������������������������������������������������������������������������������������������

export async function getQcDashboard() {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.view");
    const [plans, inspections] = await Promise.all([
      prisma.qcPlan.findMany({ where: { tenantId: user.tenantId, isActive: true }, select: { id: true } }),
      prisma.qcInspection.findMany({
        where: { tenantId: user.tenantId },
        select: { status: true, overall: true, defectRate: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const total = inspections.length;
    const scheduled = inspections.filter((i) => i.status === "SCHEDULED").length;
    const inProgress = inspections.filter((i) => i.status === "IN_PROGRESS").length;
    const completed = inspections.filter((i) => i.status === "COMPLETED").length;
    const passed = inspections.filter((i) => i.overall === "PASS").length;
    const failed = inspections.filter((i) => i.overall === "FAIL").length;
    const conditional = inspections.filter((i) => i.overall === "CONDITIONAL").length;

    const passRate = completed > 0 ? Math.round((passed / completed) * 100) : 0;

    const defectRates = inspections
      .filter((i) => i.defectRate !== null)
      .map((i) => Number(i.defectRate));
    const avgDefectRate =
      defectRates.length > 0
        ? (defectRates.reduce((a, b) => a + b, 0) / defectRates.length).toFixed(1)
        : "0";

    // Last 6 months trend
    const now = new Date();
    const monthlyTrend = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const label = d.toLocaleString("fr-FR", { month: "short" });
      const monthInsp = inspections.filter((insp) => {
        const iDate = new Date(insp.createdAt);
        return iDate.getFullYear() === d.getFullYear() && iDate.getMonth() === d.getMonth();
      });
      return {
        label,
        total: monthInsp.length,
        pass: monthInsp.filter((i) => i.overall === "PASS").length,
        fail: monthInsp.filter((i) => i.overall === "FAIL").length,
      };
    });

    return {
      data: {
        plansCount: plans.length,
        total,
        scheduled,
        inProgress,
        completed,
        passed,
        failed,
        conditional,
        passRate,
        avgDefectRate,
        monthlyTrend,
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur dashboard QC" };
  }
}

// ���� Plans ����������������������������������������������������������������������������������������������������������������������������������������

export async function getQcPlans() {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.view");
    const plans = await prisma.qcPlan.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { inspections: true } } },
    });
    return { data: plans };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur plans QC" };
  }
}

export async function createQcPlan(data: {
  name: string;
  type: string;
  productCategory?: string;
  description?: string;
  checklist: Array<{ criterion: string; weight: number; required: boolean }>;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.manage");
    const plan = await prisma.qcPlan.create({
      data: {
        tenantId: user.tenantId,
        name: data.name,
        type: data.type,
        productCategory: data.productCategory,
        description: data.description,
        checklist: data.checklist,
      },
    });
    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "qc.plan_created",
      entityType: "qcPlan",
      entityId: plan.id,
      newValue: { name: plan.name },
    });
    revalidatePath("/qc");
    return { data: plan };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur création plan QC" };
  }
}

export async function updateQcPlan(
  id: string,
  data: Partial<{
    name: string;
    type: string;
    productCategory: string;
    description: string;
    checklist: unknown[];
    isActive: boolean;
  }>
) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.manage");
    const plan = await prisma.qcPlan.update({ where: { id }, data: data as any });
    revalidatePath("/qc");
    return { data: plan };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur mise à jour plan QC" };
  }
}

export async function deleteQcPlan(id: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.manage");
    await prisma.qcPlan.delete({ where: { id } });
    revalidatePath("/qc");
    return { data: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur suppression plan QC" };
  }
}

// ���� Inspections ����������������������������������������������������������������������������������������������������������������������������

export async function getQcInspections(filters?: {
  status?: string;
  planId?: string;
  orderId?: string;
  supplierId?: string;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.view");
    const inspections = await prisma.qcInspection.findMany({
      where: {
        tenantId: user.tenantId,
        ...(filters?.status ? { status: filters.status as any } : {}),
        ...(filters?.planId ? { planId: filters.planId } : {}),
        ...(filters?.orderId ? { orderId: filters.orderId } : {}),
        ...(filters?.supplierId ? { supplierId: filters.supplierId } : {}),
      },
      include: {
        plan: { select: { id: true, name: true, type: true } },
        order: { select: { id: true, orderNumber: true } },
        supplier: { select: { id: true, name: true } },
        inspector: { select: { id: true, name: true } },
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return { data: inspections };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur liste inspections" };
  }
}

export async function createQcInspection(data: {
  planId: string;
  orderId?: string;
  supplierId?: string;
  scheduledAt: string;
  sampleSize?: number;
  notes?: string;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.manage");
    const plan = await prisma.qcPlan.findUnique({
      where: { id: data.planId },
      select: { checklist: true, name: true },
    });
    if (!plan) return { error: "Plan QC introuvable" };

    const checklist = (plan.checklist as Array<{ criterion: string }>) ?? [];

    const inspection = await prisma.qcInspection.create({
      data: {
        tenantId: user.tenantId,
        planId: data.planId,
        orderId: data.orderId,
        supplierId: data.supplierId,
        scheduledAt: new Date(data.scheduledAt),
        inspectedBy: user.id,
        sampleSize: data.sampleSize,
        notes: data.notes,
        status: "SCHEDULED",
        items: {
          create: checklist.map((c) => ({ criterion: c.criterion })),
        },
      },
      include: { items: true },
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "qc.inspection_created",
      entityType: "qcInspection",
      entityId: inspection.id,
      newValue: { planName: plan.name, scheduledAt: data.scheduledAt },
    });

    revalidatePath("/qc");
    return { data: inspection };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur création inspection" };
  }
}

export async function submitQcReport(
  inspectionId: string,
  report: {
    overall: "PASS" | "FAIL" | "CONDITIONAL";
    defectRate?: number;
    notes?: string;
    items: Array<{ id: string; result: "PASS" | "FAIL" | "NA"; notes?: string; defectCount?: number }>;
  }
) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.manage");
    const inspection = await prisma.qcInspection.findUnique({
      where: { id: inspectionId },
      select: { tenantId: true, orderId: true },
    });
    if (!inspection || inspection.tenantId !== user.tenantId) {
      return { error: "Inspection introuvable" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.qcInspection.update({
        where: { id: inspectionId },
        data: {
          status: "COMPLETED",
          overall: report.overall,
          defectRate: report.defectRate,
          notes: report.notes,
          completedAt: new Date(),
        },
      });
      for (const item of report.items) {
        await tx.qcChecklistItem.update({
          where: { id: item.id },
          data: { result: item.result, notes: item.notes, defectCount: item.defectCount },
        });
      }

      // Auto-bloquer les expéditions liées à la commande si le résultat est FAIL
      if (report.overall === "FAIL" && inspection.orderId) {
        const shipments = await tx.shipment.findMany({
          where: { orderId: inspection.orderId },
          select: { id: true },
        });
        for (const shipment of shipments) {
          await tx.shipmentIncident.create({
            data: {
              shipmentId: shipment.id,
              type: "QC_FAIL",
              severity: "HIGH",
              status: "OPEN",
              description: `Inspection QC échouée (taux de défauts : ${report.defectRate ?? "N/A"}%). Expédition bloquée en attente de décision. Notes : ${report.notes ?? "—"}`,
            },
          });
        }
      }
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "qc.report_submitted",
      entityType: "qcInspection",
      entityId: inspectionId,
      newValue: { overall: report.overall, defectRate: report.defectRate },
    });

    if (report.overall === "FAIL") {
      await NotificationService.notify({
        tenantId: user.tenantId,
        userId: user.id,
        type: "TASK_ASSIGNED",
        title: "Inspection QC échouée — Expédition bloquée",
        message: `Le rapport QC est FAIL${report.defectRate ? ` (${report.defectRate}% défauts)` : ""}. Les expéditions liées ont été bloquées automatiquement.`,
        entityType: "qcInspection",
        entityId: inspectionId,
      });
    }

    revalidatePath("/qc");
    revalidatePath("/logistics");
    return { data: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur soumission rapport QC" };
  }
}

export async function startQcInspection(inspectionId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.manage");
    const inspection = await prisma.qcInspection.findUnique({
      where: { id: inspectionId },
      select: { id: true, tenantId: true },
    });
    if (!inspection || inspection.tenantId !== user.tenantId) {
      return { error: "Inspection introuvable" };
    }
    const updated = await prisma.qcInspection.update({
      where: { id: inspectionId },
      data: { status: "IN_PROGRESS" },
    });
    revalidatePath("/qc");
    return { data: updated };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur demarrage inspection" };
  }
}

// ============================================================
// QC REQUESTS (Order-level)
// ============================================================

export async function getQcRequests(filters?: {
  status?: string;
  level?: string;
  orderId?: string;
  partnerId?: string;
  supplierId?: string;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.view");
    const where: any = {
      order: { tenantId: user.tenantId },
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.level ? { level: filters.level } : {}),
      ...(filters?.orderId ? { orderId: filters.orderId } : {}),
      ...(filters?.partnerId ? { partnerId: filters.partnerId } : {}),
      ...(filters?.supplierId ? { supplierId: filters.supplierId } : {}),
    };
    const requests = await prisma.qCRequest.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            contact: { select: { id: true, name: true, email: true, phone: true, whatsapp: true } },
          },
        },
        partner: { select: { id: true, name: true, city: true, country: true } },
        supplier: { select: { id: true, name: true } },
        product: { select: { id: true, name: true } },
        reports: { include: { nonConformities: true }, orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    });
    return { data: requests };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur demandes QC" };
  }
}

export async function getQcRequestOptions() {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.view");
    const [orders, suppliers, products, partners] = await Promise.all([
      prisma.order.findMany({
        where: { tenantId: user.tenantId, archivedAt: null },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          orderNumber: true,
          contact: { select: { name: true } },
        },
      }),
      prisma.supplier.findMany({
        orderBy: { name: "asc" },
        take: 100,
        select: { id: true, name: true, city: true },
      }),
      prisma.catalogProduct.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { name: "asc" },
        take: 100,
        select: { id: true, name: true, qcRecommendedLevel: true },
      }),
      prisma.contact.findMany({
        where: { tenantId: user.tenantId, type: "QC_PARTNER" },
        orderBy: { name: "asc" },
        take: 100,
        select: {
          id: true,
          name: true,
          city: true,
          country: true,
          qcPartnerProfile: { select: { rating: true, leadTimeDays: true, priceGrid: true, basePrice: true } },
        },
      }),
    ]);
    return { data: { orders, suppliers, products, partners } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur options QC" };
  }
}

export async function createQcRequest(data: {
  orderId: string;
  type: string;
  level?: string;
  partnerId?: string;
  supplierId?: string;
  productId?: string;
  inspector?: string;
  cost?: number;
  currency?: string;
  scheduledAt?: string;
  notes?: string;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.manage");
    const order = await prisma.order.findUnique({
      where: { id: data.orderId },
      select: { id: true, tenantId: true, orderNumber: true },
    });
    if (!order || order.tenantId !== user.tenantId) {
      return { error: "Commande introuvable" };
    }

    const request = await prisma.qCRequest.create({
      data: {
        orderId: data.orderId,
        type: data.type as any,
        level: (data.level as any) ?? "VIRTUAL",
        partnerId: data.partnerId || undefined,
        supplierId: data.supplierId || undefined,
        productId: data.productId || undefined,
        inspector: data.inspector || undefined,
        cost: data.cost ?? undefined,
        currency: data.currency || "USD",
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
        decisionNotes: data.notes || undefined,
      },
    });

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "qc.request_created",
      entityType: "qcRequest",
      entityId: request.id,
      newValue: { orderNumber: order.orderNumber, level: request.level },
    });

    revalidatePath("/qc");
    revalidatePath(`/orders/${data.orderId}`);
    return { data: request };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur creation QC" };
  }
}

export async function updateQcRequest(
  requestId: string,
  data: Partial<{
    status: string;
    level: string;
    partnerId: string;
    supplierId: string;
    productId: string;
    inspector: string;
    cost: number;
    currency: string;
    scheduledAt: string;
    decisionNotes: string;
  }>
) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.manage");
    const request = await prisma.qCRequest.findUnique({
      where: { id: requestId },
      include: { order: { select: { id: true, tenantId: true } } },
    });
    if (!request || request.order.tenantId !== user.tenantId) {
      return { error: "QC introuvable" };
    }

    const updated = await prisma.qCRequest.update({
      where: { id: requestId },
      data: {
        ...(data.status ? { status: data.status as any } : {}),
        ...(data.level ? { level: data.level as any } : {}),
        ...(data.partnerId ? { partnerId: data.partnerId } : {}),
        ...(data.supplierId ? { supplierId: data.supplierId } : {}),
        ...(data.productId ? { productId: data.productId } : {}),
        ...(data.inspector !== undefined ? { inspector: data.inspector } : {}),
        ...(data.cost !== undefined ? { cost: data.cost } : {}),
        ...(data.currency ? { currency: data.currency } : {}),
        ...(data.scheduledAt ? { scheduledAt: new Date(data.scheduledAt) } : {}),
        ...(data.decisionNotes ? { decisionNotes: data.decisionNotes } : {}),
        ...(data.status === "PASSED" || data.status === "FAILED" || data.status === "CONDITIONAL"
          ? { completedAt: new Date() }
          : {}),
      },
    });

    revalidatePath("/qc");
    revalidatePath(`/orders/${request.order.id}`);
    return { data: updated };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur maj QC" };
  }
}

export async function addQcReportToRequest(
  requestId: string,
  data: {
    overallResult: "PASS" | "FAIL" | "CONDITIONAL";
    defectRate?: number;
    recommendation?: string;
    summary?: string;
    photos?: string[];
    videos?: string[];
    packagingVideo?: string;
    quantityConfirmed?: boolean;
    qualityConfirmed?: boolean;
    packagingConfirmed?: boolean;
    nonConformities?: Array<{
      category: string;
      severity: string;
      description: string;
      photoUrl?: string;
      resolution?: string;
    }>;
  }
) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.manage");
    const request = await prisma.qCRequest.findUnique({
      where: { id: requestId },
      include: { order: { select: { id: true, tenantId: true } } },
    });
    if (!request || request.order.tenantId !== user.tenantId) {
      return { error: "QC introuvable" };
    }

    const report = await prisma.qCReport.create({
      data: {
        qcRequestId: requestId,
        overallResult: data.overallResult,
        defectRate: data.defectRate ?? undefined,
        recommendation: data.recommendation,
        summary: data.summary,
        photos: data.photos ?? [],
        videos: data.videos ?? [],
        packagingVideo: data.packagingVideo,
        quantityConfirmed: data.quantityConfirmed,
        qualityConfirmed: data.qualityConfirmed,
        packagingConfirmed: data.packagingConfirmed,
        nonConformities: data.nonConformities
          ? { create: data.nonConformities.map((n) => ({ ...n })) }
          : undefined,
      },
      include: { nonConformities: true },
    });

    const status =
      data.overallResult === "PASS" ? "PASSED" : data.overallResult === "CONDITIONAL" ? "CONDITIONAL" : "FAILED";

    await prisma.qCRequest.update({
      where: { id: requestId },
      data: { status, completedAt: new Date() },
    });

    if (status === "FAILED") {
      await prisma.order.update({
        where: { id: request.order.id },
        data: {
          status: "LITIGE",
          timeline: {
            create: {
              event: "qc_failed_block",
              fromValue: "QC_EN_COURS",
              toValue: "LITIGE",
              note: "Blocage automatique suite a un QC FAIL",
              userId: user.id,
            },
          },
        },
      });
    }

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "qc.report_added",
      entityType: "qcRequest",
      entityId: requestId,
      newValue: { overallResult: data.overallResult },
    });

    revalidatePath("/qc");
    revalidatePath(`/orders/${request.order.id}`);
    return { data: report };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur rapport QC" };
  }
}

export async function getQcReports() {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.view");
    const reports = await prisma.qCReport.findMany({
      where: { qcRequest: { order: { tenantId: user.tenantId } } },
      include: {
        qcRequest: {
          include: {
            order: { select: { id: true, orderNumber: true, contact: { select: { name: true, email: true } } } },
          },
        },
        nonConformities: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return { data: reports };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur rapports QC" };
  }
}

export async function shareQcReportWithClient(reportId: string, message?: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.manage");
    const report = await prisma.qCReport.findUnique({
      where: { id: reportId },
      include: {
        qcRequest: {
          include: {
            order: { select: { id: true, tenantId: true, orderNumber: true, ownerId: true, contact: true } },
          },
        },
      },
    });
    if (!report || report.qcRequest.order.tenantId !== user.tenantId) {
      return { error: "Rapport introuvable" };
    }

    const updated = await prisma.qCReport.update({
      where: { id: reportId },
      data: { sharedWithClient: true, sharedAt: new Date(), sharedById: user.id },
    });

    const contact = report.qcRequest.order.contact;
    if (contact?.email) {
      await EmailNotificationChannel.send({
        to: contact.email,
        type: "QC_REPORT_SHARED",
        title: `Rapport QC - Commande ${report.qcRequest.order.orderNumber}`,
        message: message || report.summary || "Votre rapport QC est disponible.",
        entityType: "qc_report",
        entityId: reportId,
        urgency: "normal",
      });
    }

    if (report.qcRequest.order.ownerId) {
      await NotificationService.notify({
        tenantId: user.tenantId,
        userId: report.qcRequest.order.ownerId,
        type: "QC_REPORT_ADDED",
        title: "Rapport QC partage avec le client",
        message: report.summary || "Rapport QC partage",
        entityType: "qc_report",
        entityId: reportId,
      });
    }

    revalidatePath("/qc");
    return { data: updated };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur partage QC" };
  }
}

// ============================================================
// QC PARTNERS
// ============================================================

export async function getQcPartners() {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.view");
    const partners = await prisma.contact.findMany({
      where: { tenantId: user.tenantId, type: "QC_PARTNER" },
      orderBy: { name: "asc" },
      include: { qcPartnerProfile: true },
    });
    return { data: partners };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur partenaires QC" };
  }
}

export async function createQcPartner(data: {
  name: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  specialties?: string[];
  leadTimeDays?: number;
  basePrice?: number;
  priceGrid?: Record<string, any>;
  rating?: number;
  notes?: string;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.manage");
    const contact = await prisma.contact.create({
      data: {
        tenantId: user.tenantId,
        type: "QC_PARTNER",
        name: data.name,
        city: data.city,
        country: data.country || "CN",
        phone: data.phone,
        email: data.email,
        notes: data.notes,
      },
    });

    const profile = await prisma.qcPartnerProfile.create({
      data: {
        tenantId: user.tenantId,
        contactId: contact.id,
        city: data.city,
        specialties: data.specialties ?? [],
        leadTimeDays: data.leadTimeDays ?? undefined,
        basePrice: data.basePrice ?? undefined,
        priceGrid: data.priceGrid ?? {},
        rating: data.rating ?? 50,
        notes: data.notes,
      },
    });

    revalidatePath("/qc");
    return { data: { contact, profile } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur creation partenaire" };
  }
}

export async function updateQcPartner(
  contactId: string,
  data: Partial<{
    name: string;
    city: string;
    country: string;
    phone: string;
    email: string;
    notes: string;
    specialties: string[];
    leadTimeDays: number;
    basePrice: number;
    priceGrid: Record<string, any>;
    rating: number;
  }>
) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.manage");
    const contact = await prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact || contact.tenantId !== user.tenantId) {
      return { error: "Partenaire introuvable" };
    }

    await prisma.contact.update({
      where: { id: contactId },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.city ? { city: data.city } : {}),
        ...(data.country ? { country: data.country } : {}),
        ...(data.phone ? { phone: data.phone } : {}),
        ...(data.email ? { email: data.email } : {}),
        ...(data.notes ? { notes: data.notes } : {}),
      },
    });

    await prisma.qcPartnerProfile.upsert({
      where: { contactId },
      update: {
        ...(data.specialties ? { specialties: data.specialties } : {}),
        ...(data.leadTimeDays !== undefined ? { leadTimeDays: data.leadTimeDays } : {}),
        ...(data.basePrice !== undefined ? { basePrice: data.basePrice } : {}),
        ...(data.priceGrid ? { priceGrid: data.priceGrid } : {}),
        ...(data.rating !== undefined ? { rating: data.rating } : {}),
      },
      create: {
        tenantId: user.tenantId,
        contactId,
        specialties: data.specialties ?? [],
        leadTimeDays: data.leadTimeDays ?? undefined,
        basePrice: data.basePrice ?? undefined,
        priceGrid: data.priceGrid ?? {},
        rating: data.rating ?? 50,
      },
    });

    revalidatePath("/qc");
    return { data: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur maj partenaire" };
  }
}

export async function deleteQcPartner(contactId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.manage");
    const contact = await prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact || contact.tenantId !== user.tenantId) {
      return { error: "Partenaire introuvable" };
    }
    await prisma.qcPartnerProfile.deleteMany({ where: { contactId } });
    await prisma.contact.delete({ where: { id: contactId } });
    revalidatePath("/qc");
    return { data: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur suppression partenaire" };
  }
}

//    Lab Connections                                                           

export async function getLabConnections() {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.view");
    const data = await prisma.qcLabConnection.findMany({
      where: { tenantId: user.tenantId },
      include: { _count: { select: { tests: true } } },
      orderBy: { createdAt: "desc" },
    });
    return { data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur" };
  }
}

export async function createLabConnection(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.manage");
    const data = await prisma.qcLabConnection.create({
      data: {
        tenantId: user.tenantId,
        provider: formData.get("provider") as string,
        name: formData.get("name") as string,
        apiEndpoint: formData.get("apiEndpoint") as string,
        apiKey: formData.get("apiKey") as string,
        webhookSecret: (formData.get("webhookSecret") as string) || undefined,
      },
    });
    revalidatePath("/qc");
    return { data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur cr�ation connexion lab" };
  }
}

export async function deleteLabConnection(id: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.manage");
    const conn = await prisma.qcLabConnection.findUnique({ where: { id } });
    if (!conn || conn.tenantId !== user.tenantId) return { error: "Introuvable" };
    await prisma.qcLabConnection.delete({ where: { id } });
    revalidatePath("/qc");
    return { data: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur suppression" };
  }
}

export async function submitTestToLab(qcRequestId: string, connectionId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.manage");
    const conn = await prisma.qcLabConnection.findUnique({ where: { id: connectionId } });
    if (!conn || conn.tenantId !== user.tenantId) return { error: "Connexion introuvable" };

    const labTest = await prisma.qcLabTest.create({
      data: { connectionId, qcRequestId, status: "SUBMITTED" },
    });

    // Fire-and-forget POST to external lab API
    if (conn.apiEndpoint) {
      fetch(conn.apiEndpoint + "/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": conn.apiKey },
        body: JSON.stringify({ horionTestId: labTest.id, qcRequestId }),
      }).catch(() => {/* ignore  external API may be unavailable */});
    }

    revalidatePath("/qc");
    return { data: labTest };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur soumission lab" };
  }
}

export async function fetchLabResults(labTestId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.manage");
    const labTest = await prisma.qcLabTest.findUnique({
      where: { id: labTestId },
      include: { connection: true },
    });
    if (!labTest || labTest.connection.tenantId !== user.tenantId) return { error: "Introuvable" };

    const res = await fetch(`${labTest.connection.apiEndpoint}/tests/${labTest.externalTestId || labTestId}`, {
      headers: { "X-Api-Key": labTest.connection.apiKey },
    });
    if (!res.ok) return { error: `Lab API error: ${res.status}` };
    const results = await res.json();
    const updated = await prisma.qcLabTest.update({
      where: { id: labTestId },
      data: { results, status: results.status ?? "COMPLETED", completedAt: new Date() },
    });
    revalidatePath("/qc");
    return { data: updated };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur r�cup�ration r�sultats" };
  }
}

export async function listLabTests(qcRequestId?: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.view");
    const data = await prisma.qcLabTest.findMany({
      where: qcRequestId
        ? { qcRequestId }
        : { connection: { tenantId: user.tenantId } },
      include: { connection: { select: { provider: true, name: true } } },
      orderBy: { submittedAt: "desc" },
      take: 100,
    });
    return { data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur" };
  }
}

//    AI Vision                                                                 

export async function analyzeQcPhotoWithAI(photoUrl: string, nonConformityId?: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.manage");

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) return { error: "ANTHROPIC_API_KEY non configur�" };

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "url", url: photoUrl },
              },
              {
                type: "text",
                text: `Tu es un expert en contr�le qualit� industriel. Analyse cette image et identifie les d�fauts visuels.
R�ponds UNIQUEMENT en JSON avec ce format exact:
{
  "defects": [{"type": "string", "severity": "LOW|MEDIUM|HIGH|CRITICAL", "location": "string", "confidence": 0.0-1.0}],
  "overallSeverity": "PASS|MINOR|MAJOR|CRITICAL",
  "recommendation": "string"
}`,
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) return { error: `Anthropic API error: ${res.status}` };
    const aiResp = await res.json();
    const text = aiResp.content?.[0]?.text ?? "{}";
    let parsed: { defects?: unknown[]; overallSeverity?: string; recommendation?: string };
    try { parsed = JSON.parse(text); } catch { parsed = { defects: [], overallSeverity: "PASS", recommendation: text }; }

    const confidence = Array.isArray(parsed.defects) && parsed.defects.length > 0
      ? Math.max(...(parsed.defects as { confidence?: number }[]).map(d => d.confidence ?? 0))
      : 0;

    if (nonConformityId) {
      await prisma.qCNonConformity.update({
        where: { id: nonConformityId },
        data: { aiDetected: true, aiConfidence: confidence, aiRawResponse: parsed as object },
      });
    }

    revalidatePath("/qc");
    return { data: parsed };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur analyse IA" };
  }
}

//    SPC Charts                                                                

export async function createSpcChart(formData: FormData) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.manage");
    const data = await prisma.qcSpcChart.create({
      data: {
        tenantId: user.tenantId,
        name: formData.get("name") as string,
        metric: formData.get("metric") as string,
        productId: (formData.get("productId") as string) || undefined,
      },
    });
    revalidatePath("/qc");
    return { data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur cr�ation graphique SPC" };
  }
}

export async function listSpcCharts(productId?: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.view");
    const data = await prisma.qcSpcChart.findMany({
      where: { tenantId: user.tenantId, ...(productId ? { productId } : {}) },
      include: {
        _count: { select: { dataPoints: true } },
        dataPoints: { orderBy: { measuredAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });
    return { data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur" };
  }
}

export async function getSpcChartData(chartId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.view");
    const chart = await prisma.qcSpcChart.findUnique({
      where: { id: chartId },
      include: { dataPoints: { orderBy: { measuredAt: "asc" } } },
    });
    if (!chart || chart.tenantId !== user.tenantId) return { error: "Introuvable" };
    return { data: chart };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur" };
  }
}

export async function addSpcDataPoint(chartId: string, value: number, inspectionId?: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.manage");
    const chart = await prisma.qcSpcChart.findUnique({ where: { id: chartId } });
    if (!chart || chart.tenantId !== user.tenantId) return { error: "Graphique introuvable" };

    // Get existing data points for control limit calculation
    const existing = await prisma.qcSpcDataPoint.findMany({
      where: { chartId },
      select: { value: true },
    });
    const values = [...existing.map(d => Number(d.value)), value];
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sigma = Math.sqrt(values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length);
    const ucl = mean + 3 * sigma;
    const lcl = mean - 3 * sigma;
    const isOutOfControl = value > ucl || value < lcl;

    const point = await prisma.qcSpcDataPoint.create({
      data: { chartId, value, isOutOfControl, inspectionId },
    });

    // Auto-update chart control limits if >= 10 points
    if (values.length >= 10) {
      await prisma.qcSpcChart.update({
        where: { id: chartId },
        data: { mean, sigma, ucl, lcl },
      });
    }

    revalidatePath("/qc");
    return { data: point };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur ajout point SPC" };
  }
}

//    Lot Traceability                                                          

export async function createOrUpdateLotTrace(lotNumber: string, input: {
  productId?: string;
  supplierId?: string;
}) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.manage");
    const data = await prisma.qcLotTrace.upsert({
      where: { tenantId_lotNumber: { tenantId: user.tenantId, lotNumber } },
      create: { tenantId: user.tenantId, lotNumber, ...input },
      update: input,
    });
    revalidatePath("/qc");
    return { data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur lot" };
  }
}

export async function getLotHistory(lotNumber: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.view");
    const lot = await prisma.qcLotTrace.findUnique({
      where: { tenantId_lotNumber: { tenantId: user.tenantId, lotNumber } },
    });
    if (!lot) return { data: null };

    const orderIds = (lot.orderIds as string[]) || [];
    const qcRequestIds = (lot.qcRequestIds as string[]) || [];

    const [orders, qcRequests] = await Promise.all([
      orderIds.length > 0
        ? prisma.order.findMany({
            where: { id: { in: orderIds } },
            select: { id: true, orderNumber: true, status: true, createdAt: true },
          })
        : [],
      qcRequestIds.length > 0
        ? prisma.qCRequest.findMany({ where: { id: { in: qcRequestIds } }, select: { id: true, type: true, status: true, createdAt: true } })
        : [],
    ]);

    return { data: { lot, orders, qcRequests } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur historique lot" };
  }
}

export async function recallLot(lotNumber: string, reason: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.manage");
    const data = await prisma.qcLotTrace.update({
      where: { tenantId_lotNumber: { tenantId: user.tenantId, lotNumber } },
      data: { status: "RECALLED", recallReason: reason },
    });
    revalidatePath("/qc");
    return { data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur rappel lot" };
  }
}

export async function listLotTraces(status?: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.view");
    const data = await prisma.qcLotTrace.findMany({
      where: { tenantId: user.tenantId, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return { data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur" };
  }
}

export async function linkOrderToLot(lotNumber: string, orderId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.manage");
    const lot = await prisma.qcLotTrace.findUnique({
      where: { tenantId_lotNumber: { tenantId: user.tenantId, lotNumber } },
    });
    if (!lot) return { error: "Lot introuvable" };
    const orderIds = [...new Set([...(lot.orderIds as string[]), orderId])];
    const data = await prisma.qcLotTrace.update({
      where: { tenantId_lotNumber: { tenantId: user.tenantId, lotNumber } },
      data: { orderIds },
    });
    revalidatePath("/qc");
    return { data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur liaison lot" };
  }
}

export async function linkQcRequestToLot(lotNumber: string, qcRequestId: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "qc.manage");
    const lot = await prisma.qcLotTrace.findUnique({
      where: { tenantId_lotNumber: { tenantId: user.tenantId, lotNumber } },
    });
    if (!lot) return { error: "Lot introuvable" };

    const qcRequestIds = [...new Set([...(lot.qcRequestIds as string[]), qcRequestId])];
    const data = await prisma.qcLotTrace.update({
      where: { tenantId_lotNumber: { tenantId: user.tenantId, lotNumber } },
      data: { qcRequestIds },
    });
    revalidatePath("/qc");
    return { data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur liaison QC lot" };
  }
}
