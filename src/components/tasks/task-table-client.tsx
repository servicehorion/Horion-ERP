"use client";

import { useState } from "react";
import { AlertTriangle, CheckSquare, Download, Loader2, Square, X } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TaskStatusBadge, PriorityBadge } from "@/components/shared/status-badge";
import { bulkUpdateTaskStatus, bulkAssignTasks, exportTasksData } from "@/lib/actions/task.actions";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  taskType?: string | null;
  module: string;
  status: string;
  priority: string;
  slaBreach: boolean;
  slaDeadline?: Date | null;
  assignments?: { user: { name: string } }[];
}

interface TaskTableClientProps {
  tasks: Task[];
  teamMembers: { id: string; name: string }[];
}

const STATUS_OPTIONS = [
  { value: "IN_PROGRESS", label: "En cours" },
  { value: "COMPLETED", label: "Terminé" },
  { value: "BLOCKED", label: "Bloqué" },
  { value: "CANCELLED", label: "Annulé" },
  { value: "PENDING", label: "En attente" },
];

export function TaskTableClient({ tasks, teamMembers }: TaskTableClientProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const allSelected = selected.size === tasks.length && tasks.length > 0;

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(tasks.map((t) => t.id)));
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleBulkStatus = async (status: string) => {
    if (selected.size === 0) return;
    setLoading(true);
    try {
      const res = await bulkUpdateTaskStatus(Array.from(selected), status);
      if (res.error) toast.error(res.error);
      else {
        toast.success(`${selected.size} tâche(s) mise(s) à jour`);
        setSelected(new Set());
        router.refresh();
      }
    } catch { toast.error("Erreur"); }
    finally { setLoading(false); }
  };

  const handleBulkAssign = async (userId: string) => {
    if (selected.size === 0) return;
    setLoading(true);
    try {
      const res = await bulkAssignTasks(Array.from(selected), userId);
      if (res.error) toast.error(res.error);
      else {
        toast.success(`${selected.size} tâche(s) assignée(s)`);
        setSelected(new Set());
        router.refresh();
      }
    } catch { toast.error("Erreur"); }
    finally { setLoading(false); }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await exportTasksData("csv");
      if (res.error) { toast.error(res.error); return; }
      const blob = new Blob([res.data as string], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `horion-tasks-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Export CSV téléchargé");
    } catch { toast.error("Erreur export"); }
    finally { setExporting(false); }
  };

  return (
    <div className="space-y-2">
      {/* Bulk toolbar — appears when items selected */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20 animate-in slide-in-from-top-1">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <CheckSquare className="h-4 w-4" />
            <span>{selected.size} sélectionnée{selected.size > 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <Select onValueChange={handleBulkStatus} disabled={loading}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue placeholder="Changer statut..." />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {teamMembers.length > 0 && (
              <Select onValueChange={handleBulkAssign} disabled={loading}>
                <SelectTrigger className="w-44 h-8 text-xs">
                  <SelectValue placeholder="Assigner à..." />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setSelected(new Set())}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Export button + count */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{tasks.length} tâche{tasks.length > 1 ? "s" : ""}</span>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} className="h-7 text-xs">
          {exporting ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Download className="mr-1.5 h-3 w-3" />}
          Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {tasks.length === 0 ? (
            <div className="py-16 text-center">
              <CheckSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-30" />
              <h3 className="text-lg font-semibold">Aucune tâche</h3>
              <p className="text-muted-foreground text-sm mt-1">
                Modifiez vos filtres ou créez une nouvelle tâche
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <button
                      onClick={toggleAll}
                      className="flex items-center justify-center w-4 h-4 text-muted-foreground hover:text-foreground"
                    >
                      {allSelected
                        ? <CheckSquare className="h-4 w-4 text-primary" />
                        : <Square className="h-4 w-4" />
                      }
                    </button>
                  </TableHead>
                  <TableHead className="w-[36%]">Tâche</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Priorité</TableHead>
                  <TableHead>Assigné à</TableHead>
                  <TableHead>Échéance SLA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => {
                  const isSelected = selected.has(task.id);
                  return (
                    <TableRow
                      key={task.id}
                      className={cn(
                        "group",
                        isSelected && "bg-primary/5"
                      )}
                    >
                      <TableCell>
                        <button
                          onClick={() => toggle(task.id)}
                          className="flex items-center justify-center w-4 h-4 text-muted-foreground hover:text-foreground"
                        >
                          {isSelected
                            ? <CheckSquare className="h-4 w-4 text-primary" />
                            : <Square className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                          }
                        </button>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/tasks/${task.id}`}
                          className="flex items-center gap-2 text-blue-600 hover:underline group-hover:underline"
                        >
                          {task.slaBreach && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                          <span className="font-medium line-clamp-1">{task.title}</span>
                        </Link>
                        {task.taskType && (
                          <span className="text-xs text-muted-foreground ml-5">{task.taskType}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">{task.module}</Badge>
                      </TableCell>
                      <TableCell><TaskStatusBadge status={task.status} /></TableCell>
                      <TableCell><PriorityBadge priority={task.priority} /></TableCell>
                      <TableCell className="text-sm">
                        {task.assignments?.[0]?.user?.name ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {task.slaDeadline ? (
                          <span className={cn("text-sm", task.slaBreach && "text-red-600 font-semibold")}>
                            {formatDate(task.slaDeadline, true)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
