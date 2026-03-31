export type PawaPayCountryCode = "BJ" | "CD" | "CG" | "CI" | "CM" | "GA" | "SN";

export type PawaPayCountryAlpha3 = "BEN" | "COD" | "COG" | "CIV" | "CMR" | "GAB" | "SEN";

export type PawaPayProviderCode =
  | "AIRTEL_COD"
  | "AIRTEL_GAB"
  | "AIRTEL_COG"
  | "FREE_SEN"
  | "MOOV_BEN"
  | "MTN_MOMO_BEN"
  | "MTN_MOMO_CIV"
  | "MTN_MOMO_CMR"
  | "MTN_MOMO_COG"
  | "ORANGE_CIV"
  | "ORANGE_CMR"
  | "ORANGE_COD"
  | "ORANGE_SEN"
  | "VODACOM_MPESA_COD"
  | "WAVE_CIV"
  | "WAVE_SEN";

export type PawaPayProviderConfig = {
  countryCode: PawaPayCountryCode;
  countryAlpha3: PawaPayCountryAlpha3;
  countryName: string;
  currency: "USD" | "XAF" | "XOF";
  provider: PawaPayProviderCode;
  label: string;
  collectionFeePct: number;
  authType: "PROVIDER_AUTH" | "REDIRECT_AUTH";
  refundsEnabled: boolean;
  enabledByDefault: boolean;
};

const REDIRECT_AUTH_WAVE_ENABLED =
  String(process.env.NEXT_PUBLIC_PAWAPAY_ENABLE_WAVE ?? "false").toLowerCase() === "true";
const EXTRA_COLLECTION_FEE_PCT =
  Number(process.env.NEXT_PUBLIC_PAWAPAY_COLLECTION_MARKUP_PCT ?? "0") || 0;
const EXTRA_COLLECTION_FEE_FIXED =
  Number(process.env.NEXT_PUBLIC_PAWAPAY_COLLECTION_MARKUP_FIXED ?? "0") || 0;

export const PAWAPAY_PROVIDER_CONFIG: ReadonlyArray<PawaPayProviderConfig> = [
  {
    countryCode: "BJ",
    countryAlpha3: "BEN",
    countryName: "Benin",
    currency: "XOF",
    provider: "MOOV_BEN",
    label: "Moov Money",
    collectionFeePct: 0.022,
    authType: "PROVIDER_AUTH",
    refundsEnabled: true,
    enabledByDefault: true,
  },
  {
    countryCode: "BJ",
    countryAlpha3: "BEN",
    countryName: "Benin",
    currency: "XOF",
    provider: "MTN_MOMO_BEN",
    label: "MTN Mobile Money",
    collectionFeePct: 0.022,
    authType: "PROVIDER_AUTH",
    refundsEnabled: true,
    enabledByDefault: true,
  },
  {
    countryCode: "CM",
    countryAlpha3: "CMR",
    countryName: "Cameroun",
    currency: "XAF",
    provider: "MTN_MOMO_CMR",
    label: "MTN Mobile Money",
    collectionFeePct: 0.0175,
    authType: "PROVIDER_AUTH",
    refundsEnabled: true,
    enabledByDefault: true,
  },
  {
    countryCode: "CM",
    countryAlpha3: "CMR",
    countryName: "Cameroun",
    currency: "XAF",
    provider: "ORANGE_CMR",
    label: "Orange Money",
    collectionFeePct: 0.0177,
    authType: "PROVIDER_AUTH",
    refundsEnabled: true,
    enabledByDefault: true,
  },
  {
    countryCode: "CG",
    countryAlpha3: "COG",
    countryName: "Congo-Brazzaville",
    currency: "XAF",
    provider: "AIRTEL_COG",
    label: "Airtel Money",
    collectionFeePct: 0.04,
    authType: "PROVIDER_AUTH",
    refundsEnabled: true,
    enabledByDefault: true,
  },
  {
    countryCode: "CG",
    countryAlpha3: "COG",
    countryName: "Congo-Brazzaville",
    currency: "XAF",
    provider: "MTN_MOMO_COG",
    label: "MTN Mobile Money",
    collectionFeePct: 0.04,
    authType: "PROVIDER_AUTH",
    refundsEnabled: true,
    enabledByDefault: true,
  },
  {
    countryCode: "CD",
    countryAlpha3: "COD",
    countryName: "RDC",
    currency: "USD",
    provider: "AIRTEL_COD",
    label: "Airtel Money",
    collectionFeePct: 0.03,
    authType: "PROVIDER_AUTH",
    refundsEnabled: true,
    enabledByDefault: true,
  },
  {
    countryCode: "CD",
    countryAlpha3: "COD",
    countryName: "RDC",
    currency: "USD",
    provider: "ORANGE_COD",
    label: "Orange Money",
    collectionFeePct: 0.03,
    authType: "PROVIDER_AUTH",
    refundsEnabled: true,
    enabledByDefault: true,
  },
  {
    countryCode: "CD",
    countryAlpha3: "COD",
    countryName: "RDC",
    currency: "USD",
    provider: "VODACOM_MPESA_COD",
    label: "Vodacom M-Pesa",
    collectionFeePct: 0.025,
    authType: "PROVIDER_AUTH",
    refundsEnabled: true,
    enabledByDefault: true,
  },
  {
    countryCode: "GA",
    countryAlpha3: "GAB",
    countryName: "Gabon",
    currency: "XAF",
    provider: "AIRTEL_GAB",
    label: "Airtel Money",
    collectionFeePct: 0.02,
    authType: "PROVIDER_AUTH",
    refundsEnabled: true,
    enabledByDefault: true,
  },
  {
    countryCode: "CI",
    countryAlpha3: "CIV",
    countryName: "Cote d'Ivoire",
    currency: "XOF",
    provider: "MTN_MOMO_CIV",
    label: "MTN Mobile Money",
    collectionFeePct: 0.018,
    authType: "PROVIDER_AUTH",
    refundsEnabled: true,
    enabledByDefault: true,
  },
  {
    countryCode: "CI",
    countryAlpha3: "CIV",
    countryName: "Cote d'Ivoire",
    currency: "XOF",
    provider: "ORANGE_CIV",
    label: "Orange Money",
    collectionFeePct: 0.025,
    authType: "PROVIDER_AUTH",
    refundsEnabled: true,
    enabledByDefault: true,
  },
  {
    countryCode: "CI",
    countryAlpha3: "CIV",
    countryName: "Cote d'Ivoire",
    currency: "XOF",
    provider: "WAVE_CIV",
    label: "Wave",
    collectionFeePct: 0.02,
    authType: "REDIRECT_AUTH",
    refundsEnabled: true,
    enabledByDefault: REDIRECT_AUTH_WAVE_ENABLED,
  },
  {
    countryCode: "SN",
    countryAlpha3: "SEN",
    countryName: "Senegal",
    currency: "XOF",
    provider: "FREE_SEN",
    label: "YAS",
    collectionFeePct: 0.02,
    authType: "PROVIDER_AUTH",
    refundsEnabled: true,
    enabledByDefault: true,
  },
  {
    countryCode: "SN",
    countryAlpha3: "SEN",
    countryName: "Senegal",
    currency: "XOF",
    provider: "ORANGE_SEN",
    label: "Orange Money",
    collectionFeePct: 0.02,
    authType: "PROVIDER_AUTH",
    refundsEnabled: true,
    enabledByDefault: true,
  },
  {
    countryCode: "SN",
    countryAlpha3: "SEN",
    countryName: "Senegal",
    currency: "XOF",
    provider: "WAVE_SEN",
    label: "Wave",
    collectionFeePct: 0.02,
    authType: "REDIRECT_AUTH",
    refundsEnabled: true,
    enabledByDefault: REDIRECT_AUTH_WAVE_ENABLED,
  },
] as const;

const COUNTRY_ALIAS_TO_ALPHA2: Record<string, PawaPayCountryCode> = {
  BEN: "BJ",
  BJ: "BJ",
  CD: "CD",
  COD: "CD",
  CG: "CG",
  COG: "CG",
  CI: "CI",
  CIV: "CI",
  CM: "CM",
  CMR: "CM",
  GA: "GA",
  GAB: "GA",
  SN: "SN",
  SEN: "SN",
};

export function normalizePawaPayCountryCode(value?: string | null): PawaPayCountryCode | null {
  const normalized = String(value ?? "").trim().toUpperCase();
  return COUNTRY_ALIAS_TO_ALPHA2[normalized] ?? null;
}

export function getPawaPayCountryOptions() {
  const countries = new Map<PawaPayCountryCode, { code: PawaPayCountryCode; alpha3: PawaPayCountryAlpha3; label: string; currency: string }>();
  for (const config of PAWAPAY_PROVIDER_CONFIG) {
    if (!countries.has(config.countryCode)) {
      countries.set(config.countryCode, {
        code: config.countryCode,
        alpha3: config.countryAlpha3,
        label: config.countryName,
        currency: config.currency,
      });
    }
  }
  return Array.from(countries.values());
}

export function getPawaPayEnabledProvidersForCountry(countryCode?: string | null) {
  const normalized = normalizePawaPayCountryCode(countryCode);
  if (!normalized) return [];
  return PAWAPAY_PROVIDER_CONFIG.filter(
    (config) => config.countryCode === normalized && config.enabledByDefault
  );
}

export function findPawaPayProviderConfig(params: {
  countryCode?: string | null;
  provider?: string | null;
}) {
  const normalizedCountry = normalizePawaPayCountryCode(params.countryCode);
  const normalizedProvider = String(params.provider ?? "").trim().toUpperCase();
  if (!normalizedCountry || !normalizedProvider) return null;
  return (
    PAWAPAY_PROVIDER_CONFIG.find(
      (config) =>
        config.countryCode === normalizedCountry &&
        config.provider === normalizedProvider &&
        config.enabledByDefault
    ) ?? null
  );
}

export function estimatePawaPayCollectionFee(amount: number, config: Pick<PawaPayProviderConfig, "collectionFeePct">) {
  const base = Math.max(0, Number(amount) || 0);
  return Math.round(base * (config.collectionFeePct + EXTRA_COLLECTION_FEE_PCT) + EXTRA_COLLECTION_FEE_FIXED);
}

export function getPawaPayExtraCollectionFeeConfig() {
  return {
    percentage: EXTRA_COLLECTION_FEE_PCT,
    fixed: EXTRA_COLLECTION_FEE_FIXED,
  };
}
