import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getWhatsAppUrl } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Pourquoi Horion",
  description: "Transparence, securite, experience et simplicite : les raisons de choisir Horion.",
};

const WA_URL = getWhatsAppUrl("Bonjour Horion, je souhaite demarrer une commande.");

const VALUES = [
  {
    title: "Transparence",
    text: "Le devis detaille explique les prix du produit, du transport et des frais de service avant execution.",
  },
  {
    title: "Securite",
    text: "Horion suit la commande et peut bloquer l'expedition si le controle qualite n'est pas satisfaisant.",
  },
  {
    title: "Experience",
    text: "Le corridor Chine -> Congo impose des choix precis de fournisseurs, de transport et de dedouanement.",
  },
  {
    title: "Simplicite",
    text: "Un seul interlocuteur, un seul suivi et une seule logique d'execution pour tout le parcours client.",
  },
];

export default function PourquoiHorionPage() {
  return (
    <div className="py-16 sm:py-20">
      <div className="mx-auto max-w-4xl space-y-12 px-4 sm:px-6">
        <div className="space-y-4 text-center">
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">Pourquoi choisir Horion ?</h1>
          <p className="mx-auto max-w-2xl text-base text-white/60 sm:text-lg">
            Horion ne vend pas seulement un transport. Horion securise une execution complete, previsible et sans tracas.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {VALUES.map((value) => (
            <div key={value.title} className="rounded-3xl border border-white/10 bg-[#12131E] p-6">
              <h2 className="text-xl font-semibold text-white">{value.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-white/65">{value.text}</p>
            </div>
          ))}
        </div>

        <blockquote className="rounded-3xl border border-violet-500/20 bg-violet-500/10 p-6 text-lg text-white/85">
          Horion est la couche de confiance entre le client, le fournisseur, le QC et la logistique.
        </blockquote>

        <div className="space-y-4 text-center">
          <p className="text-white/60">Demarrons votre premiere commande.</p>
          <Button asChild size="lg" className="gap-2">
            <a href={WA_URL} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-5 w-5" />
              Demander un devis
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
