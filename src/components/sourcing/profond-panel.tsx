"use client";

import { useState, useTransition } from "react";
import {
  Calculator,
  TrendingUp,
  Package,
  AlertTriangle,
  CheckCircle,
  Upload,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  updateSourcingWeights,
  simulateSourcingMargin,
  approveSourcingMarginCeo,
  capitalizeToCatalog,
  promoteToProFond,
} from "@/lib/actions/sourcing.actions";
import {
  TransportCalculatorService,
  HORION_TRANSPORT_RATES,
} from "@/lib/services/transport-calculator.service";

interface ProfondPanelProps {
  caseId: string;
  level: string;
  status: string;
  weightKg?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  cartonCount?: number | null;
  sensitiveProduct?: boolean;
  taxableWeightKg?: number | null;
  transportCostEst?: number | null;
  unitPriceRmb?: number | null;
  quantity?: number | null;
  totalCostXAF?: number | null;
  prixFinalXAF?: number | null;
  marginPct?: number | null;
  marginApprovedByCeo?: boolean;
  canPromote: boolean;
  canApproveCeo: boolean;
  canCapitalize: boolean;
}

export function ProfondPanel({
  caseId,
  level,
  status,
  weightKg,
  lengthCm,
  widthCm,
  heightCm,
  cartonCount,
  sensitiveProduct: initialSensitive = false,
  taxableWeightKg,
  transportCostEst,
  unitPriceRmb,
  quantity,
  totalCostXAF,
  prixFinalXAF,
  marginPct,
  marginApprovedByCeo,
  canPromote,
  canApproveCeo,
  canCapitalize,
}: ProfondPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showMarginForm, setShowMarginForm] = useState(false);

  const [wForm, setWForm] = useState({
    weightKg: weightKg?.toString() ?? "",
    lengthCm: lengthCm?.toString() ?? "",
    widthCm: widthCm?.toString() ?? "",
    heightCm: heightCm?.toString() ?? "",
    cartonCount: cartonCount?.toString() ?? "1",
    isSensitive: initialSensitive,
  });

  const [mForm, setMForm] = useState({
    unitPriceRmb: unitPriceRmb?.toString() ?? "",
    quantity: quantity?.toString() ?? "",
    exchangeRate: HORION_TRANSPORT_RATES.DEFAULT_EXCHANGE_RATE.toString(),
    customsDutyPct: (HORION_TRANSPORT_RATES.DEFAULT_CUSTOMS_DUTY_PCT * 100).toString(),
  });

  // Live transport preview
  const preview = (() => {
    const w = parseFloat(wForm.weightKg);
    const l = parseFloat(wForm.lengthCm);
    const wd = parseFloat(wForm.widthCm);
    const h = parseFloat(wForm.heightCm);
    const c = parseInt(wForm.cartonCount) || 1;
    if (!w || w <= 0) return null;
    return TransportCalculatorService.calculate({
      weightKg: w,
      lengthCm: l > 0 ? l : undefined,
      widthCm: wd > 0 ? wd : undefined,
      heightCm: h > 0 ? h : undefined,
      cartonCount: c,
      isSensitive: wForm.isSensitive,
      mode: "AIR",
    });
  })();

  const flashMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handlePromote = () => {
    startTransition(async () => {
      const result = await promoteToProFond(caseId);
      if (result.error) flashMessage("error", result.error);
      else window.location.reload();
    });
  };

  const handleSaveWeights = () => {
    startTransition(async () => {
      const result = await updateSourcingWeights(caseId, {
        weightKg: parseFloat(wForm.weightKg),
        lengthCm: parseFloat(wForm.lengthCm) || undefined,
        widthCm: parseFloat(wForm.widthCm) || undefined,
        heightCm: parseFloat(wForm.heightCm) || undefined,
        cartonCount: parseInt(wForm.cartonCount) || undefined,
        isSensitive: wForm.isSensitive,
      });
      if (result.error) flashMessage("error", result.error);
      else flashMessage("success", "Dimensions sauvegardées — transport calculé automatiquement");
    });
  };

  const handleSimulateMargin = () => {
    startTransition(async () => {
      const result = await simulateSourcingMargin(caseId, {
        unitPriceRmb: parseFloat(mForm.unitPriceRmb),
        quantity: parseInt(mForm.quantity),
        exchangeRate: parseFloat(mForm.exchangeRate),
        customsDutyPct: parseFloat(mForm.customsDutyPct) / 100,
      });
      if (result.error) flashMessage("error", result.error);
      else {
        flashMessage("success", "Simulation de marge sauvegardée");
        setShowMarginForm(false);
      }
    });
  };

  const handleApproveCeo = () => {
    startTransition(async () => {
      const result = await approveSourcingMarginCeo(caseId);
      if (result.error) flashMessage("error", result.error);
      else window.location.reload();
    });
  };

  const handleCapitalize = () => {
    startTransition(async () => {
      const result = await capitalizeToCatalog(caseId);
      if (result.error) flashMessage("error", result.error);
      else flashMessage("success", "Données capitalisées vers le catalogue produit ✓");
    });
  };

  const marginNum = marginPct != null ? Number(marginPct) : null;
  const marginColor =
    marginNum == null ? "" :
    marginNum >= 30 ? "text-green-600" :
    marginNum >= 20 ? "text-orange-500" :
    "text-red-600";

  const marginStatus =
    marginNum == null ? null :
    marginNum >= 30 ? "OK" :
    marginNum >= 20 ? "WARNING" :
    "DANGER";

  const isConfirmed = status === "CONFIRMED";
  const isInfomatif = level === "INFORMATIF";

  return (
    <div className="space-y-4">
      {/* Promote to Profond banner */}
      {isInfomatif && canPromote && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-4 flex items-start justify-between gap-4">
          <div>
            <p className="font-medium text-blue-800 dark:text-blue-300 text-sm">
              Mode Indicatif actif
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
              Promouvoir ce cas pour débloquer le moteur de marge et la capitalisation
            </p>
          </div>
          <Button
            size="sm"
            onClick={handlePromote}
            disabled={isPending}
            variant="outline"
            className="border-blue-400 text-blue-700 shrink-0"
          >
            Promouvoir → Profond
          </Button>
        </div>
      )}

      {/* Toast message */}
      {message && (
        <div
          className={`rounded-lg p-3 text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Transport calculator */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="h-4 w-4" />
            Données logistiques &amp; Transport
            {taxableWeightKg != null && (
              <Badge variant="secondary" className="text-[10px] ml-auto">
                {Number(taxableWeightKg).toFixed(2)} kg taxable
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Poids réel total (kg) *</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="0.0"
                value={wForm.weightKg}
                onChange={(e) => setWForm((f) => ({ ...f, weightKg: e.target.value }))}
                className="h-8 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Nb cartons</Label>
              <Input
                type="number"
                min="1"
                value={wForm.cartonCount}
                onChange={(e) => setWForm((f) => ({ ...f, cartonCount: e.target.value }))}
                className="h-8 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Longueur carton (cm)</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="–"
                value={wForm.lengthCm}
                onChange={(e) => setWForm((f) => ({ ...f, lengthCm: e.target.value }))}
                className="h-8 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Largeur (cm)</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="–"
                value={wForm.widthCm}
                onChange={(e) => setWForm((f) => ({ ...f, widthCm: e.target.value }))}
                className="h-8 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Hauteur (cm)</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="–"
                value={wForm.heightCm}
                onChange={(e) => setWForm((f) => ({ ...f, heightCm: e.target.value }))}
                className="h-8 text-sm mt-1"
              />
            </div>
            <div className="flex items-end pb-1">
              <div className="flex items-center gap-2 mt-1">
                <Checkbox
                  id="sensitive-prod"
                  checked={wForm.isSensitive}
                  onCheckedChange={(v) => setWForm((f) => ({ ...f, isSensitive: !!v }))}
                />
                <Label htmlFor="sensitive-prod" className="text-xs cursor-pointer">
                  Produit sensible
                </Label>
              </div>
            </div>
          </div>

          {/* Live preview */}
          {preview && (
            <div className="rounded-lg bg-muted/50 border p-3 text-xs space-y-1.5">
              <p className="font-semibold text-muted-foreground">Calcul en temps réel</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <span className="text-muted-foreground">Poids volumétrique:</span>
                <span>
                  {preview.volumetricWeightKg != null
                    ? `${preview.volumetricWeightKg.toFixed(2)} kg`
                    : "–"}
                </span>
                <span className="text-muted-foreground">Poids taxable:</span>
                <span className="font-medium">{preview.taxableWeightKg.toFixed(2)} kg</span>
                <span className="text-muted-foreground">Tarif appliqué:</span>
                <span>
                  {preview.ratePerKg.toLocaleString("fr-FR")} XAF/kg
                  {wForm.isSensitive && (
                    <span className="text-orange-600 ml-1">(sensible)</span>
                  )}
                </span>
                <span className="text-muted-foreground">Transport + buffer:</span>
                <span className="font-semibold text-primary">
                  {preview.transportCostWithBufferXAF.toLocaleString("fr-FR")} XAF
                </span>
              </div>
            </div>
          )}

          {/* Saved transport */}
          {transportCostEst != null && !preview && (
            <div className="rounded-lg bg-muted/50 border p-3 text-xs">
              <span className="text-muted-foreground">Transport sauvegardé: </span>
              <span className="font-semibold text-primary">
                {Number(transportCostEst).toLocaleString("fr-FR")} XAF
              </span>
            </div>
          )}

          <Button
            size="sm"
            onClick={handleSaveWeights}
            disabled={isPending || !wForm.weightKg}
            className="w-full"
          >
            <Calculator className="h-3.5 w-3.5 mr-1.5" />
            Calculer &amp; Sauvegarder le transport
          </Button>
        </CardContent>
      </Card>

      {/* Margin engine */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Moteur de marge
            {marginStatus && (
              <Badge
                variant={
                  marginStatus === "OK"
                    ? "default"
                    : marginStatus === "WARNING"
                    ? "secondary"
                    : "destructive"
                }
                className="text-[10px]"
              >
                {marginStatus === "OK" ? "✓ 30%" : marginStatus === "WARNING" ? "⚠ < 30%" : "✗ < 20%"}
              </Badge>
            )}
            <button
              className="ml-auto text-muted-foreground hover:text-foreground"
              onClick={() => setShowMarginForm((v) => !v)}
            >
              {showMarginForm ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Saved margin results */}
          {prixFinalXAF != null && (
            <div className="rounded-lg bg-muted/50 border p-3 text-xs space-y-1.5">
              <p className="font-semibold text-muted-foreground">Dernière simulation</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {totalCostXAF != null && (
                  <>
                    <span className="text-muted-foreground">Coût total:</span>
                    <span>{Number(totalCostXAF).toLocaleString("fr-FR")} XAF</span>
                  </>
                )}
                <span className="text-muted-foreground">Prix final client:</span>
                <span className="font-semibold">
                  {Number(prixFinalXAF).toLocaleString("fr-FR")} XAF
                </span>
                {marginNum != null && (
                  <>
                    <span className="text-muted-foreground">Marge:</span>
                    <span className={`font-bold ${marginColor}`}>
                      {marginNum.toFixed(1)}%
                    </span>
                  </>
                )}
                {marginApprovedByCeo && (
                  <span className="col-span-2 text-green-600 font-medium text-xs mt-1">
                    ✓ Approuvé CEO — dérogation accordée
                  </span>
                )}
              </div>
            </div>
          )}

          {/* CEO approval alert */}
          {marginNum != null && marginNum < 30 && !marginApprovedByCeo && canApproveCeo && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/20 p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0" />
                <span className="text-sm font-medium text-orange-800 dark:text-orange-300">
                  Marge {marginNum.toFixed(1)}% — Validation CEO requise
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleApproveCeo}
                disabled={isPending}
                className="border-orange-400 text-orange-700 w-full"
              >
                Approuver (CEO override)
              </Button>
            </div>
          )}

          {/* Simulate form */}
          {(showMarginForm || prixFinalXAF == null) && (
            <div className="space-y-3 border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground">Nouvelle simulation</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Prix unitaire RMB *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={mForm.unitPriceRmb}
                    onChange={(e) => setMForm((f) => ({ ...f, unitPriceRmb: e.target.value }))}
                    className="h-8 text-sm mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Quantité *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={mForm.quantity}
                    onChange={(e) => setMForm((f) => ({ ...f, quantity: e.target.value }))}
                    className="h-8 text-sm mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Taux change (XAF/RMB)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={mForm.exchangeRate}
                    onChange={(e) => setMForm((f) => ({ ...f, exchangeRate: e.target.value }))}
                    className="h-8 text-sm mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Douane exceptionnelle (%)</Label>
                  <Input
                    type="number"
                    step="1"
                    value={mForm.customsDutyPct}
                    onChange={(e) => setMForm((f) => ({ ...f, customsDutyPct: e.target.value }))}
                    className="h-8 text-sm mt-1"
                  />
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleSimulateMargin}
                disabled={isPending || !mForm.unitPriceRmb || !mForm.quantity}
                className="w-full"
              >
                <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
                Simuler la marge (30% cible)
              </Button>
            </div>
          )}

          {prixFinalXAF != null && !showMarginForm && (
            <button
              onClick={() => setShowMarginForm(true)}
              className="text-xs text-muted-foreground hover:text-primary w-full text-center"
            >
              Recalculer la marge
            </button>
          )}
        </CardContent>
      </Card>

      {/* Capitalize to catalog */}
      {isConfirmed && canCapitalize && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Capitalisation catalogue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Ce cas est confirmé. Enregistrez les poids et marges réels dans le catalogue pour affiner les estimations futures.
            </p>
            <Button
              size="sm"
              onClick={handleCapitalize}
              disabled={isPending}
              className="w-full"
              variant="outline"
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
              Capitaliser vers le Catalogue
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
