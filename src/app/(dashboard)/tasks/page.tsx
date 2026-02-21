import Link from "next/link";
import {
  AlertTriangle, BarChart3, CheckCircle2, ChevronLeft, ChevronRight,
  Clock, Calendar, Kanban, ListTodo, Target, TrendingUp, Users, Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TaskStatusBadge, PriorityBadge } from "@/components/shared/status-badge";
import { TaskCreateDialog } from "@/components/tasks/task-create-dialog";
import { TaskFilters } from "@/components/tasks/task-filters";
import { TaskTableClient } from "@/components/tasks/task-table-client";
import { getTasks, getTaskDashboardData, getTeamMembers } from "@/lib/actions/task.actions";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Tâches | Horion ERP",
  description: "Task engine collaboratif — opérations centralisées",
};

interface PageProps {
  searchParams: {
    page?: string;
    module?: string;
    status?: string;
    priority?: string;
    assignee?: string;
    q?: string;
  };
}

export default async function TasksPage({ searchParams }: PageProps) {
  const page = Math.max(1, Number(searchParams.page) || 1);

  const [dashResult, tasksResult, membersResult] = await Promise.all([
    getTaskDashboardData(),
    getTasks({
      module: searchParams.module,
      status: searchParams.status,
      priority: searchParams.priority,
      assigneeId: searchParams.assignee,
      search: searchParams.q,
      page,
      limit: 25,
    }),
    getTeamMembers(),
  ]);

  const dashboard = dashResult.data;
  const teamMembers = membersResult.data ?? [];

  if (!dashboard) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center text-destructive">
        Erreur lors du chargement du tableau de bord
      </div>
    );
  }

  const { metrics, moduleBreakdown, priorities, urgencies, myTasks, teamWorkload } = dashboard;
  const tasks = (tasksResult as any).data ?? [];
  const total = (tasksResult as any).total ?? 0;
  const totalPages = (tasksResult as any).totalPages ?? 1;

  const hasFilters = !!(searchParams.module || searchParams.status || searchParams.priority || searchParams.assignee || searchParams.q);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Tasks OS</h1>
          <p className="text-muted-foreground">
            Opérations centralisées — priorités, urgences, collaboratif
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" asChild>
            <Link href="/tasks/my"><Target className="mr-2 h-4 w-4" />Mes tâches</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/tasks/board"><Kanban className="mr-2 h-4 w-4" />Kanban</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/tasks/timeline"><Calendar className="mr-2 h-4 w-4" />Timeline</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/tasks/analytics"><BarChart3 className="mr-2 h-4 w-4" />Analytics</Link>
          </Button>
          <TaskCreateDialog teamMembers={teamMembers} />
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <KpiCard label="Total actif" value={metrics.totalActive} icon={<ListTodo className="h-4 w-4 text-blue-600" />} color="blue" />
        <KpiCard label="Mes tâches" value={metrics.myTasks} icon={<Target className="h-4 w-4 text-indigo-600" />} color="indigo" href="/tasks/my" />
        <KpiCard label="SLA dépassé" value={metrics.slaBreaches} icon={<AlertTriangle className="h-4 w-4 text-red-600" />} color="red" urgent={metrics.slaBreaches > 0} />
        <KpiCard label="Bloqué" value={metrics.blocked} icon={<Zap className="h-4 w-4 text-orange-600" />} color="orange" urgent={metrics.blocked > 0} />
        <KpiCard label="Approbation" value={metrics.waitingApproval} icon={<Clock className="h-4 w-4 text-yellow-600" />} color="yellow" />
        <KpiCard label="Terminé auj." value={metrics.completedToday} icon={<CheckCircle2 className="h-4 w-4 text-green-600" />} color="green" />
        <KpiCard label="Terminé sem." value={metrics.completedThisWeek} icon={<TrendingUp className="h-4 w-4 text-teal-600" />} color="teal" />
      </div>

      {/* SLA Alert Banner */}
      {metrics.slaBreaches > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-3">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
          <div className="flex-1 text-sm">
            <span className="font-semibold text-red-700 dark:text-red-400">
              {metrics.slaBreaches} tâche{metrics.slaBreaches > 1 ? "s" : ""} en retard critique
            </span>
            <span className="text-red-600 dark:text-red-500 ml-2">— action immédiate requise</span>
          </div>
          <Button size="sm" variant="destructive" asChild>
            <Link href="/tasks?priority=URGENT">Voir urgences</Link>
          </Button>
        </div>
      )}

      {/* Dashboard panels */}
      {!hasFilters && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Urgencies */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Urgences à traiter
                  {urgencies.length > 0 && <Badge variant="destructive" className="ml-auto text-xs">{urgencies.length}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {urgencies.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    Aucune urgence
                  </div>
                ) : (
                  <div className="divide-y">
                    {urgencies.slice(0, 6).map((task: any) => (
                      <Link key={task.id} href={`/tasks/${task.id}`} className="flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{task.title}</span>
                            {task.slaBreach && <Badge className="bg-red-100 text-red-700 text-xs shrink-0">SLA!</Badge>}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-xs capitalize">{task.module}</Badge>
                            <PriorityBadge priority={task.priority} />
                          </div>
                        </div>
                        {task.assignments?.[0]?.user && (
                          <span className="text-xs text-muted-foreground shrink-0">{task.assignments[0].user.name}</span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* My Tasks */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-4 w-4 text-indigo-500" />
                  Mes tâches
                  {myTasks.length > 0 && <Badge variant="secondary" className="ml-auto text-xs">{myTasks.length}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {myTasks.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    Vous êtes à jour !
                  </div>
                ) : (
                  <div className="divide-y">
                    {myTasks.slice(0, 6).map((task: any) => (
                      <Link key={task.id} href={`/tasks/${task.id}`} className="flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{task.title}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-xs capitalize">{task.module}</Badge>
                            <TaskStatusBadge status={task.status} />
                          </div>
                        </div>
                        {task.slaDeadline && (
                          <span className={cn("text-xs shrink-0", task.slaBreach ? "text-red-600 font-medium" : "text-muted-foreground")}>
                            {formatDate(task.slaDeadline, true)}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Module + Team */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-4 w-4 text-blue-500" /> Par module OS
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {moduleBreakdown.map((m: any) => {
                    const maxTotal = Math.max(...moduleBreakdown.map((x: any) => x.total), 1);
                    const pct = Math.round((m.total / maxTotal) * 100);
                    return (
                      <Link key={m.module} href={`/tasks?module=${m.module}`}>
                        <div className="flex items-center gap-3 py-1.5 hover:opacity-80 transition-opacity">
                          <span className="w-24 text-sm font-medium capitalize shrink-0">{m.module}</span>
                          <div className="flex-1"><Progress value={pct} className="h-1.5" /></div>
                          <div className="flex items-center gap-1.5 text-xs shrink-0 min-w-[80px] justify-end">
                            <span className="font-bold">{m.total}</span>
                            {m.slaBreaches > 0 && <Badge className="bg-red-100 text-red-700 text-xs px-1 py-0">{m.slaBreaches}!</Badge>}
                            {m.blocked > 0 && <Badge className="bg-orange-100 text-orange-700 text-xs px-1 py-0">{m.blocked} blq</Badge>}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4 text-purple-500" /> Charge équipe
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {teamWorkload.slice(0, 7).map((member: any) => {
                    const maxLoad = Math.max(...teamWorkload.map((m: any) => m.assignedCount), 1);
                    const pct = Math.round((member.assignedCount / maxLoad) * 100);
                    return (
                      <div key={member.userId} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium truncate max-w-[110px]">{member.userName}</span>
                          <div className="flex items-center gap-1 text-xs">
                            <span className="font-bold">{member.assignedCount}</span>
                            {member.slaBreaches > 0 && <span className="text-red-600 font-bold">!{member.slaBreaches}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="h-1.5 flex-1" />
                          <span className="text-xs text-muted-foreground w-8 text-right">{member.completedCount}v</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Priority Distribution */}
          {priorities && (
            <div className="grid grid-cols-4 gap-3">
              {[
                { key: "URGENT", label: "Urgent", count: priorities.URGENT, color: "text-red-600", bg: "bg-red-50 border-red-200 dark:bg-red-950/20" },
                { key: "HIGH", label: "Haut", count: priorities.HIGH, color: "text-orange-600", bg: "bg-orange-50 border-orange-200 dark:bg-orange-950/20" },
                { key: "NORMAL", label: "Normal", count: priorities.NORMAL, color: "text-blue-600", bg: "bg-blue-50 border-blue-200 dark:bg-blue-950/20" },
                { key: "LOW", label: "Bas", count: priorities.LOW, color: "text-gray-600", bg: "bg-gray-50 border-gray-200 dark:bg-gray-950/20" },
              ].map((p) => (
                <Link key={p.key} href={`/tasks?priority=${p.key}`}>
                  <Card className={cn("border cursor-pointer hover:shadow-sm", p.bg)}>
                    <CardContent className="p-3 text-center">
                      <div className={cn("text-2xl font-bold", p.color)}>{p.count}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{p.label}</div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {/* Task list */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">
            {hasFilters ? `Résultats (${total})` : `Toutes les tâches (${total})`}
          </h2>
          <TaskFilters
            currentModule={searchParams.module}
            currentStatus={searchParams.status}
            currentPriority={searchParams.priority}
            currentAssignee={searchParams.assignee}
            currentSearch={searchParams.q}
            teamMembers={teamMembers}
          />
        </div>

        <TaskTableClient tasks={tasks} teamMembers={teamMembers} />

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} sur {totalPages} ({total.toLocaleString("fr-FR")} tâches)
            </p>
            <div className="flex items-center gap-2">
              {page > 1 && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={buildUrl(searchParams, { page: page - 1 })}><ChevronLeft className="h-4 w-4 mr-1" />Précédent</Link>
                </Button>
              )}
              <div className="flex items-center gap-1">
                {buildPageNumbers(page, totalPages).map((p, i) =>
                  p === "..." ? (
                    <span key={`e-${i}`} className="px-2 text-muted-foreground">...</span>
                  ) : (
                    <Button key={p} variant={p === page ? "default" : "outline"} size="sm" className="w-9 h-8 p-0" asChild>
                      <Link href={buildUrl(searchParams, { page: p as number })}>{p}</Link>
                    </Button>
                  )
                )}
              </div>
              {page < totalPages && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={buildUrl(searchParams, { page: page + 1 })}>Suivant<ChevronRight className="h-4 w-4 ml-1" /></Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon, color, urgent, href }: {
  label: string; value: number; icon: React.ReactNode; color: string; urgent?: boolean; href?: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "border-blue-200 bg-blue-50/50 dark:bg-blue-950/10",
    indigo: "border-indigo-200 bg-indigo-50/50 dark:bg-indigo-950/10",
    red: "border-red-200 bg-red-50/50 dark:bg-red-950/10",
    orange: "border-orange-200 bg-orange-50/50 dark:bg-orange-950/10",
    yellow: "border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/10",
    green: "border-green-200 bg-green-50/50 dark:bg-green-950/10",
    teal: "border-teal-200 bg-teal-50/50 dark:bg-teal-950/10",
  };
  const Inner = (
    <Card className={cn("border", colorMap[color], urgent && "ring-2 ring-red-400 ring-offset-1", href && "cursor-pointer hover:shadow-sm transition-shadow")}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-1">
          {icon}
          {urgent && <span className="text-red-500 text-xs font-bold animate-pulse">!</span>}
        </div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground leading-tight">{label}</div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{Inner}</Link> : Inner;
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
