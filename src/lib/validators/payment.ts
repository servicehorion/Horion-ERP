import { z } from "zod";
import { PaymentMethod } from "@prisma/client";

export const createPaymentSchema = z.object({
  orderId: z.string().min(1, "Commande requise"),
  direction: z.enum(["INBOUND", "OUTBOUND"]),
  type: z.enum([
    "CLIENT_DEPOSIT", "CLIENT_BALANCE", "SUPPLIER_PAYMENT",
    "FREIGHT_PAYMENT", "CUSTOMS_DUTY", "QC_PAYMENT",
    "COMMISSION", "REFUND",
  ]),
  amount: z.number().positive("Montant positif requis"),
  currency: z.string().default("XAF"),
  amountXAF: z.number().nonnegative(),
  fxRate: z.number().positive().optional(),
  methodKey: z.nativeEnum(PaymentMethod).optional(),
  method: z.string().optional(),
  reference: z.string().optional(),
  proofUrl: z.string().optional(),
  depositCode: z.string().optional(),
  expiresAt: z.string().optional(),
  proofUploadedAt: z.string().optional(),
  dueAt: z.string().optional(),
  notes: z.string().optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
