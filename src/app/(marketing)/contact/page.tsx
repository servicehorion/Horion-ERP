import type { Metadata } from "next";
import { Mail, MapPin, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SITE_CONFIG, getWhatsAppUrl } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contactez Horion par WhatsApp ou email pour lancer votre importation depuis la Chine.",
};

const WA_URL = getWhatsAppUrl("Bonjour Horion, je souhaite vous contacter.");

export default function ContactPage() {
  return (
    <div className="py-16 sm:py-20">
      <div className="mx-auto max-w-3xl space-y-12 px-4 sm:px-6">
        <div className="space-y-4 text-center">
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">Contactez-nous</h1>
          <p className="mx-auto max-w-2xl text-base text-white/60 sm:text-lg">
            Le canal le plus rapide reste WhatsApp. Vous pouvez aussi nous ecrire par email.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <a href={WA_URL} target="_blank" rel="noopener noreferrer" className="rounded-3xl border border-white/10 bg-[#12131E] p-6 text-center">
            <MessageCircle className="mx-auto h-8 w-8 text-emerald-400" />
            <p className="mt-4 text-sm font-medium text-white">WhatsApp</p>
            <p className="mt-1 text-sm text-white/60">{SITE_CONFIG.whatsappDisplay}</p>
          </a>
          <a href={`mailto:${SITE_CONFIG.contactEmail}`} className="rounded-3xl border border-white/10 bg-[#12131E] p-6 text-center">
            <Mail className="mx-auto h-8 w-8 text-blue-400" />
            <p className="mt-4 text-sm font-medium text-white">Email</p>
            <p className="mt-1 text-sm text-white/60">{SITE_CONFIG.contactEmail}</p>
          </a>
          <div className="rounded-3xl border border-white/10 bg-[#12131E] p-6 text-center">
            <MapPin className="mx-auto h-8 w-8 text-amber-400" />
            <p className="mt-4 text-sm font-medium text-white">Localisation</p>
            <p className="mt-1 text-sm text-white/60">Brazzaville, Congo</p>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#12131E] p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-white">Envoyez-nous un message</h2>
          <p className="mt-2 text-sm text-white/60">
            Pour une reponse rapide, indiquez le produit, la quantite, votre delai et votre numero WhatsApp.
          </p>

          <form action={`mailto:${SITE_CONFIG.contactEmail}`} method="GET" encType="text/plain" className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-white" htmlFor="contact-name">Votre nom</label>
                <input id="contact-name" name="subject" type="text" required placeholder="Jean-Pierre Mbala" className="h-11 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-white" htmlFor="contact-phone">Telephone / WhatsApp</label>
                <input id="contact-phone" name="tel" type="tel" placeholder={SITE_CONFIG.whatsappDisplay} className="h-11 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-white" htmlFor="contact-message">Votre message</label>
              <textarea id="contact-message" name="body" rows={5} required placeholder="Decrivez le produit, la quantite souhaitee et le delai vise." className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <Button type="submit" className="w-full">
              Envoyer le message
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
