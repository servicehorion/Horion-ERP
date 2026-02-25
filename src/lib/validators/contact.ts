import { z } from "zod";

export const createContactSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  type: z.enum(["CLIENT", "PROSPECT", "SUPPLIER", "FREIGHT_PARTNER", "CUSTOMS_BROKER", "QC_PARTNER", "OTHER"]),
  company: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  whatsapp: z.string().optional(),
  city: z.string().optional(),
  country: z.string().default("CG"),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
  ownerId: z.string().optional(),
  collaboratorIds: z.array(z.string()).default([]),
});

export const updateContactSchema = z.object({
  name: z.string().min(1, "Nom requis").optional(),
  type: z.enum(["CLIENT", "PROSPECT", "SUPPLIER", "FREIGHT_PARTNER", "CUSTOMS_BROKER", "QC_PARTNER", "OTHER"]).optional(),
  company: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  whatsapp: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  ownerId: z.string().optional().nullable(),
  collaboratorIds: z.array(z.string()).optional(),
});

export const createLeadSchema = z.object({
  contactId: z.string().min(1, "Contact requis"),
  source: z.string().optional(),
  description: z.string().optional(),
  estimatedValue: z.number().nonnegative().optional(),
  currency: z.string().default("XAF"),
  category: z.string().optional(),
  assignedTo: z.string().optional(),
  ownerId: z.string().optional(),
  collaboratorIds: z.array(z.string()).default([]),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type CreateLeadInput = z.infer<typeof createLeadSchema>;
