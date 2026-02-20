"use client";

import { useState } from "react";
import { Copy, Loader2, Plus, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { instantiateTemplate, createTaskTemplate } from "@/lib/actions/task.actions";
import { cn } from "@/lib/utils";

const MODULES = [
  { value: "sourcing", label: "Sourcing" },
  { value: "orders", label: "Commandes" },
  { value: "finance", label: "Finance" },
  { value: "logistics", label: "Logistique" },
  { value: "crm", label: "CRM" },
  { value: "catalog", label: "Catalogue" },
  { value: "manual", label: "Manuel" },
];

const PRIORITIES = [
  { value: "LOW", label: "Faible" },
  { value: "NORMAL", label: "Normale" },
  { value: "HIGH", label: "Haute" },
  { value: "URGENT", label: "Urgente" },
  { value: "CRITICAL", label: "Critique" },
];

interface TemplateActionsProps {
  mode: "create" | "use" | "duplicate";
  templateId?: string;
  templateName?: string;
  className?: string;
}

export function TemplateActions({ mode, templateId, templateName, className }: TemplateActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // ── Use template (instantiate) ────────────────────────────────────────────
  if (mode === "use") {
    return (
      <Button
        size="sm"
        className={cn("", className)}
        onClick={async () => {
          setLoading(true);
          try {
            const res = await instantiateTemplate(templateId!);
            if (res.error) {
              toast.error(res.error);
            } else {
              toast.success(`Tâche créée depuis "${templateName}"`);
              router.push(`/tasks/${(res.data as any)?.task?.id}`);
            }
          } catch {
            toast.error("Erreur lors de la création");
          } finally {
            setLoading(false);
          }
        }}
        disabled={loading}
      >
        {loading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Wand2 className="mr-2 h-3.5 w-3.5" />}
        Utiliser
      </Button>
    );
  }

  // ── Duplicate template ────────────────────────────────────────────────────
  if (mode === "duplicate") {
    return (
      <Button
        size="sm"
        variant="outline"
        className={cn("", className)}
        disabled={loading}
        onClick={() => toast.info("Duplication à venir")}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
    );
  }

  // ── Create template ───────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className={cn("", className)}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau modèle
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Créer un modèle de tâche</DialogTitle>
          <DialogDescription>
            Les modèles permettent de standardiser vos workflows. Utilisez <code className="bg-muted px-1 rounded text-xs">{"{{variable}}"}</code> dans le titre et la description pour des champs dynamiques.
          </DialogDescription>
        </DialogHeader>
        <CreateTemplateForm
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

// ── Create template form ──────────────────────────────────────────────────────
function CreateTemplateForm({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    module: "manual",
    taskType: "",
    titleTemplate: "",
    descriptionTemplate: "",
    defaultPriority: "NORMAL",
    defaultSlaHours: "",
    requiresApproval: false,
    automationAllowed: false,
  });

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.titleTemplate.trim() || !form.taskType.trim()) {
      toast.error("Remplissez les champs obligatoires (nom, type, titre)");
      return;
    }
    setLoading(true);
    try {
      const res = await createTaskTemplate({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        module: form.module,
        taskType: form.taskType.trim(),
        titleTemplate: form.titleTemplate.trim(),
        descriptionTemplate: form.descriptionTemplate.trim() || undefined,
        defaultPriority: form.defaultPriority,
        defaultSlaHours: form.defaultSlaHours ? parseInt(form.defaultSlaHours) : undefined,
        requiresApproval: form.requiresApproval,
        automationAllowed: form.automationAllowed,
      });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Modèle créé");
        onSuccess();
      }
    } catch {
      toast.error("Erreur lors de la création");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label>Nom du modèle <span className="text-red-500">*</span></Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: Vérification QC standard"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Module <span className="text-red-500">*</span></Label>
          <Select value={form.module} onValueChange={(v) => setForm({ ...form, module: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MODULES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Type de tâche <span className="text-red-500">*</span></Label>
          <Input
            value={form.taskType}
            onChange={(e) => setForm({ ...form, taskType: e.target.value })}
            placeholder="Ex: quality_check"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Titre du modèle <span className="text-red-500">*</span></Label>
        <Input
          value={form.titleTemplate}
          onChange={(e) => setForm({ ...form, titleTemplate: e.target.value })}
          placeholder='Ex: Contrôle QC — {{orderNumber}}'
        />
        <p className="text-xs text-muted-foreground">Utilisez {"{{variable}}"} pour les champs dynamiques</p>
      </div>

      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Description du modèle..."
          rows={2}
          className="text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Priorité par défaut</Label>
          <Select value={form.defaultPriority} onValueChange={(v) => setForm({ ...form, defaultPriority: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>SLA (heures)</Label>
          <Input
            type="number"
            value={form.defaultSlaHours}
            onChange={(e) => setForm({ ...form, defaultSlaHours: e.target.value })}
            placeholder="Ex: 48"
            min={1}
          />
        </div>
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.requiresApproval}
            onChange={(e) => setForm({ ...form, requiresApproval: e.target.checked })}
            className="w-4 h-4"
          />
          <span className="text-sm">Approbation requise</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.automationAllowed}
            onChange={(e) => setForm({ ...form, automationAllowed: e.target.checked })}
            className="w-4 h-4"
          />
          <span className="text-sm">Automatisable (IA)</span>
        </label>
      </div>

      <DialogFooter>
        <Button onClick={handleSubmit} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Créer le modèle
        </Button>
      </DialogFooter>
    </div>
  );
}
