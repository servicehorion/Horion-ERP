export function formatPublicNumber(value: number | string | null | undefined): string {
  const normalized = Math.round(Number(value ?? 0));
  const sign = normalized < 0 ? "-" : "";
  const digits = Math.abs(normalized).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${digits}`;
}

export function formatPublicMoney(
  value: number | string | null | undefined,
  currency: string = "XAF"
): string {
  const amount = Number(value ?? 0);
  if (currency === "XAF") {
    return `${formatPublicNumber(amount)} FCFA`;
  }

  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${formatPublicNumber(amount)} ${currency}`;
  }
}
