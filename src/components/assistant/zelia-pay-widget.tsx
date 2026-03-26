"use client";

import { ChatShell } from "@/components/assistant/chat-shell";

export function ZeliaPayWidget({
  token,
  page,
}: {
  token: string;
  page: "quote" | "pay" | "submitted" | "success";
}) {
  return (
    <ChatShell
      endpoint="/api/assistant/public/chat"
      title="Zelia"
      subtitle="Aide Horion pour le devis, le paiement et le recu"
      welcomeMessage="Bonjour, je suis Zelia. Je peux vous aider a payer, envoyer une preuve et retrouver votre recu."
      accentClassName="bg-emerald-600 text-white hover:bg-emerald-700"
      staticPayload={{ token, page }}
      initialSuggestions={[
        "Comment payer ?",
        "Comment envoyer ma preuve ?",
        "Quand le paiement sera confirme ?",
        "Comment telecharger mon recu ?",
      ]}
    />
  );
}
