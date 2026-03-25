import Link from "next/link";

import { BrandLogo } from "@/components/layout/brand-logo";
import { SITE_CONFIG, getWhatsAppUrl } from "@/lib/site-config";

const WA_URL = getWhatsAppUrl();

const LINKS = [
  { label: "Comment ca marche", href: "/comment-ca-marche" },
  { label: "Nos services", href: "/services" },
  { label: "Pourquoi Horion", href: "/pourquoi-horion" },
  { label: "FAQ", href: "/faq" },
  { label: "A propos", href: "/a-propos" },
  { label: "Contact", href: "/contact" },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-white/5 bg-[#080910]">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="space-y-3">
            <BrandLogo width={112} height={30} />
            <p className="max-w-xs text-sm leading-relaxed text-white/45">
              Horion simplifie l'importation entre la Chine et le Congo : sourcing, QC, transport et livraison.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/30">Navigation</h3>
            <ul className="space-y-2">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-white/50 transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/30">Contact</h3>
            <ul className="space-y-2 text-sm text-white/50">
              <li>
                <a href={WA_URL} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white">
                  WhatsApp : {SITE_CONFIG.whatsappDisplay}
                </a>
              </li>
              <li>
                <a href={`mailto:${SITE_CONFIG.contactEmail}`} className="transition-colors hover:text-white">
                  {SITE_CONFIG.contactEmail}
                </a>
              </li>
              <li>Brazzaville, Republique du Congo</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/5 pt-6 text-xs text-white/30 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Horion. Tous droits reserves.</p>
          <p>Site public connecte a l'ERP Horion.</p>
        </div>
      </div>
    </footer>
  );
}
