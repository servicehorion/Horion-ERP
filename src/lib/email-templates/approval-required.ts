import { formatParagraphs, renderBaseEmail } from "./base";

export function renderApprovalRequiredEmail(params: {
  title: string;
  message?: string;
  taskUrl?: string;
}) {
  return renderBaseEmail({
    title: params.title,
    preheader: "Approval required.",
    bodyHtml: formatParagraphs(params.message || "An approval is required."),
    ctaLabel: params.taskUrl ? "Open approval" : undefined,
    ctaUrl: params.taskUrl,
  });
}

