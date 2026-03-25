import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getWhatsAppUrl } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Nos services",
  description: "Sourcing, controle qualite, logistique et accompagnement : Horion gere toute la chaine.",
};

const WA_URL = getWhatsAppUrl("Bonjour Horion, je souhaite en savoir plus sur vos services.");

const SERVICES = [
  {
    title: "Sourcing",
    items: [
      "Recherche de fournisseurs fiables sur 1688, Taobao, JD et Pinduoduo",
      "Comparaison de plusieurs offres et verification du fournisseur",
      "Negociation du prix et des conditions",
    ],
  },
  {
    title: "Controle qualite",
    items: [
      "QC virtuel avec photos et videos",
      "QC physique avant expedition",
      "QC avance pour produits sensibles ou techniques",
    ],
  },
  {
    title: "Logistique",
    items: [
      "Transport aerien ou maritime selon le besoin",
      "Transit, dedouanement et livraison",
      "Coordination complete jusqu'au Congo",
    ],
  },
  {
    title: "Accompagnement",
    items: [
      "Conseil produit et optimisation du budget",
      "Suivi de commande a chaque etape",
      "Un seul interlocuteur du devis a la livraison",
    ],
  },
];

export default function ServicesPage() {
  return (
    <div className="py-16 sm:py-20">
      <div className="mx-auto max-w-5xl space-y-12 px-4 sm:px-6">
        <div className="space-y-4 text-center">
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">Nos services</h1>
          <p className="mx-auto max-w-2xl text-base text-white/60 sm:text-lg">
            Horion prend en charge toute la chaine d'importation, du sourcing jusqu'a la livraison finale.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {SERVICES.map((service) => (
            <div key={service.title} className="rounded-3xl border border-white/10 bg-[#12131E] p-6">
              <h2 className="text-xl font-semibold text-white">{service.title}</h2>
              <ul className="mt-4 space-y-3 text-sm text-white/65">
                {service.items.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="text-violet-300">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="rounded-3xl bg-white p-8 text-center text-slate-900">
          <h2 className="text-2xl font-semibold">Besoin d'un service sur mesure ?</h2>
          <p className="mt-3 text-sm text-slate-600">
            Echangeons sur votre besoin reel et construisons un devis adapte a votre produit, votre delai et votre budget.
          </p>
          <Button asChild size="lg" className="mt-6 gap-2">
            <a href={WA_URL} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-5 w-5" />
              Nous contacter
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
