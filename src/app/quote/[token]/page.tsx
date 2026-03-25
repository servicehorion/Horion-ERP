import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { serializeDecimals } from "@/lib/utils";
import { QuoteSignature } from "@/components/quotes/quote-signature";
import { SITE_CONFIG } from "@/lib/site-config";

export const metadata = {
  title: "Validation devis | Horion",
};

function maskEmail(value?: string | null) {
  if (!value) return null;
  const [local, domain] = value.split("@");
  if (!local || !domain) return value;
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(local.length - 2, 1))}@${domain}`;
}

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function QuoteSignPage({ params }: PageProps) {
  const { token } = await params;

  const quote = await prisma.quote.findUnique({
    where: { signatureToken: token },
    include: {
      order: { select: { orderNumber: true, contact: { select: { name: true, email: true } } } },
    },
  });

  if (!quote || !quote.isActive) return notFound();

  const view = serializeDecimals({
    id: quote.id,
    status: quote.status,
    orderNumber: quote.order.orderNumber,
    total: Number(quote.total),
    merchandiseTotal: Number(quote.merchandiseTotal),
    logisticsCost: Number(quote.logisticsCost),
    commission: Number(quote.commission),
    insuranceCost: Number(quote.insuranceCost ?? 0),
    currency: quote.currency,
    paymentToken: quote.paymentToken || null,
    paymentStatus: quote.paymentStatus || "PENDING",
    validUntil: quote.validUntil,
    signedAt: quote.signedAt,
    contactName: quote.order.contact?.name || null,
    recipientHint: maskEmail(quote.sentByEmailTo || quote.order.contact?.email || null),
    companyEmail: SITE_CONFIG.contactEmail,
    companyWhatsapp: SITE_CONFIG.whatsappDisplay,
    items: Array.isArray((quote.pricingSnapshot as Record<string, unknown> | null)?.items)
      ? ((quote.pricingSnapshot as Record<string, unknown>).items as Array<Record<string, unknown>>).map(
          (item, index) => ({
            index,
            description: String(item.description ?? item.name ?? `Article ${index + 1}`),
            quantity: Number(item.quantity ?? 0),
            productSellXAF: Number(item.productSellXAF ?? 0),
            serviceFeeXAF: Number(item.serviceFeeXAF ?? 0),
            selectedTransport:
              item.selectedTransport && typeof item.selectedTransport === "object"
                ? {
                    key: String((item.selectedTransport as Record<string, unknown>).key ?? ""),
                    label: String((item.selectedTransport as Record<string, unknown>).label ?? "A confirmer"),
                    delayLabel: String(
                      (item.selectedTransport as Record<string, unknown>).delayLabel ?? "Selon disponibilite"
                    ),
                    costXAF: Number((item.selectedTransport as Record<string, unknown>).costXAF ?? 0),
                  }
                : null,
            transportOptions: Array.isArray(item.transportOptions)
              ? (item.transportOptions as Array<Record<string, unknown>>).map((option) => ({
                  key: String(option.key ?? ""),
                  label: String(option.label ?? "Transport"),
                  delayLabel: String(option.delayLabel ?? "Selon disponibilite"),
                  costXAF: Number(option.costXAF ?? 0),
                }))
              : [],
          })
        )
      : [],
  });

  return <QuoteSignature quote={view} token={token} />;
}

