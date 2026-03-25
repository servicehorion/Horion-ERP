"use client";

import { useRouter, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { TaskSavedFilters } from "@/components/tasks/task-saved-filters";

interface TaskFiltersProps {
  currentModule?: string;
  currentStatus?: string;
  currentPriority?: string;
  currentAssignee?: string;
  currentProject?: string;
  currentSearch?: string;
  currentSortBy?: string;
  currentSortDir?: string;
  teamMembers?: { id: string; name: string }[];
  projects?: { id: string; name: string }[];
}

const MODULES = [
  { value: "all", label: "Tous les modules" },
  { value: "orders", label: "Commandes" },
  { value: "sourcing", label: "Sourcing" },
  { value: "logistics", label: "Logistique" },
  { value: "finance", label: "Finance" },
  { value: "qc", label: "Controle Qualite" },
  { value: "crm", label: "CRM" },
  { value: "catalog", label: "Catalogue" },
  { value: "manual", label: "Manuel" },
];

const STATUSES = [
  { value: "all", label: "Tous les statuts" },
  { value: "PENDING", label: "En attente" },
  { value: "IN_PROGRESS", label: "En cours" },
  { value: "WAITING_APPROVAL", label: "Approbation" },
  { value: "BLOCKED", label: "Bloque" },
  { value: "COMPLETED", label: "Termine" },
  { value: "CANCELLED", label: "Annule" },
];

const PRIORITIES = [
  { value: "all", label: "Toutes priorites" },
  { value: "URGENT", label: "Urgent" },
  { value: "HIGH", label: "Haut" },
  { value: "NORMAL", label: "Normal" },
  { value: "LOW", label: "Bas" },
];

const SORT_BY = [
  { value: "priority", label: "Priorite" },
  { value: "sla", label: "SLA" },
  { value: "created", label: "Cree" },
  { value: "updated", label: "Modifie" },
];

const SORT_DIR = [
  { value: "desc", label: "DESC" },
  { value: "asc", label: "ASC" },
];

export function TaskFilters({
  currentModule,
  currentStatus,
  currentPriority,
  currentAssignee,
  currentProject,
  currentSearch,
  currentSortBy,
  currentSortDir,
  teamMembers = [],
  projects = [],
}: TaskFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();

  function updateParams(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      module: currentModule,
      status: currentStatus,
      priority: currentPriority,
      assignee: currentAssignee,
      project: currentProject,
      q: currentSearch,
      sortBy: currentSortBy,
      sortDir: currentSortDir,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== "all" && v !== "") params.set(k, v);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const hasFilters = currentModule || currentStatus || currentPriority || currentAssignee || currentProject || currentSearch;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher une tache..."
          defaultValue={currentSearch ?? ""}
          className="pl-9"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              updateParams({ q: (e.target as HTMLInputElement).value || undefined });
            }
          }}
        />
      </div>

      <Select value={currentModule || "all"} onValueChange={(v) => updateParams({ module: v === "all" ? undefined : v })}>
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MODULES.map((m) => (
            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {projects.length > 0 && (
        <Select value={currentProject || "all"} onValueChange={(v) => updateParams({ project: v === "all" ? undefined : v })}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Projet" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les projets</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select value={currentStatus || "all"} onValueChange={(v) => updateParams({ status: v === "all" ? undefined : v })}>
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={currentPriority || "all"} onValueChange={(v) => updateParams({ priority: v === "all" ? undefined : v })}>
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PRIORITIES.map((p) => (
            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {teamMembers.length > 0 && (
        <Select value={currentAssignee || "all"} onValueChange={(v) => updateParams({ assignee: v === "all" ? undefined : v })}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Assigne a" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les membres</SelectItem>
            {teamMembers.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select value={currentSortBy || "priority"} onValueChange={(v) => updateParams({ sortBy: v })}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Trier par" />
        </SelectTrigger>
        <SelectContent>
          {SORT_BY.map((s) => (
            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={currentSortDir || "desc"} onValueChange={(v) => updateParams({ sortDir: v })}>
        <SelectTrigger className="w-[90px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_DIR.map((s) => (
            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <TaskSavedFilters
        entityType="task"
        currentFilters={{
          module: currentModule,
          status: currentStatus,
          priority: currentPriority,
          assignee: currentAssignee,
          project: currentProject,
          q: currentSearch,
          sortBy: currentSortBy,
          sortDir: currentSortDir,
        }}
      />

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}>
          <X className="h-4 w-4 mr-1" />
          Effacer
        </Button>
      )}
    </div>
  );
}
