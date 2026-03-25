"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Anchor, ChevronDown, ChevronRight, FileText, Loader2, MapPin, Plus, Ship, Truck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  createShipment,
  updateShipmentStatus,
  addTrackingEvent,
  upsertCustomsClearance,
  syncShipmentTracking,
} from "@/lib/actions/order.actions";
import { formatDate } from "@/lib/utils";

export type TrackingEvent = {
  id: string;
  event: string;
  location?: string | null;
  description?: string | null;
  occurredAt: Date;
};

export type Shipment = {
  id: string;
  mode: string;
  status: string;
  origin?: string | null;
  destination?: string | null;
  trackingProvider?: string | null;
  trackingNumber?: string | null;
  trackingStatus?: string | null;
  trackingUrl?: string | null;
  lastTrackingSyncAt?: Date | null;
  containerNumber?: string | null;
  blNumber?: string | null;
  weight?: any;
  volume?: any;
  estimatedDeparture?: Date | null;
  estimatedArrival?: Date | null;
  actualDeparture?: Date | null;
  actualArrival?: Date | null;
  cost?: any;
  currency?: string | null;
  trackingEvents?: TrackingEvent[];
  customsClearance?: any;
  aiInsight?: {
    predictedArrival?: Date | null;
    predictedDelayDays?: number | null;
    riskLevel?: string | null;
  } | null;
};

const MODE_ICONS: Record<string, React.ReactNode> = {
  SEA:       <Anchor className="h-4 w-4" />,
  AIR:       <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>,
  ROAD:      <Truck className="h-4 w-4" />,
  RAIL:      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="3" width="16" height="13" rx="2"/><path d="M4 11h16M12 3v8M8 16l-2 5M16 16l2 5M8 16h8"/></svg>,
  MULTIMODAL: <Ship className="h-4 w-4" />,
};

const STATUS_COLORS: Record<string, string> = {
  PENDING:      "bg-gray-100 text-gray-700",
  BOOKED:       "bg-blue-100 text-blue-700",
  PICKED_UP:    "bg-indigo-100 text-indigo-700",
  IN_TRANSIT:   "bg-amber-100 text-amber-700",
  ARRIVED_PORT: "bg-orange-100 text-orange-700",
  CUSTOMS:      "bg-purple-100 text-purple-700",
  CLEARED:      "bg-teal-100 text-teal-700",
  IN_DELIVERY:  "bg-cyan-100 text-cyan-700",
  DELIVERED:    "bg-green-100 text-green-700",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING:      "En attente",
  BOOKED:       "Réservé",
  PICKED_UP:    "Enlevé",
  IN_TRANSIT:   "En transit",
  ARRIVED_PORT: "Arrivé port",
  CUSTOMS:      "Dédouanement",
  CLEARED:      "Dédouané",
  IN_DELIVERY:  "En livraison",
  DELIVERED:    "Livré",
};

const MODE_LABELS: Record<string, string> = {
  SEA: "Maritime", AIR: "Aérien", ROAD: "Routier",
  RAIL: "Ferroviaire", MULTIMODAL: "Multimodal",
};

const CUSTOMS_STATUS_LABELS: Record<string, string> = {
  PENDING:              "En attente",
  DOCUMENTS_SUBMITTED:  "Docs soumis",
  UNDER_REVIEW:         "En révision",
  DUTY_ASSESSED:        "Droits évalués",
  DUTY_PAID:            "Droits payés",
  CLEARED:              "Dédouané",
  HELD:                 "Retenu",
  REJECTED:             "Rejeté",
};

const CUSTOMS_STATUS_COLORS: Record<string, string> = {
  PENDING:              "bg-gray-100 text-gray-700",
  DOCUMENTS_SUBMITTED:  "bg-blue-100 text-blue-700",
  UNDER_REVIEW:         "bg-amber-100 text-amber-700",
  DUTY_ASSESSED:        "bg-orange-100 text-orange-700",
  DUTY_PAID:            "bg-indigo-100 text-indigo-700",
  CLEARED:              "bg-green-100 text-green-700",
  HELD:                 "bg-red-100 text-red-700",
  REJECTED:             "bg-red-200 text-red-800",
};

interface OrderShipmentsProps {
  orderId: string;
  shipments: Shipment[];
  canManage?: boolean;
}

export function OrderShipments({ orderId, shipments, canManage }: OrderShipmentsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [trackingShipId, setTrackingShipId] = useState<string | null>(null);
  const [customsShipId, setCustomsShipId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [customsForm, setCustomsForm] = useState({
    status: "PENDING",
    declarationNum: "",
    dutyAmount: "",
    dutyCurrency: "XAF",
    brokerName: "",
    submittedAt: "",
    clearedAt: "",
  });

  // Create form state
  const [form, setForm] = useState({
    mode: "SEA", origin: "", destination: "",
    containerNumber: "", blNumber: "", estimatedDeparture: "", estimatedArrival: "",
    cost: "", currency: "XAF",
    trackingProvider: "",
    trackingNumber: "",
    trackingUrl: "",
    cargoCategory: "STANDARD",
    isPureBattery: false,
    isLiquid: false,
    isDrone: false,
    isUndeclared: false,
    isFragile: false,
    hasWoodenCratePackaging: false,
  });

  // Tracking event form state
  const [trackForm, setTrackForm] = useState({
    event: "", location: "", description: "", occurredAt: "",
  });

  const handleCreate = () => {
    startTransition(async () => {
      const res = await createShipment(orderId, {
        mode: form.mode,
        origin: form.origin || undefined,
        destination: form.destination || undefined,
        containerNumber: form.containerNumber || undefined,
        blNumber: form.blNumber || undefined,
        estimatedDeparture: form.estimatedDeparture || undefined,
        estimatedArrival: form.estimatedArrival || undefined,
        cost: form.cost ? Number(form.cost) : undefined,
        currency: form.currency || undefined,
        trackingProvider: form.trackingProvider || undefined,
        trackingNumber: form.trackingNumber || undefined,
        trackingUrl: form.trackingUrl || undefined,
        cargoCategory: form.cargoCategory as any,
        isPureBattery: form.isPureBattery,
        isLiquid: form.isLiquid,
        isDrone: form.isDrone,
        isUndeclared: form.isUndeclared,
        isFragile: form.isFragile,
        hasWoodenCratePackaging: form.hasWoodenCratePackaging,
      });
      if (res.error) toast.error(res.error);
      else { toast.success("Expédition créée"); setCreateOpen(false); router.refresh(); }
    });
  };

  const handleStatusChange = (shipmentId: string, status: string) => {
    startTransition(async () => {
      const res = await updateShipmentStatus(shipmentId, status);
      if (res.error) toast.error(res.error);
      else { toast.success("Statut mis à jour"); router.refresh(); }
    });
  };

  const openCustomsForm = (ship: Shipment) => {
    if (ship.customsClearance) {
      setCustomsForm({
        status: ship.customsClearance.status ?? "PENDING",
        declarationNum: ship.customsClearance.declarationNum ?? "",
        dutyAmount: ship.customsClearance.dutyAmount != null ? String(Number(ship.customsClearance.dutyAmount)) : "",
        dutyCurrency: ship.customsClearance.dutyCurrency ?? "XAF",
        brokerName: ship.customsClearance.brokerName ?? "",
        submittedAt: ship.customsClearance.submittedAt
          ? new Date(ship.customsClearance.submittedAt).toISOString().slice(0, 10)
          : "",
        clearedAt: ship.customsClearance.clearedAt
          ? new Date(ship.customsClearance.clearedAt).toISOString().slice(0, 10)
          : "",
      });
    } else {
      setCustomsForm({ status: "PENDING", declarationNum: "", dutyAmount: "", dutyCurrency: "XAF", brokerName: "", submittedAt: "", clearedAt: "" });
    }
    setCustomsShipId(ship.id);
  };

  const handleSaveCustoms = (shipmentId: string) => {
    startTransition(async () => {
      const res = await upsertCustomsClearance(shipmentId, {
        status: customsForm.status || undefined,
        declarationNum: customsForm.declarationNum || undefined,
        dutyAmount: customsForm.dutyAmount ? Number(customsForm.dutyAmount) : undefined,
        dutyCurrency: customsForm.dutyCurrency || undefined,
        brokerName: customsForm.brokerName || undefined,
        submittedAt: customsForm.submittedAt || undefined,
        clearedAt: customsForm.clearedAt || undefined,
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("Dédouanement enregistré");
        setCustomsShipId(null);
        router.refresh();
      }
    });
  };

  const handleAddTracking = (shipmentId: string) => {
    startTransition(async () => {
      if (!trackForm.event.trim()) { toast.error("Événement requis"); return; }
      const res = await addTrackingEvent(shipmentId, {
        event: trackForm.event,
        location: trackForm.location || undefined,
        description: trackForm.description || undefined,
        occurredAt: trackForm.occurredAt || new Date().toISOString(),
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("Événement ajouté");
        setTrackForm({ event: "", location: "", description: "", occurredAt: "" });
        setTrackingShipId(null);
        router.refresh();
      }
    });
  };

  const handleSyncTracking = (shipmentId: string) => {
    setSyncingId(shipmentId);
    startTransition(async () => {
      const res = await syncShipmentTracking(shipmentId);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Tracking synchronise");
        router.refresh();
      }
      setSyncingId(null);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {shipments.length === 0 ? "Aucune expédition" : `${shipments.length} expédition${shipments.length > 1 ? "s" : ""}`}
        </p>
        {canManage && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Nouvelle expédition
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Créer une expédition</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Mode de transport</Label>
                    <Select value={form.mode} onValueChange={(v) => setForm((f) => ({ ...f, mode: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(MODE_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Origine</Label>
                    <Input value={form.origin} onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))} placeholder="Shanghai..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Destination</Label>
                    <Input value={form.destination} onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))} placeholder="Douala..." />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>N° Conteneur</Label>
                    <Input value={form.containerNumber} onChange={(e) => setForm((f) => ({ ...f, containerNumber: e.target.value }))} placeholder="TCKU..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label>N° BL / AWB</Label>
                    <Input value={form.blNumber} onChange={(e) => setForm((f) => ({ ...f, blNumber: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>ETD (départ estimé)</Label>
                    <Input type="date" value={form.estimatedDeparture} onChange={(e) => setForm((f) => ({ ...f, estimatedDeparture: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>ETA (arrivée estimée)</Label>
                    <Input type="date" value={form.estimatedArrival} onChange={(e) => setForm((f) => ({ ...f, estimatedArrival: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Coût fret</Label>
                  <Input type="number" min="0" step="0.01" value={form.cost} onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))} placeholder="0" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Provider tracking</Label>
                    <Input
                      value={form.trackingProvider}
                      onChange={(e) => setForm((f) => ({ ...f, trackingProvider: e.target.value }))}
                      placeholder="aftership / ... "
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tracking number</Label>
                    <Input
                      value={form.trackingNumber}
                      onChange={(e) => setForm((f) => ({ ...f, trackingNumber: e.target.value }))}
                      placeholder="Numéro"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Tracking URL</Label>
                  <Input
                    value={form.trackingUrl}
                    onChange={(e) => setForm((f) => ({ ...f, trackingUrl: e.target.value }))}
                    placeholder="https://tracking..."
                  />
                </div>
                <div className="rounded-md border p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Compliance transport</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label>Categorie marchandise</Label>
                      <Select
                        value={form.cargoCategory}
                        onValueChange={(v) => setForm((f) => ({ ...f, cargoCategory: v }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="STANDARD">Standard</SelectItem>
                          <SelectItem value="SPECIAL">Special</SelectItem>
                          <SelectItem value="MEDICAL">Medical</SelectItem>
                          <SelectItem value="LAPTOP">Ordinateur</SelectItem>
                          <SelectItem value="SMARTPHONE">Smartphone/Tablette</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Checks</Label>
                      <div className="space-y-1 text-xs">
                        <label className="flex items-center gap-2">
                          <Checkbox
                            checked={form.isPureBattery}
                            onCheckedChange={(checked) => setForm((f) => ({ ...f, isPureBattery: Boolean(checked) }))}
                          />
                          Batterie pure
                        </label>
                        <label className="flex items-center gap-2">
                          <Checkbox
                            checked={form.isLiquid}
                            onCheckedChange={(checked) => setForm((f) => ({ ...f, isLiquid: Boolean(checked) }))}
                          />
                          Liquide/cosmetique
                        </label>
                        <label className="flex items-center gap-2">
                          <Checkbox
                            checked={form.isDrone}
                            onCheckedChange={(checked) => setForm((f) => ({ ...f, isDrone: Boolean(checked) }))}
                          />
                          Drone
                        </label>
                        <label className="flex items-center gap-2">
                          <Checkbox
                            checked={form.isUndeclared}
                            onCheckedChange={(checked) => setForm((f) => ({ ...f, isUndeclared: Boolean(checked) }))}
                          />
                          Colis non declare (majoration 60%)
                        </label>
                        <label className="flex items-center gap-2">
                          <Checkbox
                            checked={form.isFragile}
                            onCheckedChange={(checked) => setForm((f) => ({ ...f, isFragile: Boolean(checked) }))}
                          />
                          Fragile
                        </label>
                        <label className="flex items-center gap-2">
                          <Checkbox
                            checked={form.hasWoodenCratePackaging}
                            onCheckedChange={(checked) => setForm((f) => ({ ...f, hasWoodenCratePackaging: Boolean(checked) }))}
                          />
                          Caisse bois
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Créer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {shipments.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Aucune expédition pour cette commande.
        </div>
      )}

      <div className="space-y-3">
        {shipments.map((ship) => {
          const isOpen = expanded === ship.id;
          return (
            <Card key={ship.id} className="overflow-hidden">
              <CardHeader className="p-4 pb-3">
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">{MODE_ICONS[ship.mode] ?? <Ship className="h-4 w-4" />}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{MODE_LABELS[ship.mode] ?? ship.mode}</span>
                      {ship.containerNumber && (
                        <span className="text-xs text-muted-foreground font-mono">{ship.containerNumber}</span>
                      )}
                      {ship.blNumber && (
                        <span className="text-xs text-muted-foreground font-mono">BL: {ship.blNumber}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      {ship.origin && <><MapPin className="h-3 w-3" />{ship.origin}</>}
                      {ship.origin && ship.destination && <span>→</span>}
                      {ship.destination && <span>{ship.destination}</span>}
                      {ship.estimatedArrival && (
                        <span className="ml-1">· ETA {formatDate(ship.estimatedArrival)}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={STATUS_COLORS[ship.status] ?? ""}>{STATUS_LABELS[ship.status] ?? ship.status}</Badge>
                    {canManage && (
                      <Select
                        value={ship.status}
                        onValueChange={(v) => handleStatusChange(ship.id, v)}
                        disabled={isPending}
                      >
                        <SelectTrigger className="h-7 w-36 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_LABELS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <button
                      onClick={() => setExpanded(isOpen ? null : ship.id)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </CardHeader>

              {isOpen && (
                <CardContent className="border-t pt-3 pb-4 space-y-3 bg-muted/20">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>
                        Provider: <span className="text-foreground font-medium">{ship.trackingProvider || "Non defini"}</span>
                        {ship.trackingNumber && <span className="ml-2 font-mono">{ship.trackingNumber}</span>}
                      </div>
                      {ship.trackingStatus && (
                        <div>Statut tracking: <span className="text-foreground">{ship.trackingStatus}</span></div>
                      )}
                      {ship.lastTrackingSyncAt && (
                        <div>Dernier sync: {formatDate(ship.lastTrackingSyncAt)}</div>
                      )}
                      {ship.aiInsight?.predictedArrival && (
                        <div>
                          ETA IA: <span className="text-foreground">{formatDate(ship.aiInsight.predictedArrival)}</span>
                          {ship.aiInsight.predictedDelayDays != null && ship.aiInsight.predictedDelayDays > 0 && (
                            <span className="ml-2 text-amber-600">+{ship.aiInsight.predictedDelayDays}j</span>
                          )}
                        </div>
                      )}
                      {ship.aiInsight?.riskLevel && (
                        <div>Risque: <span className="text-foreground">{ship.aiInsight.riskLevel}</span></div>
                      )}
                      {ship.trackingUrl && (
                        <a className="text-primary underline" href={ship.trackingUrl} target="_blank" rel="noreferrer">
                          Ouvrir tracking
                        </a>
                      )}
                    </div>
                    {canManage && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSyncTracking(ship.id)}
                        disabled={syncingId === ship.id}
                      >
                        {syncingId === ship.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                        Sync tracking
                      </Button>
                    )}
                  </div>

                  {/* Tracking events */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Suivi</p>
                    {(ship.trackingEvents ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground">Aucun événement de suivi</p>
                    ) : (
                      <div className="space-y-1.5">
                        {(ship.trackingEvents ?? []).map((ev) => (
                          <div key={ev.id} className="flex items-start gap-2 text-xs">
                            <span className="w-2 h-2 rounded-full bg-primary mt-1 shrink-0" />
                            <div className="flex-1">
                              <span className="font-medium">{ev.event}</span>
                              {ev.location && <span className="text-muted-foreground"> — {ev.location}</span>}
                              {ev.description && <p className="text-muted-foreground">{ev.description}</p>}
                            </div>
                            <span className="text-muted-foreground shrink-0">{formatDate(ev.occurredAt)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Customs clearance section */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        Dédouanement
                      </p>
                      {canManage && customsShipId !== ship.id && (
                        <button
                          className="text-xs text-primary hover:underline"
                          onClick={() => openCustomsForm(ship)}
                        >
                          {ship.customsClearance ? "Modifier" : "Initier"}
                        </button>
                      )}
                    </div>

                    {ship.customsClearance && customsShipId !== ship.id && (
                      <div className="text-xs space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge className={CUSTOMS_STATUS_COLORS[ship.customsClearance.status] ?? ""}>
                            {CUSTOMS_STATUS_LABELS[ship.customsClearance.status] ?? ship.customsClearance.status}
                          </Badge>
                          {ship.customsClearance.declarationNum && (
                            <span className="font-mono text-muted-foreground">N° {ship.customsClearance.declarationNum}</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-4 text-muted-foreground mt-1">
                          {ship.customsClearance.brokerName && (
                            <span>Transitaire : <span className="text-foreground font-medium">{ship.customsClearance.brokerName}</span></span>
                          )}
                          {ship.customsClearance.dutyAmount != null && (
                            <span>Droits : <span className="text-foreground font-medium">{Number(ship.customsClearance.dutyAmount).toLocaleString("fr-FR")} {ship.customsClearance.dutyCurrency ?? "XAF"}</span></span>
                          )}
                          {ship.customsClearance.submittedAt && (
                            <span>Soumis : {formatDate(ship.customsClearance.submittedAt)}</span>
                          )}
                          {ship.customsClearance.clearedAt && (
                            <span className="text-green-600">Dédouané : {formatDate(ship.customsClearance.clearedAt)}</span>
                          )}
                        </div>
                      </div>
                    )}

                    {!ship.customsClearance && customsShipId !== ship.id && (
                      <p className="text-xs text-muted-foreground">Aucune procédure douanière enregistrée.</p>
                    )}

                    {canManage && customsShipId === ship.id && (
                      <div className="space-y-2 pt-2 border-t">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-xs font-medium">Statut</label>
                            <Select
                              value={customsForm.status}
                              onValueChange={(v) => setCustomsForm((f) => ({ ...f, status: v }))}
                            >
                              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {Object.entries(CUSTOMS_STATUS_LABELS).map(([k, v]) => (
                                  <SelectItem key={k} value={k}>{v}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium">N° déclaration</label>
                            <input
                              className="flex h-7 w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                              value={customsForm.declarationNum}
                              onChange={(e) => setCustomsForm((f) => ({ ...f, declarationNum: e.target.value }))}
                              placeholder="DEC-2024-..."
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-xs font-medium">Montant droits</label>
                            <div className="flex gap-1">
                              <input
                                type="number"
                                min="0"
                                className="flex h-7 flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                value={customsForm.dutyAmount}
                                onChange={(e) => setCustomsForm((f) => ({ ...f, dutyAmount: e.target.value }))}
                                placeholder="0"
                              />
                              <Select
                                value={customsForm.dutyCurrency}
                                onValueChange={(v) => setCustomsForm((f) => ({ ...f, dutyCurrency: v }))}
                              >
                                <SelectTrigger className="h-7 w-16 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {["XAF", "USD", "EUR"].map((c) => (
                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium">Transitaire / Broker</label>
                            <input
                              className="flex h-7 w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              value={customsForm.brokerName}
                              onChange={(e) => setCustomsForm((f) => ({ ...f, brokerName: e.target.value }))}
                              placeholder="Bolloré, DHL..."
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-xs font-medium">Date soumission</label>
                            <input
                              type="date"
                              className="flex h-7 w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              value={customsForm.submittedAt}
                              onChange={(e) => setCustomsForm((f) => ({ ...f, submittedAt: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium">Date dédouanement</label>
                            <input
                              type="date"
                              className="flex h-7 w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              value={customsForm.clearedAt}
                              onChange={(e) => setCustomsForm((f) => ({ ...f, clearedAt: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleSaveCustoms(ship.id)}
                            disabled={isPending}
                          >
                            {isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                            Enregistrer
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => setCustomsShipId(null)}
                          >
                            Annuler
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Add tracking event */}
                  {canManage && (
                    trackingShipId === ship.id ? (
                      <div className="space-y-2 pt-2 border-t">
                        <p className="text-xs font-medium">Ajouter un événement</p>
                        <Input
                          value={trackForm.event}
                          onChange={(e) => setTrackForm((f) => ({ ...f, event: e.target.value }))}
                          placeholder="Ex: Embarquement effectué..."
                          className="h-7 text-xs"
                          autoFocus
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            value={trackForm.location}
                            onChange={(e) => setTrackForm((f) => ({ ...f, location: e.target.value }))}
                            placeholder="Localisation"
                            className="h-7 text-xs"
                          />
                          <Input
                            type="datetime-local"
                            value={trackForm.occurredAt}
                            onChange={(e) => setTrackForm((f) => ({ ...f, occurredAt: e.target.value }))}
                            className="h-7 text-xs"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleAddTracking(ship.id)}
                            disabled={isPending}
                          >
                            {isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                            Enregistrer
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => setTrackingShipId(null)}
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
                        onClick={() => setTrackingShipId(ship.id)}
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        Événement de suivi
                      </Button>
                    )
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

