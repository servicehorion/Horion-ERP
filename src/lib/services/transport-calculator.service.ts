export type HorionTransportMode = "AIR" | "SEA";
export type HorionServiceLevel = "STANDARD" | "EXPRESS";
export type HorionCargoCategory =
  | "STANDARD"
  | "SPECIAL"
  | "MEDICAL"
  | "LAPTOP"
  | "SMARTPHONE";

export interface TransportInput {
  weightKg: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  cartonCount?: number;
  mode?: HorionTransportMode;
  serviceLevel?: HorionServiceLevel;
  category?: HorionCargoCategory;
  isSensitive?: boolean; // legacy alias -> SPECIAL
  bufferPct?: number;
  pricingUnit?: "KG" | "CBM";
  ratePerKg?: number;
  ratePerCbm?: number;
  sellRatePerKg?: number;
  sellRatePerCbm?: number;
  // Compliance flags
  isPureBattery?: boolean;
  isLiquid?: boolean;
  isDrone?: boolean;
  isFlammable?: boolean;
  isExplosive?: boolean;
  isSpray?: boolean;
  isIllegal?: boolean;
  isToxicChemical?: boolean;
  isWeaponReplica?: boolean;
  isMedicalSupplement?: boolean;
  hasImportAuthorization?: boolean;
  isUndeclared?: boolean;
  isFragile?: boolean;
  hasWoodenCratePackaging?: boolean;
  densityRatioHint?: number | null;
}

export interface DensityValidationResult {
  averageDensityRatio: number;
  actualDensityRatio: number;
  deviationPct: number;
  blocked: boolean;
  message: string;
}

export interface CategoryMemoryHint {
  categoryName?: string | null;
  averageRealityCoefficient?: number | null;
  averageDensityRatio?: number | null;
  averageBufferedWeightKg?: number | null;
  historicalSampleCount?: number | null;
}

export interface NegotiatedTransportRateProfile {
  key: string;
  pricingUnit?: "KG" | "CBM";
  ratePerKg?: number | null;
  ratePerCbm?: number | null;
  sellRatePerKg?: number | null;
  sellRatePerCbm?: number | null;
  freightPartnerId?: string | null;
  freightPartnerName?: string | null;
  incoterm?: string | null;
  supportsDap?: boolean;
  customsDeclarant?: boolean;
}

export interface TransportEligibility {
  allowed: boolean;
  blockingReasons: string[];
  warnings: string[];
  surchargePct: number;
}

export interface TransportResult {
  actualWeightKg: number;
  bufferedWeightKg: number;
  volumetricWeightKg: number | null;
  bufferedVolumetricWeightKg: number | null;
  taxableWeightKg: number;
  chargeableWeightKg: number;
  ratePerKg: number;
  ratePerCbm?: number;
  transportCostXAF: number;
  transportCostWithBufferXAF: number;
  bufferPct: number;
  mode: HorionTransportMode;
  serviceLevel: HorionServiceLevel;
  category: HorionCargoCategory;
  isSensitive: boolean;
  breakdown: string;
  cbm?: number | null;
  bufferedCbm?: number | null;
  pricingUnit?: "KG" | "CBM";
  transportSellPriceXAF?: number;
  transportMarginXAF?: number;
  transportMarginPct?: number;
  delayMinDays?: number;
  delayMaxDays?: number;
  eligibility: TransportEligibility;
  densityValidation?: DensityValidationResult | null;
}

export interface MarginSimulation {
  unitPriceRmb: number;
  quantity: number;
  exchangeRate: number;
  transportCostXAF: number;
  customsDutyPct: number;
  commissionPct: number;
  targetMarginPct: number;
  productBufferPct: number;
  serviceFeePct: number;
  // Internal cost
  coutProduitXAF: number;
  coutTransportXAF: number;
  coutDouaneXAF: number;
  coutTotalXAF: number;
  // Client-facing amounts
  productBufferedXAF: number;
  productSellXAF: number;
  subtotalClientXAF: number;
  serviceFeeXAF: number;
  prixFinalXAF: number;
  // Internal margins
  internalMarginXAF: number;
  totalMarginXAF: number;
  marginPct: number;
  marginAlert: "OK" | "WARNING" | "DANGER";
  marginAlertLabel: string;
}

export interface IndicatifTransportOption {
  key: string;
  label: string;
  mode: HorionTransportMode;
  serviceLevel: HorionServiceLevel;
  costXAF: number;
  ratePerKg?: number;
  ratePerCbm?: number;
  delayLabel: string;
  delayMinDays?: number;
  delayMaxDays?: number;
  eligible: boolean;
  warnings: string[];
  reason?: string;
  freightPartnerId?: string | null;
  freightPartnerName?: string | null;
  incoterm?: string | null;
  supportsDap?: boolean;
  customsDeclarant?: boolean;
  result?: TransportResult;
}

export const HORION_TRANSPORT_RATES = {
  // Main rates shared by Sourcing + Logistics
  AIR_STANDARD_XAF_KG: 9_500,
  AIR_SPECIAL_XAF_KG: 15_000,
  AIR_MEDICAL_XAF_KG: 15_000,
  AIR_SMARTPHONE_XAF_KG: 15_000,
  AIR_LAPTOP_XAF_KG: 25_000,
  AIR_EXPRESS_STANDARD_XAF_KG: 15_000,
  AIR_EXPRESS_SENSITIVE_XAF_KG: 25_000,
  SEA_BUY_CBM_DEFAULT_XAF: 265_000,
  SEA_SELL_CBM_DEFAULT_XAF: 300_000,
  SEA_STANDARD_XAF_KG: 1_200,
  SEA_MIN_CBM: 0.1,
  // Calculation params
  DEFAULT_BUFFER_PCT: 0.06,
  DEFAULT_EXCHANGE_RATE: 78,
  DEFAULT_CUSTOMS_DUTY_PCT: 0,
  TARGET_MARGIN_PCT: 0.30, // hidden internal margin
  SERVICE_FEE_PCT: 0.10, // visible client fee
  INFORMATIF_BUFFER_PCT: 0.175,
  UNDECLARED_SURCHARGE_PCT: 0.60,
  WEIGHT_BUFFER_STD_PCT: 0.10,
  WEIGHT_BUFFER_EXPRESS_PCT: 0.05,
  DIMENSION_BUFFER_PCT: 0.15,
  AIR_STD_VOLUMETRIC_DIVISOR: 6000,
  AIR_EXPRESS_VOLUMETRIC_DIVISOR: 5000,
  DENSITY_ALERT_DEVIATION_PCT: 0.30,
} as const;

// ──────────────────────────────────────────────────────────────────────────────
// Dynamic Pricing Engine — Risk-based margin model
// ──────────────────────────────────────────────────────────────────────────────

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type SourcePlatform =
  | "ALIBABA"
  | "1688"
  | "TAOBAO"
  | "PINDUODUO"
  | "AMAZON"
  | "ALIEXPRESS"
  | "WEB";

/** Platforms where prices are domestic Chinese → full 30% margin applies */
export const LOCAL_PLATFORMS = new Set<string>(["1688", "TAOBAO", "PINDUODUO"]);

export const PRICING_ENGINE = {
  /**
   * Risk buffer per risk level × platform type.
   * Buffer absorbs price surprises (marketing prices, last-minute increases).
   * If sourcing succeeds at lower cost, buffer becomes additional profit.
   */
  RISK_BUFFER: {
    LOW: { LOCAL: 0.05, INTERNATIONAL: 0.08 },
    MEDIUM: { LOCAL: 0.08, INTERNATIONAL: 0.12 },
    HIGH: { LOCAL: 0.15, INTERNATIONAL: 0.20 },
  },
  /**
   * Invisible margin (hidden from client):
   * - LOCAL (1688/Taobao): base price is cheap → apply full 30% margin
   * - INTERNATIONAL (Alibaba/Amazon): base price already elevated vs 1688 →
   *   reduced 15% margin avoids making quote uncompetitive.
   *   The 30-60% platform premium already acts as a hidden margin cushion.
   */
  INVISIBLE_MARGIN: {
    LOCAL: 0.30,
    INTERNATIONAL: 0.15,
  },
  SERVICE_FEE: {
    TRANSACTION: 0.06, // bank/wire fees (non-negotiable)
    MANAGEMENT: 0.04,  // Horion service value (total = 10%)
  },
} as const;

export type PricingRationale = {
  sourcePlatform: string;
  riskLevel: RiskLevel;
  isLocalPlatform: boolean;
  bufferPct: number;
  invisibleMarginPct: number;
  serviceFeePct: number;
  notes: string[];
  /** Min profit % if buying at stated indicative price (worst case) */
  profitFloorPct: number;
  /** Expected profit % if buffer is not fully consumed */
  profitExpectedPct: number;
};

const CATEGORY_DELAYS: Record<
  HorionCargoCategory,
  { standard: { min: number; max: number }; express?: { min: number; max: number } }
> = {
  STANDARD: { standard: { min: 7, max: 21 }, express: { min: 3, max: 7 } },
  SPECIAL: { standard: { min: 7, max: 30 }, express: { min: 3, max: 7 } },
  MEDICAL: { standard: { min: 7, max: 30 }, express: { min: 3, max: 7 } },
  LAPTOP: { standard: { min: 30, max: 30 } },
  SMARTPHONE: { standard: { min: 7, max: 30 } },
};

function resolveCategory(input: Pick<TransportInput, "category" | "isSensitive">): HorionCargoCategory {
  if (input.category) return input.category;
  if (input.isSensitive) return "SPECIAL";
  return "STANDARD";
}

function resolveRatePerKg(
  mode: HorionTransportMode,
  serviceLevel: HorionServiceLevel,
  category: HorionCargoCategory
): number {
  if (mode === "SEA") return HORION_TRANSPORT_RATES.SEA_STANDARD_XAF_KG;
  if (serviceLevel === "EXPRESS") {
    return category === "STANDARD"
      ? HORION_TRANSPORT_RATES.AIR_EXPRESS_STANDARD_XAF_KG
      : HORION_TRANSPORT_RATES.AIR_EXPRESS_SENSITIVE_XAF_KG;
  }
  switch (category) {
    case "STANDARD":
      return HORION_TRANSPORT_RATES.AIR_STANDARD_XAF_KG;
    case "SPECIAL":
      return HORION_TRANSPORT_RATES.AIR_SPECIAL_XAF_KG;
    case "MEDICAL":
      return HORION_TRANSPORT_RATES.AIR_MEDICAL_XAF_KG;
    case "LAPTOP":
      return HORION_TRANSPORT_RATES.AIR_LAPTOP_XAF_KG;
    case "SMARTPHONE":
      return HORION_TRANSPORT_RATES.AIR_SMARTPHONE_XAF_KG;
  }
}

function formatDelay(min?: number, max?: number): string {
  if (!min || !max) return "-";
  return min === max ? `${min} j` : `${min}-${max} j`;
}

function containsAny(text: string, terms: string[]): boolean {
  const normalized = text.toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

export class TransportCalculatorService {
  static getWeightBufferPct(serviceLevel: HorionServiceLevel = "STANDARD") {
    return serviceLevel === "EXPRESS"
      ? HORION_TRANSPORT_RATES.WEIGHT_BUFFER_EXPRESS_PCT
      : HORION_TRANSPORT_RATES.WEIGHT_BUFFER_STD_PCT;
  }

  static calculateBufferedActualWeight(weightKg: number, serviceLevel: HorionServiceLevel = "STANDARD") {
    return weightKg * (1 + this.getWeightBufferPct(serviceLevel));
  }

  static calculateBufferedVolumeCbm(lengthCm: number, widthCm: number, heightCm: number, cartonCount = 1) {
    const rawCbm = ((lengthCm * widthCm * heightCm) / 1_000_000) * cartonCount;
    return rawCbm * (1 + HORION_TRANSPORT_RATES.DIMENSION_BUFFER_PCT);
  }

  static calculateVolumetricWeight(
    lengthCm: number,
    widthCm: number,
    heightCm: number,
    options?: { serviceLevel?: HorionServiceLevel; cartonCount?: number }
  ): number {
    const divisor =
      options?.serviceLevel === "EXPRESS"
        ? HORION_TRANSPORT_RATES.AIR_EXPRESS_VOLUMETRIC_DIVISOR
        : HORION_TRANSPORT_RATES.AIR_STD_VOLUMETRIC_DIVISOR;
    const bufferedCbm = this.calculateBufferedVolumeCbm(
      lengthCm,
      widthCm,
      heightCm,
      options?.cartonCount ?? 1
    );
    return (bufferedCbm * 1_000_000) / divisor;
  }

  static calculateTaxableWeight(actualKg: number, volumetricKg: number | null): number {
    if (!volumetricKg) return actualKg;
    return Math.max(actualKg, volumetricKg);
  }

  static calculateChargeableWeight(actualKg: number, volumetricKg: number | null) {
    return Math.ceil(this.calculateTaxableWeight(actualKg, volumetricKg));
  }

  static validateDensity(params: {
    weightKg: number;
    lengthCm?: number;
    widthCm?: number;
    heightCm?: number;
    cartonCount?: number;
    averageDensityRatio?: number | null;
  }): DensityValidationResult | null {
    if (!params.averageDensityRatio || params.averageDensityRatio <= 0) return null;
    if (!params.lengthCm || !params.widthCm || !params.heightCm) return null;

    const bufferedCbm = this.calculateBufferedVolumeCbm(
      params.lengthCm,
      params.widthCm,
      params.heightCm,
      params.cartonCount ?? 1
    );
    if (bufferedCbm <= 0) return null;

    const bufferedWeightKg = this.calculateBufferedActualWeight(params.weightKg);
    const actualDensityRatio = bufferedWeightKg / bufferedCbm;
    const deviationPct = Math.abs(actualDensityRatio - params.averageDensityRatio) / params.averageDensityRatio;
    const blocked = deviationPct > HORION_TRANSPORT_RATES.DENSITY_ALERT_DEVIATION_PCT;

    return {
      averageDensityRatio: params.averageDensityRatio,
      actualDensityRatio,
      deviationPct: deviationPct * 100,
      blocked,
      message: blocked
        ? `Le ratio poids/volume saisi s'ecarte de ${Math.round(
            deviationPct * 100
          )}% de la moyenne historique de la categorie.`
        : `Le ratio poids/volume reste proche de la moyenne historique (${Math.round(
            deviationPct * 100
          )}% d'ecart).`,
    };
  }

  static validateTransportEligibility(input: TransportInput): TransportEligibility {
    const mode = input.mode ?? "AIR";
    const category = resolveCategory(input);
    const blockingReasons: string[] = [];
    const warnings: string[] = [];
    let surchargePct = 0;

    if (input.isDrone) {
      blockingReasons.push("Les drones ne peuvent etre transportes ni par avion ni par bateau.");
    }
    if (mode === "SEA" && (category === "SMARTPHONE" || category === "LAPTOP")) {
      blockingReasons.push("Telephones et ordinateurs interdits par voie maritime.");
    }
    if (mode === "AIR" && input.isPureBattery) {
      blockingReasons.push("Batteries pures (powerbank, etc.) interdites en avion.");
    }
    if (mode === "SEA" && input.isLiquid) {
      blockingReasons.push("Liquides interdits par bateau.");
    }
    if (input.isFlammable || input.isExplosive) {
      blockingReasons.push("Articles inflammables/explosifs interdits.");
    }
    if (input.isSpray) {
      blockingReasons.push("Articles conditionnes en spray interdits.");
    }
    if (input.isIllegal) {
      blockingReasons.push("Marchandises illegales ou reglementees interdites.");
    }
    if (input.isToxicChemical) {
      blockingReasons.push("Produits chimiques dangereux/toxiques interdits.");
    }
    if (input.isWeaponReplica) {
      blockingReasons.push("Armes reelles ou repliques interdites.");
    }
    if (input.isMedicalSupplement && !input.hasImportAuthorization) {
      blockingReasons.push("Supplements/medicaments sans autorisation d'importation interdits.");
    }
    if (input.isUndeclared) {
      warnings.push(
        "Colis non declare: majoration de 60% appliquee sur les frais de transport."
      );
      surchargePct = Math.max(surchargePct, HORION_TRANSPORT_RATES.UNDECLARED_SURCHARGE_PCT);
    }
    if (input.isFragile && !input.hasWoodenCratePackaging) {
      warnings.push("Colis fragile: emballage caisse bois recommande avant expedition.");
    }
    if (category === "MEDICAL" || category === "SMARTPHONE") {
      warnings.push(
        "Si dedouanement particulier requis, le surplus est a la charge du proprietaire."
      );
    }

    return {
      allowed: blockingReasons.length === 0,
      blockingReasons,
      warnings,
      surchargePct,
    };
  }

  static inferComplianceFlagsFromDescriptions(descriptions: string[]) {
    const text = descriptions.join(" ").toLowerCase();
    return {
      category: containsAny(text, ["laptop", "ordinateur portable", "pc portable"])
        ? ("LAPTOP" as HorionCargoCategory)
        : containsAny(text, ["smartphone", "telephone", "tablette", "tablet"])
          ? ("SMARTPHONE" as HorionCargoCategory)
          : containsAny(text, ["medical", "scanner", "patch", "pilule", "medicament"])
            ? ("MEDICAL" as HorionCargoCategory)
            : containsAny(text, ["liquide", "liquid", "cosmet", "batterie", "fragile", "poudre"])
              ? ("SPECIAL" as HorionCargoCategory)
              : ("STANDARD" as HorionCargoCategory),
      isPureBattery: containsAny(text, ["powerbank", "batterie pure", "battery pack"]),
      isLiquid: containsAny(text, ["liquide", "liquid"]),
      isDrone: containsAny(text, ["drone"]),
      isFlammable: containsAny(text, ["inflammable", "flammable"]),
      isExplosive: containsAny(text, ["explosif", "explosive"]),
      isSpray: containsAny(text, ["spray", "aerosol"]),
      isToxicChemical: containsAny(text, ["toxique", "toxic", "chemical"]),
      isWeaponReplica: containsAny(text, ["arme", "weapon", "replica"]),
      isMedicalSupplement: containsAny(text, ["medicament", "supplement", "pilule", "patch"]),
    };
  }

  static calculate(input: TransportInput): TransportResult {
    const mode = input.mode ?? "AIR";
    const serviceLevel = input.serviceLevel ?? "STANDARD";
    const category = resolveCategory(input);
    const cartonCount = input.cartonCount ?? 1;
    const pricingUnit: "KG" | "CBM" = input.pricingUnit ?? (mode === "SEA" ? "CBM" : "KG");
    const bufferPct = input.bufferPct ?? HORION_TRANSPORT_RATES.DEFAULT_BUFFER_PCT;

    const eligibility = this.validateTransportEligibility({ ...input, mode, category });

    let volumetricWeightKg: number | null = null;
    let cbm: number | null = null;
    let bufferedCbm: number | null = null;
    if (input.lengthCm && input.widthCm && input.heightCm && mode === "AIR") {
      volumetricWeightKg =
        this.calculateVolumetricWeight(input.lengthCm, input.widthCm, input.heightCm, {
          serviceLevel,
          cartonCount,
        });
      cbm = ((input.lengthCm * input.widthCm * input.heightCm) / 1_000_000) * cartonCount;
      bufferedCbm = this.calculateBufferedVolumeCbm(input.lengthCm, input.widthCm, input.heightCm, cartonCount);
    }
    if (input.lengthCm && input.widthCm && input.heightCm && mode === "SEA") {
      cbm = ((input.lengthCm * input.widthCm * input.heightCm) / 1_000_000) * cartonCount;
      bufferedCbm = this.calculateBufferedVolumeCbm(input.lengthCm, input.widthCm, input.heightCm, cartonCount);
    }

    const actualWeightKg = input.weightKg;
    const bufferedWeightKg = this.calculateBufferedActualWeight(actualWeightKg, serviceLevel);
    const bufferedVolumetricWeightKg = volumetricWeightKg;
    const taxableWeightKg = this.calculateTaxableWeight(bufferedWeightKg, bufferedVolumetricWeightKg);
    const chargeableWeightKg = this.calculateChargeableWeight(
      bufferedWeightKg,
      bufferedVolumetricWeightKg
    );
    const densityValidation = this.validateDensity({
      weightKg: actualWeightKg,
      lengthCm: input.lengthCm,
      widthCm: input.widthCm,
      heightCm: input.heightCm,
      cartonCount,
      averageDensityRatio: input.densityRatioHint ?? null,
    });
    if (densityValidation?.blocked) {
      eligibility.warnings.push(densityValidation.message);
    }

    const ratePerKg = input.ratePerKg ?? resolveRatePerKg(mode, serviceLevel, category);
    const ratePerCbm = input.ratePerCbm ?? HORION_TRANSPORT_RATES.SEA_BUY_CBM_DEFAULT_XAF;
    const sellRatePerCbm = input.sellRatePerCbm ?? HORION_TRANSPORT_RATES.SEA_SELL_CBM_DEFAULT_XAF;
    const billableCbm =
      mode === "SEA" && pricingUnit === "CBM"
        ? Math.max(HORION_TRANSPORT_RATES.SEA_MIN_CBM, bufferedCbm ?? cbm ?? 0)
        : null;

    const baseCost =
      mode === "SEA" && pricingUnit === "CBM" && billableCbm
        ? billableCbm * ratePerCbm
        : chargeableWeightKg * ratePerKg;
    const costWithBuffer = baseCost * (1 + bufferPct);
    const totalCost = costWithBuffer * (1 + eligibility.surchargePct);

    const sellTransport =
      mode === "SEA" && pricingUnit === "CBM" && billableCbm
        ? billableCbm * sellRatePerCbm
        : input.sellRatePerKg != null
          ? chargeableWeightKg * input.sellRatePerKg
          : undefined;

    const marginXaf = sellTransport != null ? sellTransport - baseCost : undefined;
    const marginPct =
      sellTransport && sellTransport > 0 && marginXaf != null
        ? (marginXaf / sellTransport) * 100
        : undefined;

    const delays = CATEGORY_DELAYS[category];
    const d = serviceLevel === "EXPRESS" ? delays.express : delays.standard;
    const delayMinDays = d?.min;
    const delayMaxDays = d?.max;

    const breakdownParts: string[] = [];
    if (mode === "SEA" && pricingUnit === "CBM" && billableCbm) {
      breakdownParts.push(
        `${billableCbm.toFixed(2)} cbm facturables x ${Math.round(ratePerCbm).toLocaleString("fr-FR")} FCFA/cbm`
      );
    } else {
      breakdownParts.push(
        `${chargeableWeightKg.toFixed(0)} kg facturables x ${Math.round(ratePerKg).toLocaleString("fr-FR")} FCFA/kg`
      );
    }
    if (bufferedWeightKg > actualWeightKg) {
      breakdownParts.push(`poids securise ${bufferedWeightKg.toFixed(2)} kg`);
    }
    if (bufferedVolumetricWeightKg != null && bufferedVolumetricWeightKg > bufferedWeightKg) {
      breakdownParts.push(`poids volumetrique ${bufferedVolumetricWeightKg.toFixed(2)} kg`);
    }
    if (bufferedCbm != null && mode === "SEA") {
      breakdownParts.push(`volume securise ${bufferedCbm.toFixed(2)} cbm`);
    }
    if (bufferPct > 0) {
      breakdownParts.push(`buffer ${(bufferPct * 100).toFixed(1)}%`);
    }
    if (eligibility.surchargePct > 0) {
      breakdownParts.push(`majoration ${(eligibility.surchargePct * 100).toFixed(0)}%`);
    }
    if (delayMinDays && delayMaxDays) {
      breakdownParts.push(`delai ${formatDelay(delayMinDays, delayMaxDays)}`);
    }

    return {
      actualWeightKg,
      bufferedWeightKg,
      volumetricWeightKg,
      bufferedVolumetricWeightKg,
      taxableWeightKg,
      chargeableWeightKg,
      ratePerKg,
      ratePerCbm,
      transportCostXAF: Math.round(baseCost),
      transportCostWithBufferXAF: Math.round(totalCost),
      bufferPct,
      mode,
      serviceLevel,
      category,
      isSensitive: category === "SPECIAL",
      breakdown: breakdownParts.join(" + "),
      cbm,
      bufferedCbm: billableCbm ?? bufferedCbm,
      pricingUnit,
      transportSellPriceXAF: sellTransport != null ? Math.round(sellTransport) : undefined,
      transportMarginXAF: marginXaf != null ? Math.round(marginXaf) : undefined,
      transportMarginPct: marginPct,
      delayMinDays,
      delayMaxDays,
      eligibility,
      densityValidation,
    };
  }

  static compareAirVsSea(input: Omit<TransportInput, "mode">) {
    const air = this.calculate({ ...input, mode: "AIR" });
    const sea = this.calculate({ ...input, mode: "SEA" });
    const savings = air.transportCostWithBufferXAF - sea.transportCostWithBufferXAF;
    const savingsPct =
      air.transportCostWithBufferXAF > 0
        ? (savings / air.transportCostWithBufferXAF) * 100
        : 0;
    return {
      air,
      sea,
      savingsXAF: Math.round(savings),
      savingsPct: Math.round(savingsPct),
      recommendation:
        sea.eligibility.allowed &&
        sea.transportCostWithBufferXAF < air.transportCostWithBufferXAF * 0.6
          ? "SEA"
          : "AIR",
    };
  }

  /**
   * Derives the optimal buffer + invisible margin for a quote line
   * based on the sourcing platform and product risk level.
   */
  static derivePricingParams(
    sourcePlatform: string,
    riskLevel: RiskLevel
  ): { bufferPct: number; invisibleMarginPct: number; isLocalPlatform: boolean; rationale: PricingRationale } {
    const isLocal = LOCAL_PLATFORMS.has(sourcePlatform);
    const platformType = isLocal ? "LOCAL" : "INTERNATIONAL";
    const bufferPct = PRICING_ENGINE.RISK_BUFFER[riskLevel][platformType];
    const invisibleMarginPct = PRICING_ENGINE.INVISIBLE_MARGIN[platformType];
    const serviceFeePct =
      PRICING_ENGINE.SERVICE_FEE.TRANSACTION + PRICING_ENGINE.SERVICE_FEE.MANAGEMENT;

    // Floor = margin only (buffer fully consumed in worst case)
    const profitFloorPct = Math.round(invisibleMarginPct * 100);
    // Expected = margin + unused buffer if sourcing goes well
    const profitExpectedPct = Math.round((invisibleMarginPct + bufferPct * 0.6) * 100);

    const riskLabels: Record<RiskLevel, string> = {
      LOW: "faible",
      MEDIUM: "modéré",
      HIGH: "élevé",
    };
    const notes: string[] = [];
    if (!isLocal) {
      notes.push(
        `⚠️ Prix ${sourcePlatform} majoré de 30-60% vs 1688/Taobao. Marge réduite à ${profitFloorPct}% — le delta plateforme constitue déjà un coussin caché.`
      );
    } else {
      notes.push(
        `✓ Plateforme locale ${sourcePlatform} — prix réel. Marge pleine ${profitFloorPct}% appliquée.`
      );
    }
    notes.push(
      `Buffer risque ${riskLabels[riskLevel]}: ${(bufferPct * 100).toFixed(0)}% — couvre les surprises prix. S'il n'est pas consommé, il gonfle le bénéfice net.`
    );
    notes.push(
      `Frais service: ${(serviceFeePct * 100).toFixed(0)}% (6% bancaire + 4% gestion Horion).`
    );

    return {
      bufferPct,
      invisibleMarginPct,
      isLocalPlatform: isLocal,
      rationale: {
        sourcePlatform,
        riskLevel,
        isLocalPlatform: isLocal,
        bufferPct,
        invisibleMarginPct,
        serviceFeePct,
        notes,
        profitFloorPct,
        profitExpectedPct,
      },
    };
  }

  static simulateMargin(params: {
    unitPriceRmb: number;
    quantity: number;
    transportCostXAF: number;
    exchangeRate?: number;
    customsDutyPct?: number;
    commissionPct?: number; // visible fee; defaults to SERVICE_FEE_PCT
    targetMarginPct?: number; // hidden margin on product only
    productBufferPct?: number;
  }): MarginSimulation {
    const exchangeRate = params.exchangeRate ?? HORION_TRANSPORT_RATES.DEFAULT_EXCHANGE_RATE;
    const customsDutyPct = params.customsDutyPct ?? HORION_TRANSPORT_RATES.DEFAULT_CUSTOMS_DUTY_PCT;
    const targetMarginPct = params.targetMarginPct ?? HORION_TRANSPORT_RATES.TARGET_MARGIN_PCT;
    const serviceFeePct = params.commissionPct ?? HORION_TRANSPORT_RATES.SERVICE_FEE_PCT;
    const productBufferPct = params.productBufferPct ?? HORION_TRANSPORT_RATES.INFORMATIF_BUFFER_PCT;

    const coutProduitXAFRaw = params.unitPriceRmb * params.quantity * exchangeRate;
    const productBufferedXAFRaw = coutProduitXAFRaw * (1 + productBufferPct);
    const coutDouaneXAFRaw = coutProduitXAFRaw * customsDutyPct;
    const coutTotalXAFRaw = productBufferedXAFRaw + params.transportCostXAF + coutDouaneXAFRaw;

    const internalMarginXAFRaw = productBufferedXAFRaw * targetMarginPct;
    const productSellXAFRaw = productBufferedXAFRaw + internalMarginXAFRaw;
    const subtotalClientXAFRaw = productSellXAFRaw + params.transportCostXAF;
    // Horion service fee is applied only on product sell price (never on transport)
    const serviceFeeXAFRaw = productSellXAFRaw * serviceFeePct;
    const prixFinalXAFRaw = subtotalClientXAFRaw + serviceFeeXAFRaw;

    const totalMarginXAFRaw = prixFinalXAFRaw - coutTotalXAFRaw;
    const marginPct = prixFinalXAFRaw > 0 ? (totalMarginXAFRaw / prixFinalXAFRaw) * 100 : 0;

    let marginAlert: "OK" | "WARNING" | "DANGER" = "OK";
    let marginAlertLabel = "Marge globale OK";
    if (marginPct < 30) {
      marginAlert = "WARNING";
      marginAlertLabel = "Marge globale faible";
    }
    if (marginPct < 20) {
      marginAlert = "DANGER";
      marginAlertLabel = "Marge globale critique";
    }

    return {
      unitPriceRmb: params.unitPriceRmb,
      quantity: params.quantity,
      exchangeRate,
      transportCostXAF: Math.round(params.transportCostXAF),
      customsDutyPct,
      commissionPct: serviceFeePct,
      targetMarginPct,
      productBufferPct,
      serviceFeePct,
      coutProduitXAF: Math.round(coutProduitXAFRaw),
      coutTransportXAF: Math.round(params.transportCostXAF),
      coutDouaneXAF: Math.round(coutDouaneXAFRaw),
      coutTotalXAF: Math.round(coutTotalXAFRaw),
      productBufferedXAF: Math.round(productBufferedXAFRaw),
      productSellXAF: Math.round(productSellXAFRaw),
      subtotalClientXAF: Math.round(subtotalClientXAFRaw),
      serviceFeeXAF: Math.round(serviceFeeXAFRaw),
      prixFinalXAF: Math.round(prixFinalXAFRaw),
      internalMarginXAF: Math.round(internalMarginXAFRaw),
      totalMarginXAF: Math.round(totalMarginXAFRaw),
      marginPct,
      marginAlert,
      marginAlertLabel,
    };
  }

  static getIndicatifTransportOptions(
    input: Omit<TransportInput, "mode" | "serviceLevel">,
    rateProfiles?: Partial<Record<string, NegotiatedTransportRateProfile>>
  ): IndicatifTransportOption[] {
    const base = { ...input, bufferPct: input.bufferPct ?? 0 };
    const options = [
      { key: "AIR_STANDARD", label: "Avion standard", mode: "AIR" as const, serviceLevel: "STANDARD" as const },
      { key: "AIR_EXPRESS", label: "Avion express", mode: "AIR" as const, serviceLevel: "EXPRESS" as const },
      { key: "SEA_DDP", label: "Maritime DDP", mode: "SEA" as const, serviceLevel: "STANDARD" as const },
    ];

    return options.map((opt) => {
      const profile = rateProfiles?.[opt.key];
      const result = this.calculate({
        ...base,
        mode: opt.mode,
        serviceLevel: opt.serviceLevel,
        pricingUnit: profile?.pricingUnit ?? base.pricingUnit,
        ratePerKg: profile?.ratePerKg ?? base.ratePerKg,
        ratePerCbm: profile?.ratePerCbm ?? base.ratePerCbm,
        sellRatePerKg: profile?.sellRatePerKg ?? base.sellRatePerKg,
        sellRatePerCbm: profile?.sellRatePerCbm ?? base.sellRatePerCbm,
      });
      if (!result.eligibility.allowed) {
        return {
          key: opt.key,
          label: opt.label,
          mode: opt.mode,
          serviceLevel: opt.serviceLevel,
          costXAF: 0,
          ratePerKg: profile?.ratePerKg ?? undefined,
          ratePerCbm: profile?.ratePerCbm ?? undefined,
          delayLabel: "-",
          eligible: false,
          warnings: result.eligibility.warnings,
          reason: result.eligibility.blockingReasons.join(" "),
          freightPartnerId: profile?.freightPartnerId ?? null,
          freightPartnerName: profile?.freightPartnerName ?? null,
          incoterm: profile?.incoterm ?? null,
          supportsDap: profile?.supportsDap ?? false,
          customsDeclarant: profile?.customsDeclarant ?? false,
          result,
        };
      }
      return {
        key: opt.key,
        label: opt.label,
        mode: opt.mode,
        serviceLevel: opt.serviceLevel,
        costXAF: result.transportCostWithBufferXAF,
        ratePerKg: profile?.ratePerKg ?? result.ratePerKg,
        ratePerCbm: profile?.ratePerCbm ?? result.ratePerCbm,
        delayLabel: formatDelay(result.delayMinDays, result.delayMaxDays),
        delayMinDays: result.delayMinDays,
        delayMaxDays: result.delayMaxDays,
        eligible: true,
        warnings: result.eligibility.warnings,
        freightPartnerId: profile?.freightPartnerId ?? null,
        freightPartnerName: profile?.freightPartnerName ?? null,
        incoterm: profile?.incoterm ?? null,
        supportsDap: profile?.supportsDap ?? false,
        customsDeclarant: profile?.customsDeclarant ?? false,
        result,
      };
    });
  }

  static indicatifPrice(params: {
    platformPriceRmb: number;
    quantity: number;
    weightKg: number;
    lengthCm?: number;
    widthCm?: number;
    heightCm?: number;
    cartonCount?: number;
    category?: HorionCargoCategory;
    serviceLevel?: HorionServiceLevel;
    isSensitive?: boolean;
    bufferPct?: number;
    exchangeRate?: number;
    mode?: HorionTransportMode;
    selectedTransportKey?: string;
    /** Dynamic pricing: when provided, buffer + margin are derived from these */
    sourcePlatform?: string;
    riskLevel?: RiskLevel;
    transportOverrides?: {
      pricingUnit?: "KG" | "CBM";
      ratePerKg?: number;
      ratePerCbm?: number;
      sellRatePerKg?: number;
      sellRatePerCbm?: number;
    };
    transportRateProfiles?: Partial<Record<string, NegotiatedTransportRateProfile>>;
    categoryMemory?: CategoryMemoryHint;
    compliance?: {
      isPureBattery?: boolean;
      isLiquid?: boolean;
      isDrone?: boolean;
      isFlammable?: boolean;
      isExplosive?: boolean;
      isSpray?: boolean;
      isIllegal?: boolean;
      isToxicChemical?: boolean;
      isWeaponReplica?: boolean;
      isMedicalSupplement?: boolean;
      hasImportAuthorization?: boolean;
      isUndeclared?: boolean;
      isFragile?: boolean;
      hasWoodenCratePackaging?: boolean;
    };
  }) {
    const exchangeRate = params.exchangeRate ?? HORION_TRANSPORT_RATES.DEFAULT_EXCHANGE_RATE;
    const category = resolveCategory({ category: params.category, isSensitive: params.isSensitive });
    const categoryRealityCoefficient =
      params.categoryMemory?.averageRealityCoefficient && params.categoryMemory.averageRealityCoefficient > 0
        ? params.categoryMemory.averageRealityCoefficient
        : null;

    // ── Dynamic pricing engine ──────────────────────────────────────────────
    let productBufferPct: number;
    let effectiveMarginPct: number;
    let pricingRationale: PricingRationale | null = null;

    if (params.sourcePlatform && params.riskLevel) {
      const derived = this.derivePricingParams(params.sourcePlatform, params.riskLevel);
      productBufferPct = derived.bufferPct;
      effectiveMarginPct = derived.invisibleMarginPct;
      pricingRationale = derived.rationale;
    } else {
      // Legacy fallback: flat constants
      productBufferPct = params.bufferPct ?? HORION_TRANSPORT_RATES.INFORMATIF_BUFFER_PCT;
      effectiveMarginPct = HORION_TRANSPORT_RATES.TARGET_MARGIN_PCT;
    }
    // ────────────────────────────────────────────────────────────────────────

    const baseInput: TransportInput = {
      weightKg: params.weightKg,
      lengthCm: params.lengthCm,
      widthCm: params.widthCm,
      heightCm: params.heightCm,
      cartonCount: params.cartonCount,
      category,
      isSensitive: params.isSensitive,
      pricingUnit: params.transportOverrides?.pricingUnit,
      ratePerKg: params.transportOverrides?.ratePerKg,
      ratePerCbm: params.transportOverrides?.ratePerCbm,
      sellRatePerKg: params.transportOverrides?.sellRatePerKg,
      sellRatePerCbm: params.transportOverrides?.sellRatePerCbm,
      densityRatioHint: params.categoryMemory?.averageDensityRatio ?? null,
      ...params.compliance,
    };

    const transportOptions = this.getIndicatifTransportOptions(baseInput, params.transportRateProfiles);
    const eligibleOptions = transportOptions.filter((o) => o.eligible && o.result);
    const fallbackOption = eligibleOptions[0] ?? transportOptions[0];

    const selectedOption =
      transportOptions.find((o) => o.key === params.selectedTransportKey) ?? fallbackOption;
    const selectedTransport = selectedOption?.result;
    if (!selectedTransport) {
      throw new Error("Aucune option transport disponible pour cette marchandise.");
    }

    const adjustedPlatformPriceRmb = categoryRealityCoefficient
      ? params.platformPriceRmb * categoryRealityCoefficient
      : params.platformPriceRmb;

    const simulation = this.simulateMargin({
      unitPriceRmb: adjustedPlatformPriceRmb,
      quantity: params.quantity,
      transportCostXAF: selectedTransport.transportCostWithBufferXAF,
      exchangeRate,
      customsDutyPct: HORION_TRANSPORT_RATES.DEFAULT_CUSTOMS_DUTY_PCT,
      targetMarginPct: effectiveMarginPct,
      commissionPct: HORION_TRANSPORT_RATES.SERVICE_FEE_PCT,
      productBufferPct,
    });

    return {
      platformPriceRmb: params.platformPriceRmb,
      adjustedPriceRmb: adjustedPlatformPriceRmb * (1 + productBufferPct),
      bufferApplied: productBufferPct,
      effectiveMarginPct,
      exchangeRate,
      category,
      transport: selectedTransport,
      transportOptions,
      selectedTransportKey: selectedOption?.key,
      margin: simulation,
      pricingRationale,
      categoryMemory: params.categoryMemory ?? null,
      appliedRealityCoefficient: categoryRealityCoefficient,
      logisticHint: {
        historicalBufferedWeightKg: params.categoryMemory?.averageBufferedWeightKg ?? null,
        densityValidation: selectedTransport.densityValidation ?? null,
      },
      prixUnitaireClientXAF: Math.round(simulation.prixFinalXAF / Math.max(params.quantity, 1)),
      fourchetteMin: Math.round(simulation.prixFinalXAF * 0.95),
      fourchetteMax: Math.round(simulation.prixFinalXAF * 1.05),
    };
  }
}
