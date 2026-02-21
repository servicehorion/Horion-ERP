"use client";

import { useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { updateTask } from "@/lib/actions/task.actions";

const PRIORITIES = [
  { value: "LOW", label: "Faible" },
  { value: "NORMAL", label: "Normale" },
  { value: "HIGH", label: "Haute" },
  { value: "URGENT", label: "Urgente" },
  { value: "CRITICAL", label: "Critique" },
];

const RISK_LEVELS = [
  { value: "LOW", label: "Faible" },
  { value: "MEDIUM", label: "Moyen" },
  { value: "HIGH", label: "Élevé" },
  { value: "CRITICAL", label: "Critique" },
];

interface TaskEditDialogProps {
  task: {
    id: string;
    title: string;
    description?: string | null;
    priority: string;
    module: string;
    tags: string[];
    estimatedHours?: number | null;
    riskLevel?: string;
    dueDate?: string | null;
  };
}

export function TaskEditDialog({ task }: TaskEditDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: task.title,
    description: task.description ?? "",
    priority: task.priority,
    tags: task.tags.join(", "),
    estimatedHours: task.estimatedHours?.toString() ?? "",
    riskLevel: task.riskLevel ?? "LOW",
  });

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast.error("Le titre est requis");
      return;
    }
    setLoading(true);
    try {
      const tags = form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await updateTask(task.id, {
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        tags,
        estimatedHours: form.estimatedHours ? parseFloat(form.estimatedHours) : undefined,
        riskLevel: form.riskLevel,
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Tâche mise à jour");
        setOpen(false);
        router.refresh();
      }
    } catch {
      toast.error("Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="mr-2 h-3.5 w-3.5" />
          Modifier
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier la tâche</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Titre <span className="text-red-500">*</span></Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Priorité</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Niveau de risque</Label>
              <Select value={form.riskLevel} onValueChange={(v) => setForm({ ...form, riskLevel: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RISK_LEVELS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Heures estimées</Label>
            <Input
              type="number"
              value={form.estimatedHours}
              onChange={(e) => setForm({ ...form, estimatedHours: e.target.value })}
              placeholder="Ex: 4"
              min={0}
              step={0.5}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tags</Label>
            <Input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="Séparés par des virgules: urgent, import, qc"
            />
            {form.tags && (
              <div className="flex flex-wrap gap-1 mt-1">
                {form.tags.split(",").map((t) => t.trim()).filter(Boolean).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sauvegarder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
