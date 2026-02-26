"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GitBranch, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { TaskStatusBadge } from "@/components/shared/status-badge";
import { addTaskDependency, removeTaskDependency, getTasks } from "@/lib/actions/task.actions";
import { cn } from "@/lib/utils";

interface Dep {
  id: string;
  type: string;
  dependsOn: { id: string; title: string; status: string };
}
interface Dependent {
  id: string;
  type: string;
  task: { id: string; title: string; status: string };
}

interface TaskDependencyManagerProps {
  taskId: string;
  dependencies: Dep[];
  dependents: Dependent[];
}

const DEP_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  BLOCKS: { label: "Bloque", color: "bg-red-100 text-red-700" },
  REQUIRES: { label: "Requiert", color: "bg-amber-100 text-amber-700" },
  RELATED: { label: "Lié", color: "bg-blue-100 text-blue-700" },
};

export function TaskDependencyManager({
  taskId,
  dependencies,
  dependents,
}: TaskDependencyManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; title: string; status: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [depType, setDepType] = useState("BLOCKS");

  const handleSearch = async (q: string) => {
    setSearch(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await getTasks({ search: q, limit: 10 });
      const tasks = (Array.isArray(res.data) ? res.data : [])
        .filter((t: any) => t.id !== taskId)
        .map((t: any) => ({ id: t.id, title: t.title, status: t.status }));
      setSearchResults(tasks);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = (dependsOnId: string, title: string) => {
    startTransition(async () => {
      const res = await addTaskDependency(taskId, dependsOnId, depType);
      if (res.error) toast.error(res.error);
      else {
        toast.success(`Dépendance ajoutée — "${title}"`);
        setAddOpen(false);
        setSearch("");
        setSearchResults([]);
        router.refresh();
      }
    });
  };

  const handleRemove = (dependsOnId: string) => {
    startTransition(async () => {
      const res = await removeTaskDependency(taskId, dependsOnId);
      if (res.error) toast.error(res.error);
      else { toast.success("Dépendance supprimée"); router.refresh(); }
    });
  };

  return (
    <div className="space-y-4">
      {/* Add button */}
      <div className="flex justify-end">
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-xs">
              <Plus className="mr-1 h-3 w-3" />
              Ajouter dépendance
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Ajouter une dépendance</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={depType} onValueChange={setDepType}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BLOCKS">Bloque (doit finir avant)</SelectItem>
                    <SelectItem value="REQUIRES">Requiert (doit compléter avant)</SelectItem>
                    <SelectItem value="RELATED">Lié (informationnel)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Rechercher une tâche</Label>
                <div className="relative">
                  <Input
                    value={search}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Titre de la tâche..."
                    className="h-8 text-sm pr-8"
                    autoFocus
                  />
                  {searching && (
                    <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                {searchResults.length > 0 && (
                  <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
                    {searchResults.map((t) => (
                      <button
                        key={t.id}
                        className="w-full flex items-center gap-2 p-2 hover:bg-muted/50 text-left text-sm"
                        onClick={() => handleAdd(t.id, t.title)}
                        disabled={isPending}
                      >
                        <span className="flex-1 truncate">{t.title}</span>
                        <TaskStatusBadge status={t.status} />
                      </button>
                    ))}
                  </div>
                )}
                {search.length >= 2 && !searching && searchResults.length === 0 && (
                  <p className="text-xs text-muted-foreground">Aucune tâche trouvée</p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Blockers: tasks this task depends on */}
      {dependencies.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
            Bloqué par ({dependencies.length})
          </h4>
          <div className="space-y-1">
            {dependencies.map((dep) => {
              const cfg = DEP_TYPE_CONFIG[dep.type] ?? DEP_TYPE_CONFIG.BLOCKS;
              return (
                <div key={dep.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/30 group">
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", cfg.color)}>
                    {cfg.label}
                  </span>
                  <Link href={`/tasks/${dep.dependsOn.id}`} className="text-sm flex-1 truncate hover:underline">
                    {dep.dependsOn.title}
                  </Link>
                  <TaskStatusBadge status={dep.dependsOn.status} />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleRemove(dep.dependsOn.id)}
                    disabled={isPending}
                    title="Supprimer"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dependents: tasks blocked by this task */}
      {dependents.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
            Bloque ({dependents.length})
          </h4>
          <div className="space-y-1">
            {dependents.map((dep) => {
              const cfg = DEP_TYPE_CONFIG[dep.type] ?? DEP_TYPE_CONFIG.BLOCKS;
              return (
                <div key={dep.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/30">
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", cfg.color)}>
                    {cfg.label}
                  </span>
                  <Link href={`/tasks/${dep.task.id}`} className="text-sm flex-1 truncate hover:underline">
                    {dep.task.title}
                  </Link>
                  <TaskStatusBadge status={dep.task.status} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {dependencies.length === 0 && dependents.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Aucune dépendance définie
        </p>
      )}
    </div>
  );
}
