"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createProject } from "@/lib/actions/project.actions";

const COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#06b6d4",
];

export function ProjectCreateDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    startDate: "",
    endDate: "",
    color: "#6366f1",
    budgetTotal: "",
  });

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Le nom du projet est requis");
      return;
    }
    setLoading(true);
    try {
      const res = await createProject({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        color: form.color,
        budgetTotal: form.budgetTotal ? Number(form.budgetTotal) : undefined,
      });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Projet créé");
        setOpen(false);
        setForm({ name: "", description: "", startDate: "", endDate: "", color: "#6366f1", budgetTotal: "" });
        router.push(`/projects/${(res.data as any).id}`);
      }
    } catch {
      toast.error("Erreur lors de la création");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Nouveau projet
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Créer un projet</DialogTitle>
          <DialogDescription>
            Définissez les informations de base. Vous pourrez ajouter des membres, sprints et tâches ensuite.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nom du projet <span className="text-red-500">*</span></Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Refonte site web"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Description du projet..."
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date de début</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date de fin</Label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Budget total (XAF)</Label>
            <Input
              type="number"
              value={form.budgetTotal}
              onChange={(e) => setForm({ ...form, budgetTotal: e.target.value })}
              placeholder="Ex: 5000000"
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Couleur</Label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`w-7 h-7 rounded-full transition-transform ${form.color === c ? "scale-125 ring-2 ring-offset-1 ring-primary" : "hover:scale-110"}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setForm({ ...form, color: c })}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Créer le projet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
