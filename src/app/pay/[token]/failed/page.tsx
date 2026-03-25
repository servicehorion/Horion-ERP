import Link from "next/link";

import { PublicPageShell } from "@/components/layout/public-page-shell";
import { getWhatsAppUrl } from "@/lib/site-config";

export default async function PaymentFailedPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const WA_URL = getWhatsAppUrl("Bonjour Horion, j'ai rencontré un problème lors de l'enregistrement de mon paiement.");

  return (
    <PublicPageShell step={2}>
      <div className="mx-auto max-w-md space-y-6">
        <div className="rounded-3xl border border-black/[0.07] bg-white shadow-[0_20px_64px_-24px_rgba(15,23,42,0.18)] overflow-hidden">
          <div className="bg-gradient-to-br from-rose-50 via-white to-white px-8 py-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-100">
              <svg className="h-8 w-8 text-rose-600" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <h1 className="mt-4 text-2xl font-semibold text-slate-950">Enregistrement impossible</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Nous n{"'"}avons pas pu enregistrer votre paiement. Vérifiez la référence saisie et réessayez, ou contactez Horion directement.
            </p>
          </div>
          <div className="border-t border-black/[0.05] px-8 py-6">
            <div className="space-y-2.5">
              <Link
                href={`/pay/${token}`}
                className="flex h-12 w-full items-center justify-center rounded-2xl bg-slate-950 font-semibold text-white transition hover:bg-slate-800"
              >
                Réessayer le paiement
              </Link>
              <a
                href={WA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 font-semibold text-emerald-800 transition hover:bg-emerald-100"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Contacter le support
              </a>
            </div>
          </div>
        </div>
      </div>
    </PublicPageShell>
  );
}
