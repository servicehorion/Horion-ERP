"use server";

import { getSession } from "@/lib/session";
import { CatalogProductService } from "@/lib/services/catalog-product.service";
import { CatalogSupplierService } from "@/lib/services/catalog-supplier.service";
import { CatalogOfferService } from "@/lib/services/catalog-offer.service";
import { CatalogMediaService } from "@/lib/services/catalog-media.service";
import { AuditService } from "@/lib/services/audit.service";
import { checkPermission } from "@/lib/permissions";
import {
  createProductSchema,
  updateProductSchema,
  createSupplierSchema,
  updateSupplierSchema,
  createOfferSchema,
  createSupplierProductSchema,
  createMediaSchema,
  createCategorySchema,
} from "@/lib/validators/catalog";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import type { ProductStatus, SupplierStatus } from "@prisma/client";

// ============================================================
// PRODUCTS
// ============================================================

export async function createProduct(formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "catalog.manage");

    const validated = createProductSchema.parse(formData);
    const product = await CatalogProductService.create(user.tenantId, validated);

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "catalog.product.created",
      entityType: "product",
      entityId: product.id,
      newValue: { name: product.name, status: product.status },
    });

    revalidatePath("/catalog/products");
    revalidatePath("/catalog");
    return { data: product };
  } catch (error) {
    console.error("Error creating product:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la création du produit" };
  }
}

export async function updateProduct(productId: string, formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "catalog.manage");

    const existing = await CatalogProductService.getById(productId);
    if (!existing || existing.tenantId !== user.tenantId) {
      return { error: "Produit introuvable" };
    }

    const validated = updateProductSchema.parse(formData);
    const product = await CatalogProductService.update(productId, validated);

    revalidatePath(`/catalog/products/${productId}`);
    revalidatePath("/catalog/products");
    revalidatePath("/catalog");
    return { data: product };
  } catch (error) {
    console.error("Error updating product:", error);
    return { error: error instanceof Error ? error.message : "Erreur lors de la mise à jour" };
  }
}

export async function getProducts(options?: {
  status?: string;
  categoryId?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  try {
    const user = await getSession();
    const result = await CatalogProductService.list(user.tenantId, {
      status: options?.status as ProductStatus | undefined,
      categoryId: options?.categoryId,
      search: options?.search,
      page: options?.page,
      limit: options?.limit,
    });
    return { data: result.products };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la récupération" };
  }
}

export async function getProductById(productId: string) {
  try {
    const user = await getSession();
    const product = await CatalogProductService.getById(productId);
    if (!product || product.tenantId !== user.tenantId) {
      return { error: "Produit introuvable" };
    }
    return { data: product };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la récupération" };
  }
}

export async function getProductStatusCounts() {
  try {
    const user = await getSession();
    return { data: await CatalogProductService.getStatusCounts(user.tenantId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getTopProducts() {
  try {
    const user = await getSession();
    return { data: await CatalogProductService.getTopByDemand(user.tenantId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// SUPPLIERS
// ============================================================

export async function createCatalogSupplier(formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "catalog.manage");

    const validated = createSupplierSchema.parse(formData);
    const supplier = await CatalogSupplierService.create(validated);

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "catalog.supplier.created",
      entityType: "supplier",
      entityId: supplier.id,
      newValue: { name: supplier.name },
    });

    revalidatePath("/catalog/suppliers");
    revalidatePath("/catalog");
    return { data: supplier };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la création du fournisseur" };
  }
}

export async function updateCatalogSupplier(supplierId: string, formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "catalog.manage");

    const validated = updateSupplierSchema.parse(formData);
    const supplier = await CatalogSupplierService.update(supplierId, validated);

    revalidatePath(`/catalog/suppliers/${supplierId}`);
    revalidatePath("/catalog/suppliers");
    return { data: supplier };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la mise à jour" };
  }
}

export async function getSuppliers(options?: {
  status?: string;
  platform?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  try {
    await getSession();
    const result = await CatalogSupplierService.list({
      status: options?.status as SupplierStatus | undefined,
      platform: options?.platform,
      search: options?.search,
      page: options?.page,
      limit: options?.limit,
    });
    return { data: result.suppliers };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la récupération" };
  }
}

export async function getSupplierById(supplierId: string) {
  try {
    await getSession();
    const supplier = await CatalogSupplierService.getById(supplierId);
    if (!supplier) return { error: "Fournisseur introuvable" };
    return { data: supplier };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la récupération" };
  }
}

export async function getSupplierStatusCounts() {
  try {
    await getSession();
    return { data: await CatalogSupplierService.getStatusCounts() };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getTopSuppliers() {
  try {
    await getSession();
    return { data: await CatalogSupplierService.getTopByRating() };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function blacklistSupplier(supplierId: string, reason: string) {
  try {
    const user = await getSession();
    checkPermission(user.role, "catalog.manage");

    const supplier = await CatalogSupplierService.blacklist(supplierId, reason);

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "catalog.supplier.blacklisted",
      entityType: "supplier",
      entityId: supplierId,
      newValue: { reason },
    });

    revalidatePath("/catalog/suppliers");
    return { data: supplier };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// OFFERS / PRICE HISTORY
// ============================================================

export async function createOffer(formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "catalog.manage");

    const validated = createOfferSchema.parse(formData);
    const offer = await CatalogOfferService.create({
      ...validated,
      validFrom: validated.validFrom ? new Date(validated.validFrom) : undefined,
      validTo: validated.validTo ? new Date(validated.validTo) : undefined,
    });

    revalidatePath("/catalog/offers");
    return { data: offer };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la création de l'offre" };
  }
}

export async function getOffers(options?: {
  productId?: string;
  supplierId?: string;
  sourceType?: string;
  page?: number;
  limit?: number;
}) {
  try {
    await getSession();
    const result = await CatalogOfferService.list(options);
    return { data: result.offers };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

export async function getPriceHistory(productId: string, supplierId?: string) {
  try {
    await getSession();
    return { data: await CatalogOfferService.getPriceHistory(productId, supplierId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// SUPPLIER PRODUCTS
// ============================================================

export async function linkSupplierProduct(formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "catalog.manage");

    const validated = createSupplierProductSchema.parse(formData);
    const sp = await prisma.supplierProduct.create({
      data: {
        supplierId: validated.supplierId,
        productId: validated.productId,
        moq: validated.moq,
        priceMin: validated.priceMin,
        priceMax: validated.priceMax,
        currency: validated.currency || "RMB",
        leadTimeDays: validated.leadTimeDays,
        reliabilityNotes: validated.reliabilityNotes,
        isPrimary: validated.isPrimary || false,
      },
      include: { supplier: true, product: true },
    });

    revalidatePath(`/catalog/products/${validated.productId}`);
    revalidatePath(`/catalog/suppliers/${validated.supplierId}`);
    return { data: sp };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la liaison" };
  }
}

// ============================================================
// MEDIA / PROOF VAULT
// ============================================================

export async function createMedia(formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "catalog.manage");

    const validated = createMediaSchema.parse(formData);
    const media = await CatalogMediaService.create(user.tenantId, validated);

    revalidatePath("/catalog/vault");
    return { data: media };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de l'ajout" };
  }
}

export async function getMediaList(options?: {
  linkedEntityType?: string;
  linkedEntityId?: string;
  productId?: string;
  supplierId?: string;
  type?: string;
  page?: number;
  limit?: number;
}) {
  try {
    const user = await getSession();
    return { data: (await CatalogMediaService.list(user.tenantId, options)).media };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// CATEGORIES
// ============================================================

export async function createCategory(formData: Record<string, unknown>) {
  try {
    const user = await getSession();
    checkPermission(user.role, "catalog.manage");

    const validated = createCategorySchema.parse(formData);
    const category = await prisma.productCategory.create({
      data: {
        tenantId: user.tenantId,
        name: validated.name,
        parentId: validated.parentId,
      },
    });

    revalidatePath("/catalog/products");
    return { data: category };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur lors de la création" };
  }
}

export async function getCategories() {
  try {
    const user = await getSession();
    const categories = await prisma.productCategory.findMany({
      where: { tenantId: user.tenantId },
      include: { _count: { select: { products: true } } },
      orderBy: { name: "asc" },
    });
    return { data: categories };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}

// ============================================================
// CATALOG DASHBOARD STATS
// ============================================================

export async function getCatalogDashboardStats() {
  try {
    const user = await getSession();
    const tenantId = user.tenantId;

    const [productCounts, supplierCounts, topProducts, topSuppliers, recentOffers, mediaCounts] = await Promise.all([
      CatalogProductService.getStatusCounts(tenantId),
      CatalogSupplierService.getStatusCounts(),
      CatalogProductService.getTopByDemand(tenantId, 5),
      CatalogSupplierService.getTopByRating(5),
      CatalogOfferService.list({ page: 1, limit: 5 }),
      CatalogMediaService.getCountsByType(tenantId),
    ]);

    return {
      data: {
        productCounts,
        supplierCounts,
        topProducts,
        topSuppliers,
        recentOffers: recentOffers.offers,
        mediaCounts,
      },
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur" };
  }
}
