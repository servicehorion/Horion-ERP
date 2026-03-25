import { z } from "zod";

export const orderItemSchema = z.object({
  description: z.string().min(1, "Description requise"),
  quantity: z.number().int().positive("Quantite positive requise"),
  unitPrice: z.number().positive("Prix unitaire positif requis"),
  currency: z.string().default("RMB"),
  hsCode: z.string().optional(),
  weight: z.number().optional(),
  volume: z.number().optional(),
  notes: z.string().optional(),
});

export const createOrderSchema = z.object({
  contactId: z.string().min(1, "Contact requis"),
  leadId: z.string().optional(),
  items: z.array(orderItemSchema).min(1, "Au moins un article requis"),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  destinationCity: z.string().default("Brazzaville"),
  originCountry: z.string().optional(),
  logisticsCost: z.number().nonnegative().optional(),
  insuranceAmount: z.number().nonnegative().optional(),
  commissionRate: z.number().min(0).max(1).optional(),
  notes: z.string().optional(),
});

export const updateOrderStatusSchema = z.object({
  orderId: z.string().min(1),
  newStatus: z.enum([
    "DEMANDE", "RECHERCHE_PRODUIT", "DEVIS", "PAIEMENT_EN_COURS",
    "SOURCING", "EN_PRODUCTION", "RECU_ENTREPOT", "QC_EN_COURS", "QC_VALIDE",
    "EN_TRANSIT", "DEDOUANE", "LIVRE", "CLOTURE", "ANNULE", "LITIGE"
  ]),
  note: z.string().optional(),
});

export const updateOrderSchema = z.object({
  orderId: z.string().min(1),
  contactId: z.string().min(1).optional(),
  items: z.array(orderItemSchema).min(1).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  destinationCity: z.string().optional(),
  originCountry: z.string().optional(),
  notes: z.string().optional(),
  logisticsCost: z.number().nonnegative().optional(),
  insuranceAmount: z.number().nonnegative().optional(),
  commissionRate: z.number().min(0).max(1).optional(),
  budgetPlannedXAF: z.number().nonnegative().optional(),
});

export const createQuoteSchema = z.object({
  orderId: z.string().min(1),
  merchandiseTotal: z.number().nonnegative(),
  logisticsCost: z.number().nonnegative(),
  commission: z.number().nonnegative(),
  insuranceCost: z.number().nonnegative().default(0),
  currency: z.string().default("XAF"),
  validUntil: z.string().optional(), // ISO date string
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
