"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PhoneCall } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logContactActivity } from "@/lib/actions/contact.actions";

export function CallLogDialog({
  contactId,
  defaultPhone,
}: {
  contactId: string;
  defaultPhone?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [duration, setDuration] = useState("");
  const [outcome, setOutcome] = useState("");
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    if (!summary.trim()) return;
    const durationValue = duration.trim() ? Number(duration) : undefined;
    startTransition(async () => {
      const result = await logContactActivity(contactId, {
        type: "call",
        summary: summary.trim(),
        outcome: outcome || undefined,
        durationMinutes: Number.isFinite(durationValue) ? durationValue : undefined,
        phoneNumber: phone.trim() || undefined,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Appel enregistré");
      router.refresh();
      setSummary("");
      setDuration("");
      setOutcome("");
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start">
          <PhoneCall className="h-4 w-4 mr-2" />
          Journaliser un appel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Journaliser un appel</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Telephone</div>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Duree (min)</div>
              <Input
                type="number"
                min="0"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="Ex: 10"
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Resultat</div>
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="POSITIVE">Positif</SelectItem>
                  <SelectItem value="NEUTRAL">Neutre</SelectItem>
                  <SelectItem value="NEGATIVE">Negatif</SelectItem>
                  <SelectItem value="NO_ANSWER">Sans reponse</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Resume</div>
            <Textarea
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Ex: Discussion sur le devis..."
            />
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={submit} disabled={isPending || !summary.trim()}>
              Enregistrer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


