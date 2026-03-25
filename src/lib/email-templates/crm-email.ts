import { formatParagraphs, renderBaseEmail } from "./base";

export function renderCrmEmail(input: {
  title: string;
  message?: string;
  recipientName?: string;
}) {
  const greeting = input.recipientName
    ? `<p style="margin:0 0 12px 0; color:#111827;">Bonjour ${input.recipientName},</p>`
    : "";

  return renderBaseEmail({
    title: input.title,
    preheader: input.message?.slice(0, 80),
    bodyHtml: `${greeting}${formatParagraphs(input.message)}`,
  });
}
