"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, ExternalLink, MessageCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import { confirmPayment, rejectPaymentProof } from "@/lib/actions/payment.actions";
import { getPaymentMethodLabel } from "@/lib/payments/config";
import { formatDate } from "@/lib/utils";

type Payment = {
  id: string;
  amountXAF: number;
  method: string | null;
  status: string;
  proofUrl: string | null;
  proofDownloadUrl?: string | null;
  depositCode: string | null;
  proofUploadedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  order: {
    id: string;
    orderNumber: string;
    contact: {
      name: string | null;
      phone?: string | null;
      whatsapp?: string | null;
    } | null;
  };
};

function normalizeWhatsappPhone(value?: string | null) {
  return (value || "").replace(/\D/g, "");
}

function buildPaymentReminderLink(payment: Payment) {
  const phone = normalizeWhatsappPhone(payment.order.contact?.whatsapp || payment.order.contact?.phone);
  if (!phone) return null;

  const customerName = payment.order.contact?.name?.trim() || "Bonjour";
  const expiresLabel = payment.expiresAt ? formatDate(payment.expiresAt) : null;
  const message = [
    `Bonjour ${customerName},`,
    `Horion attend toujours votre preuve de paiement pour la commande ${payment.order.orderNumber}.`,
    payment.depositCode ? `Code de depot a rappeler: ${payment.depositCode}.` : null,
    expiresLabel ? `Merci de nous l'envoyer avant le ${expiresLabel}.` : "Merci de nous l'envoyer des que possible.",
  ]
    .filter(Boolean)
    .join(" ");

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function ProofCard({ payment, mode }: { payment: Payment; mode: "review" | "waiting" }) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  if (done) return null;

  const expiresAt = payment.expiresAt ? new Date(payment.expiresAt) : null;
  const now = new Date();
  const msLeft = expiresAt ? expiresAt.getTime() - now.getTime() : null;
  const hoursLeft = msLeft != null ? Math.floor(msLeft / 3_600_000) : null;
  const isUrgent = hoursLeft != null && hoursLeft < 8;
  const reminderLink = mode === "waiting" ? buildPaymentReminderLink(payment) : null;

  function handleConfirm() {
    startTransition(async () => {
      const res = await confirmPayment(payment.id);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success("Paiement validé — commande lancée.");
        setDone(true);
      }
    });
  }

  function handleReject() {
    startTransition(async () => {
      const res = await rejectPaymentProof(payment.id);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success("Preuve rejetee - client notifie.");
        setDone(true);
      }
    });
  }

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        mode === "review"
          ? "border-sky-200 bg-sky-50/60"
          : isUrgent
            ? "border-rose-200 bg-rose-50/60"
            : "border-amber-100 bg-amber-50/40"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Link
              href={`/orders/${payment.order.id}`}
              className="font-semibold text-slate-900 hover:underline"
            >
              {payment.order.orderNumber}
            </Link>
            <Badge variant="outline" className="text-xs">
              {getPaymentMethodLabel(payment.method) ?? payment.method ?? "-"}
            </Badge>
            {payment.depositCode && (
              <Badge variant="outline" className="font-mono text-xs text-slate-500">
                {payment.depositCode}
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-500">{payment.order.contact?.name ?? "-"}</p>
          {payment.proofUploadedAt && (
            <p className="text-xs text-slate-400">
              Preuve recue le {formatDate(payment.proofUploadedAt)}
            </p>
          )}
          {mode === "waiting" && expiresAt && (
            <p className={`text-xs font-medium ${isUrgent ? "text-rose-600" : "text-amber-600"}`}>
              {hoursLeft != null && hoursLeft > 0 ? `Expire dans ${hoursLeft}h` : "Delai depasse"}
            </p>
          )}
        </div>

        <div className="text-right">
          <p className="text-lg font-bold text-slate-900">
            <CurrencyDisplay amount={payment.amountXAF} currency="XAF" />
          </p>
          <p className="text-xs text-slate-400">{formatDate(payment.createdAt)}</p>
        </div>
      </div>

      {mode === "review" && (
        <div className="mt-4 space-y-3">
          {(payment.proofDownloadUrl || payment.proofUrl) && (
            <a
              href={payment.proofDownloadUrl || payment.proofUrl || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-50"
            >
              <ExternalLink className="h-4 w-4" />
              Voir la preuve de paiement
            </a>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={isPending}
              className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              Valider l'encaissement
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleReject}
              disabled={isPending}
              className="flex-1 border-rose-200 text-rose-700 hover:bg-rose-50"
            >
              <XCircle className="mr-1.5 h-4 w-4" />
              Rejeter
            </Button>
          </div>
        </div>
      )}

      {mode === "waiting" && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Clock className={`h-4 w-4 ${isUrgent ? "text-rose-500" : "text-amber-500"}`} />
            <p className="text-xs text-slate-500">
              En attente de la preuve client.
            </p>
          </div>
          {reminderLink ? (
            <a
              href={reminderLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
            >
              <MessageCircle className="h-4 w-4" />
              Relancer via WhatsApp
            </a>
          ) : (
            <p className="text-xs text-slate-400">Aucun numero WhatsApp exploitable sur ce contact.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function ProofReviewList({ payments }: { payments: Payment[] }) {
  if (payments.length === 0) {
    return (
      <EmptyState
        title="Aucune preuve à vérifier"
        description="Les preuves de paiement envoyees par les clients apparaitront ici."
      />
    );
  }

  return (
    <div className="space-y-3">
      {payments.map((payment) => (
        <ProofCard key={payment.id} payment={payment} mode="review" />
      ))}
    </div>
  );
}

export function WaitingList({ payments }: { payments: Payment[] }) {
  if (payments.length === 0) {
    return (
      <EmptyState
        title="Aucun paiement en attente"
        description="Les paiements differes en attente de preuve apparaitront ici."
      />
    );
  }

  return (
    <div className="space-y-3">
      {payments.map((payment) => (
        <ProofCard key={payment.id} payment={payment} mode="waiting" />
      ))}
    </div>
  );
}
