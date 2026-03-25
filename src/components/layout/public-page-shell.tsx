import type { ReactNode } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { BrandLogo } from "@/components/layout/brand-logo";
import { SITE_CONFIG } from "@/lib/site-config";

type Step = { label: string; active: boolean; done: boolean };

function StepBar({ steps }: { steps: Step[] }) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-all ${
              step.done
                ? "bg-emerald-500 text-white"
                : step.active
                  ? "bg-amber-500 text-white ring-4 ring-amber-500/20"
                  : "bg-slate-200 text-slate-400"
            }`}
          >
            {step.done ? (
              <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none">
                <path d="M2.5 7l3 3 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              i + 1
            )}
          </div>
          <span
            className={`hidden text-xs font-medium sm:block ${
              step.done ? "text-emerald-600" : step.active ? "text-slate-900" : "text-slate-400"
            }`}
          >
            {step.label}
          </span>
          {i < steps.length - 1 && (
            <div className={`h-px w-6 sm:w-10 ${step.done ? "bg-emerald-300" : "bg-slate-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

type ShellProps = {
  children: ReactNode;
  step?: 1 | 2 | 3;
};

export function PublicPageShell({ children, step }: ShellProps) {
  const steps: Step[] = [
    { label: "Devis", active: step === 1, done: (step ?? 0) > 1 },
    { label: "Paiement", active: step === 2, done: (step ?? 0) > 2 },
    { label: "Confirmation", active: step === 3, done: false },
  ];

  return (
    <div className="min-h-screen bg-[linear-gradient(160deg,#fdf8ef_0%,#ffffff_48%,#f5f7fb_100%)]">
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link href="/">
            <BrandLogo width={110} height={30} priority />
          </Link>

          {step && (
            <div className="flex items-center gap-4 sm:gap-6">
              <StepBar steps={steps} />
            </div>
          )}

          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span className="hidden sm:inline">Paiement sécurisé</span>
            <span className="sm:hidden">Sécurisé</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>

      <footer className="border-t border-black/[0.04] py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 text-center text-xs text-slate-400 sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} {SITE_CONFIG.brandName} — Tous droits réservés</span>
          <span>{SITE_CONFIG.contactEmail}</span>
        </div>
      </footer>
    </div>
  );
}
