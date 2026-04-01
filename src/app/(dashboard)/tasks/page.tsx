import Link from "next/link";
import { BarChart3, Calendar, ChevronLeft, ChevronRight, Kanban, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { TaskCreateDialog } from "@/components/tasks/task-create-dialog";
import { TaskFilters } from "@/components/tasks/task-filters";
import { TaskTableClient } from "@/components/tasks/task-table-client";
import { getTasks, getTeamMembers } from "@/lib/actions/task.actions";
import { getProjects } from "@/lib/actions/project.actions";

export const metadata = {
  title: "Taches | Horion ERP",
  description: "Task engine collaboratif - operations centralisees",
};

interface PageProps {
  searchParams: Promise<{
    page?: string;
    module?: string;
    status?: string;
    priority?: string;
    assignee?: string;
    project?: string;
    q?: string;
    sortBy?: string;
    sortDir?: string;
  }>;
}

export default async function TasksPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const tasksResult = await getTasks({
    module: sp.module,
    status: sp.status,
    priority: sp.priority,
    assigneeId: sp.assignee,
    projectId: sp.project,
    search: sp.q,
    sortBy: sp.sortBy,
    sortDir: sp.sortDir,
    page,
    limit: 25,
  });

  const membersResult = await getTeamMembers();
  const projectsResult = await getProjects({ limit: 100, compact: true });

  const teamMembers = membersResult.data ?? [];
  const projects = (projectsResult as { data?: Array<{ id: string; name: string }> }).data ?? [];
  const tasks = (tasksResult as { data?: unknown[] }).data ?? [];
  const total = (tasksResult as { total?: number }).total ?? 0;
  const totalPages = (tasksResult as { totalPages?: number }).totalPages ?? 1;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Taches & Projets"
        description="Vue liste prioritaire pour garder la page rapide et exploitable"
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/tasks/my"><Target className="mr-2 h-4 w-4" />Mes taches</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/tasks/board"><Kanban className="mr-2 h-4 w-4" />Kanban</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/tasks/timeline"><Calendar className="mr-2 h-4 w-4" />Timeline</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/tasks/analytics"><BarChart3 className="mr-2 h-4 w-4" />Analytique</Link>
        </Button>
        <TaskCreateDialog teamMembers={teamMembers} projects={projects} />
      </PageHeader>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
        Le dashboard analytique de la page taches est temporairement desactive pour supprimer les timeouts. La liste, les filtres et la creation restent disponibles.
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">
            Toutes les taches ({total})
          </h2>
          <TaskFilters
            currentModule={sp.module}
            currentStatus={sp.status}
            currentPriority={sp.priority}
            currentAssignee={sp.assignee}
            currentProject={sp.project}
            currentSearch={sp.q}
            currentSortBy={sp.sortBy}
            currentSortDir={sp.sortDir}
            teamMembers={teamMembers}
            projects={projects}
          />
        </div>

        <TaskTableClient tasks={tasks as any[]} teamMembers={teamMembers} />

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} sur {totalPages} ({total.toLocaleString("fr-FR")} taches)
            </p>
            <div className="flex items-center gap-2">
              {page > 1 && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={buildUrl(sp, { page: page - 1 })}><ChevronLeft className="h-4 w-4 mr-1" />Precedent</Link>
                </Button>
              )}
              <div className="flex items-center gap-1">
                {buildPageNumbers(page, totalPages).map((p, i) =>
                  p === "..." ? (
                    <span key={`e-${i}`} className="px-2 text-muted-foreground">...</span>
                  ) : (
                    <Button key={p} variant={p === page ? "default" : "outline"} size="sm" className="w-9 h-8 p-0" asChild>
                      <Link href={buildUrl(sp, { page: p as number })}>{p}</Link>
                    </Button>
                  ),
                )}
              </div>
              {page < totalPages && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={buildUrl(sp, { page: page + 1 })}>Suivant<ChevronRight className="h-4 w-4 ml-1" /></Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function buildUrl(current: Record<string, string | undefined>, overrides: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  const merged = { ...current, ...overrides };
  for (const [k, v] of Object.entries(merged)) {
    if (v != null && v !== "" && v !== "all") params.set(k, String(v));
  }
  return `/tasks?${params.toString()}`;
}

function buildPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}
