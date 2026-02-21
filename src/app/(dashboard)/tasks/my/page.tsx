import Link from "next/link";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Clock, Inbox,
  ListTodo, Target, TrendingUp, Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { TaskStatusBadge, PriorityBadge } from "@/components/shared/status-badge";
import { getMyTasksList } from "@/lib/actions/task.actions";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const metadata = { title: "Mes Tâches | Horion ERP" };

export default async function MyTasksPage() {
  const result = await getMyTasksList();
  const tasks = (result.data ?? []) as any[];

  // Stats
  const total = tasks.length;
  const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const blocked = tasks.filter((t) => t.status === "BLOCKED").length;
  const slaBreaches = tasks.filter((t) => t.slaBreach).length;
  const waitingApproval = tasks.filter((t) => t.status === "WAITING_APPROVAL").length;
  const urgent = tasks.filter((t) => t.priority === "URGENT" || t.priority === "CRITICAL").length;

  // Group by status
  const byStatus: Record<string, any[]> = {};
  tasks.forEach((t) => {
    if (!byStatus[t.status]) byStatus[t.status] = [];
    byStatus[t.status].push(t);
  });

  const statusOrder = ["BLOCKED", "IN_PROGRESS", "WAITING_APPROVAL", "PENDING"];
  const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
    BLOCKED: { label: "Bloquées", icon: Zap, color: "text-orange-600" },
    IN_PROGRESS: { label: "En cours", icon: TrendingUp, color: "text-blue-600" },
    WAITING_APPROVAL: { label: "En approbation", icon: Clock, color: "text-yellow-600" },
    PENDING: { label: "En attente", icon: Inbox, color: "text-gray-600" },
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/tasks"><ArrowLeft className="h-4 w-4 mr-1" />Tâches</Link>
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Target className="h-6 w-6 text-indigo-600" />
              Mes Tâches
            </h1>
            <p className="text-sm text-muted-foreground">Vue personnalisée de vos tâches actives</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/tasks">Dashboard</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/tasks/board">Kanban</Link>
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total actif", value: total, icon: ListTodo, color: "text-blue-600" },
          { label: "En cours", value: inProgress, icon: TrendingUp, color: "text-blue-600" },
          { label: "Bloquées", value: blocked, icon: Zap, color: "text-orange-600", alert: blocked > 0 },
          { label: "SLA dépassé", value: slaBreaches, icon: AlertTriangle, color: "text-red-600", alert: slaBreaches > 0 },
          { label: "Urgentes", value: urgent, icon: AlertTriangle, color: "text-red-600", alert: urgent > 0 },
        ].map(({ label, value, icon: Icon, color, alert }) => (
          <Card key={label} className={cn("border-0 shadow-sm", alert && "ring-1 ring-red-200")}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">{label}</span>
                <Icon className={cn("h-4 w-4", color)} />
              </div>
              <div className={cn("text-2xl font-bold", color)}>{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* SLA Alert */}
      {slaBreaches > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-3">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
          <span className="text-sm font-semibold text-red-700 dark:text-red-400">
            {slaBreaches} de vos tâches ont dépassé le SLA !
          </span>
        </div>
      )}

      {/* Tasks grouped by status */}
      {total === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500/30 mb-4" />
            <h3 className="text-xl font-semibold text-green-700">Vous êtes à jour !</h3>
            <p className="text-sm text-muted-foreground mt-1">Aucune tâche active ne vous est assignée</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {statusOrder.map((status) => {
            const statusTasks = byStatus[status];
            if (!statusTasks || statusTasks.length === 0) return null;
            const config = STATUS_CONFIG[status];
            const Icon = config.icon;

            return (
              <div key={status}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon className={cn("h-4 w-4", config.color)} />
                  <h2 className={cn("text-sm font-semibold", config.color)}>{config.label}</h2>
                  <Badge variant="secondary" className="text-xs">{statusTasks.length}</Badge>
                </div>
                <div className="space-y-2">
                  {statusTasks.map((task: any) => (
                    <Link key={task.id} href={`/tasks/${task.id}`}>
                      <Card className={cn(
                        "hover:shadow-md transition-all cursor-pointer group",
                        task.slaBreach && "border-red-200 bg-red-50/50 dark:bg-red-950/10",
                        status === "BLOCKED" && "border-orange-200",
                      )}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {task.slaBreach && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                                <span className="font-medium text-sm group-hover:text-primary transition-colors truncate">
                                  {task.title}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="text-xs capitalize">{task.module}</Badge>
                                <PriorityBadge priority={task.priority} />
                                {task._count?.children > 0 && (
                                  <Badge variant="secondary" className="text-xs">{task._count.children} sous-tâches</Badge>
                                )}
                                {task._count?.comments > 0 && (
                                  <Badge variant="secondary" className="text-xs">{task._count.comments} 💬</Badge>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <TaskStatusBadge status={task.status} />
                              {task.slaDeadline && (
                                <div className={cn("text-xs mt-1", task.slaBreach ? "text-red-600 font-semibold" : "text-muted-foreground")}>
                                  <Clock className="h-3 w-3 inline mr-0.5" />
                                  {formatDate(task.slaDeadline, true)}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
