"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { addOfferToSourcing } from "@/lib/actions/sourcing.actions";
import { Loader2, Plus } from "lucide-react";

interface Supplier {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
  rating: number;
}

export function AddOfferForm({
  sourcingCaseId,
  suppliers,
}: {
  sourcingCaseId: string;
  suppliers: Supplier[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    const moq = fd.get("moq") as string;
    const leadTimeDays = fd.get("leadTimeDays") as string;

    const result = await addOfferToSourcing({
      sourcingCaseId,
      supplierId: fd.get("supplierId") as string,
      unitPrice: parseFloat(fd.get("unitPrice") as string),
      currency: (fd.get("currency") as string) || "RMB",
      moq: moq ? parseInt(moq) : undefined,
      leadTimeDays: leadTimeDays ? parseInt(leadTimeDays) : undefined,
      sampleAvailable: fd.get("sampleAvailable") === "true",
      notes: (fd.get("notes") as string) || undefined,
      validTo: (fd.get("validTo") as string) || undefined,
    });

    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Ajouter une offre
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle offre fournisseur</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}

          <div className="space-y-2">
            <Label>Fournisseur *</Label>
            <Select name="supplierId" required>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} {s.country ? `(${s.country})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prix unitaire *</Label>
              <Input name="unitPrice" type="number" step="0.01" min="0.01" required />
            </div>
            <div className="space-y-2">
              <Label>Devise</Label>
              <Select name="currency" defaultValue="RMB">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RMB">RMB</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="XAF">XAF</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>MOQ (quantité min.)</Label>
              <Input name="moq" type="number" min="0" />
            </div>
            <div className="space-y-2">
              <Label>Délai (jours)</Label>
              <Input name="leadTimeDays" type="number" min="0" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Échantillon disponible</Label>
              <Select name="sampleAvailable" defaultValue="false">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Oui</SelectItem>
                  <SelectItem value="false">Non</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valide jusqu&apos;au</Label>
              <Input name="validTo" type="date" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea name="notes" rows={2} placeholder="Conditions particulières..." />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Ajouter l&apos;offre
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
