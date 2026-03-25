"use client";

import { useMemo, useState } from "react";
import {
  DragDropContext, Droppable, Draggable, type DropResult,
} from "@hello-pangea/dnd";
import { AlertTriangle, Clock, GripVertical, User } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateTaskStatus } from "@/lib/actions/task.actions";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface KanbanTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  module: string;
  taskType: string | null;
  slaBreach: boolean;
  slaDeadline: Date | string | null;
  assignments: { user: { name: string } }[];
}

interface TaskKanbanProps {
  tasks: KanbanTask[];
  module?: string;
  groupBy?: "status" | "module" | "priority" | "assignee";
}

const STATUS_COLUMNS = [
  { id: "PENDING", label: "En attente", color: "border-t-gray-400", bgHeader: "bg-muted/60", countColor: "bg-muted text-muted-foreground" },
  { id: "IN_PROGRESS", label: "En cours", color: "border-t-blue-400", bgHeader: "surface-info", countColor: "bg-blue-100 text-blue-700" },
  { id: "WAITING_APPROVAL", label: "Approbation", color: "border-t-yellow-400", bgHeader: "surface-warning", countColor: "bg-yellow-100 text-yellow-700" },
  { id: "BLOCKED", label: "Bloque", color: "border-t-orange-400", bgHeader: "surface-danger", countColor: "bg-orange-100 text-orange-700" },
  { id: "COMPLETED", label: "Termine", color: "border-t-green-400", bgHeader: "surface-success", countColor: "bg-green-100 text-green-700" },
];

const PRIORITY_ORDER = ["URGENT", "HIGH", "NORMAL", "LOW"];

const PRIORITY_DOT: Record<string, string> = {
  URGENT: "bg-red-500",
  HIGH: "bg-orange-400",
  NORMAL: "bg-blue-400",
  LOW: "bg-gray-300",
};

function buildDynamicColumns(groupBy: string, tasks: KanbanTask[]) {
  if (groupBy === "module") {
    const modules = Array.from(new Set(tasks.map((t) => t.module)));
    return modules.map((m) => ({ id: m, label: m, color: "border-t-slate-300", bgHeader: "bg-muted/30", countColor: "bg-muted" }));
  }
  if (groupBy === "priority") {
    return PRIORITY_ORDER.map((p) => ({ id: p, label: p, color: "border-t-slate-300", bgHeader: "bg-muted/30", countColor: "bg-muted" }));
  }
  if (groupBy === "assignee") {
    const assignees = Array.from(new Set(tasks.map((t) => t.assignments?.[0]?.user?.name || "Non assigne")));
    return assignees.map((a) => ({ id: a, label: a, color: "border-t-slate-300", bgHeader: "bg-muted/30", countColor: "bg-muted" }));
  }
  return STATUS_COLUMNS;
}

export function TaskKanban({ tasks: initialTasks, module, groupBy = "status" }: TaskKanbanProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const router = useRouter();

  const columns = useMemo(() => {
    return groupBy === "status" ? STATUS_COLUMNS : buildDynamicColumns(groupBy, tasks);
  }, [groupBy, tasks]);

  const columnTasks = useMemo(() => {
    const map: Record<string, KanbanTask[]> = {};
    columns.forEach((col) => { map[col.id] = []; });
    tasks.forEach((t) => {
      let key = "";
      if (groupBy === "module") key = t.module;
      else if (groupBy === "priority") key = t.priority;
      else if (groupBy === "assignee") key = t.assignments?.[0]?.user?.name || "Non assigne";
      else key = t.status;
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return map;
  }, [tasks, columns, groupBy]);

  const handleDragEnd = async (result: DropResult) => {
    if (groupBy !== "status") return;
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStatus = destination.droppableId;
    const oldStatus = source.droppableId;

    setTasks((prev) => prev.map((t) => (t.id === draggableId ? { ...t, status: newStatus } : t)));

    try {
      const res = await updateTaskStatus(draggableId, newStatus);
      if (res.error) {
        setTasks((prev) => prev.map((t) => (t.id === draggableId ? { ...t, status: oldStatus } : t)));
        toast.error(res.error);
      } else {
        const col = STATUS_COLUMNS.find((c) => c.id === newStatus);
        toast.success(`Tache deplacee vers "${col?.label}"`);
        router.refresh();
      }
    } catch {
      setTasks((prev) => prev.map((t) => (t.id === draggableId ? { ...t, status: oldStatus } : t)));
      toast.error("Erreur lors de la mise a jour");
    }
  };

  const BoardContent = (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[600px]">
      {columns.map((col) => {
        const colTasks = columnTasks[col.id] ?? [];
        return (
          <div key={col.id} className="shrink-0 w-72">
            <Card className={cn("border-t-4 h-full flex flex-col", col.color)}>
              <CardHeader className={cn("py-3 px-4 rounded-t-lg", col.bgHeader)}>
                <CardTitle className="flex items-center justify-between text-sm font-semibold">
                  <span className="capitalize">{col.label}</span>
                  <span className={cn("inline-flex items-center justify-center h-5 w-5 rounded-full text-xs font-bold", col.countColor)}>
                    {colTasks.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-2">
                <div className="space-y-2 min-h-[500px] rounded-md p-1">
                  {colTasks.map((task, index) => (
                    <div key={task.id} className="bg-background border rounded-lg p-3 shadow-sm">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={cn("w-2 h-2 rounded-full shrink-0", PRIORITY_DOT[task.priority])} />
                            {task.slaBreach && <AlertTriangle className="h-3 w-3 text-red-500" />}
                            <Badge variant="outline" className="text-xs capitalize py-0 px-1">{task.module}</Badge>
                          </div>
                          <Link href={`/tasks/${task.id}`} className="text-sm font-medium leading-snug hover:underline line-clamp-2">
                            {task.title}
                          </Link>
                          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              {task.assignments?.[0]?.user && (
                                <>
                                  <User className="h-3 w-3" />
                                  <span className="truncate max-w-[70px]">{task.assignments[0].user.name}</span>
                                </>
                              )}
                            </div>
                            {task.slaDeadline && (
                              <div className={cn("flex items-center gap-1", task.slaBreach && "text-red-600 font-medium")}>
                                <Clock className="h-3 w-3" />
                                <span>{formatDate(new Date(task.slaDeadline), true)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );

  if (groupBy !== "status") return BoardContent;

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[600px]">
        {STATUS_COLUMNS.map((col) => {
          const colTasks = columnTasks[col.id] ?? [];
          return (
            <div key={col.id} className="shrink-0 w-72">
              <Card className={cn("border-t-4 h-full flex flex-col", col.color)}>
                <CardHeader className={cn("py-3 px-4 rounded-t-lg", col.bgHeader)}>
                  <CardTitle className="flex items-center justify-between text-sm font-semibold">
                    <span>{col.label}</span>
                    <span className={cn("inline-flex items-center justify-center h-5 w-5 rounded-full text-xs font-bold", col.countColor)}>
                      {colTasks.length}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 p-2">
                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn("space-y-2 min-h-[500px] rounded-md p-1 transition-colors", snapshot.isDraggingOver && "bg-muted/50")}
                      >
                        {colTasks.map((task, index) => (
                          <Draggable key={task.id} draggableId={task.id} index={index}>
                            {(prov, snap) => (
                              <div
                                ref={prov.innerRef}
                                {...prov.draggableProps}
                                className={cn(
                                  "bg-background border rounded-lg p-3 shadow-sm cursor-pointer group",
                                  snap.isDragging && "shadow-md ring-2 ring-primary/20",
                                  task.slaBreach && "border-red-300 bg-red-50/50 dark:bg-red-950/10"
                                )}
                              >
                                <div className="flex items-start gap-2">
                                  <div {...prov.dragHandleProps} className="mt-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                    <GripVertical className="h-4 w-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <span className={cn("w-2 h-2 rounded-full shrink-0", PRIORITY_DOT[task.priority])} />
                                      {task.slaBreach && <AlertTriangle className="h-3 w-3 text-red-500" />}
                                      <Badge variant="outline" className="text-xs capitalize py-0 px-1">{task.module}</Badge>
                                    </div>
                                    <Link href={`/tasks/${task.id}`} className="text-sm font-medium leading-snug hover:underline line-clamp-2">
                                      {task.title}
                                    </Link>
                                    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                                      <div className="flex items-center gap-1">
                                        {task.assignments?.[0]?.user && (
                                          <>
                                            <User className="h-3 w-3" />
                                            <span className="truncate max-w-[70px]">{task.assignments[0].user.name}</span>
                                          </>
                                        )}
                                      </div>
                                      {task.slaDeadline && (
                                        <div className={cn("flex items-center gap-1", task.slaBreach && "text-red-600 font-medium")}> 
                                          <Clock className="h-3 w-3" />
                                          <span>{formatDate(new Date(task.slaDeadline), true)}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
