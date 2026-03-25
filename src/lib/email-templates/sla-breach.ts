import { formatParagraphs, renderBaseEmail } from "./base";

export function renderSlaBreachEmail(params: {
  title: string;
  message?: string;
  taskUrl?: string;
}) {
  return renderBaseEmail({
    title: params.title,
    preheader: "SLA requires immediate action.",
    bodyHtml: formatParagraphs(params.message || "An SLA threshold has been breached."),
    ctaLabel: params.taskUrl ? "Review task" : undefined,
    ctaUrl: params.taskUrl,
  });
}

