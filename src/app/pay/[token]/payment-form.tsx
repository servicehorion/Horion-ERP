"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  CreditCard,
  Loader2,
  Lock,
  Smartphone,
  Truck,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getInsuranceUpsellCost, INSURANCE_UPSELL_RATE } from "@/lib/insurance-upsell";
import {
  estimatePawaPayCollectionFee,
  findPawaPayProviderConfig,
  getPawaPayCountryOptions,
  getPawaPayEnabledProvidersForCountry,
  normalizePawaPayCountryCode,
} from "@/lib/payments/pawapay-market-config";
import { formatPublicMoney } from "@/lib/public-money";
import { QC_UPSELL_PRICING, type QcUpsellOption } from "@/lib/qc-upsell";

type PaymentMethodDef = {
  value: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  ring: string;
};

const DEFAULT_PAYMENT_METHODS: PaymentMethodDef[] = [
  {
    value: "MOBILE_MONEY_MTN",
    label: "MTN Mobile Money",
    description: "Débit depuis votre compte MTN",
    icon: <Smartphone className="h-5 w-5" />,
    color: "border-yellow-200 bg-yellow-50",
    ring: "ring-yellow-300 border-yellow-400",
  },
  {
    value: "MOBILE_MONEY_AIRTEL",
    label: "Airtel Money",
    description: "Débit depuis votre compte Airtel",
    icon: <Smartphone className="h-5 w-5" />,
    color: "border-red-100 bg-red-50",
    ring: "ring-red-300 border-red-400",
  },
  {
    value: "CARD_VISA",
    label: "Carte Visa",
    description: "Paiement sécurisé par carte bancaire",
    icon: <CreditCard className="h-5 w-5" />,
    color: "border-slate-200 bg-slate-50",
    ring: "ring-slate-300 border-slate-400",
  },
  {
    value: "CARD_MASTERCARD",
    label: "Mastercard",
    description: "Paiement sécurisé par carte bancaire",
    icon: <CreditCard className="h-5 w-5" />,
    color: "border-slate-200 bg-slate-50",
    ring: "ring-slate-300 border-slate-400",
  },
  {
    value: "WIRE_TRANSFER",
    label: "Virement bancaire",
    description: "Validation manuelle après réception de votre preuve",
    icon: <Building2 className="h-5 w-5" />,
    color: "border-sky-100 bg-sky-50",
    ring: "ring-sky-300 border-sky-400",
  },
  {
    value: "CASH_DEPOSIT",
    label: "Dépôt en espèces à la banque",
    description: "0 frais Horion, validation manuelle avec bordereau",
    icon: <CreditCard className="h-5 w-5" />,
    color: "border-emerald-100 bg-emerald-50",
    ring: "ring-emerald-300 border-emerald-400",
  },
] as const;

const MOBILE_MONEY_METHODS = new Set(["MOBILE_MONEY_MTN", "MOBILE_MONEY_AIRTEL"]);
const CARD_PAYMENT_METHODS = new Set(["CARD_VISA", "CARD_MASTERCARD"]);
const MANUAL_PAYMENT_METHODS = new Set(["WIRE_TRANSFER", "CASH_DEPOSIT"]);
const MOBILE_MONEY_FEE_PCT = 0.035;

function getPaymentMethods(preferredGatewayProvider?: string | null): PaymentMethodDef[] {
  if (String(preferredGatewayProvider ?? "").trim().toUpperCase() === "PAWAPAY") {
    return [
      {
        value: "AGGREGATOR",
        label: "Mobile Money",
        description: "Choisissez votre pays et votre opérateur mobile money",
        icon: <Smartphone className="h-5 w-5" />,
        color: "border-emerald-200 bg-emerald-50",
        ring: "ring-emerald-300 border-emerald-400",
      },
      ...DEFAULT_PAYMENT_METHODS.filter((method) => MANUAL_PAYMENT_METHODS.has(method.value)),
    ];
  }

  return [...DEFAULT_PAYMENT_METHODS];
}

type TransportOption = {
  key: string;
  label: string;
  delayLabel: string;
  totalCostXAF: number;
  eligible: boolean;
};

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "").trim();
}

export function PaymentForm({
  token,
  total,
  currency,
  preferredGatewayProvider,
  defaultCustomerCountry,
  defaultCustomerPhone,
  transportOptions,
  currentTransportKey,
  baseAmount,
  currentLogisticsCost,
  currentInsuranceCost = 0,
  currentQcOption = "NONE",
  currentQcCost = 0,
}: {
  token: string;
  total: number;
  currency: string;
  preferredGatewayProvider?: string | null;
  defaultCustomerCountry?: string | null;
  defaultCustomerPhone?: string | null;
  transportOptions?: TransportOption[];
  currentTransportKey?: string;
  baseAmount?: number;
  currentLogisticsCost?: number;
  currentInsuranceCost?: number;
  currentQcOption?: QcUpsellOption;
  currentQcCost?: number;
}) {
  const router = useRouter();
  const paymentMethods = useMemo(
    () => getPaymentMethods(preferredGatewayProvider),
    [preferredGatewayProvider]
  );
  const isPawaPayGateway =
    String(preferredGatewayProvider ?? "").trim().toUpperCase() === "PAWAPAY";
  const countryOptions = useMemo(
    () => getPawaPayCountryOptions().filter((country) => country.currency === currency),
    [currency]
  );
  const normalizedDefaultCountry = normalizePawaPayCountryCode(defaultCustomerCountry);
  const initialCountry = countryOptions.some((option) => option.code === normalizedDefaultCountry)
    ? (normalizedDefaultCountry ?? "")
    : countryOptions[0]?.code ?? "";

  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [payerPhone, setPayerPhone] = useState(defaultCustomerPhone ?? "");
  const [paymentCountry, setPaymentCountry] = useState(initialCountry);
  const [paymentProvider, setPaymentProvider] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedTransportKey, setSelectedTransportKey] = useState(currentTransportKey ?? "");
  const [selectedQcOption, setSelectedQcOption] = useState<QcUpsellOption>(currentQcOption);
  const [withInsurance, setWithInsurance] = useState(currentInsuranceCost > 0);
  const [cgvAccepted, setCgvAccepted] = useState(false);

  const hasTransportChoice = Boolean(transportOptions && transportOptions.length > 1);
  const isPawaPayCollection = isPawaPayGateway && method === "AGGREGATOR";
  const isMobileMoney = MOBILE_MONEY_METHODS.has(method) || isPawaPayCollection;
  const isCardPayment = CARD_PAYMENT_METHODS.has(method);
  const isManualPayment = MANUAL_PAYMENT_METHODS.has(method);
  const instantPaymentMethods = paymentMethods.filter((pm) => !MANUAL_PAYMENT_METHODS.has(pm.value));
  const deferredPaymentMethods = paymentMethods.filter((pm) => MANUAL_PAYMENT_METHODS.has(pm.value));
  const providerOptions = useMemo(
    () => (isPawaPayGateway ? getPawaPayEnabledProvidersForCountry(paymentCountry) : []),
    [isPawaPayGateway, paymentCountry]
  );
  const selectedPawaPayProvider = useMemo(
    () =>
      isPawaPayCollection
        ? findPawaPayProviderConfig({
            countryCode: paymentCountry,
            provider: paymentProvider,
          })
        : null,
    [isPawaPayCollection, paymentCountry, paymentProvider]
  );
  const normalizedPhone = normalizePhone(payerPhone);
  const canSubmit =
    Boolean(method) &&
    cgvAccepted &&
    (!isMobileMoney || normalizedPhone.length >= 9) &&
    (!isPawaPayCollection || Boolean(selectedPawaPayProvider));

  useEffect(() => {
    if (!isPawaPayGateway) return;
    if ((!paymentCountry || !countryOptions.some((country) => country.code === paymentCountry)) && countryOptions[0]?.code) {
      setPaymentCountry(countryOptions[0].code);
    }
  }, [countryOptions, isPawaPayGateway, paymentCountry]);

  useEffect(() => {
    if (!isPawaPayGateway) return;
    if (!providerOptions.some((option) => option.provider === paymentProvider)) {
      setPaymentProvider(providerOptions[0]?.provider ?? "");
    }
  }, [isPawaPayGateway, paymentProvider, providerOptions]);

  const selectedTransportCost = useMemo(() => {
    if (!hasTransportChoice) return currentLogisticsCost ?? 0;
    const selected = transportOptions?.find((o) => o.key === selectedTransportKey);
    return selected?.totalCostXAF ?? currentLogisticsCost ?? 0;
  }, [currentLogisticsCost, hasTransportChoice, selectedTransportKey, transportOptions]);

  const subtotalBeforeInsurance = useMemo(() => {
    const qcCost = QC_UPSELL_PRICING[selectedQcOption].costXaf;
    if (baseAmount != null) return baseAmount + selectedTransportCost + qcCost;
    return total - currentInsuranceCost - currentQcCost + qcCost;
  }, [baseAmount, currentInsuranceCost, currentQcCost, selectedQcOption, selectedTransportCost, total]);

  const insuranceCost = withInsurance ? getInsuranceUpsellCost(subtotalBeforeInsurance) : 0;
  const displayedTotal = subtotalBeforeInsurance + insuranceCost;
  const mobileMoneyFee = selectedPawaPayProvider
    ? estimatePawaPayCollectionFee(displayedTotal, selectedPawaPayProvider)
    : isMobileMoney
      ? Math.round(displayedTotal * MOBILE_MONEY_FEE_PCT)
      : 0;
  const estimatedDebitTotal = displayedTotal + mobileMoneyFee;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!method || !canSubmit) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        paymentMethod: method,
        qcOption: selectedQcOption,
        withInsurance,
        cgvAcceptedAt: new Date().toISOString(),
      };
      if (isMobileMoney) {
        body.payerPhone = normalizedPhone;
        if (isPawaPayCollection) {
          body.paymentCountry = paymentCountry;
          body.paymentProvider = paymentProvider;
        }
      } else if (reference.trim()) {
        body.paymentReference = reference.trim();
      }
      if (hasTransportChoice && selectedTransportKey && selectedTransportKey !== currentTransportKey) {
        body.selectedTransportKey = selectedTransportKey;
        body.adjustedTotal = displayedTotal;
      }

      const res = await fetch(`/api/pay/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      const checkoutUrl = data?.payment?.checkoutUrl as string | null | undefined;

      if (checkoutUrl) {
        window.location.assign(checkoutUrl);
        return;
      }
      if (data.status === "SUBMITTED") {
        router.push(`/pay/${token}/submitted`);
        return;
      }
      if (data.status === "PAID") {
        router.push(`/pay/${token}/success`);
        return;
      }
      if (data.status === "EXPIRED") {
        router.push(`/pay/${token}/expired`);
        return;
      }
      if (!res.ok) {
        toast.error(data.error || "Erreur lors de l'enregistrement du paiement");
        router.push(`/pay/${token}/failed`);
      }
    } catch {
      toast.error("Erreur réseau. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="overflow-hidden rounded-3xl border border-black/[0.07] bg-white shadow-[0_20px_72px_-28px_rgba(15,23,42,0.22)]"
    >
      {hasTransportChoice && transportOptions && (
        <div className="border-b border-black/[0.05] bg-slate-50/80 px-6 py-5">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            <Truck className="h-3.5 w-3.5" />
            Choisir le transport
          </p>
          <div className="space-y-2">
            {transportOptions.map((opt) => {
              const isActive = selectedTransportKey === opt.key;
              const optionSubtotal =
                (baseAmount ?? total - currentInsuranceCost - currentQcCost) +
                opt.totalCostXAF +
                QC_UPSELL_PRICING[selectedQcOption].costXaf;
              const optionInsurance = withInsurance ? getInsuranceUpsellCost(optionSubtotal) : 0;
              const optionTotal = optionSubtotal + optionInsurance;

              return (
                <button
                  key={opt.key}
                  type="button"
                  disabled={!opt.eligible}
                  onClick={() => setSelectedTransportKey(opt.key)}
                  className={`w-full rounded-2xl border p-3.5 text-left transition-all ${
                    !opt.eligible
                      ? "cursor-not-allowed border-slate-100 bg-white opacity-40"
                      : isActive
                        ? "border-amber-400 bg-amber-50 ring-1 ring-amber-300"
                        : "border-slate-200 bg-white hover:border-amber-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{opt.label}</p>
                      <p className="text-xs text-slate-400">{opt.delayLabel}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-950">
                        {formatPublicMoney(optionTotal, currency)}
                      </p>
                      {isActive && <CheckCircle2 className="h-4 w-4 text-amber-500" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="border-b border-black/[0.05] bg-white px-6 py-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Contrôle qualité
        </p>
        <div className="space-y-2">
          {(Object.entries(QC_UPSELL_PRICING) as Array<
            [QcUpsellOption, (typeof QC_UPSELL_PRICING)[QcUpsellOption]]
          >).map(([option, config]) => {
            const isActive = selectedQcOption === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setSelectedQcOption(option)}
                className={`w-full rounded-2xl border p-3.5 text-left transition-all ${
                  isActive
                    ? "border-amber-400 bg-amber-50 ring-1 ring-amber-300"
                    : "border-slate-200 bg-slate-50/60 hover:border-amber-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{config.label}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{config.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-950">
                      {config.costXaf > 0 ? formatPublicMoney(config.costXaf, currency) : "Inclus"}
                    </p>
                    {isActive ? <CheckCircle2 className="ml-auto mt-1 h-4 w-4 text-amber-500" /> : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-b border-black/[0.05] bg-white px-6 py-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Assurance Horion
        </p>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setWithInsurance(false)}
            className={`w-full rounded-2xl border p-3.5 text-left transition-all ${
              !withInsurance
                ? "border-amber-400 bg-amber-50 ring-1 ring-amber-300"
                : "border-slate-200 bg-slate-50/60 hover:border-amber-200"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">Sans assurance additionnelle</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Horion agit comme intermédiaire et suit votre commande jusqu'à la remise au transporteur.
                </p>
              </div>
              {!withInsurance ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-amber-500" /> : null}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setWithInsurance(true)}
            className={`w-full rounded-2xl border p-3.5 text-left transition-all ${
              withInsurance
                ? "border-amber-400 bg-amber-50 ring-1 ring-amber-300"
                : "border-slate-200 bg-slate-50/60 hover:border-amber-200"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  Assurance Horion ({Math.round(INSURANCE_UPSELL_RATE * 100)}%)
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Couvre la perte, la casse et la non-conformité majeure selon les conditions Horion.
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-950">
                  {formatPublicMoney(insuranceCost, currency)}
                </p>
                {withInsurance ? <CheckCircle2 className="ml-auto mt-1 h-4 w-4 text-amber-500" /> : null}
              </div>
            </div>
          </button>
        </div>
      </div>

      <div className="space-y-6 p-6">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Paiement instantane
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {instantPaymentMethods.map((pm) => {
              const isActive = method === pm.value;
              return (
                <button
                  key={pm.value}
                  type="button"
                  onClick={() => setMethod(pm.value)}
                  className={`rounded-2xl border p-3.5 text-left transition-all ${
                    isActive ? `ring-2 ${pm.ring} bg-white shadow-sm` : `${pm.color} hover:shadow-sm`
                  }`}
                >
                  <div className={`mb-2 ${isActive ? "text-slate-900" : "text-slate-400"}`}>
                    {pm.icon}
                  </div>
                  <p className="text-xs font-semibold leading-tight text-slate-900">{pm.label}</p>
                  <p className="mt-0.5 text-[10px] leading-tight text-slate-400">{pm.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Paiement differe
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {deferredPaymentMethods.map((pm) => {
              const isActive = method === pm.value;
              return (
                <button
                  key={pm.value}
                  type="button"
                  onClick={() => setMethod(pm.value)}
                  className={`rounded-2xl border p-3.5 text-left transition-all ${
                    isActive ? `ring-2 ${pm.ring} bg-white shadow-sm` : `${pm.color} hover:shadow-sm`
                  }`}
                >
                  <div className={`mb-2 ${isActive ? "text-slate-900" : "text-slate-400"}`}>
                    {pm.icon}
                  </div>
                  <p className="text-xs font-semibold leading-tight text-slate-900">{pm.label}</p>
                  <p className="mt-0.5 text-[10px] leading-tight text-slate-400">{pm.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {method && (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm">
            {isMobileMoney ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-900">
                  <Smartphone className="h-4 w-4 text-slate-400" />
                  <p className="font-medium">
                    {isPawaPayCollection ? "Paiement mobile money" : "Numéro à débiter"}
                  </p>
                </div>
                <p className="text-xs text-slate-500">
                  {selectedPawaPayProvider
                    ? `Frais estimés ${selectedPawaPayProvider.label}: ${Math.round(
                        selectedPawaPayProvider.collectionFeePct * 10000
                      ) / 100}%.`
                    : "Des frais opérateur estimés peuvent s'appliquer."}
                </p>
                {isPawaPayCollection && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                        Pays
                      </span>
                      <select
                        value={paymentCountry}
                        onChange={(e) => setPaymentCountry(e.target.value)}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-0 focus:border-emerald-300"
                      >
                        {countryOptions.map((country) => (
                          <option key={country.code} value={country.code}>
                            {country.label} ({country.currency})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                        Operateur
                      </span>
                      <select
                        value={paymentProvider}
                        onChange={(e) => setPaymentProvider(e.target.value)}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-0 focus:border-emerald-300"
                      >
                        {providerOptions.map((provider) => (
                          <option key={provider.provider} value={provider.provider}>
                            {provider.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
                <Input
                  id="payer-phone"
                  value={payerPhone}
                  onChange={(e) => setPayerPhone(e.target.value)}
                  placeholder={isPawaPayCollection ? "Ex : 221771234567" : "Ex : 06 460 08 31"}
                  inputMode="tel"
                  className="h-11 rounded-xl"
                  required={isMobileMoney}
                />
                {isPawaPayCollection && selectedPawaPayProvider ? (
                  <p className="text-xs text-slate-500">
                    Le client voit une demande de debit sur {selectedPawaPayProvider.label}. La commande
                    ne sera confirmee qu'apres callback ou verification finale pawaPay.
                  </p>
                ) : null}
              </div>
            ) : isCardPayment ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-900">
                  <CreditCard className="h-4 w-4 text-slate-400" />
                  <p className="font-medium">Carte bancaire</p>
                </div>
                <p className="text-xs text-slate-500">
                  Vous serez redirigé vers une page de paiement securisee pour finaliser la transaction.
                </p>
                <p className="text-xs text-slate-500">
                  Horion ne stocke pas vos donnees carte. La confirmation revient ensuite automatiquement dans l'ERP.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-900">
                  <Building2 className="h-4 w-4 text-slate-400" />
                  <p className="font-medium">
                    {method === "WIRE_TRANSFER" ? "Référence du virement" : "Référence du dépôt"}
                  </p>
                </div>
                <p className="text-xs text-slate-500">
                  {method === "WIRE_TRANSFER"
                    ? "Vous pourrez téléverser votre preuve de virement. La référence est facultative à cette étape."
                    : "Un code de dépôt unique sera généré après validation pour vous aider à identifier le versement."}
                </p>
                <Input
                  id="payment-reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Ex : REF-2024-001234"
                  className="h-11 rounded-xl"
                  required={false}
                />
                {isManualPayment && (
                  <p className="text-xs text-amber-700">
                    Votre commande restera en attente tant que la preuve de paiement n’aura pas été reçue et validée.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="rounded-2xl bg-slate-950 px-5 py-4 text-white">
          <div className="flex items-center justify-between text-sm text-white/50">
            <span>Montant du devis</span>
            <span className="font-medium text-white">{formatPublicMoney(subtotalBeforeInsurance, currency)}</span>
          </div>
          {QC_UPSELL_PRICING[selectedQcOption].costXaf > 0 && (
            <div className="mt-2 flex items-center justify-between text-sm text-white/50">
              <span>QC sélectionné</span>
              <span className="font-medium text-white">
                {formatPublicMoney(QC_UPSELL_PRICING[selectedQcOption].costXaf, currency)}
              </span>
            </div>
          )}
          {insuranceCost > 0 && (
            <div className="mt-2 flex items-center justify-between text-sm text-white/50">
              <span>Assurance Horion ({Math.round(INSURANCE_UPSELL_RATE * 100)}%)</span>
              <span className="font-medium text-white">{formatPublicMoney(insuranceCost, currency)}</span>
            </div>
          )}
          {isMobileMoney && (
            <div className="mt-2 flex items-center justify-between text-sm text-white/50">
              <span>
                {selectedPawaPayProvider
                  ? `Frais Mobile Money (${Math.round(selectedPawaPayProvider.collectionFeePct * 10000) / 100}%)`
                  : "Frais opérateur (3,5%)"}
              </span>
              <span className="font-medium text-white">{formatPublicMoney(mobileMoneyFee, currency)}</span>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
            <span className="text-sm font-semibold text-white">
              {isMobileMoney ? "Montant estimé à débiter" : "Montant à régler"}
            </span>
            <span className="text-xl font-bold text-amber-400">
              {formatPublicMoney(isMobileMoney ? estimatedDebitTotal : displayedTotal, currency)}
            </span>
          </div>
        </div>

        <label
          htmlFor="cgv-accept"
          className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-all ${
            cgvAccepted
              ? "border-amber-300 bg-amber-50"
              : "border-slate-200 bg-slate-50/60"
          }`}
        >
          <input
            id="cgv-accept"
            type="checkbox"
            checked={cgvAccepted}
            onChange={(e) => setCgvAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-amber-500"
          />
          <span className="text-xs leading-5 text-slate-500">
            En cochant cette case, je confirme avoir lu et accepté les{" "}
            <a
              href="/cgv"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-600 underline"
              onClick={(e) => e.stopPropagation()}
            >
              CGV d'Horion
            </a>
            . Je comprends qu'Horion agit comme intermédiaire d'achat et que sa responsabilité
            prend fin à la remise du colis au transporteur. J'accepte la facturation au poids
            arrondi au kilo supérieur.
          </span>
        </label>

        <Button
          type="submit"
          className="h-12 w-full rounded-2xl bg-amber-500 text-base font-semibold text-white shadow-[0_4px_20px_-4px_rgba(245,158,11,0.6)] hover:bg-amber-600 disabled:opacity-50"
          disabled={!canSubmit || submitting}
        >
          {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
          {isMobileMoney
            ? isPawaPayCollection
              ? "Confirmer la demande pawaPay"
              : "Confirmer la demande Mobile Money"
            : isCardPayment
              ? "Continuer vers le paiement securise"
              : "Enregistrer le paiement"}
        </Button>

        <p className="text-center text-xs text-slate-400">
          {isManualPayment
            ? "Votre paiement est verifie manuellement par Horion avant lancement."
            : "Une confirmation operateur ou bancaire est attendue avant lancement."}
        </p>
      </div>
    </form>
  );
}
