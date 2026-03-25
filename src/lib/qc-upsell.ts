export type QcUpsellOption = "NONE" | "VIRTUAL" | "PHYSICAL";

export const QC_UPSELL_PRICING: Record<
  QcUpsellOption,
  { label: string; description: string; costXaf: number; slaHours?: number }
> = {
  NONE: {
    label: "Aucun QC additionnel",
    description: "Vérification visuelle basique à l'entrepôt.",
    costXaf: 0,
    slaHours: 24,
  },
  VIRTUAL: {
    label: "QC virtuel",
    description: "Photos HD + checklist + rapport détaillé sous 48h après réception.",
    costXaf: 15_000,
    slaHours: 48,
  },
  PHYSICAL: {
    label: "QC physique",
    description: "Inspection tierce type SGS / Bureau Veritas sous 72h.",
    costXaf: 75_000,
    slaHours: 72,
  },
};

export function normalizeQcUpsellOption(value: unknown): QcUpsellOption {
  const normalized = String(value || "").toUpperCase();
  if (normalized === "VIRTUAL" || normalized === "PHYSICAL") return normalized;
  return "NONE";
}

export function getQcUpsellCost(option: unknown) {
  const normalized = normalizeQcUpsellOption(option);
  return QC_UPSELL_PRICING[normalized].costXaf;
}
