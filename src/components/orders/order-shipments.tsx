"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Anchor, ChevronDown, ChevronRight, Loader2, MapPin, Plus, Ship, Truck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  createShipment, updateShipmentStatus, addTrackingEvent,
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

  // Create form state
  const [form, setForm] = useState({
    mode: "SEA", origin: "", destination: "",
    containerNumber: "", blNumber: "", estimatedDeparture: "", estimatedArrival: "",
    cost: "", currency: "XAF",
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
