"use client";

import { ChatShell } from "@/components/assistant/chat-shell";

export function ZeliaInternalWidget() {
  return (
    <ChatShell
      endpoint="/api/assistant/internal/chat"
      title="Zelia Interne"
      subtitle="Guide d'orientation Horion pour l'equipe interne"
      welcomeMessage="Bonjour, je suis Zelia Interne. Je peux expliquer cette page, le prochain jalon, les validations et les blocages."
      accentClassName="bg-slate-950 text-white"
      includePathname
      initialSuggestions={[
        "Explique cette page",
        "Que dois-je faire maintenant ?",
        "Pourquoi c'est bloque ?",
        "Qui doit valider ?",
      ]}
    />
  );
}
