"use client";

import { useState, useTransition, useEffect } from "react";
import { Package, Weight, AlertTriangle, CheckCircle2, Upload, QrCode } from "lucide-react";

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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

import { createWarehouseReceipt } from "@/lib/actions/logistics.actions";

type WarehouseFormState = {
  shipmentId: string;
  actualWeightKg: string;
  actualLengthCm: string;
  actualWidthCm: string;
  actualHeightCm: string;
  condition: "OK" | "DAMAGED" | "WRONG_ITEM" | "PARTIAL";
  conditionNotes: string;
  warehouseLocation: string;
  consolidationNote: string;
  readyToShip: boolean;
};

const INITIAL_STATE: WarehouseFormState = {
  shipmentId: "",
  actualWeightKg: "",
  actualLengthCm: "",
  actualWidthCm: "",
  actualHeightCm: "",
  condition: "OK",
  conditionNotes: "",
  warehouseLocation: "",
  consolidationNote: "",
  readyToShip: false,
};

const CONDITION_LABELS: Record<string, { label: string; color: string }> = {
  OK: { label: "Conforme", color: "bg-green-100 text-green-800" },
  DAMAGED: { label: "Endommagé", color: "bg-red-100 text-red-800" },
  WRONG_ITEM: { label: "Mauvais article", color: "bg-orange-100 text-orange-800" },
  PARTIAL: { label: "Incomplet", color: "bg-yellow-100 text-yellow-800" },
};

export function WarehouseReceiptForm({
  prefillShipmentId,
  onSuccess,
}: {
  prefillShipmentId?: string;
  onSuccess?: (receipt: unknown) => void;
}) {
  const [form, setForm] = useState<WarehouseFormState>({
    ...INITIAL_STATE,
    shipmentId: prefillShipmentId ?? "",
  });
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ error?: string; success?: boolean } | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [newPhotoUrl, setNewPhotoUrl] = useState("");

  // Auto-calculate volumetric and chargeable weight
  const volWeight =
    form.actualLengthCm && form.actualWidthCm && form.actualHeightCm
      ? (Number(form.actualLengthCm) * Number(form.actualWidthCm) * Number(form.actualHeightCm)) /
        6000
      : null;
  const actualW = Number(form.actualWeightKg) || 0;
  const chargeableW =
    volWeight !== null ? Math.ceil(Math.max(actualW, volWeight) * 10) / 10 : actualW;

  function setField<K extends keyof WarehouseFormState>(key: K, value: WarehouseFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addPhotoUrl() {
    const trimmed = newPhotoUrl.trim();
    if (!trimmed || photoUrls.includes(trimmed)) return;
    try {
      new URL(trimmed);
      setPhotoUrls((prev) => [...prev, trimmed]);
      setNewPhotoUrl("");
    } catch {
      // ignore invalid URL
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);

    startTransition(async () => {
      const payload = {
        shipmentId: form.shipmentId,
        actualWeightKg: Number(form.actualWeightKg),
        actualLengthCm: form.actualLengthCm ? Number(form.actualLengthCm) : undefined,
        actualWidthCm: form.actualWidthCm ? Number(form.actualWidthCm) : undefined,
        actualHeightCm: form.actualHeightCm ? Number(form.actualHeightCm) : undefined,
        condition: form.condition,
        conditionNotes: form.conditionNotes || undefined,
        photoUrls,
        warehouseLocation: form.warehouseLocation || undefined,
        consolidationNote: form.consolidationNote || undefined,
        readyToShip: form.readyToShip,
      };

      const res = await createWarehouseReceipt(payload);
      if (res.error) {
        setResult({ error: res.error });
      } else {
        setResult({ success: true });
        setForm(INITIAL_STATE);
        setPhotoUrls([]);
        onSuccess?.(res.data);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Shipment ID */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <QrCode className="h-4 w-4" />
            Identification de l&apos;expédition
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="shipmentId">ID Expédition (QR scan ou saisie manuelle)</Label>
            <Input
              id="shipmentId"
              value={form.shipmentId}
              onChange={(e) => setField("shipmentId", e.target.value)}
              placeholder="Scannez le QR ou entrez l'ID de l'expédition"
              required
            />
          </div>
          <div>
            <Label htmlFor="warehouseLocation">Emplacement entrepôt</Label>
            <Input
              id="warehouseLocation"
              value={form.warehouseLocation}
              onChange={(e) => setField("warehouseLocation", e.target.value)}
              placeholder="ex: Zone A, Étagère 3, Box 12"
            />
          </div>
        </CardContent>
      </Card>

      {/* Weight & Dimensions — INTERNAL ONLY */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Weight className="h-4 w-4" />
            Poids &amp; Dimensions
            <Badge variant="outline" className="text-xs ml-2 border-orange-300 text-orange-600">
              Usage interne uniquement
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="actualWeightKg">Poids réel (kg) *</Label>
              <Input
                id="actualWeightKg"
                type="number"
                step="0.001"
                min="0.001"
                value={form.actualWeightKg}
                onChange={(e) => setField("actualWeightKg", e.target.value)}
                required
              />
            </div>
            <div />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="lengthCm">Longueur (cm)</Label>
              <Input
                id="lengthCm"
                type="number"
                step="0.1"
                min="0"
                value={form.actualLengthCm}
                onChange={(e) => setField("actualLengthCm", e.target.value)}
                placeholder="L"
              />
            </div>
            <div>
              <Label htmlFor="widthCm">Largeur (cm)</Label>
              <Input
                id="widthCm"
                type="number"
                step="0.1"
                min="0"
                value={form.actualWidthCm}
                onChange={(e) => setField("actualWidthCm", e.target.value)}
                placeholder="l"
              />
            </div>
            <div>
              <Label htmlFor="heightCm">Hauteur (cm)</Label>
              <Input
                id="heightCm"
                type="number"
                step="0.1"
                min="0"
                value={form.actualHeightCm}
                onChange={(e) => setField("actualHeightCm", e.target.value)}
                placeholder="H"
              />
            </div>
          </div>

          {/* Auto-calculated weights */}
          {actualW > 0 && (
            <div className="rounded-lg bg-muted p-3 grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground text-xs mb-1">Poids réel</div>
                <div className="font-semibold">{actualW.toFixed(3)} kg</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs mb-1">
                  Poids volumétrique
                </div>
                <div className="font-semibold">
                  {volWeight !== null ? `${volWeight.toFixed(3)} kg` : "—"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs mb-1">
                  Poids facturable
                  <span className="ml-1 text-orange-500">★</span>
                </div>
                <div className="font-bold text-orange-600">
                  {chargeableW > 0 ? `${chargeableW.toFixed(1)} kg` : "—"}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Condition */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            État du colis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Condition à réception</Label>
            <Select
              value={form.condition}
              onValueChange={(v) => setField("condition", v as WarehouseFormState["condition"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CONDITION_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {form.condition !== "OK" && (
            <div>
              <Label htmlFor="conditionNotes">Description de l&apos;anomalie *</Label>
              <Textarea
                id="conditionNotes"
                value={form.conditionNotes}
                onChange={(e) => setField("conditionNotes", e.target.value)}
                placeholder="Décrivez l'anomalie constatée (obligatoire si colis non conforme)"
                rows={3}
                required
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Photos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Photos ({photoUrls.length}/3)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={newPhotoUrl}
              onChange={(e) => setNewPhotoUrl(e.target.value)}
              placeholder="URL photo (Google Drive, Supabase…)"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPhotoUrl())}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={photoUrls.length >= 3}
              onClick={addPhotoUrl}
            >
              Ajouter
            </Button>
          </div>
          {photoUrls.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {photoUrls.map((url, idx) => (
                <div key={idx} className="flex items-center gap-1 text-xs bg-muted rounded px-2 py-1">
                  <span className="truncate max-w-[180px]">Photo {idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => setPhotoUrls((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-muted-foreground hover:text-destructive ml-1"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes & Ready to ship */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="h-4 w-4" />
            Notes &amp; Expédition
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="consolidationNote">Note consolidation</Label>
            <Textarea
              id="consolidationNote"
              value={form.consolidationNote}
              onChange={(e) => setField("consolidationNote", e.target.value)}
              placeholder="Groupage, palettisation, instructions particulières…"
              rows={2}
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="readyToShip"
              checked={form.readyToShip}
              onCheckedChange={(v) => setField("readyToShip", v)}
            />
            <Label htmlFor="readyToShip" className="cursor-pointer">
              Colis prêt à expédier (passe l&apos;expédition en transit)
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Feedback */}
      {result?.error && (
        <div className="flex items-center gap-2 text-sm text-destructive rounded-lg border border-destructive/20 bg-destructive/5 p-3">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {result.error}
        </div>
      )}
      {result?.success && (
        <div className="flex items-center gap-2 text-sm text-green-700 rounded-lg border border-green-200 bg-green-50 p-3">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Réception enregistrée avec succès.
        </div>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Enregistrement…" : "Enregistrer la réception"}
      </Button>
    </form>
  );
}
