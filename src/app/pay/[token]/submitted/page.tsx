import { notFound, redirect } from "next/navigation";

import { PublicPageShell } from "@/components/layout/public-page-shell";
import { ZeliaPayWidget } from "@/components/assistant/zelia-pay-widget";
import { prisma } from "@/lib/db";
import { getPaymentMethodLabel, isManualPaymentMethod, normalizePaymentMethod } from "@/lib/payments/config";
import { formatPublicMoney } from "@/lib/public-money";
import { getWhatsAppUrl } from "@/lib/site-config";
import { PaymentDeadline } from "@/app/pay/[token]/payment-deadline";
import { ProofUploadForm } from "@/app/pay/[token]/proof-upload-form";

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

export default async function PaymentSubmittedPage({
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
      paymentMethod: true,
      orderId: true,
      paymentStatus: true,
      paymentExpiry: true,
      order: {
        select: {
          payments: {
            where: {
              direction: "INBOUND",
              status: { in: ["PENDING_PROOF", "PROOF_UPLOADED", "PROOF_REJECTED"] },
            },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              depositCode: true,
              status: true,
              expiresAt: true,
              proofUploadedAt: true,
            },
          },
        },
      },
    },
  });

  if (!quote) notFound();
  if (quote.paymentStatus === "PAID") redirect(`/pay/${token}/success`);

  if (quote.paymentStatus !== "SUBMITTED") {
    if (quote.paymentExpiry && new Date() > quote.paymentExpiry) {
      redirect(`/pay/${token}/expired`);
    }
    redirect(`/pay/${token}`);
  }

  const order = await prisma.order.findUnique({
    where: { id: quote.orderId },
    select: { orderNumber: true },
  });

  const waUrl = getWhatsAppUrl(
    `Bonjour Horion, j'ai soumis mon paiement pour la commande #${order?.orderNumber ?? ""}. Pouvez-vous confirmer la reception ?`
  );
  const methodLabel = quote.paymentMethod ? getPaymentMethodLabel(quote.paymentMethod) : null;
  const normalizedMethod = quote.paymentMethod ? normalizePaymentMethod(quote.paymentMethod) : null;
  const isManual = normalizedMethod ? isManualPaymentMethod(normalizedMethod) : false;
  const pendingPayment = quote.order?.payments?.[0] ?? null;
  const needsProofUpload = isManual && pendingPayment?.status === "PENDING_PROOF";
  const proofRejected = isManual && pendingPayment?.status === "PROOF_REJECTED";
  const proofUploaded = isManual && pendingPayment?.status === "PROOF_UPLOADED";

  const steps = [
    { label: "Paiement soumis", done: true, active: false },
    { label: "Verification Horion", done: false, active: true },
    { label: "Execution de la commande", done: false, active: false },
  ];

  return (
    <PublicPageShell step={3}>
      <div className="mx-auto max-w-lg space-y-6">
        <div className="overflow-hidden rounded-3xl border border-black/[0.07] bg-white shadow-[0_20px_64px_-24px_rgba(15,23,42,0.18)]">
          <div className="bg-gradient-to-br from-blue-50 via-white to-white px-8 py-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <svg className="h-8 w-8 text-blue-600" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2v10m0 0l3-3m-3 3l-3-3"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M3 15v4a2 2 0 002 2h14a2 2 0 002-2v-4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h1 className="mt-4 text-2xl font-semibold text-slate-950">Paiement recu</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Votre demande a bien ete enregistree. Horion verifie la transaction avant de lancer votre commande.
            </p>
          </div>

          <div className="border-t border-black/[0.05] px-8 py-6 text-sm">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Reference</span>
                <span className="font-semibold text-slate-950">#{order?.orderNumber ?? "-"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Montant</span>
                <span className="font-semibold text-slate-950">
                  {formatPublicMoney(Number(quote.total), quote.currency)}
                </span>
              </div>
              {methodLabel && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Methode</span>
                  <span className="font-semibold text-slate-950">{methodLabel}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-black/[0.07] bg-white px-6 py-6 shadow-[0_16px_48px_-20px_rgba(15,23,42,0.12)]">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Prochaines etapes
          </p>
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div key={step.label} className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    step.done
                      ? "bg-emerald-500 text-white"
                      : step.active
                        ? "bg-blue-500 text-white ring-4 ring-blue-100"
                        : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {step.done ? (
                    <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M2.5 7l3 3 6-6"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <div>
                  <p
                    className={`text-sm font-medium ${
                      step.active
                        ? "text-slate-950"
                        : step.done
                          ? "text-emerald-700"
                          : "text-slate-400"
                    }`}
                  >
                    {step.label}
                  </p>
                  {step.active && (
                    <p className="text-xs text-slate-400">Generalement sous 24h ouvrables</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {(needsProofUpload || proofRejected) && pendingPayment && (
          <div className="space-y-2">
            {proofRejected && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-800">
                Votre preuve precedente a ete rejetee. Merci d'en soumettre une nouvelle.
              </div>
            )}
            <ProofUploadForm
              token={token}
              paymentId={pendingPayment.id}
              depositCode={pendingPayment.depositCode}
              methodLabel={methodLabel}
            />
          </div>
        )}

        {isManual && pendingPayment && (
          <div className="rounded-3xl border border-black/[0.07] bg-white px-6 py-6 shadow-[0_16px_48px_-20px_rgba(15,23,42,0.12)]">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Paiement differe
            </p>
            <div className="space-y-3 text-sm text-slate-600">
              {pendingPayment.depositCode && (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                  <span className="text-slate-400">Code de depot</span>
                  <span className="font-semibold text-slate-950">{pendingPayment.depositCode}</span>
                </div>
              )}
              {pendingPayment.expiresAt && (
                <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
                  <p className="font-medium text-slate-950">
                    Temps restant: <PaymentDeadline expiresAt={pendingPayment.expiresAt.toISOString()} />
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Votre devis et votre reservation sont maintenus jusqu'au{" "}
                    <span className="font-medium text-slate-700">
                      {formatDateTime(pendingPayment.expiresAt)}
                    </span>
                    .
                  </p>
                </div>
              )}
              {proofUploaded && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  Votre preuve a bien ete recue par Horion. Notre equipe confirme l'encaissement avant de lancer la commande.
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2.5">
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 font-semibold text-white shadow-[0_4px_16px_-4px_rgba(5,150,105,0.5)] transition hover:bg-emerald-700"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Contacter Horion sur WhatsApp
          </a>
        </div>
      </div>
      <ZeliaPayWidget token={token} page="submitted" />
    </PublicPageShell>
  );
}
