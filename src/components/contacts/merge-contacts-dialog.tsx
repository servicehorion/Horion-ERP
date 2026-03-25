"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GitMerge, Search, Check, Minus, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { findDuplicateContacts, mergeContacts } from "@/lib/actions/contact.actions";

// ── Types ──────────────────────────────────────────────────────────────────

type DuplicateCandidate = {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  type: string;
  tags: unknown;
  _count: { orders: number; leads: number };
};

interface Props {
  contactId: string;
  contactName: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TYPE_LABELS: Record<string, string> = {
  CLIENT: "Client", PROSPECT: "Prospect", SUPPLIER: "Fournisseur",
  FREIGHT_PARTNER: "Transitaire", CUSTOMS_BROKER: "Douanier",
  QC_PARTNER: "QC", OTHER: "Autre",
};

// ── Field Row ──────────────────────────────────────────────────────────────

function FieldRow({ label, keepVal, mergeVal }: { label: string; keepVal?: string | null; mergeVal?: string | null }) {
  return (
    <div className="grid grid-cols-[80px_1fr_1fr] items-center gap-2 py-1.5 border-b last:border-0">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <div className="flex items-center gap-1 text-sm min-w-0">
        {keepVal ? (
          <>
            <Check className="h-3 w-3 text-green-600 shrink-0" />
            <span className="truncate">{keepVal}</span>
          </>
        ) : (
          <Minus className="h-3 w-3 text-muted-foreground" />
        )}
      </div>
      <div className="flex items-center gap-1 text-sm min-w-0">
        {mergeVal ? (
          <>
            <Check className="h-3 w-3 text-blue-600 shrink-0" />
            <span className="truncate text-muted-foreground">{mergeVal}</span>
          </>
        ) : (
          <Minus className="h-3 w-3 text-muted-foreground" />
        )}
      </div>
    </div>
  );
}

// ── Main Dialog ────────────────────────────────────────────────────────────

export function MergeContactsDialog({
  contactId,
  contactName,
  contactPhone,
  contactEmail,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<"search" | "compare">("search");
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<DuplicateCandidate[]>([]);
  const [selected, setSelected] = useState<DuplicateCandidate | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSearching, setIsSearching] = useState(false);

  function handleClose() {
    onOpenChange(false);
    // Reset state after animation
    setTimeout(() => {
      setStep("search");
      setQuery("");
      setCandidates([]);
      setSelected(null);
    }, 200);
  }

  function handleSearch() {
    setIsSearching(true);
    startTransition(async () => {
      const res = await findDuplicateContacts(contactId);
      // Filter by query if provided
      const all = res.data ?? [];
      const filtered = query.trim()
        ? all.filter((c) =>
            c.name.toLowerCase().includes(query.toLowerCase()) ||
            (c.company ?? "").toLowerCase().includes(query.toLowerCase()) ||
            (c.phone ?? "").includes(query) ||
            (c.email ?? "").toLowerCase().includes(query.toLowerCase())
          )
        : all;
      setCandidates(filtered);
      setIsSearching(false);
    });
  }

  function handleSelect(candidate: DuplicateCandidate) {
    setSelected(candidate);
    setStep("compare");
  }

  function handleConfirmMerge() {
    if (!selected) return;
    startTransition(async () => {
      const res = await mergeContacts(contactId, selected.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`"${selected.name}" a été fusionné dans "${contactName}"`);
      handleClose();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-primary" />
            Fusionner un contact doublon
          </DialogTitle>
          <DialogDescription>
            Sélectionnez le contact à fusionner dans{" "}
            <strong>{contactName}</strong>. Ses leads et commandes seront transférés.
          </DialogDescription>
        </DialogHeader>

        {/* ── Step 1: Search ── */}
        {step === "search" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Nom, email, téléphone…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={isPending || isSearching}>
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {/* Auto-search on open */}
            {candidates.length === 0 && !isSearching && (
              <div className="text-center py-6 text-muted-foreground text-sm space-y-2">
                <p>Recherchez un contact par nom, email ou téléphone.</p>
                {(contactPhone || contactEmail) && (
                  <Button variant="link" size="sm" className="text-xs" onClick={handleSearch}>
                    Chercher doublons automatiques (même phone/email)
                  </Button>
                )}
              </div>
            )}

            {candidates.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {candidates.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{c.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {TYPE_LABELS[c.type] ?? c.type}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 space-x-2">
                        {c.company && <span>{c.company}</span>}
                        {c.phone && <span>{c.phone}</span>}
                        {c.email && <span>{c.email}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {c._count.orders} commande(s) · {c._count.leads} lead(s)
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleSelect(c)}>
                      Choisir
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Compare ── */}
        {step === "compare" && selected && (
          <div className="space-y-4">
            {/* Column headers */}
            <div className="grid grid-cols-[80px_1fr_1fr] gap-2 pb-1">
              <div />
              <div className="text-center">
                <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                  ✓ Conserver
                </Badge>
                <p className="text-xs font-medium mt-1 truncate">{contactName}</p>
              </div>
              <div className="text-center">
                <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
                  → Fusionner
                </Badge>
                <p className="text-xs font-medium mt-1 truncate">{selected.name}</p>
              </div>
            </div>

            {/* Field comparison */}
            <div className="rounded-lg border divide-y text-sm px-3">
              <FieldRow label="Entreprise" keepVal={null} mergeVal={selected.company} />
              <FieldRow label="Téléphone" keepVal={contactPhone} mergeVal={selected.phone} />
              <FieldRow label="Email" keepVal={contactEmail} mergeVal={selected.email} />
              <FieldRow label="WhatsApp" keepVal={null} mergeVal={selected.whatsapp} />
            </div>

            {/* Stats */}
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-amber-800">
                <strong>{selected._count.leads} lead(s)</strong> et{" "}
                <strong>{selected._count.orders} commande(s)</strong> de{" "}
                <em>{selected.name}</em> seront rattachés à <em>{contactName}</em>.
                Le contact fusionné sera supprimé définitivement.
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === "search" ? (
            <Button variant="outline" onClick={handleClose}>Annuler</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("search")}>
                ← Rechoisir
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmMerge}
                disabled={isPending}
              >
                {isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Fusion en cours…</>
                ) : (
                  <><GitMerge className="mr-2 h-4 w-4" />Confirmer la fusion</>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
