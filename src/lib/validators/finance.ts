import { z } from "zod";

export const createLedgerAccountSchema = z.object({
  code: z.string().min(1, "Code obligatoire").max(10),
  name: z.string().min(1, "Nom obligatoire"),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]),
  currency: z.string().optional(),
});

export const createLedgerEntrySchema = z.object({
  accountId: z.string().min(1, "Compte obligatoire"),
  orderId: z.string().optional(),
  type: z.enum(["DEBIT", "CREDIT"]),
  amount: z.number().positive("Montant positif requis"),
  currency: z.string().default("XAF"),
  description: z.string().min(1, "Description obligatoire"),
  reference: z.string().optional(),
});

export const createFXRateSchema = z.object({
  fromCurrency: z.string().min(1),
  toCurrency: z.string().min(1),
  rate: z.number().positive("Taux positif requis"),
  source: z.string().optional(),
  effectiveAt: z.string().optional(),
});
