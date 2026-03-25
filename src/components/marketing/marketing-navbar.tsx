"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, MessageCircle } from "lucide-react";

import { BrandLogo } from "@/components/layout/brand-logo";
import { getWhatsAppUrl } from "@/lib/site-config";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Accueil", href: "/" },
  { label: "Comment ca marche", href: "/comment-ca-marche" },
  { label: "Nos services", href: "/services" },
  { label: "Pourquoi Horion", href: "/pourquoi-horion" },
  { label: "FAQ", href: "/faq" },
  { label: "A propos", href: "/a-propos" },
  { label: "Contact", href: "/contact" },
];

const WA_URL = getWhatsAppUrl("Bonjour Horion, je souhaite demander un devis.");

export function MarketingNavbar() {
  const [open, setOpen] = useState(false);

  return (
    <div className="sticky top-0 z-50 w-full">
      <div className="border-b border-violet-500/20 bg-violet-500/10 px-4 py-2 text-center text-xs text-violet-100">
        {"Corridor Chine -> Congo | Devis gratuit | Reponse sous 24h"}
      </div>

      <header className="border-b border-white/5 bg-[#0B0C17]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex-shrink-0">
            <BrandLogo width={124} height={34} priority />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-1.5 text-sm text-white/65 transition-colors hover:bg-white/5 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Link
              href="/login"
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 transition-colors hover:border-white/25 hover:text-white"
            >
              Acceder a l'ERP
            </Link>
            <a
              href={WA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500"
            >
              <MessageCircle className="h-4 w-4" />
              Demander un devis
            </a>
          </div>

          <button
            className="rounded-md p-2 text-white/70 transition-colors hover:bg-white/5 hover:text-white lg:hidden"
            onClick={() => setOpen((prev) => !prev)}
            aria-label="Ouvrir le menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        <div
          className={cn(
            "overflow-hidden border-t border-white/5 bg-[#0B0C17] transition-all duration-200 lg:hidden",
            open ? "max-h-[520px] opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <nav className="mx-auto max-w-6xl space-y-1 px-4 py-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block rounded-md px-3 py-2.5 text-sm text-white/65 transition-colors hover:bg-white/5 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
            <div className="space-y-2 border-t border-white/10 pt-3">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="block rounded-full border border-white/10 px-4 py-3 text-center text-sm text-white/75"
              >
                Acceder a l'ERP
              </Link>
              <a
                href={WA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-full bg-violet-600 px-4 py-3 text-sm font-medium text-white"
              >
                <MessageCircle className="h-4 w-4" />
                Demander un devis sur WhatsApp
              </a>
            </div>
          </nav>
        </div>
      </header>
    </div>
  );
}
