import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getWhatsAppUrl } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "A propos",
  description: "La vision, la mission et l'histoire d'Horion.",
};

const WA_URL = getWhatsAppUrl();

export default function AProposPage() {
  return (
    <div className="py-16 sm:py-20">
      <div className="mx-auto max-w-3xl space-y-12 px-4 sm:px-6">
        <div className="space-y-4 text-center">
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">A propos d'Horion</h1>
          <p className="mx-auto max-w-2xl text-base text-white/60 sm:text-lg">
            Horion construit une infrastructure commerciale simple entre la Chine et le Congo.
          </p>
        </div>

        <section className="space-y-4 rounded-3xl border border-white/10 bg-[#12131E] p-6">
          <h2 className="text-xl font-semibold text-white">Notre histoire</h2>
          <p className="text-sm leading-relaxed text-white/65">
            Horion est ne d'un constat simple : importer depuis la Chine est possible, mais difficile a executer proprement pour beaucoup d'entrepreneurs et de commercants congolais.
          </p>
          <p className="text-sm leading-relaxed text-white/65">
            Trop de risques, trop de dispersion, trop peu de transparence. Horion structure cette execution dans une seule chaine de service.
          </p>
        </section>

        <section className="rounded-3xl border border-violet-500/20 bg-violet-500/10 p-6">
          <h2 className="text-xl font-semibold text-white">Notre vision</h2>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            Rendre l'importation depuis la Chine plus previsible, plus sure et plus simple pour les entreprises congolaises.
          </p>
        </section>

        <section className="space-y-4 rounded-3xl border border-white/10 bg-[#12131E] p-6">
          <h2 className="text-xl font-semibold text-white">Notre mission</h2>
          <ul className="space-y-3 text-sm text-white/65">
            <li>1. Connecter les clients aux bons fournisseurs.</li>
            <li>2. Securiser les commandes par le QC et le suivi.</li>
            <li>3. Livrer avec un niveau de service plus lisible et plus serieux.</li>
          </ul>
        </section>

        <div className="space-y-4 text-center">
          <p className="text-white/60">Vous voulez travailler avec Horion ?</p>
          <Button asChild size="lg" className="gap-2">
            <a href={WA_URL} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-5 w-5" />
              Nous contacter sur WhatsApp
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

