import Link from "next/link";
import { ArrowRight, Search, ShieldCheck, Truck } from "lucide-react";

import { getWhatsAppUrl } from "@/lib/site-config";

const WA_URL = getWhatsAppUrl("Bonjour Horion, je souhaite demander un devis.");

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-[#0B0C17] pb-24 pt-16 sm:pb-32 sm:pt-24">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-[420px] max-w-5xl"
        style={{ background: "radial-gradient(circle at top, rgba(124,108,248,0.20), transparent 60%)" }}
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="space-y-8 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-xs font-medium text-violet-200">
              {"Chine -> Congo | Sourcing, QC, transport, livraison"}
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Importer depuis la Chine simplement et sans tracas.
              </h1>
              <p className="max-w-2xl text-lg leading-relaxed text-white/65 lg:max-w-xl">
                Horion gere toute la chaine : sourcing, negociation, controle qualite, transport et livraison au Congo.
              </p>
            </div>

            <div className="flex flex-col items-center gap-3 sm:flex-row lg:items-start">
              <a
                href={WA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-6 py-3 font-medium text-white transition-colors hover:bg-violet-500"
              >
                Demander un devis
                <ArrowRight className="h-4 w-4" />
              </a>
              <Link
                href="/comment-ca-marche"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 font-medium text-white/80 transition-colors hover:border-white/30 hover:text-white"
              >
                Comment ca marche
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: Search, title: "Sourcing fiable", text: "Recherche fournisseur et prix reels." },
                { icon: ShieldCheck, title: "QC avant depart", text: "Inspection visuelle ou physique selon le besoin." },
                { icon: Truck, title: "Execution complete", text: "Transport, suivi et livraison au Congo." },
              ].map((feature) => (
                <div key={feature.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left">
                  <feature.icon className="h-5 w-5 text-violet-300" />
                  <p className="mt-3 text-sm font-medium text-white">{feature.title}</p>
                  <p className="mt-1 text-sm text-white/55">{feature.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#12131E] p-6 shadow-2xl shadow-black/20">
            <div className="space-y-5">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-sm font-medium text-violet-300">Ce que le client obtient</p>
                <ul className="mt-4 space-y-3 text-sm text-white/70">
                  <li>1. Un devis detaille avant execution</li>
                  <li>2. Un lien de paiement unique et securise</li>
                  <li>3. Un suivi de commande a chaque etape</li>
                </ul>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/40">Promesse Horion</p>
                  <p className="mt-3 text-xl font-semibold text-white">Previsible et sans tracas</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/40">Canal prioritaire</p>
                  <p className="mt-3 text-xl font-semibold text-white">WhatsApp +242 06 460 08 31</p>
                </div>
              </div>
              <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-5 text-sm text-violet-100">
                Horion n'est pas seulement un transitaire. C'est un partenaire d'execution qui securise votre commande avant, pendant et apres l'achat.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

