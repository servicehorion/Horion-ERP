"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createDispute, resolveDispute } from "@/lib/actions/order.actions";
import { formatDate } from "@/lib/utils";
import { CurrencyDisplay } from "@/components/shared/currency-display";

export type Dispute = {
  id: string;
  type: string;
  status: string;
  description: string;
  resolution?: string | null;
  amount?: any;
  currency?: string | null;
  createdAt: Date;
  resolvedAt?: Date | null;
};

const TYPE_LABELS: Record<string, string> = {
  QUALITY:       "Qualité",
  DELAY:         "Délai",
  PRICING:       "Tarification",
  MISSING_ITEMS: "Articles manquants",
  DAMAGE:        "Dommage",
  OTHER:         "Autre",
};

const STATUS_COLORS: Record<string, string> = {
  OPEN:          "bg-red-100 text-red-700",
  INVESTIGATING: "bg-amber-100 text-amber-700",
  RESOLVED:      "bg-green-100 text-green-700",
  ESCALATED:     "bg-purple-100 text-purple-700",
  CLOSED:        "bg-gray-100 text-gray-500",
};

const STATUS_LABELS: Record<string, string> = {
  OPEN:          "Ouvert",
  INVESTIGATING: "En cours d'investigation",
  RESOLVED:      "Résolu",
  ESCALATED:     "Escaladé",
  CLOSED:        "Clôturé",
};

interface OrderDisputesProps {
  orderId: string;
  disputes: Dispute[];
  canManage?: boolean;
}

export function OrderDisputes({ orderId, disputes, canManage }: OrderDisputesProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [resolveOpenFor, setResolveOpenFor] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");

  // Create dispute form
  const [form, setForm] = useState({
    type: "QUALITY",
    description: "",
    amount: "",
    currency: "XAF",
  });

  const openDisputes = disputes.filter((d) => !["RESOLVED", "CLOSED"].includes(d.status));

  const handleCreate = () => {
    startTransition(async () => {
      if (!form.description.trim()) { toast.error("Description requise"); return; }
      const res = await createDispute(orderId, {
        type: form.type,
        description: form.description,
        amount: form.amount ? Number(form.amount) : undefined,
        currency: form.currency || undefined,
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("Litige créé");
        setCreateOpen(false);
        setForm({ type: "QUALITY", description: "", amount: "", currency: "XAF" });
        router.refresh();
      }
    });
  };

  const handleResolve = (disputeId: string) => {
    startTransition(async () => {
      if (!resolution.trim()) { toast.error("Résolution requise"); return; }
      const res = await resolveDispute(disputeId, resolution);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Litige résolu");
        setResolveOpenFor(null);
        setResolution("");
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {disputes.length === 0 ? "Aucun litige" : `${disputes.length} litige${disputes.length > 1 ? "s" : ""}`}
          </p>
          {openDisputes.length > 0 && (
            <Badge className="bg-red-100 text-red-700">
              {openDisputes.length} ouvert{openDisputes.length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        {canManage && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="destructive" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Ouvrir un litige
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Ouvrir un litige</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Type de litige</Label>
                  <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TYPE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Décrivez le problème en détail..."
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Montant en litige</Label>
                    <Input
                      type="number"
                      min="0"
                      value={form.amount}
                      onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                      placeholder="Optionnel"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Devise</Label>
                    <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["XAF", "USD", "EUR", "CNY"].map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={isPending} variant="destructive">
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Ouvrir le litige
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {disputes.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Aucun litige pour cette commande.
        </div>
      )}

      <div className="space-y-3">
        {disputes.map((dispute) => {
          const isOpen = !["RESOLVED", "CLOSED"].includes(dispute.status);
          return (
            <Card key={dispute.id} className={isOpen ? "border-red-200" : ""}>
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start gap-3">
                  <span className={isOpen ? "text-red-500 mt-0.5" : "text-green-500 mt-0.5"}>
                    {isOpen
                      ? <AlertTriangle className="h-4 w-4" />
                      : <CheckCircle2 className="h-4 w-4" />
                    }
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{TYPE_LABELS[dispute.type] ?? dispute.type}</span>
                      <Badge className={STATUS_COLORS[dispute.status] ?? ""}>
                        {STATUS_LABELS[dispute.status] ?? dispute.status}
                      </Badge>
                      {dispute.amount != null && (
                        <span className="text-xs font-medium text-red-600">
                          <CurrencyDisplay amount={Number(dispute.amount)} currency={dispute.currency ?? "XAF"} />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Ouvert le {formatDate(dispute.createdAt)}
                      {dispute.resolvedAt && ` · Résolu le ${formatDate(dispute.resolvedAt)}`}
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="px-4 pb-4 space-y-2">
                <p className="text-sm">{dispute.description}</p>

                {dispute.resolution && (
                  <div className="rounded-md bg-green-50 border border-green-200 p-2 text-xs">
                    <p className="font-medium text-green-700 mb-0.5">Résolution</p>
                    <p className="text-green-800">{dispute.resolution}</p>
                  </div>
                )}

                {/* Resolve action */}
                {canManage && isOpen && (
                  resolveOpenFor === dispute.id ? (
                    <div className="space-y-2 pt-2 border-t">
                      <Textarea
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value)}
                        placeholder="Décrivez comment le litige a été résolu..."
                        rows={3}
                        className="text-xs"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleResolve(dispute.id)}
                          disabled={isPending}
                        >
                          {isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                          Marquer comme résolu
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => { setResolveOpenFor(null); setResolution(""); }}
                        >
                          Annuler
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setResolveOpenFor(dispute.id)}
                    >
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Résoudre
                    </Button>
                  )
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
