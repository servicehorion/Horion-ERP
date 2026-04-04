"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createLeadTask } from "@/lib/actions/contact.actions";

type TeamMember = { id: string; name: string | null; email: string };

export function LeadTaskDialog({
  leadId,
  teamMembers,
  defaultAssigneeId,
}: {
  leadId: string;
  teamMembers: TeamMember[];
  defaultAssigneeId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("Relancer ce lead");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [slaHours, setSlaHours] = useState("24");
  const [assigneeId, setAssigneeId] = useState(defaultAssigneeId ?? "");

  const submit = () => {
    if (!title.trim()) {
      toast.error("Titre requis");
      return;
    }
    startTransition(async () => {
      const res = await createLeadTask(leadId, {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        slaHours: slaHours ? Number(slaHours) : undefined,
        assigneeId: assigneeId || undefined,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Tâche créée");
      setOpen(false);
      setDescription("");
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start">
          <Plus className="mr-2 h-4 w-4" />
          Creer une tache
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle tache CRM</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Titre</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Objectifs, prochaines actions..."
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Priorite</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Basse</SelectItem>
                  <SelectItem value="NORMAL">Normale</SelectItem>
                  <SelectItem value="HIGH">Haute</SelectItem>
                  <SelectItem value="URGENT">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>SLA (heures)</Label>
              <Input
                type="number"
                min="1"
                value={slaHours}
                onChange={(e) => setSlaHours(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Assigner</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir" />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name || m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={isPending}>
            Creer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
