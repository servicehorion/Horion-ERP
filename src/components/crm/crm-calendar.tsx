"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Phone,
  Video,
  MapPin,
  List,
  CalendarDays,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { createMeeting, updateMeeting, deleteMeeting } from "@/lib/actions/crm-advanced.actions";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

type MeetingContact = { id: string; name: string; company?: string | null };
type Meeting = {
  id: string;
  title: string;
  startAt: Date | string;
  endAt: Date | string;
  type: string;
  status: string;
  location?: string | null;
  notes?: string | null;
  contactId: string;
  leadId?: string | null;
  contact: MeetingContact;
};

type Props = {
  meetings: Meeting[];
  contacts: { id: string; name: string; company?: string | null }[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_ICON = {
  CALL: <Phone className="h-3 w-3" />,
  VIDEO: <Video className="h-3 w-3" />,
  IN_PERSON: <MapPin className="h-3 w-3" />,
};

const TYPE_COLORS: Record<string, string> = {
  CALL: "bg-blue-100 text-blue-800",
  VIDEO: "bg-violet-100 text-violet-800",
  IN_PERSON: "bg-green-100 text-green-800",
};

const TYPE_LABELS: Record<string, string> = {
  CALL: "Appel",
  VIDEO: "Visio",
  IN_PERSON: "Sur place",
};

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalInputValue(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtTime(d: Date | string) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(d: Date | string) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

// ── Create Dialog ─────────────────────────────────────────────────────────────

function CreateMeetingDialog({
  contacts,
  open,
  onOpenChange,
}: {
  contacts: Props["contacts"];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const now = new Date();
  const inOneHour = new Date(now.getTime() + 3600000);

  const [form, setForm] = useState({
    contactId: "",
    title: "",
    startAt: toLocalInputValue(now),
    endAt: toLocalInputValue(inOneHour),
    type: "CALL",
    location: "",
    description: "",
    notes: "",
  });

  function set(key: keyof typeof form, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function handleSubmit() {
    if (!form.contactId || !form.title) {
      toast.error("Contact et titre requis");
      return;
    }
    startTransition(async () => {
      const res = await createMeeting({
        ...form,
        location: form.location || undefined,
        description: form.description || undefined,
        notes: form.notes || undefined,
      });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("RDV créé");
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau RDV</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>Contact *</Label>
            <Select value={form.contactId} onValueChange={(v) => set("contactId", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un contact..." />
              </SelectTrigger>
              <SelectContent>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}{c.company ? ` — ${c.company}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Titre *</Label>
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Ex: Appel de qualification"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Début</Label>
              <Input
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => set("startAt", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Fin</Label>
              <Input
                type="datetime-local"
                value={form.endAt}
                onChange={(e) => set("endAt", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => set("type", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CALL">Appel téléphonique</SelectItem>
                  <SelectItem value="VIDEO">Visioconférence</SelectItem>
                  <SelectItem value="IN_PERSON">Sur place</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Lieu / Lien</Label>
              <Input
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
                placeholder="Adresse, Zoom link..."
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Points à aborder..."
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Création..." : "Créer le RDV"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Week View ─────────────────────────────────────────────────────────────────

function WeekView({
  meetings,
  weekStart,
}: {
  meetings: Meeting[];
  weekStart: Date;
}) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {days.map((d, i) => {
          const isToday = d.toDateString() === new Date().toDateString();
          return (
            <div
              key={i}
              className={`p-2 text-center text-sm border-r last:border-0 ${isToday ? "bg-violet-50" : ""}`}
            >
              <div className="text-xs text-muted-foreground capitalize">
                {d.toLocaleDateString("fr-FR", { weekday: "short" })}
              </div>
              <div className={`font-semibold ${isToday ? "text-violet-700" : ""}`}>
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>
      {/* Meetings grid */}
      <div className="grid grid-cols-7 min-h-32">
        {days.map((d, i) => {
          const dayMeetings = meetings.filter((m) => {
            const md = new Date(m.startAt);
            return md.toDateString() === d.toDateString();
          });
          return (
            <div key={i} className="border-r last:border-0 p-1 space-y-1 min-h-24">
              {dayMeetings.map((m) => (
                <div
                  key={m.id}
                  className={`rounded px-1.5 py-1 text-xs cursor-default ${TYPE_COLORS[m.type] ?? "bg-slate-100 text-slate-800"}`}
                >
                  <div className="flex items-center gap-1">
                    {TYPE_ICON[m.type as keyof typeof TYPE_ICON]}
                    <span className="font-medium truncate">{fmtTime(m.startAt)}</span>
                  </div>
                  <div className="truncate mt-0.5">{m.title}</div>
                  <div className="truncate text-[10px] opacity-70">{m.contact.name}</div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── List View ─────────────────────────────────────────────────────────────────

function ListView({ meetings }: { meetings: Meeting[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await deleteMeeting(id);
      if (res.error) toast.error(res.error);
      else { toast.success("RDV supprimé"); router.refresh(); }
    });
  }

  function handleComplete(id: string) {
    startTransition(async () => {
      const res = await updateMeeting(id, { status: "COMPLETED" });
      if (res.error) toast.error(res.error);
      else { toast.success("RDV marqué comme terminé"); router.refresh(); }
    });
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead>RDV</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {meetings.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                Aucun RDV planifié
              </TableCell>
            </TableRow>
          )}
          {meetings.map((m) => (
            <TableRow key={m.id}>
              <TableCell>
                <div className="font-medium">{m.title}</div>
                {m.location && (
                  <div className="text-xs text-muted-foreground">{m.location}</div>
                )}
              </TableCell>
              <TableCell>
                <div>{m.contact.name}</div>
                {m.contact.company && (
                  <div className="text-xs text-muted-foreground">{m.contact.company}</div>
                )}
              </TableCell>
              <TableCell>
                <div className="text-sm">{fmtDate(m.startAt)}</div>
                <div className="text-xs text-muted-foreground">
                  {fmtTime(m.startAt)} → {fmtTime(m.endAt)}
                </div>
              </TableCell>
              <TableCell>
                <Badge className={TYPE_COLORS[m.type] ?? "bg-slate-100"}>
                  <span className="flex items-center gap-1">
                    {TYPE_ICON[m.type as keyof typeof TYPE_ICON]}
                    {TYPE_LABELS[m.type] ?? m.type}
                  </span>
                </Badge>
              </TableCell>
              <TableCell>
                <Badge className={STATUS_COLORS[m.status] ?? "bg-slate-100"}>
                  {m.status === "SCHEDULED" ? "Planifié" : m.status === "COMPLETED" ? "Terminé" : "Annulé"}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  {m.status === "SCHEDULED" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-green-600"
                      onClick={() => handleComplete(m.id)}
                      disabled={isPending}
                      title="Marquer terminé"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() => handleDelete(m.id)}
                    disabled={isPending}
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function CrmCalendar({ meetings, contacts }: Props) {
  const [view, setView] = useState<"week" | "list">("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);

  // Start of current week (Monday)
  const weekStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1 + weekOffset * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const weekLabel = `${weekStart.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} — ${weekEnd.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`;

  const upcoming = [...meetings]
    .filter((m) => m.status === "SCHEDULED")
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {view === "week" && (
            <>
              <Button variant="outline" size="sm" onClick={() => setWeekOffset((o) => o - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-48 text-center">{weekLabel}</span>
              <Button variant="outline" size="sm" onClick={() => setWeekOffset((o) => o + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>
                Aujourd'hui
              </Button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={view === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("week")}
          >
            <CalendarDays className="h-4 w-4 mr-1" />
            Semaine
          </Button>
          <Button
            variant={view === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("list")}
          >
            <List className="h-4 w-4 mr-1" />
            Liste
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nouveau RDV
          </Button>
        </div>
      </div>

      {/* Upcoming badge */}
      {upcoming.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{upcoming.length}</span> RDV à venir
          <span className="text-muted-foreground">—</span>
          <span className="font-medium">Prochain :</span>
          {fmtDate(upcoming[0].startAt)} {fmtTime(upcoming[0].startAt)} · {upcoming[0].title}
          <span className="text-muted-foreground">avec</span>
          {upcoming[0].contact.name}
        </div>
      )}

      {/* View */}
      {view === "week" ? (
        <WeekView meetings={meetings} weekStart={weekStart} />
      ) : (
        <ListView meetings={meetings} />
      )}

      {/* Create dialog */}
      <CreateMeetingDialog
        contacts={contacts}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  );
}
