import { formatParagraphs, renderBaseEmail } from "./base";

export function renderTaskAssignedEmail(params: {
  title: string;
  message?: string;
  taskUrl?: string;
}) {
  return renderBaseEmail({
    title: params.title,
    preheader: "A new task has been assigned to you.",
    bodyHtml: formatParagraphs(params.message || "A new task requires your attention."),
    ctaLabel: params.taskUrl ? "Open task" : undefined,
    ctaUrl: params.taskUrl,
  });
}

