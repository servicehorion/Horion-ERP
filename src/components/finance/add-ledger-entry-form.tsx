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
import { createLedgerEntry } from "@/lib/actions/finance.actions";
import { Loader2, Plus } from "lucide-react";

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface CostCenter {
  id: string;
  code: string;
  name: string;
}

export function AddLedgerEntryForm({
  accounts,
  costCenters = [],
}: {
  accounts: Account[];
  costCenters?: CostCenter[];
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
    const result = await createLedgerEntry({
      accountId: fd.get("accountId") as string,
      contraAccountId: fd.get("contraAccountId") as string,
      type: fd.get("type") as string,
      amount: parseFloat(fd.get("amount") as string),
      currency: (fd.get("currency") as string) || "XAF",
      description: fd.get("description") as string,
      reference: (fd.get("reference") as string) || undefined,
      costCenterId: (fd.get("costCenterId") as string) || undefined,
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
          Nouvelle ecriture
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle ecriture comptable</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}

          <div className="space-y-2">
            <Label>Compte *</Label>
            <Select name="accountId" required>
              <SelectTrigger>
                <SelectValue placeholder="Selectionner un compte" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.code} - {a.name} ({a.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Contrepartie *</Label>
            <Select name="contraAccountId" required>
              <SelectTrigger>
                <SelectValue placeholder="Selectionner la contrepartie" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={`contra-${a.id}`} value={a.id}>
                    {a.code} - {a.name} ({a.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select name="type" required defaultValue="DEBIT">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DEBIT">Debit</SelectItem>
                  <SelectItem value="CREDIT">Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Montant *</Label>
              <Input name="amount" type="number" step="0.01" min="0.01" required />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description *</Label>
            <Textarea name="description" rows={2} required placeholder="Motif de l'ecriture..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Devise</Label>
              <Select name="currency" defaultValue="XAF">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="XAF">XAF</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="RMB">RMB</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input name="reference" placeholder="N° piece..." />
            </div>
          </div>

          {costCenters.length > 0 && (
            <div className="space-y-2">
              <Label>Centre de cout</Label>
              <Select name="costCenterId">
                <SelectTrigger><SelectValue placeholder="Selectionner" /></SelectTrigger>
                <SelectContent>
                  {costCenters.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code} - {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer l'ecriture
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
