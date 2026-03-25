import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, MessageCircle } from "lucide-react";

import { HeroSection } from "@/components/marketing/hero-section";
import { getWhatsAppUrl } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Accueil",
  description:
    "Importer depuis la Chine simplement et sans tracas. Horion gere le sourcing, le controle qualite, le transport et la livraison au Congo.",
};

const WA_URL = getWhatsAppUrl("Bonjour Horion, je souhaite demander un devis.");

const PROBLEMS = [
  "Fournisseurs peu fiables",
  "Prix imprecis ou instables",
  "Risque d'arnaque a distance",
  "Transport et suivi peu previsibles",
];

const SOLUTIONS = [
  "Sourcing fournisseurs",
  "Negociation des prix",
  "Controle qualite avant depart",
  "Transport et livraison au Congo",
];

const STEPS = [
  "Vous nous envoyez votre besoin",
  "Horion source le produit",
  "Vous recevez un devis detaille",
  "Vous effectuez le paiement securise",
  "Nous executons la commande",
];

export default function HomePage() {
  return (
    <>
      <HeroSection />

      <section className="border-y border-white/5 bg-[#12131E] py-8">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 px-4 text-center sm:grid-cols-3 sm:px-6">
          {[
            { value: "Chine -> Congo", label: "Corridor dedie" },
            { value: "Devis detaille", label: "Avant toute execution" },
            { value: "WhatsApp", label: "Canal principal" },
          ].map((stat) => (
            <div key={stat.label} className="space-y-1">
              <p className="text-xl font-semibold text-violet-300">{stat.value}</p>
              <p className="text-sm text-white/50">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2">
          <div className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">Le probleme</p>
            <h2 className="text-3xl font-semibold text-white sm:text-4xl">
              Importer depuis la Chine est souvent complique.
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {PROBLEMS.map((problem) => (
                <div key={problem} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/65">
                  {problem}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">La solution</p>
            <h2 className="text-3xl font-semibold text-white sm:text-4xl">
              Horion simplifie l'importation.
            </h2>
            <div className="space-y-3 rounded-3xl border border-white/10 bg-[#12131E] p-6">
              {SOLUTIONS.map((solution) => (
                <div key={solution} className="flex items-center gap-3 text-sm text-white/70">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  {solution}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#0D0E1A] py-20 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">Comment ca marche</p>
            <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
              Un process simple en 5 etapes.
            </h2>
          </div>
          <div className="mt-10 grid gap-4 lg:grid-cols-5">
            {STEPS.map((step, index) => (
              <div key={step} className="rounded-2xl border border-white/10 bg-[#12131E] p-5 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">Etape {index + 1}</p>
                <p className="mt-3 text-sm leading-relaxed text-white/70">{step}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/comment-ca-marche" className="inline-flex items-center gap-2 text-sm text-violet-300 hover:text-violet-200">
              Voir le process en detail
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {[
              {
                title: "Confiance",
                text: "Le devis est detaille. Le client sait ce qu'il paie avant execution.",
              },
              {
                title: "Execution",
                text: "Horion gere sourcing, QC, transport et livraison avec un seul interlocuteur.",
              },
              {
                title: "Preuve",
                text: "Suivi commande, controle qualite et communication WhatsApp a chaque etape.",
              },
            ].map((block) => (
              <div key={block.title} className="rounded-3xl border border-white/10 bg-[#12131E] p-6">
                <h3 className="text-lg font-semibold text-white">{block.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/60">{block.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#F4F4FF] py-20 text-center">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-600">
            Consultation gratuite et sans engagement
          </span>
          <h2 className="mt-5 text-3xl font-semibold text-slate-900 sm:text-4xl">
            Besoin d'un devis ou d'un conseil ?
          </h2>
          <p className="mt-4 text-base text-slate-600">
            Parlez-nous de votre produit, de la quantite souhaitee et de votre delai. Horion vous repond rapidement.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={WA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-6 py-3 font-medium text-white transition-colors hover:bg-violet-500"
            >
              <MessageCircle className="h-4 w-4" />
              Demander un devis
            </a>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-6 py-3 font-medium text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900"
            >
              Nous contacter
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
