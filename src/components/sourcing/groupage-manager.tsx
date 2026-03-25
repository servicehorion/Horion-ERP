"use client";

import { useState, useTransition } from "react";
import {
  Package,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Truck,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createGroupageBatch,
  addToGroupageBatch,
  removeFromGroupageBatch,
  updateGroupageBatchStatus,
  createShipmentsFromGroupageBatch,
} from "@/lib/actions/sourcing.actions";

// ── Types ──────────────────────────────────────────────────────────────────

interface GroupageItem {
  id: string;
  sourcingCaseId: string;
  weightKg?: number | null;
  cbm?: number | null;
  notes?: string | null;
  sourcingCase?: {
    requirement: string;
    order?: { orderNumber: string };
  };
}

interface GroupageBatch {
  id: string;
  name: string;
  destination: string;
  status: string;
  mode: string;
  totalWeight?: number | null;
  totalCbm?: number | null;
  etd?: string | Date | null;
  eta?: string | Date | null;
  notes?: string | null;
  items: GroupageItem[];
  shipments?: { id: string; status: string }[];
}

interface Opportunity {
  id: string;
  requirement: string;
  status: string;
  weightKg?: number | null;
  taxableWeightKg?: number | null;
  order?: { orderNumber: string; contact?: { name: string } };
}

interface GroupageManagerProps {
  initialBatches: GroupageBatch[];
  opportunities: Opportunity[];
}

// ── Status helpers ─────────────────────────────────────────────────────────

const BATCH_STATUS_LABELS: Record<string, string> = {
  OPEN: "Ouvert",
  READY: "Prêt",
  IN_TRANSIT: "En transit",
  DELIVERED: "Livré",
  CANCELLED: "Annulé",
};

const BATCH_STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  READY: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  IN_TRANSIT: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
  DELIVERED: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const NEXT_STATUS: Record<string, string | null> = {
  OPEN: "READY",
  READY: "IN_TRANSIT",
  IN_TRANSIT: "DELIVERED",
  DELIVERED: null,
  CANCELLED: null,
};

const NEXT_STATUS_LABEL: Record<string, string> = {
  OPEN: "→ Marquer Prêt",
  READY: "→ Partir en transit",
  IN_TRANSIT: "→ Marquer Livré",
};

// ── Create Batch Form ──────────────────────────────────────────────────────

function CreateBatchForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: "",
    destination: "Brazzaville, Congo",
    mode: "AIR",
    etd: "",
    notes: "",
  });

  const handleCreate = () => {
    startTransition(async () => {
      const result = await createGroupageBatch({
        name: form.name,
        destination: form.destination,
        mode: form.mode,
        etd: form.etd || undefined,
        notes: form.notes || undefined,
      });
      if (!result.error) {
        setOpen(false);
        setForm({ name: "", destination: "Brazzaville, Congo", mode: "AIR", etd: "", notes: "" });
        onCreated();
      }
    });
  };

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Plus className="h-3.5 w-3.5" />
        Nouveau groupage
      </Button>
    );
  }

  return (
    <Card className="border-blue-200 dark:border-blue-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Créer un lot de groupage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Nom du lot *</Label>
            <Input
              placeholder="GRP-2026-001"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="h-8 text-sm mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Destination</Label>
            <Input
              value={form.destination}
              onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
              className="h-8 text-sm mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Mode</Label>
            <select
              value={form.mode}
              onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))}
              className="h-8 w-full text-sm rounded-md border border-input bg-background px-2 mt-1"
            >
              <option value="AIR">Aérien</option>
              <option value="SEA">Maritime</option>
              <option value="ROAD">Routier</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">ETD prévue</Label>
            <Input
              type="date"
              value={form.etd}
              onChange={(e) => setForm((f) => ({ ...f, etd: e.target.value }))}
              className="h-8 text-sm mt-1"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">Notes</Label>
          <Input
            placeholder="Instructions spéciales..."
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="h-8 text-sm mt-1"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button size="sm" onClick={handleCreate} disabled={isPending || !form.name}>
            Créer le lot
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Batch Card ─────────────────────────────────────────────────────────────

function BatchCard({
  batch,
  opportunities,
  onUpdated,
}: {
  batch: GroupageBatch;
  opportunities: Opportunity[];
  onUpdated: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [addingCase, setAddingCase] = useState("");

  const availableOpps = opportunities.filter(
    (o) => !batch.items.some((item) => item.sourcingCaseId === o.id)
  );

  const totalWeight = batch.items.reduce((s, i) => s + (Number(i.weightKg) || 0), 0);
  const totalCbm = batch.items.reduce((s, i) => s + (Number(i.cbm) || 0), 0);

  const handleAddCase = (caseId: string) => {
    if (!caseId) return;
    startTransition(async () => {
      await addToGroupageBatch(batch.id, caseId);
      setAddingCase("");
      onUpdated();
    });
  };

  const handleRemoveItem = (itemId: string) => {
    startTransition(async () => {
      await removeFromGroupageBatch(itemId);
      onUpdated();
    });
  };

  const handleNextStatus = () => {
    const next = NEXT_STATUS[batch.status];
    if (!next) return;
    startTransition(async () => {
      await updateGroupageBatchStatus(batch.id, next);
      onUpdated();
    });
  };

  const handleCreateShipments = () => {
    startTransition(async () => {
      const result = await createShipmentsFromGroupageBatch(batch.id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      const created = result?.data?.created ?? 0;
      const skipped = result?.data?.skipped ?? 0;
      toast.success(`Expéditions créées: ${created}, ignorées: ${skipped}`);
      onUpdated();
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">{batch.name}</CardTitle>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                BATCH_STATUS_COLORS[batch.status] ?? ""
              }`}
            >
              {BATCH_STATUS_LABELS[batch.status] ?? batch.status}
            </span>
            <Badge variant="secondary" className="text-[10px]">
              {batch.mode}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {NEXT_STATUS[batch.status] && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleNextStatus}
                disabled={isPending}
                className="text-xs"
              >
                {NEXT_STATUS_LABEL[batch.status]}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleCreateShipments}
              disabled={isPending}
              className="text-xs"
            >
              <Truck className="mr-1 h-3.5 w-3.5" /> Expéditions
            </Button>
            <button onClick={() => setExpanded((v) => !v)} className="text-muted-foreground hover:text-foreground">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Summary row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
          <span>
            <Truck className="h-3 w-3 inline mr-1" />
            {batch.destination}
          </span>
          <span>{batch.items.length} colis</span>
          {totalWeight > 0 && <span>{totalWeight.toFixed(2)} kg</span>}
          {totalCbm > 0 && <span>{totalCbm.toFixed(3)} m³</span>}
          {batch.etd && (
            <span>
              <Clock className="h-3 w-3 inline mr-1" />
              ETD {new Date(batch.etd).toLocaleDateString("fr-FR")}
            </span>
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 pt-0">
          {/* Items list */}
          {batch.items.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Aucun colis dans ce lot</p>
          ) : (
            <div className="space-y-2">
              {batch.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium">
                      {item.sourcingCase?.order?.orderNumber ?? "–"}
                    </span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      {item.sourcingCase?.requirement}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {item.weightKg != null && <span>{Number(item.weightKg).toFixed(2)} kg</span>}
                    {item.cbm != null && <span>{Number(item.cbm).toFixed(3)} m³</span>}
                    {batch.status === "OPEN" && (
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={isPending}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {batch.shipments && batch.shipments.length > 0 ? (
            <div className="flex flex-wrap gap-2 text-xs">
              {batch.shipments.map((shipment) => (
                <Badge key={shipment.id} variant="outline">
                  {shipment.status}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Aucune expédition créée.</p>
          )}

          {/* Add case */}
          {batch.status === "OPEN" && availableOpps.length > 0 && (
            <div className="flex items-center gap-2 border-t pt-3">
              <select
                value={addingCase}
                onChange={(e) => setAddingCase(e.target.value)}
                className="h-8 flex-1 text-sm rounded-md border border-input bg-background px-2"
              >
                <option value="">Ajouter un cas...</option>
                {availableOpps.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.order?.orderNumber ?? o.id.slice(0, 8)} — {o.requirement.slice(0, 40)}
                    {o.weightKg != null ? ` (${Number(o.weightKg).toFixed(1)} kg)` : ""}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                onClick={() => handleAddCase(addingCase)}
                disabled={isPending || !addingCase}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {batch.notes && (
            <p className="text-xs text-muted-foreground border-t pt-2">{batch.notes}</p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function GroupageManager({ initialBatches, opportunities }: GroupageManagerProps) {
  const [batches, setBatches] = useState(initialBatches);
  const [reload, setReload] = useState(0);

  // Trigger page reload to refresh server data
  const handleUpdated = () => {
    window.location.reload();
  };

  const activeBatches = batches.filter((b) => !["DELIVERED", "CANCELLED"].includes(b.status));
  const archivedBatches = batches.filter((b) => ["DELIVERED", "CANCELLED"].includes(b.status));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Lots de groupage</h2>
          <p className="text-sm text-muted-foreground">
            {activeBatches.length} lot(s) actif(s)
          </p>
        </div>
        <CreateBatchForm onCreated={handleUpdated} />
      </div>

      {/* Opportunities alert */}
      {opportunities.length > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800 dark:text-yellow-300 text-sm">
                {opportunities.length} opportunité(s) de groupage détectée(s)
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                Ces cas sont confirmés avec des poids renseignés et peuvent être consolidés :
              </p>
              <div className="mt-2 space-y-1">
                {opportunities.slice(0, 5).map((o) => (
                  <div key={o.id} className="text-xs text-yellow-800 dark:text-yellow-300">
                    <span className="font-medium">{o.order?.orderNumber ?? "–"}</span>
                    {" — "}
                    {o.requirement.slice(0, 50)}
                    {o.weightKg != null && (
                      <span className="ml-2 text-yellow-600">
                        {Number(o.weightKg).toFixed(1)} kg
                      </span>
                    )}
                  </div>
                ))}
                {opportunities.length > 5 && (
                  <p className="text-xs text-yellow-600">
                    +{opportunities.length - 5} autres...
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active batches */}
      {activeBatches.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">Aucun lot de groupage actif</p>
          <p className="text-xs text-muted-foreground mt-1">
            Créez un lot pour consolider plusieurs expéditions
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeBatches.map((batch) => (
            <BatchCard
              key={batch.id}
              batch={batch}
              opportunities={opportunities}
              onUpdated={handleUpdated}
            />
          ))}
        </div>
      )}

      {/* Archived */}
      {archivedBatches.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Lots archivés ({archivedBatches.length})
          </h3>
          <div className="space-y-3">
            {archivedBatches.map((batch) => (
              <BatchCard
                key={batch.id}
                batch={batch}
                opportunities={[]}
                onUpdated={handleUpdated}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
