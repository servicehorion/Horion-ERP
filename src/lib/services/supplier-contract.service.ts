import { prisma } from "@/lib/db";

export class SupplierContractService {
  static async list(tenantId: string, options?: { supplierId?: string; status?: string }) {
    return prisma.supplierContract.findMany({
      where: {
        tenantId,
        ...(options?.supplierId ? { supplierId: options.supplierId } : {}),
        ...(options?.status ? { status: options.status as any } : {}),
      },
      include: {
        supplier: { select: { id: true, name: true, country: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
  }

  static async create(params: {
    tenantId: string;
    supplierId: string;
    contractNumber: string;
    title: string;
    startAt: Date;
    endAt?: Date;
    status?: "DRAFT" | "ACTIVE" | "EXPIRED" | "TERMINATED";
    currency?: string;
    negotiatedBy?: string;
    termsJson?: Record<string, unknown>;
    priceGrid?: Record<string, unknown>;
    penaltyClauses?: Record<string, unknown>;
    notes?: string;
  }) {
    return prisma.supplierContract.create({
      data: {
        tenantId: params.tenantId,
        supplierId: params.supplierId,
        contractNumber: params.contractNumber,
        title: params.title,
        startAt: params.startAt,
        endAt: params.endAt,
        status: params.status || "DRAFT",
        currency: params.currency || "USD",
        negotiatedBy: params.negotiatedBy,
        termsJson: (params.termsJson || {}) as any,
        priceGrid: (params.priceGrid || {}) as any,
        penaltyClauses: (params.penaltyClauses || {}) as any,
        notes: params.notes,
      },
      include: {
        supplier: { select: { id: true, name: true } },
      },
    });
  }

  static async getActiveContractForSupplier(params: {
    tenantId: string;
    supplierId: string;
    at?: Date;
  }) {
    const at = params.at || new Date();
    return prisma.supplierContract.findFirst({
      where: {
        tenantId: params.tenantId,
        supplierId: params.supplierId,
        status: "ACTIVE",
        startAt: { lte: at },
        OR: [{ endAt: null }, { endAt: { gte: at } }],
      },
      orderBy: [{ endAt: "asc" }, { updatedAt: "desc" }],
    });
  }

  static async attachContractToSourcingCase(params: {
    sourcingCaseId: string;
    contractId: string;
  }) {
    return prisma.sourcingCase.update({
      where: { id: params.sourcingCaseId },
      data: { contractId: params.contractId },
      include: {
        supplier: { select: { id: true, name: true } },
        contract: { select: { id: true, contractNumber: true, status: true } },
      },
    });
  }
}
