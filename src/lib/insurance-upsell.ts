export const INSURANCE_UPSELL_RATE = 0.03;

export function getInsuranceUpsellCost(subtotalXaf: number) {
  if (!Number.isFinite(subtotalXaf) || subtotalXaf <= 0) return 0;
  return Math.round(subtotalXaf * INSURANCE_UPSELL_RATE);
}

