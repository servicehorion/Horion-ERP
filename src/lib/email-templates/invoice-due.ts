import { formatParagraphs, renderBaseEmail } from "./base";

export function renderInvoiceDueEmail(params: {
  title: string;
  message?: string;
  invoiceUrl?: string;
}) {
  return renderBaseEmail({
    title: params.title,
    preheader: "An invoice is due.",
    bodyHtml: formatParagraphs(params.message || "An invoice is due."),
    ctaLabel: params.invoiceUrl ? "View invoice" : undefined,
    ctaUrl: params.invoiceUrl,
  });
}

