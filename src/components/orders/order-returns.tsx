"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2, PackageSearch, Plus, Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createReturnMerchandise, updateReturnMerchandiseStatus } from "@/lib/actions/order.actions";
import { formatDate } from "@/lib/utils";

type ReturnLine = {
  id: string;
  description: string;
  quantity: number;
  condition: string;
  notes?: string | null;
};

export type ReturnMerchandise = {
  id: string;
  status: string;
  reason: string;
  notes?: string | null;
  trackingNumber?: string | null;
  warehouseSite?: string | null;
  approvedAt?: Date | null;
  receivedAt?: Date | null;
  createdAt: Date;
  lines: ReturnLine[];
};

const STATUS_LABELS: Record<string, string> = {
  REQUESTED: "Demande",
  APPROVAL_PENDING: "En attente validation",
  APPROVED: "Valide",
  REJECTED: "Rejete",
  IN_TRANSIT_TO_WAREHOUSE: "En transit retour",
  RECEIVED: "Recu entrepot",
  INSPECTED: "Inspecte",
  RESOLVED: "Resolue",
  CLOSED: "Cloture",
};

const STATUS_COLORS: Record<string, string> = {
  REQUESTED: "bg-slate-100 text-slate-700",
  APPROVAL_PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-blue-100 text-blue-700",
  REJECTED: "bg-red-100 text-red-700",
  IN_TRANSIT_TO_WAREHOUSE: "bg-indigo-100 text-indigo-700",
  RECEIVED: "bg-emerald-100 text-emerald-700",
  INSPECTED: "bg-cyan-100 text-cyan-700",
  RESOLVED: "bg-green-100 text-green-700",
  CLOSED: "bg-zinc-100 text-zinc-700",
};

const STATUS_OPTIONS = [
  "REQUESTED",
  "APPROVAL_PENDING",
  "APPROVED",
  "REJECTED",
  "IN_TRANSIT_TO_WAREHOUSE",
  "RECEIVED",
  "INSPECTED",
  "RESOLVED",
  "CLOSED",
] as const;

interface OrderReturnsProps {
  orderId: string;
  returns: ReturnMerchandise[];
  canManage?: boolean;
}

export function OrderReturns({ orderId, returns, canManage = false }: OrderReturnsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    reason: "",
    notes: "",
    lineDescription: "Retour article commande",
    lineQuantity: "1",
  });

  const openCount = useMemo(
    () => returns.filter((r) => !["RESOLVED", "CLOSED", "REJECTED"].includes(r.status)).length,
    [returns]
  );

  const handleCreate = () => {
    startTransition(async () => {
      if (!form.reason.trim()) {
        toast.error("Motif requis");
        return;
      }
      const result = await createReturnMerchandise(orderId, {
        reason: form.reason,
        notes: form.notes || undefined,
        lines: [
          {
            description: form.lineDescription || "Retour article",
            quantity: Number(form.lineQuantity || "1"),
            condition: "UNKNOWN",
          },
        ],
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("RMA cree");
      setCreateOpen(false);
      setForm({
        reason: "",
        notes: "",
        lineDescription: "Retour article commande",
        lineQuantity: "1",
      });
      router.refresh();
    });
  };

  const handleStatus = (rmaId: string, nextStatus: (typeof STATUS_OPTIONS)[number]) => {
    startTransition(async () => {
      const result = await updateReturnMerchandiseStatus(rmaId, nextStatus);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Statut RMA mis a jour");
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {returns.length === 0 ? "Aucun retour" : `${returns.length} retour(s)`}
          </p>
          {openCount > 0 && (
            <Badge className="bg-amber-100 text-amber-700">{openCount} actif(s)</Badge>
          )}
        </div>
        {canManage && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Ouvrir un retour (RMA)
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Nouveau retour marchandise</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Motif</Label>
                  <Textarea
                    value={form.reason}
                    onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                    placeholder="Defaut qualite, article manquant, produit endommage..."
                    rows={3}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Notes</Label>
                  <Input
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Optionnel"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label>Ligne</Label>
                    <Input
                      value={form.lineDescription}
                      onChange={(e) => setForm((f) => ({ ...f, lineDescription: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Qté</Label>
                    <Input
                      type="number"
                      min="1"
                      value={form.lineQuantity}
                      onChange={(e) => setForm((f) => ({ ...f, lineQuantity: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Creer RMA
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {returns.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Aucun retour marchandise enregistre.
        </div>
      )}

      <div className="space-y-3">
        {returns.map((rma) => (
          <Card key={rma.id}>
            <CardHeader className="p-4 pb-2">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">RMA {rma.id.slice(0, 8)}</span>
                    <Badge className={STATUS_COLORS[rma.status] ?? "bg-slate-100 text-slate-700"}>
                      {STATUS_LABELS[rma.status] ?? rma.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Cree le {formatDate(rma.createdAt)}
                    {rma.approvedAt ? ` · Valide le ${formatDate(rma.approvedAt)}` : ""}
                    {rma.receivedAt ? ` · Recu le ${formatDate(rma.receivedAt)}` : ""}
                  </p>
                </div>

                {canManage && (
                  <Select
                    value={rma.status}
                    onValueChange={(v) => handleStatus(rma.id, v as (typeof STATUS_OPTIONS)[number])}
                  >
                    <SelectTrigger className="h-8 w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <p className="text-sm">{rma.reason}</p>
              {rma.notes ? <p className="text-xs text-muted-foreground">{rma.notes}</p> : null}
              {rma.trackingNumber ? (
                <div className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
                  <Truck className="h-3.5 w-3.5" />
                  Tracking retour: {rma.trackingNumber}
                </div>
              ) : null}

              <div className="space-y-2">
                {rma.lines.map((line) => (
                  <div key={line.id} className="rounded-md border bg-muted/30 p-2 text-xs">
                    <div className="flex items-center gap-1 font-medium">
                      <PackageSearch className="h-3.5 w-3.5" />
                      {line.description}
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      Qté: {line.quantity} · Condition: {line.condition}
                      {line.notes ? ` · ${line.notes}` : ""}
                    </div>
                  </div>
                ))}
              </div>

              {["RESOLVED", "CLOSED"].includes(rma.status) && (
                <div className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-xs text-green-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Flux retour termine
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

