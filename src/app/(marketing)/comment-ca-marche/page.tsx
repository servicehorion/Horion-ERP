import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StepsTimeline } from "@/components/marketing/steps-timeline";
import { getWhatsAppUrl } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Comment ca marche",
  description: "Decouvrez le processus Horion : de votre demande a la livraison au Congo.",
};

const WA_URL = getWhatsAppUrl("Bonjour Horion, je souhaite demarrer une commande.");

const STEPS = [
  {
    number: 1,
    title: "Envoyer la demande",
    description:
      "Le client partage une image, une description et la quantite souhaitee. WhatsApp suffit pour lancer l'analyse.",
  },
  {
    number: 2,
    title: "Sourcing",
    description:
      "Horion recherche le fournisseur, compare les offres, verifie la disponibilite et negocie le meilleur prix.",
  },
  {
    number: 3,
    title: "Devis",
    description:
      "Le client recoit un devis detaille : produit, transport, frais de service et total a payer.",
  },
  {
    number: 4,
    title: "Paiement",
    description:
      "Le paiement passe par un lien unique et securise. La verification est ensuite faite par Horion.",
  },
  {
    number: 5,
    title: "Execution",
    description:
      "Commande fournisseur, controle qualite, transport, dedouanement et livraison au Congo.",
  },
];

export default function CommentCaMarchePage() {
  return (
    <div className="py-16 sm:py-20">
      <div className="mx-auto max-w-4xl space-y-12 px-4 sm:px-6">
        <div className="space-y-4 text-center">
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">Comment ca marche ?</h1>
          <p className="mx-auto max-w-2xl text-base text-white/60 sm:text-lg">
            Horion transforme une demande simple en execution complete, sans disperser le client entre plusieurs prestataires.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#12131E] p-6 sm:p-8">
          <StepsTimeline steps={STEPS} orientation="vertical" />
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-xl font-semibold text-white">Bon a savoir</h2>
          <ul className="mt-4 space-y-3 text-sm text-white/65">
            <li>1. Le paiement est demande avant execution car Horion engage immediatement la commande.</li>
            <li>2. Le delai depend du mode de transport et du type de marchandise.</li>
            <li>3. Le devis reste gratuit tant qu'il n'est pas confirme.</li>
          </ul>
        </div>

        <div className="space-y-4 text-center">
          <p className="text-white/60">Pret a lancer votre prochaine importation ?</p>
          <Button asChild size="lg" className="gap-2">
            <a href={WA_URL} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-5 w-5" />
              Demander un devis sur WhatsApp
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
