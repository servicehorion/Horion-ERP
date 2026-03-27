"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createManualTask } from "@/lib/actions/task.actions";

interface TaskCreateDialogProps {
  teamMembers?: { id: string; name: string }[];
  projects?: { id: string; name: string }[];
}

const MODULES = [
  { value: "orders", label: "Commandes" },
  { value: "sourcing", label: "Sourcing" },
  { value: "logistics", label: "Logistique" },
  { value: "finance", label: "Finance" },
  { value: "qc", label: "Controle qualite" },
  { value: "crm", label: "CRM" },
  { value: "catalog", label: "Catalogue" },
  { value: "manual", label: "Manuel" },
];

const PRIORITIES = [
  { value: "LOW", label: "Bas" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "Haut" },
  { value: "URGENT", label: "Urgent" },
];

const SLA_OPTIONS = [
  { value: "1", label: "1 heure" },
  { value: "2", label: "2 heures" },
  { value: "4", label: "4 heures" },
  { value: "8", label: "8 heures" },
  { value: "24", label: "24 heures" },
  { value: "48", label: "48 heures" },
  { value: "72", label: "72 heures" },
];

export function TaskCreateDialog({ teamMembers = [], projects = [] }: TaskCreateDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [module, setModule] = useState("manual");
  const [priority, setPriority] = useState("NORMAL");
  const [slaHours, setSlaHours] = useState<string>("");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("none");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Le titre est obligatoire");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createManualTask({
        title: title.trim(),
        description: description.trim() || undefined,
        module,
        priority,
        slaHours: slaHours ? Number(slaHours) : undefined,
        dueDate: dueDate || undefined,
        assigneeId: assigneeId || undefined,
        projectId: projectId === "none" ? undefined : projectId,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Tache creee avec succes");
      setOpen(false);
      resetForm();
      router.refresh();
    } catch {
      toast.error("Erreur lors de la creation");
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setModule("manual");
    setPriority("NORMAL");
    setSlaHours("");
    setDueDate("");
    setAssigneeId("");
    setProjectId("none");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle tache
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Creer une tache</DialogTitle>
          <DialogDescription>
            Creez une tache manuelle pour votre equipe. Les taches automatiques restent gerees par le systeme.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titre *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Relancer le fournisseur Zhang Wei"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Details de la tache..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Module</Label>
              <Select value={module} onValueChange={setModule}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODULES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priorite</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>SLA interne</Label>
              <Select value={slaHours} onValueChange={setSlaHours}>
                <SelectTrigger>
                  <SelectValue placeholder="Pas de SLA" />
                </SelectTrigger>
                <SelectContent>
                  {SLA_OPTIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {teamMembers.length > 0 && (
              <div className="space-y-2">
                <Label>Assigner a</Label>
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Assignation auto" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueDate">Echeance metier</Label>
            <Input
              id="dueDate"
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Cette date represente la cible operationnelle. Elle reste distincte du SLA interne.
            </p>
          </div>

          {projects.length > 0 && (
            <div className="space-y-2">
              <Label>Projet</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Aucun projet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Creer la tache
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
