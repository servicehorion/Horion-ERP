import { formatParagraphs, renderBaseEmail } from "./base";

export function renderOrderConfirmedEmail(params: {
  title: string;
  message?: string;
  orderUrl?: string;
}) {
  return renderBaseEmail({
    title: params.title,
    preheader: "Your order has been confirmed.",
    bodyHtml: formatParagraphs(params.message || "Your order has been confirmed."),
    ctaLabel: params.orderUrl ? "View order" : undefined,
    ctaUrl: params.orderUrl,
  });
}

