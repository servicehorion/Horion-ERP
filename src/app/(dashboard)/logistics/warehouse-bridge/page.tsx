import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  confirmWarehouseIntakeDraft,
  getWarehouseIntakeDrafts,
  rejectWarehouseIntakeDraft,
} from "@/lib/actions/warehouse-intake-draft.actions";

function renderParsedSummary(parsedPayload: unknown) {
  const payload =
    parsedPayload && typeof parsedPayload === "object"
      ? (parsedPayload as Record<string, unknown>)
      : {};
  const dimensions =
    payload.dimensionsCm && typeof payload.dimensionsCm === "object"
      ? (payload.dimensionsCm as Record<string, unknown>)
      : {};
  const missingFields = Array.isArray(payload.missingFields)
    ? (payload.missingFields as string[])
    : [];

  return {
    orderId: String(payload.orderId ?? payload.resolvedOrderId ?? "-"),
    weightKg: Number(payload.weightKg ?? 0),
    lengthCm: Number(dimensions.L ?? 0),
    widthCm: Number(dimensions.W ?? 0),
    heightCm: Number(dimensions.H ?? 0),
    missingFields,
    status: String(payload.status ?? "incomplete"),
  };
}

function badgeVariant(status: string) {
  if (status === "CONFIRMED") return "default";
  if (status === "REJECTED") return "destructive";
  return "secondary";
}

export default async function WarehouseBridgePage() {
  const result = await getWarehouseIntakeDrafts();
  const drafts = result.data ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Warehouse Bridge
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">
              Revue WhatsApp entrepot Chine
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Day 1: le partenaire Chine n'utilise pas l'ERP. Les messages WhatsApp sont parses,
              transformes en brouillons internes puis confirmes ici par les operations Horion.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/logistics">Retour logistique</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {drafts.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
            Aucun brouillon entrepot a revoir pour le moment.
          </div>
        )}

        {drafts.map((draft) => {
          const parsed = renderParsedSummary(draft.parsedPayload);
          const confirmAction = confirmWarehouseIntakeDraft.bind(null, draft.id);
          const rejectAction = rejectWarehouseIntakeDraft.bind(
            null,
            draft.id,
            "Brouillon rejete - informations entrepot incompletes ou incoherentes."
          );

          return (
            <div key={draft.id} className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={badgeVariant(draft.status) as any}>{draft.status}</Badge>
                    <Badge variant="outline">Source: WhatsApp</Badge>
                    {draft.order?.orderNumber && <Badge variant="outline">#{draft.order.orderNumber}</Badge>}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">
                      {draft.order?.contact?.name ?? draft.conversation?.contact?.name ?? "Partenaire Chine"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">{draft.rawText}</p>
                  </div>
                </div>

                <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2 lg:w-[420px]">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Commande</p>
                    <p className="font-medium text-slate-950">{parsed.orderId}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Poids</p>
                    <p className="font-medium text-slate-950">
                      {parsed.weightKg > 0 ? `${parsed.weightKg} kg` : "-"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 sm:col-span-2">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Dimensions</p>
                    <p className="font-medium text-slate-950">
                      {parsed.lengthCm > 0 && parsed.widthCm > 0 && parsed.heightCm > 0
                        ? `${parsed.lengthCm} x ${parsed.widthCm} x ${parsed.heightCm} cm`
                        : "-"}
                    </p>
                  </div>
                </div>
              </div>

              {parsed.missingFields.length > 0 && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Champs manquants: {parsed.missingFields.join(", ")}
                </div>
              )}

              {Array.isArray(draft.photoUrls) && draft.photoUrls.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Medias recus
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(draft.photoUrls as string[]).map((url) => (
                      <code
                        key={url}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
                      >
                        {url}
                      </code>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                {draft.status === "PENDING_REVIEW" && (
                  <>
                    <form action={confirmAction}>
                      <Button type="submit">Confirmer et creer le WarehouseReceipt</Button>
                    </form>
                    <form action={rejectAction}>
                      <Button type="submit" variant="outline">
                        Rejeter le brouillon
                      </Button>
                    </form>
                  </>
                )}
                {draft.orderId && (
                  <Button asChild variant="ghost">
                    <Link href={`/orders/${draft.orderId}`}>Ouvrir la commande</Link>
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
