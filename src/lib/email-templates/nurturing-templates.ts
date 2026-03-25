import { formatParagraphs, renderBaseEmail } from "./base";

export function renderNurturingWelcomeEmail(input: { title?: string; message?: string }) {
  return renderBaseEmail({
    title: input.title ?? "Bienvenue chez Horion",
    preheader: input.message?.slice(0, 80) ?? "Merci pour votre confiance",
    bodyHtml: formatParagraphs(
      input.message ??
        "Bienvenue chez Horion. Nous avons bien recu votre demande et un conseiller va vous contacter rapidement."
    ),
  });
}

export function renderNurturingFollowUpEmail(input: { title?: string; message?: string }) {
  return renderBaseEmail({
    title: input.title ?? "Suivi de votre demande",
    preheader: input.message?.slice(0, 80) ?? "Avez-vous eu le temps de regarder notre proposition ?",
    bodyHtml: formatParagraphs(
      input.message ??
        "Petit rappel concernant votre demande. Dites-nous si vous souhaitez avancer ou ajuster le devis."
    ),
  });
}

export function renderNurturingReminderEmail(input: { title?: string; message?: string }) {
  return renderBaseEmail({
    title: input.title ?? "Dernier rappel",
    preheader: input.message?.slice(0, 80) ?? "Nous restons disponibles",
    bodyHtml: formatParagraphs(
      input.message ??
        "Nous restons disponibles pour finaliser votre commande. Repondez a ce message si vous avez des questions."
    ),
  });
}
