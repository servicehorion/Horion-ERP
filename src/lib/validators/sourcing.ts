import { z } from "zod";

export const createSourcingCaseSchema = z.object({
  orderId: z.string().min(1, "Commande obligatoire"),
  supplierId: z.string().optional(),
  contractId: z.string().optional(),
  requirement: z.string().min(1, "Description du besoin obligatoire"),
  budget: z.number().positive().optional(),
  currency: z.string().optional(),
  level: z.enum(["INFORMATIF", "PROFOND"]).optional(),
  platform: z.string().optional(),
  sensitiveProduct: z.boolean().optional(),
  category: z.string().optional(),
  pipelineType: z.enum(["RETAIL", "WHOLESALE", "VIP", "STRATEGIC"]).optional(),
  assignedToId: z.string().optional(),
  assignedAgent: z.string().optional(),
  qcCostEst: z.number().nonnegative().optional(),
});

export const updateSourcingStatusSchema = z.object({
  status: z.enum([
    "SEARCHING",
    "OFFERS_RECEIVED",
    "NEGOTIATING",
    "SELECTED",
    "CONFIRMED",
    "CANCELLED",
  ]),
});

export const addOfferToSourcingSchema = z.object({
  sourcingCaseId: z.string().min(1),
  supplierId: z.string().min(1, "Fournisseur obligatoire"),
  supplierProductId: z.string().optional(),
  productId: z.string().optional(),
  unitPrice: z.number().positive("Prix obligatoire"),
  currency: z.string().optional(),
  moq: z.number().int().nonnegative().optional(),
  leadTimeDays: z.number().int().nonnegative().optional(),
  sampleAvailable: z.boolean().optional(),
  notes: z.string().optional(),
  validTo: z.string().optional(),
});

export const addNegotiationLogSchema = z.object({
  sourcingCaseId: z.string().min(1),
  message: z.string().min(1, "Message obligatoire"),
  direction: z.enum(["INBOUND", "OUTBOUND"]),
  channel: z.string().optional(),
});

export const selectSupplierSchema = z.object({
  supplierId: z.string().min(1),
  offerId: z.string().min(1),
});
