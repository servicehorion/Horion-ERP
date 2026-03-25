import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/layout/brand-logo";
import { prisma } from "@/lib/db";
import { formatPublicMoney } from "@/lib/public-money";
import { getWhatsAppUrl } from "@/lib/site-config";

export default async function VerificationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const quote = await prisma.quote.findFirst({
    where: { paymentToken: token, isActive: true },
    select: {
      version: true,
      currency: true,
      total: true,
      paymentStatus: true,
      paymentExpiry: true,
      orderId: true,
    },
  });

  if (!quote) notFound();

  const order = await prisma.order.findUnique({
    where: { id: quote.orderId },
    select: {
      orderNumber: true,
      status: true,
      contact: { select: { name: true, company: true } },
    },
  });

  const WA_URL = getWhatsAppUrl(`Bonjour Horion, je souhaite verifier le devis ${order?.orderNumber ?? ""}.`);

  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-6 shadow-sm">
          <BrandLogo width={128} height={34} />
          <Button asChild variant="outline">
            <Link href={`/pay/${token}`}>Ouvrir le paiement</Link>
          </Button>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Verification du devis</p>
            <h1 className="text-2xl font-semibold text-foreground">Reference devis #{order?.orderNumber ?? "-"}</h1>
            <p className="text-sm text-muted-foreground">
              {order?.contact?.name ?? "Client Horion"}
              {order?.contact?.company ? ` - ${order.contact.company}` : ""}
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm">
              <p className="text-muted-foreground">Statut du devis</p>
              <p className="mt-1 font-medium text-foreground">Version {quote.version}</p>
              <p className="mt-1 text-xs text-muted-foreground">Dossier {formatOrderStatus(order?.status)}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm">
              <p className="text-muted-foreground">Statut du paiement</p>
              <p className="mt-1 font-medium text-foreground">{formatPaymentStatus(quote.paymentStatus)}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm">
              <p className="text-muted-foreground">Montant</p>
              <p className="mt-1 font-medium text-foreground">{formatPublicMoney(Number(quote.total), quote.currency)}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm">
              <p className="text-muted-foreground">Validite</p>
              <p className="mt-1 font-medium text-foreground">
                {quote.paymentExpiry
                  ? new Date(quote.paymentExpiry).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "Selon le devis"}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild>
              <Link href={`/pay/${token}`}>Payer ce devis</Link>
            </Button>
            <Button asChild variant="outline">
              <a href={WA_URL} target="_blank" rel="noopener noreferrer">
                Contacter Horion
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatPaymentStatus(status?: string | null) {
  switch (status) {
    case "PAID":
      return "Paye";
    case "SUBMITTED":
      return "Soumis pour verification";
    case "EXPIRED":
      return "Expire";
    case "PENDING":
    case null:
    case undefined:
      return "En attente";
    default:
      return status;
  }
}

function formatOrderStatus(status?: string | null) {
  switch (status) {
    case "DEVIS":
      return "au stade devis";
    case "PAIEMENT_EN_COURS":
      return "en verification de paiement";
    case "SOURCING":
      return "en execution";
    case "RECU_ENTREPOT":
      return "reçue à l'entrepôt Chine";
    case "QC_EN_COURS":
      return "en contrôle qualité";
    default:
      return status ? status.toLowerCase() : "non renseigne";
  }
}
