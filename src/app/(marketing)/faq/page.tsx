import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getWhatsAppUrl } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Les reponses aux questions frequentes sur l'importation avec Horion.",
};

const WA_URL = getWhatsAppUrl("Bonjour Horion, j'ai une question.");

const FAQS = [
  {
    question: "Pourquoi payer avant execution ?",
    answer:
      "Le paiement permet a Horion de lancer la commande fournisseur, de reserver la logistique et de declencher l'execution sans attendre.",
  },
  {
    question: "Comment le prix est-il calcule ?",
    answer:
      "Le devis detaille inclut le produit, le transport et les frais de service. Le total est connu avant execution.",
  },
  {
    question: "Comment suivre ma commande ?",
    answer:
      "Horion informe le client a chaque etape importante : sourcing, QC, expedition, transit, dedouanement et livraison.",
  },
  {
    question: "Que se passe-t-il en cas de probleme ?",
    answer:
      "Horion accompagne le client et traite avec le fournisseur, le partenaire QC ou le transport selon l'etape du probleme.",
  },
  {
    question: "Quels sont les delais ?",
    answer:
      "Les delais dependent du produit, du fournisseur et du mode de transport. Ils sont precises dans le devis autant que possible.",
  },
];

export default function FaqPage() {
  return (
    <div className="py-16 sm:py-20">
      <div className="mx-auto max-w-3xl space-y-10 px-4 sm:px-6">
        <div className="space-y-4 text-center">
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">Questions frequentes</h1>
          <p className="mx-auto max-w-2xl text-base text-white/60 sm:text-lg">
            Les points essentiels a connaitre avant de lancer une importation avec Horion.
          </p>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq) => (
            <details key={faq.question} className="group rounded-2xl border border-white/10 bg-[#12131E] px-5 open:shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between py-5 text-sm font-medium text-white">
                {faq.question}
                <span className="text-white/40 transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="pb-5 text-sm leading-relaxed text-white/65">{faq.answer}</p>
            </details>
          ))}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center">
          <p className="font-medium text-white">Une question supplementaire ?</p>
          <p className="mt-2 text-sm text-white/60">Contactez Horion directement sur WhatsApp.</p>
          <Button asChild size="sm" className="mt-4 gap-2">
            <a href={WA_URL} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
              Poser ma question
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
