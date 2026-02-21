"use client";

import { useState } from "react";
import { CheckSquare, Loader2, Trash2, UserPlus, Zap, X, Download } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  bulkUpdateTaskStatus, bulkAssignTasks, exportTasksData,
} from "@/lib/actions/task.actions";
import { cn } from "@/lib/utils";

interface TaskBulkActionsProps {
  tasks: { id: string; title: string; status: string; priority: string; module: string }[];
  teamMembers: { id: string; name: string }[];
}

const STATUS_OPTIONS = [
  { value: "IN_PROGRESS", label: "En cours" },
  { value: "COMPLETED", label: "Terminé" },
  { value: "BLOCKED", label: "Bloqué" },
  { value: "CANCELLED", label: "Annulé" },
  { value: "PENDING", label: "En attente" },
];

export function TaskBulkActions({ tasks, teamMembers }: TaskBulkActionsProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const selected = selectedIds.size;
  const allSelected = selected === tasks.length && tasks.length > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tasks.map((t) => t.id)));
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkStatus = async (status: string) => {
    if (selected === 0) return;
    setLoading(true);
    try {
      const res = await bulkUpdateTaskStatus(Array.from(selectedIds), status);
      if (res.error) toast.error(res.error);
      else {
        toast.success(`${selected} tâche(s) mise(s) à jour`);
        setSelectedIds(new Set());
        router.refresh();
      }
    } catch {
      toast.error("Erreur");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAssign = async (userId: string) => {
    if (selected === 0) return;
    setLoading(true);
    try {
      const res = await bulkAssignTasks(Array.from(selectedIds), userId);
      if (res.error) toast.error(res.error);
      else {
        toast.success(`${selected} tâche(s) assignée(s)`);
        setSelectedIds(new Set());
        router.refresh();
      }
    } catch {
      toast.error("Erreur");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await exportTasksData("csv");
      if (res.error) {
        toast.error(res.error);
      } else if (res.data) {
        const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `tasks-export-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Export CSV téléchargé");
      }
    } catch {
      toast.error("Erreur");
    } finally {
      setExporting(false);
    }
  };

  return {
    selectedIds,
    toggle,
    toggleAll,
    allSelected,
    selected,
    toolbar: selected > 0 ? (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20 mb-3 animate-in slide-in-from-top-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <CheckSquare className="h-4 w-4 text-primary" />
          <span>{selected} sélectionnée{selected > 1 ? "s" : ""}</span>
        </div>

        <div className="flex items-center gap-2 flex-1">
          {/* Bulk status */}
          <Select onValueChange={handleBulkStatus} disabled={loading}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="Changer statut" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Bulk assign */}
          {teamMembers.length > 0 && (
            <Select onValueChange={handleBulkAssign} disabled={loading}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue placeholder="Assigner à..." />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-7"
          onClick={() => setSelectedIds(new Set())}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    ) : null,
    exportButton: (
      <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
        {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
        Export CSV
      </Button>
    ),
  };
}
