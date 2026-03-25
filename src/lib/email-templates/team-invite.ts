import { formatParagraphs, renderBaseEmail } from "./base";

export function renderTeamInviteEmail(params: {
  title: string;
  message?: string;
  loginUrl?: string;
}) {
  return renderBaseEmail({
    title: params.title,
    preheader: "Your Horion ERP account is ready.",
    bodyHtml: formatParagraphs(params.message || "Your account has been created."),
    ctaLabel: params.loginUrl ? "Se connecter" : undefined,
    ctaUrl: params.loginUrl,
  });
}

