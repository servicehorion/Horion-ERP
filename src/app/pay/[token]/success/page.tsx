import { notFound, redirect } from "next/navigation";

import { PublicPageShell } from "@/components/layout/public-page-shell";
import { ZeliaPayWidget } from "@/components/assistant/zelia-pay-widget";
import { prisma } from "@/lib/db";
import { formatPublicMoney } from "@/lib/public-money";
import { getWhatsAppUrl } from "@/lib/site-config";

export default async function PaymentSuccessPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const quote = await prisma.quote.findFirst({
    where: { paymentToken: token, isActive: true },
    select: {
      total: true,
      currency: true,
      paidAt: true,
      orderId: true,
      paymentStatus: true,
      paymentExpiry: true,
    },
  });

  if (!quote) notFound();
  if (quote.paymentStatus === "SUBMITTED") redirect(`/pay/${token}/submitted`);
  if (quote.paymentStatus !== "PAID") {
    if (quote.paymentExpiry && new Date() > quote.paymentExpiry) redirect(`/pay/${token}/expired`);
    redirect(`/pay/${token}`);
  }

  const order = await prisma.order.findUnique({
    where: { id: quote.orderId },
    select: { orderNumber: true },
  });

  const waUrl = getWhatsAppUrl(
    `Bonjour Horion, mon paiement pour la commande #${order?.orderNumber ?? ""} a été confirmé. Quelles sont les prochaines étapes ?`
  );

  const confirmedDate = quote.paidAt
    ? new Date(quote.paidAt).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const nextSteps = [
    { label: "Paiement validé par Horion", done: true },
    { label: "Sourcing & achat des produits", done: false },
    { label: "Contrôle qualité & expédition", done: false },
    { label: "Transit & dédouanement", done: false },
    { label: "Livraison à Brazzaville", done: false },
  ];

  return (
    <PublicPageShell step={3}>
      <div className="mx-auto max-w-lg space-y-6">
        {/* Success card */}
        <div className="rounded-3xl border border-black/[0.07] bg-white shadow-[0_20px_64px_-24px_rgba(15,23,42,0.18)] overflow-hidden">
          <div className="bg-gradient-to-br from-emerald-50 via-white to-white px-8 py-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-9 w-9 text-emerald-600" viewBox="0 0 24 24" fill="none">
                <path
                  d="M20 6L9 17l-5-5"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1 className="mt-4 text-2xl font-semibold text-slate-950">Paiement confirmé !</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Horion a validé votre paiement. Votre dossier est maintenant en exécution.
            </p>
          </div>

          <div className="border-t border-black/[0.05] px-8 py-6 text-sm">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Référence commande</span>
                <span className="font-semibold text-slate-950">#{order?.orderNumber ?? "-"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Montant réglé</span>
                <span className="font-semibold text-emerald-700">
                  {formatPublicMoney(Number(quote.total), quote.currency)}
                </span>
              </div>
              {confirmedDate && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Confirmé le</span>
                  <span className="font-semibold text-slate-950">{confirmedDate}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Journey tracker */}
        <div className="rounded-3xl border border-black/[0.07] bg-white px-6 py-6 shadow-[0_16px_48px_-20px_rgba(15,23,42,0.12)]">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Votre commande — étapes à venir
          </p>
          <div className="space-y-3.5">
            {nextSteps.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    step.done
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {step.done ? (
                    <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none">
                      <path d="M2.5 7l3 3 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : i + 1}
                </div>
                <p className={`text-sm ${step.done ? "font-semibold text-emerald-700" : "text-slate-500"}`}>
                  {step.label}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
            Horion vous tient informé à chaque étape clé. Votre Community Manager vous contactera sous peu.
          </p>
        </div>

        {/* CTAs */}
        <div className="space-y-2.5">
          <a
            href={`/pay/${token}/receipt`}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-900 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 3v12m0 0l-4-4m4 4l4-4M5 17v2a2 2 0 002 2h10a2 2 0 002-2v-2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Télécharger mon reçu
          </a>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 font-semibold text-white shadow-[0_4px_16px_-4px_rgba(5,150,105,0.5)] transition hover:bg-emerald-700"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Suivre ma commande sur WhatsApp
          </a>
        </div>
      </div>
      <ZeliaPayWidget token={token} page="success" />
    </PublicPageShell>
  );
}
