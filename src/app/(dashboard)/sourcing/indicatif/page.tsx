"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  FileDown,
  ImagePlus,
  Info,
  Link2,
  Mail,
  Plane,
  Send,
  Ship,
  TrendingUp,
  Zap,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  HORION_TRANSPORT_RATES,
  LOCAL_PLATFORMS,
  TransportCalculatorService,
  type HorionCargoCategory,
  type IndicatifTransportOption,
  type NegotiatedTransportRateProfile,
  type RiskLevel,
} from "@/lib/services/transport-calculator.service";
import { DEFAULT_FX_RATES, convertCurrency, formatCurrency } from "@/config/currencies";
import {
  getIndicatifContactsForQuote,
  sendIndicatifQuote,
} from "@/lib/actions/sourcing-indicatif.actions";
import { getCatalogCategoryMemoryHint, searchCatalogMemoryMatches } from "@/lib/actions/catalog.actions";
import { getNegotiatedTransportRateProfiles } from "@/lib/actions/logistics.actions";

type IndicatifResult = ReturnType<typeof TransportCalculatorService.indicatifPrice>;
type IndicatifQuoteItem = {
  description: string;
  category?: string;
  platform?: string;
  riskLevel?: string;
  catalogProductId?: string;
  catalogMatchScore?: number;
  catalogConfidenceScore?: number;
  isCatalogMatch?: boolean;
  quantity: number;
  platformUnitPriceRmb: number;
  exchangeRate: number;
  productSellXAF: number;
  serviceFeeXAF: number;
  totalXAF: number;
  weightKg?: number;
  productBufferPct?: number;
  appliedRealityCoefficient?: number | null;
  categoryAverageDensityRatio?: number | null;
  invisibleMarginPct?: number;
  selectedTransport: {
    key: string;
    label: string;
    mode: string;
    serviceLevel: string;
    costXAF: number;
    ratePerKg?: number;
    ratePerCbm?: number;
    delayLabel: string;
    eligible: boolean;
    freightPartnerId?: string | null;
    freightPartnerName?: string | null;
    incoterm?: string | null;
    supportsDap?: boolean;
    customsDeclarant?: boolean;
  };
  transportOptions: Array<{
    key: string;
    label: string;
    mode: string;
    serviceLevel: string;
    costXAF: number;
    ratePerKg?: number;
    ratePerCbm?: number;
    delayLabel: string;
    eligible: boolean;
    freightPartnerId?: string | null;
    freightPartnerName?: string | null;
    incoterm?: string | null;
    supportsDap?: boolean;
    customsDeclarant?: boolean;
  }>;
  compliance?: Record<string, unknown>;
};

type CatalogMemoryMatch = {
  id: string;
  name: string;
  score: number;
  categoryName?: string | null;
  priceCurrency?: string | null;
  preferredPlatform?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
  weightedAverageCost?: number | null;
  estimatedCost?: number | null;
  lastActualCost?: number | null;
  recommendedSellPrice?: number | null;
  averageRealityCoefficient?: number | null;
  savingsVsIndicatifPct?: number | null;
  defaultRiskBufferPct?: number | null;
  defaultHiddenMarginPct?: number | null;
  averageLeadTime?: number | null;
  weightEstimate?: number | null;
  historicalOrderCount: number;
  successfulOrderCount: number;
  catalogConfidenceScore: number;
  isCertified: boolean;
  aliases: string[];
  keywords: string[];
  primarySupplierId?: string | null;
  primarySupplierName?: string | null;
};

type ContactOption = {
  id: string;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  type: "CLIENT" | "PROSPECT";
};

type CategoryMemoryHint = {
  id: string;
  name: string;
  averageRealityCoefficient?: number | null;
  averageDensityRatio?: number | null;
  averageBufferedWeightKg?: number | null;
  historicalSampleCount: number;
  lastMemoryUpdatedAt?: string | Date | null;
};

type PriceCurrency = "RMB" | "USD" | "EUR";

const CARGO_CATEGORY_OPTIONS: Array<{ value: HorionCargoCategory; label: string; desc: string }> = [
  { value: "STANDARD", label: "Articles normaux", desc: "9 500 FCFA/kg ⬢ 7-21j" },
  { value: "SPECIAL", label: "Articles spéciaux", desc: "15 000 FCFA/kg ⬢ 7-30j" },
  { value: "MEDICAL", label: "Articles médicaux", desc: "15 000 FCFA/kg ⬢ 7-30j" },
  { value: "LAPTOP", label: "Ordinateurs", desc: "25 000 FCFA/kg ⬢ 30j" },
  { value: "SMARTPHONE", label: "Smartphones/Tablettes", desc: "15 000 FCFA/kg ⬢ 7-30j" },
];

const PLATFORM_OPTIONS = [
  {
    value: "1688",
    label: "1688 (Alibaba local)",
    badge: "LOCAL",
    hint: "Plateforme domestique chinoise → prix réels, marge pleine",
  },
  {
    value: "TAOBAO",
    label: "Taobao",
    badge: "LOCAL",
    hint: "Plateforme domestique → prix compétitifs",
  },
  {
    value: "PINDUODUO",
    label: "Pinduoduo",
    badge: "LOCAL",
    hint: "Prix très bas → vérifier la qualité",
  },
  {
    value: "ALIBABA",
    label: "Alibaba (international)",
    badge: "INTL",
    hint: "Prix majorés 30-60% vs 1688 → marge réduite automatiquement",
  },
  {
    value: "ALIEXPRESS",
    label: "AliExpress",
    badge: "INTL",
    hint: "Prix retail internationaux → prix élevés",
  },
  {
    value: "AMAZON",
    label: "Amazon",
    badge: "INTL",
    hint: "Prix occidentaux → utiliser uniquement si hors Chine",
  },
  { value: "WEB", label: "Recherche Web", badge: "INTL", hint: "Autre source" },
];

const RISK_LEVEL_OPTIONS: Array<{
  value: RiskLevel;
  label: string;
  desc: string;
  examples: string;
  color: string;
}> = [
  {
    value: "LOW",
    label: "Faible",
    desc: "Produit standard, facile à trouver sur 1688",
    examples: "Textile, papeterie, accessoires simples, quincaillerie",
    color: "text-emerald-700 bg-emerald-50 border-emerald-200",
  },
  {
    value: "MEDIUM",
    label: "Modéré",
    desc: "Risque douanier ou contrôle qualité nécessaire",
    examples: "Câbles, jouets, articles alimentaires, bois",
    color: "text-amber-700 bg-amber-50 border-amber-200",
  },
  {
    value: "HIGH",
    label: "Élevé",
    desc: "Certifications export requises, transport spécial",
    examples: "Électronique avec batterie, cosmétiques, poudres, médical",
    color: "text-rose-700 bg-rose-50 border-rose-200",
  },
];

const PRICE_CURRENCY_OPTIONS: Array<{ value: PriceCurrency; label: string; symbol: string }> = [
  { value: "RMB", label: "RMB (¥)", symbol: "¥" },
  { value: "USD", label: "USD ($)", symbol: "$" },
  { value: "EUR", label: "EUR (€)", symbol: "€" },
];

function n(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fmtXaf(value: number) {
  return `${Math.round(value).toLocaleString("fr-FR")} FCFA`;
}

function toRmb(amount: number, currency: PriceCurrency, rmbXafRate: number): number {
  if (currency === "RMB") return amount;
  if (currency === "USD") return amount * (DEFAULT_FX_RATES.USD_RMB ?? 7.25);
  if (currency === "EUR") {
    const xaf = amount * (DEFAULT_FX_RATES.EUR_XAF ?? 655.957);
    return xaf / rmbXafRate;
  }
  return amount;
}

export default function SourcingIndicatifPage() {
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    contactId: "",
    clientEmail: "",
    description: "",
    memoryCategory: "",
    platform: "ALIBABA",
    riskLevel: "MEDIUM" as RiskLevel,
    category: "STANDARD" as HorionCargoCategory,
    priceCurrency: "RMB" as PriceCurrency,
    platformPriceInput: "", // price in selected currency
    quantity: "1",
    weightKg: "",
    lengthCm: "",
    widthCm: "",
    heightCm: "",
    cartonCount: "1",
    exchangeRate: String(HORION_TRANSPORT_RATES.DEFAULT_EXCHANGE_RATE),
    isPureBattery: false,
    isLiquid: false,
    isDrone: false,
    isFlammable: false,
    isExplosive: false,
    isSpray: false,
    isIllegal: false,
    isToxicChemical: false,
    isWeaponReplica: false,
    isMedicalSupplement: false,
    hasImportAuthorization: true,
    isUndeclared: false,
    isFragile: false,
    hasWoodenCratePackaging: false,
  });

  const [selectedTransportKey, setSelectedTransportKey] = useState<string>("AIR_STANDARD");
  const [result, setResult] = useState<IndicatifResult | null>(null);
  const [landingUrl, setLandingUrl] = useState<string | null>("");
  const [lineItems, setLineItems] = useState<IndicatifQuoteItem[]>([]);
  const [catalogMatches, setCatalogMatches] = useState<CatalogMemoryMatch[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [selectedCatalogMatch, setSelectedCatalogMatch] = useState<CatalogMemoryMatch | null>(null);
  const [categoryMemoryHint, setCategoryMemoryHint] = useState<CategoryMemoryHint | null>(null);
  const [categoryHintLoading, setCategoryHintLoading] = useState(false);
  const [matchingImage, setMatchingImage] = useState(false);
  const [catalogImagePreview, setCatalogImagePreview] = useState<string>("");
  const [catalogImageFilename, setCatalogImageFilename] = useState<string>("");
  const [densityBlocked, setDensityBlocked] = useState(false);
  const [includeDdpEstimate, setIncludeDdpEstimate] = useState(false);
  const [transportRateProfiles, setTransportRateProfiles] = useState<
    Partial<Record<string, NegotiatedTransportRateProfile>>
  >({});

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === form.contactId),
    [contacts, form.contactId]
  );

  // Derived pricing params from platform + riskLevel
  const derivedPricing = useMemo(() => {
    return TransportCalculatorService.derivePricingParams(form.platform, form.riskLevel);
  }, [form.platform, form.riskLevel]);

  // Is platform international (Alibaba-type)?
  const isInternationalPlatform = !LOCAL_PLATFORMS.has(form.platform);

  // Effective price in RMB (after currency conversion)
  const effectivePriceRmb = useMemo(() => {
    const rmbXafRate = n(form.exchangeRate) || HORION_TRANSPORT_RATES.DEFAULT_EXCHANGE_RATE;
    return toRmb(n(form.platformPriceInput), form.priceCurrency, rmbXafRate);
  }, [form.platformPriceInput, form.priceCurrency, form.exchangeRate]);

  // XAF equivalent of price (for display)
  const priceXafEquivalent = useMemo(() => {
    const rmbXafRate = n(form.exchangeRate) || HORION_TRANSPORT_RATES.DEFAULT_EXCHANGE_RATE;
    return effectivePriceRmb * rmbXafRate;
  }, [effectivePriceRmb, form.exchangeRate]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await getIndicatifContactsForQuote();
      if (!mounted) return;
      if (res.error) toast.error(res.error);
      else setContacts((res.data ?? []) as ContactOption[]);
      setLoadingContacts(false);
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await getNegotiatedTransportRateProfiles();
      if (!active) return;
      if (!res.error) {
        setTransportRateProfiles((res.data ?? {}) as Partial<Record<string, NegotiatedTransportRateProfile>>);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (selectedContact?.email && !form.clientEmail) {
      setForm((prev) => ({ ...prev, clientEmail: selectedContact.email || "" }));
    }
  }, [selectedContact?.email, form.clientEmail]);

  useEffect(() => {
    let active = true;
    setCategoryHintLoading(true);
    (async () => {
      const res = await getCatalogCategoryMemoryHint({ categoryName: form.memoryCategory || form.category });
      if (!active) return;
      if (res.error) {
        setCategoryMemoryHint(null);
      } else {
        setCategoryMemoryHint((res.data ?? null) as CategoryMemoryHint | null);
      }
      setCategoryHintLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [form.category, form.memoryCategory]);

  useEffect(() => {
    const query = form.description.trim();
    if (query.length < 3) {
      setCatalogMatches([]);
      setCatalogLoading(false);
      return;
    }

    let active = true;
    const timeout = setTimeout(async () => {
      setCatalogLoading(true);
      const res = await searchCatalogMemoryMatches({
        query,
        categoryName: form.memoryCategory || form.category,
        weightKg: n(form.weightKg) || undefined,
        limit: 4,
      });
      if (!active) return;
      if (res.error) {
        setCatalogMatches([]);
      } else {
        setCatalogMatches((res.data ?? []) as CatalogMemoryMatch[]);
      }
      setCatalogLoading(false);
    }, 350);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [form.description, form.category, form.memoryCategory, form.weightKg]);

  function hydrateFromCatalog(match: CatalogMemoryMatch) {
    setSelectedCatalogMatch(match);
    setForm((prev) => ({
      ...prev,
      description: match.name,
      memoryCategory: match.categoryName || prev.memoryCategory,
      platform: match.preferredPlatform || prev.platform,
      priceCurrency: ((match.priceCurrency as PriceCurrency | null) || prev.priceCurrency),
      platformPriceInput: String(
        match.estimatedCost ??
          match.weightedAverageCost ??
          match.lastActualCost ??
          match.priceMin ??
          prev.platformPriceInput
      ),
      weightKg: match.weightEstimate != null ? String(match.weightEstimate) : prev.weightKg,
    }));
    setLandingUrl("");
    toast.success(`Données catalogue importées pour ${match.name}.`);
  }

  function applyCategoryWeightHint() {
    if (!categoryMemoryHint?.averageBufferedWeightKg) return;
    setForm((prev) => ({
      ...prev,
      weightKg: String(categoryMemoryHint.averageBufferedWeightKg),
    }));
    setDensityBlocked(false);
    toast.success("Poids mémoire de catégorie appliqué.");
  }

  async function handleCatalogImageSelected(file?: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCatalogImagePreview(typeof reader.result === "string" ? reader.result : "");
      setCatalogImageFilename(file.name);
    };
    reader.readAsDataURL(file);
  }

  async function runImageMatching() {
    if (!catalogImagePreview) {
      toast.error("Ajoutez d'abord une image produit.");
      return;
    }

    setMatchingImage(true);
    try {
      const res = await fetch("/api/catalog/match-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl: catalogImagePreview,
          filename: catalogImageFilename,
          categoryName: form.memoryCategory || form.category,
          queryHint: form.description,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Matching image indisponible.");
        return;
      }

      if (data.extracted?.productName && !form.description.trim()) {
        setForm((prev) => ({ ...prev, description: String(data.extracted.productName) }));
      }
      if (Array.isArray(data.matches) && data.matches.length > 0) {
        setCatalogMatches(data.matches as CatalogMemoryMatch[]);
        toast.success("Produits similaires trouvés depuis l'image.");
      } else {
        toast.message("Aucun produit catalogue fiable n'a été trouvé à partir de l'image.");
      }
    } catch {
      toast.error("Impossible d'analyser cette image pour le moment.");
    } finally {
      setMatchingImage(false);
    }
  }

  function compute(forceTransportKey?: string) {
    const priceRmb = effectivePriceRmb;
    const quantity = Math.max(1, Math.round(n(form.quantity)));
    const weightKg = n(form.weightKg);
    if (!priceRmb || !weightKg) {
      toast.error("Renseignez prix plateforme et poids.");
      return;
    }

    try {
      const next = TransportCalculatorService.indicatifPrice({
        platformPriceRmb: priceRmb,
        quantity,
        weightKg,
        lengthCm: n(form.lengthCm) || undefined,
        widthCm: n(form.widthCm) || undefined,
        heightCm: n(form.heightCm) || undefined,
        cartonCount: Math.max(1, Math.round(n(form.cartonCount) || 1)),
        category: form.category,
        selectedTransportKey: forceTransportKey || selectedTransportKey,
        exchangeRate: n(form.exchangeRate) || HORION_TRANSPORT_RATES.DEFAULT_EXCHANGE_RATE,
        transportRateProfiles,
        categoryMemory: categoryMemoryHint
          ? {
              categoryName: categoryMemoryHint.name,
              averageRealityCoefficient: categoryMemoryHint.averageRealityCoefficient ?? null,
              averageDensityRatio: categoryMemoryHint.averageDensityRatio ?? null,
              averageBufferedWeightKg: categoryMemoryHint.averageBufferedWeightKg ?? null,
              historicalSampleCount: categoryMemoryHint.historicalSampleCount ?? null,
            }
          : undefined,
        // Dynamic pricing engine
        sourcePlatform: form.platform,
        riskLevel: form.riskLevel,
        compliance: {
          isPureBattery: form.isPureBattery,
          isLiquid: form.isLiquid,
          isDrone: form.isDrone,
          isFlammable: form.isFlammable,
          isExplosive: form.isExplosive,
          isSpray: form.isSpray,
          isIllegal: form.isIllegal,
          isToxicChemical: form.isToxicChemical,
          isWeaponReplica: form.isWeaponReplica,
          isMedicalSupplement: form.isMedicalSupplement,
          hasImportAuthorization: form.hasImportAuthorization,
          isUndeclared: form.isUndeclared,
          isFragile: form.isFragile,
          hasWoodenCratePackaging: form.hasWoodenCratePackaging,
        },
      });
      const densityHint = next.transport.densityValidation;
      const categoryWeightHint = categoryMemoryHint?.averageBufferedWeightKg ?? null;
      const weightDeviation =
        categoryWeightHint && categoryWeightHint > 0
          ? Math.abs(weightKg - categoryWeightHint) / categoryWeightHint
          : 0;
      const shouldBlock =
        Boolean(densityHint?.blocked) ||
        (categoryWeightHint != null && categoryWeightHint > 0 && weightDeviation > 0.3);
      setDensityBlocked(shouldBlock);
      setResult(next);
      if (next.selectedTransportKey) setSelectedTransportKey(next.selectedTransportKey);
      setLandingUrl("");
      if (densityHint?.blocked) {
        toast.error(densityHint.message);
      } else if (categoryWeightHint != null && categoryWeightHint > 0 && weightDeviation > 0.3) {
        toast.error(
          `Le poids saisi s'écarte fortement de la mémoire catégorie (${categoryWeightHint.toFixed(1)} kg).`
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur de calcul");
    }
  }

  function recalcWithTransport(key: string) {
    setSelectedTransportKey(key);
    compute(key);
  }

  const selectedOption = useMemo(() => {
    return result?.transportOptions.find(
      (o) => o.key === (result.selectedTransportKey || selectedTransportKey)
    );
  }, [result, selectedTransportKey]);

  function buildCurrentLineItem(): IndicatifQuoteItem | null {
    if (!result || !selectedOption?.eligible) return null;
    const description = form.description.trim();
    if (!description) return null;
    return {
      description,
      category: form.category,
      platform: form.platform,
      riskLevel: form.riskLevel,
      catalogProductId: selectedCatalogMatch?.id,
      catalogMatchScore: selectedCatalogMatch?.score,
      catalogConfidenceScore: selectedCatalogMatch?.catalogConfidenceScore,
      isCatalogMatch: Boolean(selectedCatalogMatch),
      quantity: Math.max(1, Math.round(n(form.quantity))),
      platformUnitPriceRmb: effectivePriceRmb,
      exchangeRate: n(form.exchangeRate) || HORION_TRANSPORT_RATES.DEFAULT_EXCHANGE_RATE,
      productSellXAF: result.margin.productSellXAF,
      serviceFeeXAF: result.margin.serviceFeeXAF,
      totalXAF: result.margin.prixFinalXAF,
      weightKg: n(form.weightKg) || undefined,
      productBufferPct: result.bufferApplied,
      appliedRealityCoefficient: result.appliedRealityCoefficient ?? null,
      categoryAverageDensityRatio: categoryMemoryHint?.averageDensityRatio ?? null,
      invisibleMarginPct: result.effectiveMarginPct,
      selectedTransport: {
        key: selectedOption.key,
        label: selectedOption.label,
        mode: selectedOption.mode,
        serviceLevel: selectedOption.serviceLevel,
        costXAF: selectedOption.costXAF,
        ratePerKg: selectedOption.ratePerKg,
        ratePerCbm: selectedOption.ratePerCbm,
        delayLabel: selectedOption.delayLabel,
        eligible: selectedOption.eligible,
        freightPartnerId: selectedOption.freightPartnerId ?? null,
        freightPartnerName: selectedOption.freightPartnerName ?? null,
        incoterm: selectedOption.incoterm ?? null,
        supportsDap: selectedOption.supportsDap ?? false,
        customsDeclarant: selectedOption.customsDeclarant ?? false,
      },
      transportOptions: result.transportOptions.map((opt) => ({
        key: opt.key,
        label: opt.label,
        mode: opt.mode,
        serviceLevel: opt.serviceLevel,
        costXAF: opt.costXAF,
        ratePerKg: opt.ratePerKg,
        ratePerCbm: opt.ratePerCbm,
        delayLabel: opt.delayLabel,
        eligible: opt.eligible,
        freightPartnerId: opt.freightPartnerId ?? null,
        freightPartnerName: opt.freightPartnerName ?? null,
        incoterm: opt.incoterm ?? null,
        supportsDap: opt.supportsDap ?? false,
        customsDeclarant: opt.customsDeclarant ?? false,
      })),
      compliance: {
        isPureBattery: form.isPureBattery,
        isLiquid: form.isLiquid,
        isDrone: form.isDrone,
        isFlammable: form.isFlammable,
        isExplosive: form.isExplosive,
        isSpray: form.isSpray,
        isIllegal: form.isIllegal,
        isToxicChemical: form.isToxicChemical,
        isWeaponReplica: form.isWeaponReplica,
        isMedicalSupplement: form.isMedicalSupplement,
        hasImportAuthorization: form.hasImportAuthorization,
        isUndeclared: form.isUndeclared,
        isFragile: form.isFragile,
        hasWoodenCratePackaging: form.hasWoodenCratePackaging,
      },
    };
  }

  function addCurrentProductToQuote() {
    if (densityBlocked) {
      toast.error("Corrigez d'abord le poids / volume avant d'ajouter ce produit au devis.");
      return;
    }
    const line = buildCurrentLineItem();
    if (!line) { toast.error("Calculez d'abord un produit valide."); return; }
    setLineItems((prev) => [...prev, line]);
    setLandingUrl("");
    toast.success("Produit ajouté au devis multi-produits.");
  }

  const quoteTotals = useMemo(() => {
    if (lineItems.length === 0 && result) {
      return {
        productSellXAF: result.margin.productSellXAF,
        transportXAF: result.margin.coutTransportXAF,
        serviceFeeXAF: result.margin.serviceFeeXAF,
        totalXAF: result.margin.prixFinalXAF,
        quantity: Math.max(1, Math.round(n(form.quantity))),
        lineCount: 1,
      };
    }
    return lineItems.reduce(
      (acc, item) => {
        acc.productSellXAF += item.productSellXAF;
        acc.transportXAF += item.selectedTransport.costXAF;
        acc.serviceFeeXAF += item.serviceFeeXAF;
        acc.totalXAF += item.totalXAF;
        acc.quantity += item.quantity;
        acc.lineCount += 1;
        return acc;
      },
      { productSellXAF: 0, transportXAF: 0, serviceFeeXAF: 0, totalXAF: 0, quantity: 0, lineCount: 0 }
    );
  }, [lineItems, result, form.quantity]);

  async function handleSendQuote() {
    if (!result) { toast.error("Calculez d'abord le devis indicatif."); return; }
    if (!form.contactId) { toast.error("Sélectionnez un contact ou prospect."); return; }
    if (densityBlocked) {
      toast.error("Corrigez d'abord le poids / volume avant d'envoyer le devis.");
      return;
    }
    const currentLine = buildCurrentLineItem();
    const itemsForQuote = lineItems.length > 0 ? lineItems : currentLine ? [currentLine] : [];
    if (itemsForQuote.length === 0) { toast.error("Ajoutez au moins un produit calculé."); return; }

    startTransition(async () => {
      const activeOption = selectedOption;
      const response = await sendIndicatifQuote({
        contactId: form.contactId,
        clientEmail: form.clientEmail || undefined,
        ...(lineItems.length === 0 && activeOption && {
          description: form.description || undefined,
          category: form.category,
          platform: form.platform,
          quantity: Math.max(1, Math.round(n(form.quantity))),
          platformUnitPriceRmb: effectivePriceRmb,
          exchangeRate: n(form.exchangeRate),
          productSellXAF: result.margin.productSellXAF,
          serviceFeeXAF: result.margin.serviceFeeXAF,
          totalXAF: result.margin.prixFinalXAF,
          selectedTransport: {
            key: activeOption.key,
            label: activeOption.label,
            mode: activeOption.mode,
            serviceLevel: activeOption.serviceLevel,
            costXAF: activeOption.costXAF,
            ratePerKg: activeOption.ratePerKg,
            ratePerCbm: activeOption.ratePerCbm,
            delayLabel: activeOption.delayLabel,
            eligible: activeOption.eligible,
            freightPartnerId: activeOption.freightPartnerId ?? null,
            freightPartnerName: activeOption.freightPartnerName ?? null,
            incoterm: activeOption.incoterm ?? null,
            supportsDap: activeOption.supportsDap ?? false,
            customsDeclarant: activeOption.customsDeclarant ?? false,
          },
          transportOptions: result.transportOptions.map((opt) => ({
            key: opt.key,
            label: opt.label,
            mode: opt.mode,
            serviceLevel: opt.serviceLevel,
            costXAF: opt.costXAF,
            ratePerKg: opt.ratePerKg,
            ratePerCbm: opt.ratePerCbm,
            delayLabel: opt.delayLabel,
            eligible: opt.eligible,
            freightPartnerId: opt.freightPartnerId ?? null,
            freightPartnerName: opt.freightPartnerName ?? null,
            incoterm: opt.incoterm ?? null,
            supportsDap: opt.supportsDap ?? false,
            customsDeclarant: opt.customsDeclarant ?? false,
          })),
        }),
        items: itemsForQuote,
        validDays: 7,
      });

      if (response.error || !response.data) {
        toast.error(response.error || "Erreur envoi devis.");
        return;
      }

      if (response.data.requiresApproval) {
        setLandingUrl(null);
        toast.success(
          `Devis créé en attente de validation interne par ${response.data.approvalLabel ?? "le valideur requis"}.`
        );
        setLineItems([]);
        return;
      }

      if (response.data.pdfBase64 && response.data.filename) {
        const bytes = Uint8Array.from(atob(response.data.pdfBase64), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = response.data.filename;
        a.click();
        URL.revokeObjectURL(url);
      }

      setLandingUrl(response.data.landingUrl ?? null);
      toast.success("Devis validé en interne et envoyé au client.");
      setLineItems([]);
    });
  }

  function renderCostMultiCurrency(amountXaf: number) {
    const usd = convertCurrency(amountXaf, "XAF", "USD");
    const eur = convertCurrency(amountXaf, "XAF", "EUR");
    const rmb = convertCurrency(amountXaf, "XAF", "RMB");
    return (
      <div className="space-y-0.5">
        <div className="font-semibold">{fmtXaf(amountXaf)}</div>
        <div className="text-xs text-muted-foreground">
          {formatCurrency(usd, "USD")} ⬢ {formatCurrency(eur, "EUR")} ⬢ {formatCurrency(rmb, "RMB")}
        </div>
      </div>
    );
  }

  const complianceWarningRows: Array<[string, boolean]> = [
    ["Drone (interdit air/mer)", form.isDrone],
    ["Batterie pure (interdit avion)", form.isPureBattery],
    ["Liquide (interdit mer)", form.isLiquid],
    ["Produit inflammable/explosif", form.isFlammable || form.isExplosive],
    ["Spray", form.isSpray],
    ["Marchandise illégale/réglementée", form.isIllegal],
    ["Chimique toxique", form.isToxicChemical],
    ["Arme/réplique", form.isWeaponReplica],
  ];

  const selectedRiskOption = RISK_LEVEL_OPTIONS.find((r) => r.value === form.riskLevel);
  const selectedPlatformOption = PLATFORM_OPTIONS.find((p) => p.value === form.platform);
  const selectedCurrencyOption = PRICE_CURRENCY_OPTIONS.find((c) => c.value === form.priceCurrency);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Sourcing Indicatif</h1>
          <p className="text-muted-foreground mt-1">
            Devis avant sourcing profond → moteur de prix dynamique (buffer · risque · plateforme).
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            Moteur v2 → Buffer risque + Marge dynamique + 10% service
          </Badge>
          <span className="text-xs text-muted-foreground">
            {isInternationalPlatform
              ? `Marge réduite (15%) → prix ${form.platform} déjà élevé`
              : `Marge pleine (30%) → prix local ${form.platform}`}
          </span>
        </div>
      </div>

      {/* Alibaba warning */}
      {isInternationalPlatform && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-900 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <p className="font-semibold">
                Attention → Sourcing basé sur {form.platform} (plateforme internationale)
              </p>
              <p className="mt-1">
                Le prix {form.platform} est majoré de 30 à 60% par rapport à 1688/Taobao. Le moteur
                applique automatiquement une marge réduite (15%) pour rester compétitif. Si vous
                sourcez finalement sur 1688, la différence de prix constitue un bénéfice supplémentaire.
              </p>
              <p className="mt-1 font-medium">
                → Recommandation : vérifiez d{"'"}abord sur 1688 ou Taobao pour optimiser le taux de
                conversion du devis.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-200 bg-slate-50">
        <CardContent className="p-4 text-sm text-slate-700 space-y-1">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            Rappels transport
          </div>
          <p>→ DDP prévisible : droits de douane non intégrés dans l{"'"}estimatif standard.</p>
          <p>→ Téléphones et ordinateurs interdits par voie maritime.</p>
          <p>→ Batteries pures interdites en avion. Drones interdits air/mer.</p>
          <p>→ Colis non déclaré : majoration de 60% appliquée aux frais transport.</p>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1.4fr]">
        {/* ═══ LEFT: Parameters form ═══════════════════════════════════════════════════ */}
        <Card>
          <CardHeader>
            <CardTitle>Paramètres devis</CardTitle>
            <CardDescription>
              Client, produit, plateforme de sourcing et niveau de risque.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Contact */}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Contact / prospect cible</Label>
                <Select
                  value={form.contactId}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, contactId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingContacts ? "Chargement..." : "Sélectionnez"} />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.name}{contact.company ? ` → ${contact.company}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedContact && (
                  <p className="text-xs text-muted-foreground">
                    {selectedContact.type === "PROSPECT" ? "Prospect" : "Client"}
                    {selectedContact.whatsapp
                      ? ` → WhatsApp ${selectedContact.whatsapp}`
                      : selectedContact.phone
                        ? ` → Tél ${selectedContact.phone}`
                        : ""}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Email client (optionnel)</Label>
                <Input
                  value={form.clientEmail}
                  onChange={(e) => setForm((prev) => ({ ...prev, clientEmail: e.target.value }))}
                  placeholder="client@exemple.com"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Description produit</Label>
              <Input
                value={form.description}
                onChange={(e) => {
                  setSelectedCatalogMatch(null);
                  setForm((prev) => ({ ...prev, description: e.target.value }));
                }}
                placeholder="Ex : lot smartphones 256GB, 50 unités"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Catégorie produit / mémoire</Label>
              <Input
                value={form.memoryCategory}
                onChange={(e) => setForm((prev) => ({ ...prev, memoryCategory: e.target.value }))}
                placeholder="Ex : Accessoires mobiles, Chaise de bureau"
              />
              <p className="text-xs text-muted-foreground">
                Utilisée pour appliquer le coefficient de réalité moyen et la densité historique de la catégorie.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Matching image catalogue</p>
                  <p className="text-xs text-muted-foreground">
                    Chargez une photo produit pour retrouver plus vite un équivalent déjà connu.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    className="max-w-[220px]"
                    onChange={(e) => void handleCatalogImageSelected(e.target.files?.[0])}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void runImageMatching()}
                    disabled={!catalogImagePreview || matchingImage}
                  >
                    <ImagePlus className="mr-2 h-4 w-4" />
                    {matchingImage ? "Analyse..." : "Analyser"}
                  </Button>
                </div>
              </div>
              {catalogImagePreview ? (
                <div className="mt-3 flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={catalogImagePreview}
                    alt="Aperçu produit"
                    className="h-14 w-14 rounded-lg object-cover"
                  />
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium text-slate-900">{catalogImageFilename || "Image produit"}</p>
                    <p>Utilisez l'image pour accélérer le matching avec Catalog OS.</p>
                  </div>
                </div>
              ) : null}
            </div>

            {(categoryHintLoading || categoryMemoryHint) && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-amber-950">Mémoire catégorie</p>
                    <p className="text-xs text-amber-900/75">
                      Le devis s'appuie sur la réalité historique Horion avant de suivre aveuglément la plateforme.
                    </p>
                  </div>
                  {categoryHintLoading ? <Badge variant="outline">Chargement...</Badge> : null}
                </div>
                {categoryMemoryHint ? (
                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    <div className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Coeff. réalité</p>
                      <p className="font-semibold text-slate-950">
                        {categoryMemoryHint.averageRealityCoefficient != null
                          ? categoryMemoryHint.averageRealityCoefficient.toFixed(2)
                          : "-"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Poids mémoire</p>
                      <p className="font-semibold text-slate-950">
                        {categoryMemoryHint.averageBufferedWeightKg != null
                          ? `${categoryMemoryHint.averageBufferedWeightKg.toFixed(1)} kg`
                          : "-"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Échantillon</p>
                      <p className="font-semibold text-slate-950">
                        {categoryMemoryHint.historicalSampleCount || 0} historique(s)
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Pas encore assez d'historique pour cette catégorie. Le moteur retombe sur le pricing plateforme.
                  </p>
                )}
              </div>
            )}

            {(catalogLoading || catalogMatches.length > 0 || selectedCatalogMatch) && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">Mémoire catalogue</p>
                    <p className="text-xs text-emerald-800/80">
                      On vérifie d'abord si Horion connaît déjà ce produit avant de repartir en sourcing.
                    </p>
                  </div>
                  {catalogLoading && (
                    <Badge variant="outline" className="border-emerald-300 bg-white text-emerald-700">
                      Recherche...
                    </Badge>
                  )}
                </div>

                {selectedCatalogMatch && (
                  <div className="mt-3 rounded-lg border border-emerald-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-950">{selectedCatalogMatch.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Source maison active - Confiance {selectedCatalogMatch.catalogConfidenceScore}/100
                          {selectedCatalogMatch.primarySupplierName
                            ? ` - Fournisseur ${selectedCatalogMatch.primarySupplierName}`
                            : ""}
                        </p>
                      </div>
                      <Badge className="bg-emerald-100 text-emerald-800">
                        {selectedCatalogMatch.isCertified ? "Certifié" : "Historique connu"}
                      </Badge>
                    </div>
                  </div>
                )}

                {catalogMatches.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {catalogMatches.map((match) => (
                      <div
                        key={match.id}
                        className="rounded-lg border border-white/80 bg-white p-3 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-slate-950">{match.name}</p>
                              <Badge variant="outline">{match.score}% match</Badge>
                              {match.isCertified && (
                                <Badge className="bg-emerald-100 text-emerald-800">Certifié</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {match.categoryName || "Sans catégorie"} - {match.historicalOrderCount} commandes
                              - Cout moyen{" "}
                              {match.weightedAverageCost != null
                                ? `${match.weightedAverageCost.toLocaleString("fr-FR")} ${match.priceCurrency}`
                                : "N/A"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Plateforme prioritaire {match.preferredPlatform || "N/A"}
                              {match.primarySupplierName ? ` - Fournisseur ${match.primarySupplierName}` : ""}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => hydrateFromCatalog(match)}
                            >
                              Utiliser
                            </Button>
                            <Button type="button" size="sm" asChild>
                              <a href={`/catalog/products/${match.id}`} target="_blank" rel="noreferrer">
                                Voir
                              </a>
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Platform + Risk level */}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Plateforme de sourcing</Label>
                <Select
                  value={form.platform}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, platform: value }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Plateformes locales (marge 30%)
                    </div>
                    {PLATFORM_OPTIONS.filter((p) => p.badge === "LOCAL").map((platform) => (
                      <SelectItem key={platform.value} value={platform.value}>
                        {platform.label}
                      </SelectItem>
                    ))}
                    <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Plateformes internationales (marge 15%)
                    </div>
                    {PLATFORM_OPTIONS.filter((p) => p.badge === "INTL").map((platform) => (
                      <SelectItem key={platform.value} value={platform.value}>
                        {platform.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPlatformOption && (
                  <p className="text-xs text-muted-foreground">{selectedPlatformOption.hint}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Niveau de risque produit</Label>
                <Select
                  value={form.riskLevel}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, riskLevel: value as RiskLevel }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RISK_LEVEL_OPTIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label} → {r.desc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedRiskOption && (
                  <p className="text-xs text-muted-foreground">Ex : {selectedRiskOption.examples}</p>
                )}
              </div>
            </div>

            {/* Pricing preview */}
            <div className="rounded-xl border bg-background p-3 text-sm">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Zap className="h-3.5 w-3.5" />
                Paramètres pricing auto-calculés
              </div>
              <div className="grid grid-cols-1 gap-2 text-center sm:grid-cols-3">
                <div className="rounded-lg border bg-muted/40 px-2 py-2">
                  <p className="text-xs text-muted-foreground">Buffer risque</p>
                  <p className="font-bold text-slate-950">
                    {(derivedPricing.bufferPct * 100).toFixed(0)}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {form.riskLevel} · {LOCAL_PLATFORMS.has(form.platform) ? "local" : "intl"}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/40 px-2 py-2">
                  <p className="text-xs text-muted-foreground">Marge interne</p>
                  <p className="font-bold text-slate-950">
                    {(derivedPricing.invisibleMarginPct * 100).toFixed(0)}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {LOCAL_PLATFORMS.has(form.platform) ? "locale → pleine" : "intl → réduite"}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/40 px-2 py-2">
                  <p className="text-xs text-muted-foreground">Frais service</p>
                  <p className="font-bold text-slate-950">10%</p>
                  <p className="text-[10px] text-muted-foreground">6% bancaire + 4% gestion</p>
                </div>
              </div>
            </div>

            {/* Cargo category */}
            <div className="space-y-1.5">
              <Label>Catégorie transport (tarif fret)</Label>
              <Select
                value={form.category}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, category: value as HorionCargoCategory }))
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CARGO_CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {CARGO_CATEGORY_OPTIONS.find((item) => item.value === form.category)?.desc}
              </p>
            </div>

            {/* Price input → multi-currency */}
            <div className="space-y-2">
              <Label>Prix plateforme</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.platformPriceInput}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, platformPriceInput: e.target.value }))
                    }
                    placeholder={`Prix en ${form.priceCurrency}`}
                  />
                </div>
                <Select
                  value={form.priceCurrency}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, priceCurrency: value as PriceCurrency }))
                  }
                >
                  <SelectTrigger className="w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRICE_CURRENCY_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Live conversion display */}
              {n(form.platformPriceInput) > 0 && (
                <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
                  {form.priceCurrency !== "RMB" && (
                    <p>
                      → {formatCurrency(effectivePriceRmb, "RMB")} (converti en RMB)
                    </p>
                  )}
                  <p className="font-medium text-slate-900">
                    = {fmtXaf(priceXafEquivalent)} / unité (coût pur sans marge)
                  </p>
                  <p className="text-[10px]">
                    Taux : 1 RMB = {n(form.exchangeRate)} FCFA
                    {form.priceCurrency === "USD" &&
                      ` · 1 USD = ${DEFAULT_FX_RATES.USD_RMB ?? 7.25} RMB`}
                    {form.priceCurrency === "EUR" &&
                      ` · 1 EUR = ${DEFAULT_FX_RATES.EUR_XAF ?? 655.957} FCFA`}
                  </p>
                </div>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Quantité</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
                />
                {n(form.quantity) >= 10 && (
                  <p className="text-xs text-emerald-700 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Volume ≥ 10 unités — négociez -5 à -15% sur 1688 (prix unitaire plus bas).
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Poids total (kg)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.weightKg}
                  onChange={(e) => setForm((prev) => ({ ...prev, weightKg: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: "L (cm)", field: "lengthCm" },
                { label: "l (cm)", field: "widthCm" },
                { label: "h (cm)", field: "heightCm" },
                { label: "Cartons", field: "cartonCount" },
              ].map(({ label, field }) => (
                <div key={field} className="space-y-1.5">
                  <Label>{label}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form[field as keyof typeof form] as string}
                    onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
                  />
                </div>
              ))}
            </div>

            {(densityBlocked || categoryMemoryHint?.averageBufferedWeightKg) && (
              <div
                className={`rounded-xl border p-3 ${
                  densityBlocked
                    ? "border-rose-200 bg-rose-50 text-rose-900"
                    : "border-slate-200 bg-slate-50 text-slate-700"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">
                      {densityBlocked ? "Alerte poids / densité" : "Suggestion mémoire logistique"}
                    </p>
                    <p className="text-xs">
                      {result?.transport?.densityValidation?.message ||
                        (categoryMemoryHint?.averageBufferedWeightKg != null
                          ? `La catégorie ${categoryMemoryHint.name} tourne historiquement autour de ${categoryMemoryHint.averageBufferedWeightKg.toFixed(
                              1
                            )} kg sécurisés.`
                          : "Ajoutez des dimensions pour sécuriser le poids facturable.")}
                    </p>
                  </div>
                  {categoryMemoryHint?.averageBufferedWeightKg != null ? (
                    <Button type="button" variant="outline" size="sm" onClick={applyCategoryWeightHint}>
                      Utiliser {categoryMemoryHint.averageBufferedWeightKg.toFixed(1)} kg
                    </Button>
                  ) : null}
                </div>
              </div>
            )}

            {/* Exchange rate */}
            <div className="space-y-1.5">
              <Label>Taux de change RMB → FCFA</Label>
              <Input
                type="number"
                min="1"
                step="0.1"
                value={form.exchangeRate}
                onChange={(e) => setForm((prev) => ({ ...prev, exchangeRate: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Taux actuel estimé : {n(form.exchangeRate)} FCFA / RMB. Ajustez selon le marché du jour.
              </p>
              <p className="text-xs text-amber-700">
                Si le devis est valable plus de 3 jours, ajoutez ~2% de buffer FX (soit +{(n(form.exchangeRate) * 0.02).toFixed(1)} FCFA/RMB).
              </p>
            </div>

            {/* Compliance */}
            <div className="rounded-lg border p-3 space-y-3">
              <p className="text-sm font-medium">Compliance marchandise</p>
              <div className="grid gap-2 md:grid-cols-2">
                {[
                  ["isPureBattery", "Batterie pure"],
                  ["isLiquid", "Liquide / cosmétique"],
                  ["isDrone", "Drone"],
                  ["isFlammable", "Inflammable"],
                  ["isExplosive", "Explosif"],
                  ["isSpray", "Spray"],
                  ["isIllegal", "Produit illégal/réglementé"],
                  ["isToxicChemical", "Chimique toxique"],
                  ["isWeaponReplica", "Arme/réplique"],
                  ["isMedicalSupplement", "Supplément/médicament"],
                  ["isUndeclared", "Colis non déclaré"],
                  ["isFragile", "Colis fragile"],
                ].map(([field, label]) => (
                  <label key={field} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={Boolean(form[field as keyof typeof form])}
                      onCheckedChange={(checked) =>
                        setForm((prev) => ({ ...prev, [field]: Boolean(checked) }))
                      }
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.hasImportAuthorization}
                    onCheckedChange={(checked) =>
                      setForm((prev) => ({ ...prev, hasImportAuthorization: Boolean(checked) }))
                    }
                  />
                  <span>Autorisation import (médicaments)</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.hasWoodenCratePackaging}
                    onCheckedChange={(checked) =>
                      setForm((prev) => ({ ...prev, hasWoodenCratePackaging: Boolean(checked) }))
                    }
                  />
                  <span>Emballage caisse bois (fragile)</span>
                </label>
              </div>
            </div>

            <Button className="w-full" onClick={() => compute()}>
              <Calculator className="h-4 w-4 mr-2" />
              Calculer devis indicatif
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={addCurrentProductToQuote}
              disabled={densityBlocked}
            >
              Ajouter ce produit au devis multi-produits
            </Button>
          </CardContent>
        </Card>

        {/* ═══ RIGHT: Results ════════════════════════════════════════════════════════════ */}
        <div className="space-y-4">
          {!result ? (
            <Card className="h-full">
              <CardContent className="h-full flex items-center justify-center text-muted-foreground">
                Calculez pour afficher le tableau de devis.
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Pricing Rationale → internal tool */}
              {result.pricingRationale && (
                <Card className={`border ${result.pricingRationale.isLocalPlatform ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Info className="h-4 w-4" />
                      Logique de prix appliquée
                      <Badge variant="outline" className="ml-auto text-xs">
                        Usage interne uniquement
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="grid grid-cols-1 gap-2 text-center text-xs sm:grid-cols-3">
                      <div className="rounded-lg border bg-white/80 px-2 py-2">
                        <p className="text-muted-foreground">Buffer risque</p>
                        <p className="text-lg font-bold">
                          {(result.pricingRationale.bufferPct * 100).toFixed(0)}%
                        </p>
                        <p className="text-muted-foreground capitalize">{result.pricingRationale.riskLevel}</p>
                      </div>
                      <div className="rounded-lg border bg-white/80 px-2 py-2">
                        <p className="text-muted-foreground">Marge interne</p>
                        <p className="text-lg font-bold">
                          {(result.pricingRationale.invisibleMarginPct * 100).toFixed(0)}%
                        </p>
                        <p className="text-muted-foreground">
                          {result.pricingRationale.isLocalPlatform ? "Pleine" : "Réduite"}
                        </p>
                      </div>
                      <div className="rounded-lg border bg-white/80 px-2 py-2">
                        <p className="text-muted-foreground">Profit brut estimé</p>
                        <p className="text-lg font-bold text-emerald-700">
                          {result.pricingRationale.profitExpectedPct}%
                        </p>
                        <p className="text-muted-foreground">
                          floor {result.pricingRationale.profitFloorPct}%
                        </p>
                      </div>
                    </div>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {result.pricingRationale.notes.map((note, i) => (
                        <li key={i}>{note}</li>
                      ))}
                    </ul>
                    {/* Internal margin amount */}
                    <div className="rounded-lg border bg-white/80 px-3 py-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Bénéfice net projeté (si sourcing OK)</span>
                        <span className="font-semibold text-emerald-700">
                          {fmtXaf(result.margin.internalMarginXAF + result.margin.serviceFeeXAF * 0.4)}
                        </span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-muted-foreground">Marge globale</span>
                        <span className={`font-semibold ${result.margin.marginAlert === "OK" ? "text-emerald-700" : result.margin.marginAlert === "WARNING" ? "text-amber-700" : "text-rose-700"}`}>
                          {result.margin.marginPct.toFixed(1)}% → {result.margin.marginAlertLabel}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Margin floor alert */}
              {result.margin.marginAlert !== "OK" && (
                <div className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${
                  result.margin.marginAlert === "DANGER"
                    ? "border-rose-300 bg-rose-50 text-rose-900"
                    : "border-amber-300 bg-amber-50 text-amber-900"
                }`}>
                  <AlertTriangle className={`h-5 w-5 shrink-0 mt-0.5 ${result.margin.marginAlert === "DANGER" ? "text-rose-600" : "text-amber-600"}`} />
                  <div>
                    <p className="font-semibold">
                      {result.margin.marginAlert === "DANGER"
                        ? "Marge dangereusement basse — risque de perte"
                        : "Marge sous le seuil recommandé (20%)"}
                    </p>
                    <p className="mt-1 text-xs">
                      Marge actuelle : <strong>{result.margin.marginPct.toFixed(1)}%</strong>.{" "}
                      {result.margin.marginAlert === "DANGER"
                        ? "Augmentez le prix ou réduisez le transport avant d'envoyer ce devis."
                        : "Vérifiez le prix plateforme ou proposez le transport standard plutôt qu'express."}
                    </p>
                  </div>
                </div>
              )}

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Lecture logistique sécurisée</CardTitle>
                  <CardDescription>
                    Buffers Horion, volumétrique et poids facturable arrondi au supérieur.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Poids saisi</p>
                    <p className="mt-1 text-lg font-semibold">{result.transport.actualWeightKg.toFixed(2)} kg</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Poids sécurisé</p>
                    <p className="mt-1 text-lg font-semibold">{result.transport.bufferedWeightKg.toFixed(2)} kg</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Poids volumétrique</p>
                    <p className="mt-1 text-lg font-semibold">
                      {result.transport.bufferedVolumetricWeightKg != null
                        ? `${result.transport.bufferedVolumetricWeightKg.toFixed(2)} kg`
                        : "N/A"}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Poids facturable</p>
                    <p className="mt-1 text-lg font-semibold text-amber-700">
                      {result.transport.chargeableWeightKg.toFixed(0)} kg
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Ce poids sert de base à la facturation transitaire.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Transport options */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Options transport et délais</CardTitle>
                  <CardDescription>
                    La facture client affiche les moyens transport avec coût et délai.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Option</TableHead>
                        <TableHead>Délai</TableHead>
                        <TableHead>Coût</TableHead>
                        <TableHead className="w-[110px]">Sélection</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.transportOptions.map((option: IndicatifTransportOption) => {
                        const selected =
                          (result.selectedTransportKey || selectedTransportKey) === option.key;
                        return (
                          <TableRow key={option.key} className={!option.eligible ? "opacity-60" : ""}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {option.mode === "AIR" ? (
                                  <Plane className="h-4 w-4 text-sky-600" />
                                ) : (
                                  <Ship className="h-4 w-4 text-indigo-600" />
                                )}
                                <div>
                                  <p className="font-medium">{option.label}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {option.serviceLevel === "EXPRESS" ? "Express" : "Standard"} / {option.mode}
                                  </p>
                                  {option.freightPartnerName && (
                                    <p className="text-xs text-muted-foreground">
                                      Base négociée: {option.freightPartnerName}
                                      {option.incoterm ? ` ⬢ ${option.incoterm}` : ""}
                                    </p>
                                  )}
                                  {option.reason && (
                                    <p className="text-xs text-red-600 mt-1">{option.reason}</p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{option.delayLabel}</TableCell>
                            <TableCell>
                              {option.eligible ? fmtXaf(option.costXAF) : <span className="text-red-600">Interdit</span>}
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                size="sm"
                                variant={selected ? "default" : "outline"}
                                disabled={!option.eligible}
                                onClick={() => recalcWithTransport(option.key)}
                              >
                                {selected ? "Retenu" : "Choisir"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Client-facing summary */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Synthèse client (visible)</CardTitle>
                  <CardDescription>
                    Marge interne masquée. Frais service (10%) s{"'"}appliquent au produit uniquement.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {lineItems.length > 0 && (
                    <div className="rounded-lg border p-3">
                      <p className="text-sm font-medium mb-2">
                        Produits ajoutés au devis ({lineItems.length})
                      </p>
                      <div className="space-y-2">
                        {lineItems.map((item, idx) => (
                          <div key={`${item.description}-${idx}`} className="rounded border px-3 py-2 text-xs">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-medium text-sm">{item.description}</p>
                                <p className="text-muted-foreground">
                                  {item.category} ⬢ x{item.quantity} ⬢{" "}
                                  {item.selectedTransport.label} ({item.selectedTransport.delayLabel})
                                  {item.riskLevel && (
                                    <span className="ml-1">⬢ risque {item.riskLevel}</span>
                                  )}
                                </p>
                                {item.productBufferPct !== undefined && (
                                  <p className="text-muted-foreground">
                                    Buffer {(item.productBufferPct * 100).toFixed(0)}% ·
                                    Marge {item.invisibleMarginPct != null ? `${(item.invisibleMarginPct * 100).toFixed(0)}%` : "→"}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="font-semibold">{fmtXaf(item.totalXAF)}</p>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setLineItems((prev) => prev.filter((_, i) => i !== idx))}
                                >
                                  Retirer
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Marchandise (prix Horion)</p>
                      {renderCostMultiCurrency(quoteTotals.productSellXAF)}
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Transport retenu</p>
                      {renderCostMultiCurrency(quoteTotals.transportXAF)}
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Frais de service (10% sur produit)</p>
                      {renderCostMultiCurrency(quoteTotals.serviceFeeXAF)}
                    </div>
                    <div className="rounded-lg border p-3 bg-emerald-50 border-emerald-200">
                      <p className="text-xs text-emerald-700 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        Total devis client
                      </p>
                      <div className="text-2xl font-bold text-emerald-800">
                        {fmtXaf(quoteTotals.totalXAF)}
                      </div>
                      <p className="text-xs text-emerald-700">
                        Soit {fmtXaf(quoteTotals.quantity > 0 ? quoteTotals.totalXAF / quoteTotals.quantity : 0)} / unité
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border p-3 text-sm space-y-2">
                    <p className="font-medium">Règle DDP</p>
                    <p className="text-muted-foreground">
                      Douane standard non facturée dans l{"'"}estimation indicatif.
                      Cas spéciaux de dédouanement exceptionnel restent à la charge du propriétaire.
                    </p>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={includeDdpEstimate}
                        onCheckedChange={(v) => setIncludeDdpEstimate(Boolean(v))}
                      />
                      <span>Simuler droits de douane DDP (+25% sur marchandise)</span>
                    </label>
                    {includeDdpEstimate && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        <span className="font-semibold">Estimation DDP : </span>
                        {fmtXaf(quoteTotals.productSellXAF * 0.25)} supplémentaires.{" "}
                        Total estimé avec douane :{" "}
                        <strong>{fmtXaf(quoteTotals.totalXAF + quoteTotals.productSellXAF * 0.25)}</strong>
                        <span className="block mt-0.5 text-amber-700">Non facturable directement — à titre indicatif uniquement.</span>
                      </div>
                    )}
                  </div>

                  {result.transport.eligibility.warnings.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-sm font-medium text-amber-800 mb-1">Points d{"'"}attention</p>
                      <ul className="text-xs text-amber-800 list-disc pl-4 space-y-1">
                        {result.transport.eligibility.warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={handleSendQuote}
                      disabled={isPending || !selectedOption?.eligible || densityBlocked}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Envoyer devis (PDF + lien)
                    </Button>
                    <Button variant="outline" onClick={() => compute()}>
                      <FileDown className="h-4 w-4 mr-2" />
                      Recalculer
                    </Button>
                  </div>

                  {landingUrl && (
                    <div className="rounded-lg border p-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        Lien de validation devis
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Input value={landingUrl} readOnly />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={async () => {
                            await navigator.clipboard.writeText(landingUrl);
                            toast.success("Lien copié.");
                          }}
                        >
                          <Link2 className="h-4 w-4" />
                        </Button>
                        {form.clientEmail && (
                          <Badge variant="outline" className="gap-1">
                            <Mail className="h-3 w-3" />
                            Email cible
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Compliance warnings */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Interdictions automatiques</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 md:grid-cols-2 text-sm">
                  {complianceWarningRows.map(([label, active]) => (
                    <div key={label} className="flex items-center justify-between rounded border px-3 py-2">
                      <span>{label}</span>
                      <Badge variant={active ? "destructive" : "secondary"}>
                        {active ? "Actif" : "Non"}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


