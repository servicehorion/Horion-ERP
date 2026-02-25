"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MessageCircle,
  Package,
  CreditCard,
  AlertTriangle,
  StickyNote,
  BadgeCheck,
  Activity,
  PhoneCall,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  addContactNote,
  logContactActivity,
} from "@/lib/actions/contact.actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/utils";

export type TimelineItem = {
  id: string;
  type: string;
  title: string;
  description?: string;
  date: Date;
  link?: string;
  meta?: string;
};

const TYPE_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  order: { icon: Package, color: "text-blue-600", label: "Commande" },
  payment: { icon: CreditCard, color: "text-green-600", label: "Paiement" },
  dispute: { icon: AlertTriangle, color: "text-red-600", label: "Litige" },
  lead: { icon: BadgeCheck, color: "text-purple-600", label: "Lead" },
  activity: { icon: PhoneCall, color: "text-sky-600", label: "Activite" },
  audit: { icon: Activity, color: "text-muted-foreground", label: "Audit" },
  message: { icon: MessageCircle, color: "text-amber-600", label: "Message" },
  note: { icon: StickyNote, color: "text-indigo-600", label: "Note" },
};

export function ContactTimeline({
  contactId,
  items,
  readOnly,
}: {
  contactId: string;
  items: TimelineItem[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [activityType, setActivityType] = useState("call");
  const [activitySummary, setActivitySummary] = useState("");
  const [activityOutcome, setActivityOutcome] = useState("");
  const [activityDuration, setActivityDuration] = useState("");
  const [isPending, startTransition] = useTransition();

  const submitNote = () => {
    if (readOnly) return;
    if (!note.trim()) return;
    startTransition(async () => {
      const result = await addContactNote(contactId, note.trim());
      if (result.error) {
        toast.error(result.error);
      } else {
        setNote("");
        router.refresh();
      }
    });
  };

  const submitActivity = () => {
    if (readOnly) return;
    if (!activitySummary.trim()) return;
    const duration = activityDuration.trim() ? Number(activityDuration) : undefined;
    startTransition(async () => {
      const result = await logContactActivity(contactId, {
        type: activityType,
        summary: activitySummary.trim(),
        outcome: activityOutcome.trim() || undefined,
        durationMinutes: Number.isFinite(duration) ? duration : undefined,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        setActivitySummary("");
        setActivityOutcome("");
        setActivityDuration("");
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-6">
      {!readOnly && (
        <div className="rounded-lg border p-4 space-y-3">
          <div className="text-sm font-medium">Ajouter une note</div>
          <Textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note interne ou point d'interaction..."
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={submitNote} disabled={isPending || !note.trim()}>
              Enregistrer
            </Button>
          </div>
        </div>
      )}

      {!readOnly && (
        <div className="rounded-lg border p-4 space-y-3">
          <div className="text-sm font-medium">Journaliser une activite</div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Type</div>
              <Select value={activityType} onValueChange={setActivityType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Appel</SelectItem>
                  <SelectItem value="meeting">Reunion</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="visit">Visite</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Duree (min)</div>
              <Input
                type="number"
                min="0"
                value={activityDuration}
                onChange={(e) => setActivityDuration(e.target.value)}
                placeholder="Ex: 15"
              />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Resume</div>
            <Textarea
              rows={2}
              value={activitySummary}
              onChange={(e) => setActivitySummary(e.target.value)}
              placeholder="Ex: Point sur la commande et delais"
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Resultat (optionnel)</div>
            <Input
              value={activityOutcome}
              onChange={(e) => setActivityOutcome(e.target.value)}
              placeholder="Ex: Devis valide"
            />
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={submitActivity}
              disabled={isPending || !activitySummary.trim()}
            >
              Ajouter
            </Button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-8">
          Aucun Ã©vÃ©nement pour le moment
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.audit;
            const Icon = config.icon;
            return (
              <div key={item.id} className="flex gap-3 rounded-lg border p-3">
                <div className={`mt-1 ${config.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">
                      {item.link ? (
                        <a className="text-primary hover:underline" href={item.link}>
                          {item.title}
                        </a>
                      ) : (
                        item.title
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(item.date, true)}
                    </div>
                  </div>
                  {item.description && (
                    <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {item.description}
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {config.label}
                    </Badge>
                    {item.meta && (
                      <span className="text-xs text-muted-foreground">{item.meta}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
