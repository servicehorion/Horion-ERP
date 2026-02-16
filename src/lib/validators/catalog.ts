import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().min(1, "Nom obligatoire"),
  categoryId: z.string().optional(),
  status: z.enum(["TESTING", "TESTED", "CURATED", "BLACKLIST"]).optional(),
  specsJson: z.record(z.unknown()).optional(),
  weightEstimate: z.number().nonnegative().optional(),
  volumeEstimate: z.number().nonnegative().optional(),
  qcRecommendedLevel: z.string().optional(),
  moqMin: z.number().int().nonnegative().optional(),
  priceMin: z.number().nonnegative().optional(),
  priceMax: z.number().nonnegative().optional(),
  priceCurrency: z.string().optional(),
  shippingHints: z.record(z.unknown()).optional(),
  notes: z.string().optional(),
});

export const updateProductSchema = createProductSchema.partial();

export const createSupplierSchema = z.object({
  name: z.string().min(1, "Nom obligatoire"),
  country: z.string().optional(),
  city: z.string().optional(),
  platform: z.string().optional(),
  status: z.enum(["ACTIVE", "TESTING", "SUSPENDED", "BLACKLIST"]).optional(),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  wechat: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  category: z.string().optional(),
  leadTimeDays: z.number().int().nonnegative().optional(),
  moq: z.string().optional(),
  paymentTerms: z.string().optional(),
  contactsJson: z.record(z.unknown()).optional(),
  negotiatedTermsJson: z.record(z.unknown()).optional(),
  notes: z.string().optional(),
});

export const updateSupplierSchema = createSupplierSchema.partial();

export const createOfferSchema = z.object({
  supplierId: z.string().min(1),
  supplierProductId: z.string().optional(),
  productId: z.string().optional(),
  sourcingCaseId: z.string().optional(),
  unitPrice: z.number().positive("Prix obligatoire"),
  currency: z.string().optional(),
  moq: z.number().int().nonnegative().optional(),
  leadTimeDays: z.number().int().nonnegative().optional(),
  sampleAvailable: z.boolean().optional(),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
  sourceType: z.enum(["sourcing", "order", "manual"]).optional(),
  sourceId: z.string().optional(),
  notes: z.string().optional(),
});

export const createSupplierProductSchema = z.object({
  supplierId: z.string().min(1),
  productId: z.string().min(1),
  moq: z.number().int().nonnegative().optional(),
  priceMin: z.number().nonnegative().optional(),
  priceMax: z.number().nonnegative().optional(),
  currency: z.string().optional(),
  leadTimeDays: z.number().int().nonnegative().optional(),
  reliabilityNotes: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

export const createMediaSchema = z.object({
  type: z.enum(["image", "video", "pdf", "document"]),
  url: z.string().url("URL invalide"),
  filename: z.string().optional(),
  tags: z.array(z.string()).optional(),
  linkedEntityType: z.string().min(1),
  linkedEntityId: z.string().min(1),
  productId: z.string().optional(),
  supplierId: z.string().optional(),
  orderId: z.string().optional(),
});

export const createCategorySchema = z.object({
  name: z.string().min(1, "Nom obligatoire"),
  parentId: z.string().optional(),
});
