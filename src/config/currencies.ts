export const CURRENCIES = {
  XAF: { code: "XAF", symbol: "FCFA", name: "Franc CFA", decimals: 0, locale: "fr-CG" },
  XOF: { code: "XOF", symbol: "FCFA", name: "Franc CFA BCEAO", decimals: 0, locale: "fr-SN" },
  USD: { code: "USD", symbol: "$", name: "US Dollar", decimals: 2, locale: "en-US" },
  RMB: { code: "RMB", symbol: "\u00a5", name: "Renminbi", decimals: 2, locale: "zh-CN" },
  EUR: { code: "EUR", symbol: "\u20ac", name: "Euro", decimals: 2, locale: "fr-FR" },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export const DEFAULT_FX_RATES: Record<string, number> = {
  USD_XAF: 605,
  XOF_XAF: 1,
  RMB_XAF: 83,
  EUR_XAF: 655.957,
  USD_RMB: 7.25,
};

export function formatCurrency(amount: number, currencyCode: string): string {
  const config = CURRENCIES[currencyCode as CurrencyCode];
  if (!config) return `${amount.toLocaleString()} ${currencyCode}`;

  if (currencyCode === "XAF" || currencyCode === "XOF") {
    return `${Math.round(amount).toLocaleString("fr-FR")} FCFA`;
  }

  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: config.code === "RMB" ? "CNY" : config.code,
    minimumFractionDigits: config.decimals,
    maximumFractionDigits: config.decimals,
  }).format(amount);
}

export function convertCurrency(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number> = DEFAULT_FX_RATES
): number {
  if (from === to) return amount;

  const directKey = `${from}_${to}`;
  if (rates[directKey]) return amount * rates[directKey];

  const reverseKey = `${to}_${from}`;
  if (rates[reverseKey]) return amount / rates[reverseKey];

  // Try via XAF as intermediary
  const fromXAF = rates[`${from}_XAF`] || (rates[`XAF_${from}`] ? 1 / rates[`XAF_${from}`] : null);
  const toXAF = rates[`${to}_XAF`] || (rates[`XAF_${to}`] ? 1 / rates[`XAF_${to}`] : null);

  if (fromXAF && toXAF) return (amount * fromXAF) / toXAF;

  throw new Error(`No FX rate available for ${from} -> ${to}`);
}
