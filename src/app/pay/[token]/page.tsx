import { notFound, redirect } from "next/navigation";

import { PublicPageShell } from "@/components/layout/public-page-shell";
import { ZeliaPayWidget } from "@/components/assistant/zelia-pay-widget";
import { prisma } from "@/lib/db";
import { formatPublicMoney } from "@/lib/public-money";

import { PaymentForm } from "./payment-form";

export const dynamic = "force-dynamic";

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function PaymentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const quote = await prisma.quote.findFirst({
    where: { paymentToken: token, isActive: true },
    select: {
      id: true,
      orderId: true,
      version: true,
      currency: true,
      merchandiseTotal: true,
      logisticsCost: true,
      commission: true,
      insuranceCost: true,
      qcOption: true,
      qcCost: true,
      total: true,
      paymentStatus: true,
      paymentExpiry: true,
      pricingSnapshot: true,
    },
  });

  if (!quote) notFound();

  if (quote.paymentStatus === "PAID") redirect(`/pay/${token}/success`);
  if (quote.paymentStatus === "SUBMITTED") redirect(`/pay/${token}/submitted`);

  if (quote.paymentExpiry && new Date() > quote.paymentExpiry) {
    if (quote.paymentStatus !== "EXPIRED") {
      await prisma.quote.update({ where: { id: quote.id }, data: { paymentStatus: "EXPIRED" } });
    }
    redirect(`/pay/${token}/expired`);
  }

  const order = await prisma.order.findUnique({
    where: { id: quote.orderId },
    select: {
      orderNumber: true,
      notes: true,
      contact: { select: { name: true, company: true, email: true } },
    },
  });

  const snapshot = (quote.pricingSnapshot ?? {}) as Record<string, unknown>;
  const isIndicatifQuote = snapshot.source === "SOURCING_INDICATIF";
  const items = Array.isArray(snapshot.items)
    ? (snapshot.items as Array<Record<string, unknown>>)
    : [];

  type TransportOption = {
    key: string;
    label: string;
    delayLabel: string;
    totalCostXAF: number;
    eligible: boolean;
  };
  let aggregatedTransportOptions: TransportOption[] | null = null;
  let currentTransportKey: string | null = null;
  const baseAmount =
    Number(quote.merchandiseTotal) +
    Number(quote.commission);

  if (isIndicatifQuote && items.length > 0) {
    const costByKey: Record<string, number> = {};
    const metaByKey: Record<string, { label: string; delayLabel: string; eligible: boolean }> = {};

    for (const item of items) {
      const opts = Array.isArray(item.transportOptions)
        ? (item.transportOptions as Array<Record<string, unknown>>)
        : [];
      for (const opt of opts) {
        const key = String(opt.key ?? "");
        if (!key) continue;
        costByKey[key] = (costByKey[key] ?? 0) + Number(opt.costXAF ?? 0);
        if (!metaByKey[key]) {
          metaByKey[key] = {
            label: String(opt.label ?? key),
            delayLabel: String(opt.delayLabel ?? ""),
            eligible: Boolean(opt.eligible !== false),
          };
        }
      }
      if (!currentTransportKey) {
        const sel = item.selectedTransport as Record<string, unknown> | undefined;
        if (sel?.key) currentTransportKey = String(sel.key);
      }
    }

    if (Object.keys(costByKey).length > 0) {
      aggregatedTransportOptions = Object.entries(costByKey).map(([key, totalCostXAF]) => ({
        key,
        totalCostXAF,
        ...metaByKey[key],
      }));
    }
  }

  const clientName = order?.contact?.name ?? "Client Horion";
  const clientCompany = order?.contact?.company;

  return (
    <PublicPageShell step={2}>
      <div className="grid gap-8 lg:grid-cols-[1.35fr_0.65fr]">
        {/* ── LEFT: Order summary ── */}
        <div className="space-y-5">
          {/* Header card */}
          <div className="rounded-3xl border border-black/[0.07] bg-white shadow-[0_16px_56px_-20px_rgba(15,23,42,0.14)] overflow-hidden">
            <div className="bg-gradient-to-br from-amber-50 via-white to-white px-6 py-6 sm:px-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">
                    Paiement du devis
                  </span>
                  <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                    Finalisez votre paiement
                  </h1>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Le montant est calculé en temps réel selon le transport choisi.
                  </p>
                </div>
                <div className="shrink-0 rounded-2xl border border-amber-100 bg-white px-4 py-3 text-sm shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-[0.15em] text-slate-400">Référence</p>
                  <p className="mt-0.5 font-semibold text-slate-950">#{order?.orderNumber ?? "-"}</p>
                  <p className="mt-1 text-slate-600">{clientName}</p>
                  {clientCompany && <p className="text-xs text-slate-400">{clientCompany}</p>}
                  {quote.paymentExpiry && (
                    <p className="mt-1.5 text-xs font-medium text-rose-600">
                      Expire le {formatDateTime(quote.paymentExpiry)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Articles */}
          {items.length > 0 && (
            <div className="rounded-3xl border border-black/[0.07] bg-white shadow-[0_16px_56px_-20px_rgba(15,23,42,0.14)]">
              <div className="border-b border-black/[0.05] px-6 py-5 sm:px-8">
                <h2 className="font-semibold text-slate-950">Détail du devis</h2>
                <p className="mt-0.5 text-sm text-slate-400">{items.length} article(s)</p>
              </div>
              <div className="space-y-3 p-6 sm:p-8">
                {items.map((item, index) => {
                  const transport = (item.selectedTransport ?? {}) as Record<string, unknown>;
                  return (
                    <div
                      key={`${String(item.description ?? index)}-${index}`}
                      className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-1">
                        <p className="font-medium text-slate-950">
                          {String(item.description ?? item.name ?? `Article ${index + 1}`)}
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                          <span>Qté : {String(item.quantity ?? "-")}</span>
                          <span>·</span>
                          <span>
                            Prix Horion : {formatPublicMoney(Number(item.productSellXAF ?? 0), quote.currency)}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 rounded-xl bg-white px-3 py-2 text-right shadow-sm">
                        <p className="text-xs text-slate-400">Transport</p>
                        <p className="text-sm font-semibold text-slate-950">
                          {String(transport.label ?? item.transportLabel ?? "À confirmer")}
                        </p>
                        <p className="text-xs text-slate-400">
                          {String(transport.delayLabel ?? item.delayLabel ?? "")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Financial recap */}
          <div className="rounded-3xl bg-slate-950 p-6 shadow-[0_24px_64px_-28px_rgba(15,23,42,0.55)] sm:p-8">
            <h2 className="text-base font-semibold text-white">Récapitulatif financier</h2>
            {isIndicatifQuote && (
              <p className="mt-1 text-xs text-white/40">
                Le total est mis à jour si vous changez le transport à droite.
              </p>
            )}
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex items-center justify-between text-white/60">
                <span>Prix Horion produits</span>
                <span className="font-medium text-white">
                  {formatPublicMoney(Number(quote.merchandiseTotal), quote.currency)}
                </span>
              </div>
              <div className="flex items-center justify-between text-white/60">
                <span>Transport</span>
                <span className="font-medium text-white">
                  {formatPublicMoney(Number(quote.logisticsCost), quote.currency)}
                </span>
              </div>
              <div className="flex items-center justify-between text-white/60">
                <span>Accompagnement Horion</span>
                <span className="font-medium text-white">
                  {formatPublicMoney(Number(quote.commission), quote.currency)}
                </span>
              </div>
              {Number(quote.qcCost ?? 0) > 0 && (
                <div className="flex items-center justify-between text-white/60">
                  <span>Contrôle qualité</span>
                  <span className="font-medium text-white">
                    {formatPublicMoney(Number(quote.qcCost ?? 0), quote.currency)}
                  </span>
                </div>
              )}
              {Number(quote.insuranceCost ?? 0) > 0 && (
                <div className="flex items-center justify-between text-white/60">
                  <span>Assurance Horion</span>
                  <span className="font-medium text-white">
                    {formatPublicMoney(Number(quote.insuranceCost ?? 0), quote.currency)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-white/10 pt-4">
                <span className="text-base font-semibold text-white">Total à payer</span>
                <span className="text-xl font-semibold text-amber-400">
                  {formatPublicMoney(Number(quote.total), quote.currency)}
                </span>
              </div>
            </div>
          </div>

          {order?.notes && (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm text-amber-900">
              <p className="mb-1 font-semibold">Note Horion</p>
              <p>{order.notes}</p>
            </div>
          )}
        </div>

        {/* ── RIGHT: Payment form ── */}
        <div>
          <PaymentForm
            token={token}
            total={Number(quote.total)}
            currency={quote.currency}
            transportOptions={aggregatedTransportOptions ?? undefined}
            currentTransportKey={currentTransportKey ?? undefined}
            baseAmount={baseAmount}
            currentLogisticsCost={Number(quote.logisticsCost)}
            currentInsuranceCost={Number(quote.insuranceCost ?? 0)}
            currentQcOption={(quote.qcOption as any) ?? "NONE"}
            currentQcCost={Number(quote.qcCost ?? 0)}
          />
        </div>
      </div>
      <ZeliaPayWidget token={token} page="pay" />
    </PublicPageShell>
  );
}
