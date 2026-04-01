import Link from "next/link";
import { ArrowLeft, ListTodo } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TaskBoardGroupBy } from "@/components/tasks/task-board-groupby";
import { TaskCreateDialog } from "@/components/tasks/task-create-dialog";
import { getKanbanTasks, getTeamMembers } from "@/lib/actions/task.actions";
import { getProjects } from "@/lib/actions/project.actions";

export const metadata = {
  title: "Tableau Kanban | Horion ERP",
  description: "Vue tableau collaborative — glisser-déposer",
};

interface PageProps {
  searchParams: Promise<{ module?: string }>;
}

const MODULE_FILTERS = [
  { value: undefined, label: "Tout" },
  { value: "orders", label: "Commandes" },
  { value: "sourcing", label: "Sourcing" },
  { value: "logistics", label: "Logistique" },
  { value: "finance", label: "Finance" },
  { value: "qc", label: "QC" },
  { value: "crm", label: "CRM" },
  { value: "manual", label: "Manuel" },
];

export default async function TasksBoardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const module = params.module === "all" ? undefined : params.module;

  const [kanbanResult, membersResult, projectsResult] = await Promise.all([
    getKanbanTasks(module),
    getTeamMembers(),
    getProjects({ limit: 200 }),
  ]);

  const tasks = (kanbanResult as any).data ?? [];
  const teamMembers = membersResult.data ?? [];
  const projects = (projectsResult as any).data?.map((p: any) => ({ id: p.id, name: p.name })) ?? [];

  const totalActive = tasks.filter((t: any) => !["COMPLETED", "CANCELLED"].includes(t.status)).length;
  const slaBreaches = tasks.filter((t: any) => t.slaBreach).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/tasks">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Retour
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Tableau Kanban</h1>
            <p className="text-muted-foreground">
              Glisser-déposer pour changer le statut des tâches
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{totalActive} actives</span>
            {slaBreaches > 0 && (
              <Badge variant="destructive">{slaBreaches} SLA!</Badge>
            )}
          </div>
          <TaskCreateDialog teamMembers={teamMembers} projects={projects} />
        </div>
      </div>

      {/* Module filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground shrink-0">Module :</span>
        {MODULE_FILTERS.map((m) => {
          const active = module === m.value || (!module && !m.value);
          const href = m.value ? `/tasks/board?module=${m.value}` : "/tasks/board";
          return (
            <Link key={m.label} href={href}>
              <Badge
                variant={active ? "default" : "outline"}
                className="cursor-pointer hover:opacity-80 transition-opacity"
              >
                {m.label}
              </Badge>
            </Link>
          );
        })}
      </div>

      {/* Kanban Board */}
      {tasks.length === 0 ? (
        <div className="py-20 text-center">
          <ListTodo className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold">Aucune tâche</h3>
          <p className="text-muted-foreground mt-1">
            {module ? `Aucune tâche dans le module "${module}"` : "Les tâches sont générées automatiquement par le système"}
          </p>
        </div>
      ) : (
        <TaskBoardGroupBy tasks={tasks} module={module} />
      )}
    </div>
  );
}
