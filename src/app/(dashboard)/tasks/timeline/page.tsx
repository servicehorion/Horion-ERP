import Link from "next/link";
import {
  AlertTriangle, ArrowLeft, Calendar, CheckCircle2,
  ChevronRight, Clock, Target,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskStatusBadge, PriorityBadge } from "@/components/shared/status-badge";
import { getTaskTimeline } from "@/lib/actions/task.actions";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const metadata = { title: "Timeline Tâches | Horion ERP" };

export default async function TaskTimelinePage() {
  const result = await getTaskTimeline();
  const tasks = (result.data ?? []) as any[];

  // Group by week
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  type TimelineGroup = { label: string; key: string; tasks: any[]; isPast: boolean; isThisWeek: boolean };
  const groups: TimelineGroup[] = [];

  // Overdue
  const overdue = tasks.filter((t: any) =>
    t.slaDeadline && new Date(t.slaDeadline) < today && !["COMPLETED", "CANCELLED"].includes(t.status)
  );
  if (overdue.length > 0) {
    groups.push({ label: "En retard", key: "overdue", tasks: overdue, isPast: true, isThisWeek: false });
  }

  // Today
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);
  const todayTasks = tasks.filter((t: any) =>
    t.slaDeadline && new Date(t.slaDeadline) >= today && new Date(t.slaDeadline) <= todayEnd
    && !["COMPLETED", "CANCELLED"].includes(t.status)
  );
  if (todayTasks.length > 0) {
    groups.push({ label: "Aujourd'hui", key: "today", tasks: todayTasks, isPast: false, isThisWeek: true });
  }

  // This week (remaining)
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));
  const thisWeekTasks = tasks.filter((t: any) => {
    if (!t.slaDeadline) return false;
    const d = new Date(t.slaDeadline);
    return d > todayEnd && d <= weekEnd && !["COMPLETED", "CANCELLED"].includes(t.status);
  });
  if (thisWeekTasks.length > 0) {
    groups.push({ label: "Cette semaine", key: "thisweek", tasks: thisWeekTasks, isPast: false, isThisWeek: true });
  }

  // Next week
  const nextWeekEnd = new Date(weekEnd);
  nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);
  const nextWeekTasks = tasks.filter((t: any) => {
    if (!t.slaDeadline) return false;
    const d = new Date(t.slaDeadline);
    return d > weekEnd && d <= nextWeekEnd && !["COMPLETED", "CANCELLED"].includes(t.status);
  });
  if (nextWeekTasks.length > 0) {
    groups.push({ label: "Semaine prochaine", key: "nextweek", tasks: nextWeekTasks, isPast: false, isThisWeek: false });
  }

  // Later (2-4 weeks)
  const laterTasks = tasks.filter((t: any) => {
    if (!t.slaDeadline) return false;
    const d = new Date(t.slaDeadline);
    return d > nextWeekEnd && !["COMPLETED", "CANCELLED"].includes(t.status);
  });
  if (laterTasks.length > 0) {
    groups.push({ label: "Plus tard", key: "later", tasks: laterTasks, isPast: false, isThisWeek: false });
  }

  // No deadline
  const noDeadline = tasks.filter((t: any) =>
    !t.slaDeadline && !["COMPLETED", "CANCELLED"].includes(t.status)
  );
  if (noDeadline.length > 0) {
    groups.push({ label: "Sans échéance", key: "nodate", tasks: noDeadline, isPast: false, isThisWeek: false });
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/tasks"><ArrowLeft className="h-4 w-4 mr-1" />Tâches</Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Calendar className="h-6 w-6 text-teal-600" />
              Timeline
            </h1>
            <p className="text-sm text-muted-foreground">
              Vue chronologique des tâches par échéance SLA
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/tasks/board">Kanban</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/tasks/my">Mes Tâches</Link>
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-sm">
        <Badge variant={overdue.length > 0 ? "destructive" : "secondary"}>
          {overdue.length} en retard
        </Badge>
        <Badge variant="secondary">{todayTasks.length} aujourd&apos;hui</Badge>
        <Badge variant="secondary">{thisWeekTasks.length} cette semaine</Badge>
        <Badge variant="outline">{tasks.length} total (30j)</Badge>
      </div>

      {/* Timeline */}
      {groups.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CheckCircle2 className="h-12 w-12 text-green-500/30 mb-4" />
            <h3 className="text-lg font-semibold">Aucune tâche planifiée</h3>
            <p className="text-sm text-muted-foreground">Les tâches avec échéances SLA apparaîtront ici</p>
          </CardContent>
        </Card>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[18px] top-0 bottom-0 w-0.5 bg-border" />

          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.key} className="relative">
                {/* Group header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold z-10 border-2",
                    group.key === "overdue" ? "bg-red-100 border-red-300 text-red-600" :
                    group.key === "today" ? "bg-blue-100 border-blue-300 text-blue-600" :
                    group.isThisWeek ? "bg-teal-100 border-teal-300 text-teal-600" :
                    "bg-gray-100 border-gray-300 text-gray-600"
                  )}>
                    {group.key === "overdue" ? "!" :
                     group.key === "today" ? "★" :
                     group.key === "nodate" ? "∅" :
                     <Calendar className="h-4 w-4" />
                    }
                  </div>
                  <h3 className={cn(
                    "text-sm font-bold uppercase tracking-wider",
                    group.key === "overdue" ? "text-red-600" :
                    group.key === "today" ? "text-blue-600" :
                    "text-muted-foreground"
                  )}>
                    {group.label}
                  </h3>
                  <Badge variant="outline" className="text-xs">{group.tasks.length}</Badge>
                </div>

                {/* Tasks */}
                <div className="ml-12 space-y-2">
                  {group.tasks.map((task: any) => (
                    <Link key={task.id} href={`/tasks/${task.id}`}>
                      <Card className={cn(
                        "hover:shadow-md transition-all group cursor-pointer",
                        group.key === "overdue" && "border-red-200 bg-red-50/30 dark:bg-red-950/10",
                      )}>
                        <CardContent className="p-3 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              {task.slaBreach && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                              <span className="text-sm font-medium truncate group-hover:text-primary">
                                {task.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs capitalize">{task.module}</Badge>
                              <PriorityBadge priority={task.priority} />
                              {task.assignments?.[0]?.user && (
                                <span className="text-xs text-muted-foreground">
                                  {task.assignments[0].user.name}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <TaskStatusBadge status={task.status} />
                            {task.slaDeadline && (
                              <div className={cn("text-xs mt-0.5", task.slaBreach ? "text-red-600 font-medium" : "text-muted-foreground")}>
                                {formatDate(task.slaDeadline, true)}
                              </div>
                            )}
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
