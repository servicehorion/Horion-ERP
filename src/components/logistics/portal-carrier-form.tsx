"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_OPTIONS = [
  "PENDING",
  "BOOKED",
  "PICKED_UP",
  "IN_TRANSIT",
  "ARRIVED_PORT",
  "CUSTOMS",
  "CLEARED",
  "IN_DELIVERY",
  "DELIVERED",
];

export function PortalCarrierForm({ token }: { token: string }) {
  const [status, setStatus] = useState("IN_TRANSIT");
  const [event, setEvent] = useState("");
  const [location, setLocation] = useState("");
  const [estimatedDeparture, setEstimatedDeparture] = useState("");
  const [estimatedArrival, setEstimatedArrival] = useState("");
  const [pending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (!event.trim()) {
      toast.error("Evenement requis");
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/logistics/portal/${token}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          event,
          location,
          estimatedDeparture: estimatedDeparture || undefined,
          estimatedArrival: estimatedArrival || undefined,
        }),
      });
      if (!res.ok) {
        toast.error("Erreur mise a jour");
        return;
      }
      toast.success("Tracking envoye");
      setEvent("");
      setLocation("");
      setEstimatedArrival("");
      setEstimatedDeparture("");
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Statut</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Evenement</Label>
        <Input value={event} onChange={(e) => setEvent(e.target.value)} placeholder="Arrivee port..." />
      </div>
      <div>
        <Label>Localisation</Label>
        <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Shanghai, Lagos..." />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>ETD estime</Label>
          <Input
            type="date"
            value={estimatedDeparture}
            onChange={(e) => setEstimatedDeparture(e.target.value)}
          />
        </div>
        <div>
          <Label>ETA estime</Label>
          <Input
            type="date"
            value={estimatedArrival}
            onChange={(e) => setEstimatedArrival(e.target.value)}
          />
        </div>
      </div>
      <Button onClick={handleSubmit} disabled={pending}>
        Envoyer
      </Button>
    </div>
  );
}
