"use client";

import { useState } from "react";
import { CheckCircle2, FileText, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ProofUploadForm({
  token,
  paymentId,
  depositCode,
  methodLabel,
}: {
  token: string;
  paymentId: string;
  depositCode?: string | null;
  methodLabel?: string | null;
}) {
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!proofFile) return;
    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("paymentId", paymentId);
      formData.set("file", proofFile);
      if (reference.trim()) {
        formData.set("reference", reference.trim());
      }

      const res = await fetch(`/api/pay/${token}/proof`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur lors de l'envoi de la preuve.");
        return;
      }
      setDone(true);
    } catch {
      setError("Erreur reseau. Veuillez reessayer.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
        <div>
          <p className="text-sm font-semibold text-emerald-900">Preuve envoyee</p>
          <p className="text-xs text-emerald-700">
            Notre equipe finance va verifier votre preuve sous 24h ouvrees.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-black/[0.07] bg-white px-6 py-6 shadow-[0_16px_48px_-20px_rgba(15,23,42,0.12)]">
      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        Envoyer votre preuve de paiement
      </p>
      <p className="mb-4 text-sm text-slate-500">
        {methodLabel === "Virement bancaire"
          ? "Televersez votre recu de virement en PDF ou en image."
          : "Photographiez le bordereau de depot remis par la banque."}
        {depositCode && (
          <>
            {" "}
            Assurez-vous que le code{" "}
            <span className="font-semibold text-slate-900">{depositCode}</span> est visible.
          </>
        )}
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block cursor-pointer rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-5 transition hover:border-slate-400 hover:bg-slate-50">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white p-2 shadow-sm">
              <FileText className="h-5 w-5 text-slate-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">
                {proofFile ? proofFile.name : "Choisir un fichier"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Formats acceptes : PDF, PNG, JPG, WEBP. Maximum 20 MB.
              </p>
            </div>
          </div>
          <Input
            type="file"
            accept=".pdf,image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
            required
          />
        </label>

        <Input
          type="text"
          placeholder={methodLabel === "Virement bancaire" ? "Reference du virement (optionnel)" : "Reference bordereau (optionnel)"}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          className="h-11 rounded-xl text-sm"
        />

        {error && <p className="text-xs text-red-600">{error}</p>}
        <Button
          type="submit"
          disabled={!proofFile || submitting}
          className="h-11 w-full rounded-xl bg-slate-900 font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          Envoyer ma preuve
        </Button>
      </form>
    </div>
  );
}
