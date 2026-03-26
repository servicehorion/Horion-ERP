"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Mail,
  MessageCircle,
  Package,
  ShieldCheck,
  Truck,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ZeliaPayWidget } from "@/components/assistant/zelia-pay-widget";
import { Input } from "@/components/ui/input";
import { PublicPageShell } from "@/components/layout/public-page-shell";
import { acceptQuoteAndPreparePaymentByToken, rejectQuoteByToken } from "@/lib/actions/order.actions";
import { getWhatsAppUrl } from "@/lib/site-config";
import { formatPublicMoney } from "@/lib/public-money";
import { formatDate } from "@/lib/utils";

type QuoteTransportOption = {
  key: string;
  label: string;
  delayLabel: string;
  costXAF: number;
};

type QuoteLine = {
  index: number;
  description: string;
  quantity: number;
  productSellXAF: number;
  serviceFeeXAF: number;
  selectedTransport?: QuoteTransportOption | null;
  transportOptions: QuoteTransportOption[];
};

type QuoteView = {
  id: string;
  status: string;
  orderNumber: string;
  total: number;
  merchandiseTotal: number;
  logisticsCost: number;
  commission: number;
  insuranceCost?: number;
  currency: string;
  paymentToken?: string | null;
  paymentStatus?: string | null;
  validUntil?: Date | null;
  signedAt?: Date | null;
  contactName?: string | null;
  recipientHint?: string | null;
  companyEmail?: string | null;
  companyWhatsapp?: string | null;
  items: QuoteLine[];
};

const CARD = "rounded-3xl border border-black/[0.07] bg-white shadow-[0_16px_56px_-20px_rgba(15,23,42,0.15)]";

export function QuoteSignature({ quote, token }: { quote: QuoteView; token: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [transportSelections, setTransportSelections] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      quote.items
        .filter((item) => item.transportOptions.length > 0)
        .map((item) => [
          String(item.index),
          item.selectedTransport?.key || item.transportOptions[0]?.key || "",
        ])
    )
  );

  const computed = useMemo(() => {
    const items = quote.items.map((item) => {
      const selected =
        item.transportOptions.find((opt) => opt.key === transportSelections[String(item.index)]) ??
        item.selectedTransport ??
        item.transportOptions[0] ??
        null;
      return {
        ...item,
        selectedTransport: selected,
        lineGrandTotal: item.productSellXAF + item.serviceFeeXAF + Number(selected?.costXAF ?? 0),
      };
    });
    const merchandiseTotal = items.reduce((s, i) => s + i.productSellXAF, 0);
    const logisticsCost = items.reduce((s, i) => s + Number(i.selectedTransport?.costXAF ?? 0), 0);
    const commission = items.reduce((s, i) => s + i.serviceFeeXAF, 0);
    const insuranceCost = Number(quote.insuranceCost ?? 0);
    const total = merchandiseTotal + logisticsCost + commission + insuranceCost;
    return { items, merchandiseTotal, logisticsCost, commission, insuranceCost, total };
  }, [quote.items, quote.insuranceCost, transportSelections]);

  async function handleAccept() {
    if (!name.trim()) { toast.error("Nom requis"); return; }
    if (!email.trim()) { toast.error("Email requis"); return; }
    setLoading(true);
    try {
      const res = await acceptQuoteAndPreparePaymentByToken(
        token,
        { name: name.trim(), email: email.trim() },
        transportSelections
      );
      if (res.error) { toast.error(res.error); return; }
      toast.success("Devis accepté — redirection vers le paiement...");
      router.push(`/pay/${res.data?.paymentToken ?? ""}`);
      router.refresh();
    } catch {
      toast.error("Erreur lors de la préparation du paiement");
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    if (!email.trim()) { toast.error("Email requis"); return; }
    setLoading(true);
    try {
      const res = await rejectQuoteByToken(token, { name: name.trim() || undefined, email: email.trim() });
      if (res.error) toast.error(res.error);
      else { toast.success("Devis refusé"); setShowRejectConfirm(false); }
    } catch {
      toast.error("Erreur");
    } finally {
      setLoading(false);
    }
  }

  const isAcceptedAwaitingPayment = quote.status === "ACCEPTED" && quote.paymentStatus !== "PAID";
  const isFinal = ["REJECTED", "EXPIRED"].includes(quote.status);
  const whatsappUrl = getWhatsAppUrl(
    `Bonjour Horion, j'ai une question sur le devis ${quote.orderNumber}.`
  );

  return (
    <PublicPageShell step={1}>
      <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
        {/* ── LEFT COLUMN ── */}
        <div className="space-y-6">
          {/* Hero card */}
          <div className={`${CARD} overflow-hidden`}>
            <div className="bg-gradient-to-br from-amber-50 via-white to-white px-6 py-7 sm:px-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">
                    <Package className="h-3 w-3" />
                    Devis Horion
                  </span>
                  <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                      Validez votre devis
                    </h1>
                    <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">
                      Vérifiez chaque ligne, ajustez le transport si besoin, puis confirmez pour passer au paiement.
                    </p>
                  </div>
                </div>
                <div className="shrink-0 rounded-2xl border border-amber-100 bg-white px-4 py-3 text-sm shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-[0.15em] text-slate-400">Référence</p>
                  <p className="mt-0.5 font-semibold text-slate-950">#{quote.orderNumber}</p>
                  {quote.contactName && <p className="mt-1 text-slate-600">{quote.contactName}</p>}
                  {quote.validUntil && (
                    <p className="mt-1 text-xs text-amber-700">
                      Valable jusqu{"'"}au {formatDate(quote.validUntil)}
                    </p>
                  )}
                </div>
              </div>
            </div>
            {/* Process steps */}
            <div className="grid grid-cols-3 divide-x divide-black/[0.05] border-t border-black/[0.05] text-center text-xs">
              {[
                { label: "Prix intégré", sub: "Horion inclus" },
                { label: "Transport", sub: "Ajustable" },
                { label: "Paiement", sub: "Immédiat après" },
              ].map((item) => (
                <div key={item.label} className="px-3 py-3 sm:py-4">
                  <p className="font-semibold text-slate-800">{item.label}</p>
                  <p className="mt-0.5 text-slate-400">{item.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Articles */}
          <div className={CARD}>
            <div className="border-b border-black/[0.05] px-6 py-5 sm:px-8">
              <h2 className="text-lg font-semibold text-slate-950">Articles & transport</h2>
              <p className="mt-1 text-sm text-slate-500">
                Le prix affiché inclut le coût produit et la marge Horion.
              </p>
            </div>
            <div className="space-y-4 p-6 sm:p-8">
              {computed.items.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
                  Aucun détail disponible pour ce devis.
                </p>
              ) : (
                computed.items.map((item) => (
                  <div
                    key={item.index}
                    className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 sm:p-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <p className="font-semibold text-slate-950">{item.description}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">
                            Qté : {item.quantity}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">
                            Prix Horion : {formatPublicMoney(item.productSellXAF, quote.currency)}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 rounded-xl border border-amber-100 bg-white px-4 py-2.5 text-right">
                        <p className="text-xs text-slate-400">Total ligne</p>
                        <p className="mt-0.5 text-base font-semibold text-slate-950">
                          {formatPublicMoney(item.lineGrandTotal, quote.currency)}
                        </p>
                      </div>
                    </div>

                    {item.transportOptions.length > 0 && (
                      <div className="mt-4">
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                          <Truck className="h-3.5 w-3.5" />
                          Mode de transport
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {item.transportOptions.map((opt) => {
                            const isSelected = transportSelections[String(item.index)] === opt.key;
                            return (
                              <button
                                key={opt.key}
                                type="button"
                                onClick={() =>
                                  setTransportSelections((c) => ({
                                    ...c,
                                    [String(item.index)]: opt.key,
                                  }))
                                }
                                className={`rounded-xl border p-3 text-left text-sm transition-all ${
                                  isSelected
                                    ? "border-amber-400 bg-amber-50 shadow-sm ring-1 ring-amber-300"
                                    : "border-slate-200 bg-white hover:border-amber-200"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="font-medium text-slate-900">{opt.label}</p>
                                    <p className="text-xs text-slate-500">{opt.delayLabel}</p>
                                  </div>
                                  {isSelected && (
                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                                  )}
                                </div>
                                <p className="mt-2 font-semibold text-slate-950">
                                  {formatPublicMoney(opt.costXAF, quote.currency)}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Validation */}
          {!isFinal ? (
            <div className={CARD}>
              <div className="border-b border-black/[0.05] px-6 py-5 sm:px-8">
                <h2 className="text-lg font-semibold text-slate-950">Votre confirmation</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {quote.recipientHint
                    ? `Utilisez l'adresse qui a reçu ce lien (${quote.recipientHint}).`
                    : "Renseignez votre nom et email pour confirmer."}
                </p>
              </div>
              <div className="space-y-5 p-6 sm:p-8">
                {quote.signedAt && (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    Devis signé le {formatDate(quote.signedAt)}
                  </div>
                )}

                {isAcceptedAwaitingPayment ? (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      Ce devis est déjà accepté. Poursuivez vers le paiement.
                    </div>
                    {quote.paymentToken && (
                      <Button
                        className="h-12 w-full rounded-2xl bg-slate-950 text-white hover:bg-slate-800"
                        onClick={() => router.push(`/pay/${quote.paymentToken}`)}
                      >
                        Continuer vers le paiement
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-600" htmlFor="sig-name">
                          Votre nom complet
                        </label>
                        <Input
                          id="sig-name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Jean Dupont"
                          className="h-11 rounded-xl"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-600" htmlFor="sig-email">
                          Email de réception du devis
                        </label>
                        <Input
                          id="sig-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="jean@example.com"
                          className="h-11 rounded-xl"
                        />
                      </div>
                    </div>

                    {!showRejectConfirm ? (
                      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <Button
                          variant="ghost"
                          className="h-11 rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                          onClick={() => setShowRejectConfirm(true)}
                          disabled={loading}
                        >
                          <X className="mr-1.5 h-4 w-4" />
                          Refuser ce devis
                        </Button>
                        <Button
                          className="h-11 rounded-xl bg-amber-500 px-6 font-semibold text-white hover:bg-amber-600"
                          onClick={handleAccept}
                          disabled={loading || !name.trim() || !email.trim()}
                        >
                          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Accepter et passer au paiement
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
                        <p className="text-sm font-medium text-rose-900">
                          Confirmer le refus du devis ?
                        </p>
                        <p className="mt-1 text-xs text-rose-700">
                          Cette action est définitive. Contactez Horion si vous souhaitez un nouveau devis.
                        </p>
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl"
                            onClick={() => setShowRejectConfirm(false)}
                          >
                            Annuler
                          </Button>
                          <Button
                            size="sm"
                            className="rounded-xl bg-rose-600 text-white hover:bg-rose-700"
                            onClick={handleReject}
                            disabled={loading}
                          >
                            {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                            Confirmer le refus
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className={`${CARD} px-6 py-5 text-sm text-slate-500`}>
              Ce devis est {quote.status === "REJECTED" ? "refusé" : "expiré"}.
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="space-y-5">
          {/* Financial summary */}
          <div className={CARD}>
            <div className="border-b border-black/[0.05] px-6 py-5">
              <h2 className="text-base font-semibold text-slate-950">Récapitulatif</h2>
            </div>
            <div className="space-y-3 p-6 text-sm">
              <div className="flex items-center justify-between text-slate-600">
                <span>Prix Horion produits</span>
                <span className="font-medium text-slate-950">
                  {formatPublicMoney(computed.merchandiseTotal, quote.currency)}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Transport</span>
                <span className="font-medium text-slate-950">
                  {formatPublicMoney(computed.logisticsCost, quote.currency)}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Accompagnement Horion</span>
                <span className="font-medium text-slate-950">
                  {formatPublicMoney(computed.commission, quote.currency)}
                </span>
              </div>
              {computed.insuranceCost > 0 && (
                <div className="flex items-center justify-between text-slate-600">
                  <span>Assurance</span>
                  <span className="font-medium text-slate-950">
                    {formatPublicMoney(computed.insuranceCost, quote.currency)}
                  </span>
                </div>
              )}
              <div className="mt-2 rounded-2xl bg-slate-950 px-5 py-4 text-white">
                <p className="text-xs uppercase tracking-[0.18em] text-white/50">Total à payer</p>
                <p className="mt-1.5 text-2xl font-semibold">
                  {formatPublicMoney(computed.total, quote.currency)}
                </p>
                <p className="mt-1 text-xs text-white/40">Transport ajustable ci-contre</p>
              </div>
            </div>
          </div>

          {/* Contact Horion */}
          <div className={CARD}>
            <div className="border-b border-black/[0.05] px-6 py-5">
              <h2 className="text-base font-semibold text-slate-950">Besoin d{"'"}aide ?</h2>
            </div>
            <div className="space-y-3 p-6 text-sm">
              <a
                href={`mailto:${quote.companyEmail}`}
                className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 transition hover:bg-slate-100"
              >
                <Mail className="h-4 w-4 text-slate-400" />
                <div>
                  <p className="font-medium text-slate-900">Email</p>
                  <p className="text-xs text-slate-500">{quote.companyEmail}</p>
                </div>
              </a>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 transition hover:bg-emerald-100"
              >
                <MessageCircle className="h-4 w-4 text-emerald-600" />
                <div>
                  <p className="font-medium text-emerald-900">WhatsApp</p>
                  <p className="text-xs text-emerald-700">{quote.companyWhatsapp}</p>
                </div>
              </a>
              <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-xs leading-5 text-amber-900">
                  Horion prend en charge l{"'"}import de A à Z — sourcing, transport, dédouanement, livraison à Brazzaville.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ZeliaPayWidget token={token} page="quote" />
    </PublicPageShell>
  );
}
