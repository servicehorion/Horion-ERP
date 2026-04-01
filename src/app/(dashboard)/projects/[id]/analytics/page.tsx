import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BarChart3, Clock, DollarSign, Target, TrendingUp, Zap } from "lucide-react";

import { auth } from "@/lib/auth";
import { getProject } from "@/lib/actions/project.actions";
import { getTimeEntries } from "@/lib/actions/project.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ProjectAnalyticsClient } from "@/components/projects/project-analytics-client";
import { cn } from "@/lib/utils";

export const metadata = { title: "Analytique projet | Horion ERP" };

export default async function ProjectAnalyticsPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const [projectResult, timeResult] = await Promise.all([
    getProject(params.id),
    getTimeEntries({ projectId: params.id }),
  ]);

  if (projectResult.error || !projectResult.data) notFound();

  const project = projectResult.data;
  const timeData = timeResult.data ?? { entries: [], totalMinutes: 0, totalCost: 0 };

  // ── Compute analytics ────────────────────────────────────────────

  const tasks = project.tasks || [];
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t: any) => t.status === "COMPLETED").length;
  const inProgressTasks = tasks.filter((t: any) => t.status === "IN_PROGRESS").length;
  const blockedTasks = tasks.filter((t: any) => t.status === "BLOCKED").length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Budget
  const budgets = project.budgets || [];
  const totalPlanned = budgets.reduce((s: number, b: any) => s + Number(b.planned), 0);
  const totalActual = budgets.reduce((s: number, b: any) => s + Number(b.actual), 0);
  const budgetPct = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;
  const costVariance = totalPlanned - totalActual;

  // Velocity: story points per sprint
  const sprints = project.sprints || [];
  const completedSprints = sprints.filter((s: any) => s.status === "COMPLETED");

  // Time breakdown per user
  const timeByUser: Record<string, { name: string; minutes: number; cost: number }> = {};
  for (const entry of timeData.entries) {
    const uid = entry.user.id;
    if (!timeByUser[uid]) timeByUser[uid] = { name: entry.user.name, minutes: 0, cost: 0 };
    timeByUser[uid].minutes += entry.minutes;
    timeByUser[uid].cost += Number((entry as any).cost ?? 0);
  }
  const timeByUserList = Object.values(timeByUser).sort((a, b) => b.minutes - a.minutes);

  // Burndown data: tasks completed per day over last 30 days
  const now = Date.now();
  const burndownDays: { date: string; completed: number; remaining: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const day = new Date(now - i * 86400000);
    const dayStr = day.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    const completedByDay = tasks.filter((t: any) => {
      if (!t.completedAt) return false;
      const d = new Date(t.completedAt);
      return d <= day;
    }).length;
    burndownDays.push({ date: dayStr, completed: completedByDay, remaining: totalTasks - completedByDay });
  }

  // Milestone progress
  const milestones = project.milestones || [];
  const achievedMilestones = milestones.filter((m: any) => m.status === "ACHIEVED").length;
  const milestonePct = milestones.length > 0 ? Math.round((achievedMilestones / milestones.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-6 p-3 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/projects/${params.id}`}>
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            {project.name}
          </Button>
        </Link>
        <h1 className="text-xl font-bold">Analytique</h1>
      </div>

      {/* KPI top row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 bg-muted/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Avancement</span>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </div>
            <p className="text-2xl font-bold">{progress}%</p>
            <Progress value={progress} className="h-1.5 mt-2" />
            <p className="text-xs text-muted-foreground mt-1">{completedTasks}/{totalTasks} tâches</p>
          </CardContent>
        </Card>

        <Card className="border-0 bg-muted/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Budget consommé</span>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className={cn("text-2xl font-bold", budgetPct > 100 && "text-red-600")}>{budgetPct}%</p>
            {totalPlanned > 0 ? (
              <>
                <Progress value={Math.min(100, budgetPct)} className={cn("h-1.5 mt-2", budgetPct > 100 && "[&>div]:bg-red-500")} />
                <p className={cn("text-xs mt-1", costVariance >= 0 ? "text-green-600" : "text-red-600")}>
                  {costVariance >= 0 ? "+" : ""}{costVariance.toLocaleString("fr-FR")} XAF restant
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">Non défini</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 bg-muted/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Temps loggé</span>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">
              {Math.floor(timeData.totalMinutes / 60)}h
              {timeData.totalMinutes % 60 > 0 && <span className="text-base font-normal">{timeData.totalMinutes % 60}m</span>}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {timeData.entries.length} entrées
              {timeData.totalCost > 0 && ` · ${timeData.totalCost.toLocaleString("fr-FR")} XAF`}
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 bg-muted/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Jalons</span>
              <Target className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{achievedMilestones}/{milestones.length}</p>
            {milestones.length > 0 && (
              <Progress value={milestonePct} className="h-1.5 mt-2" />
            )}
            <p className="text-xs text-muted-foreground mt-1">{milestonePct}% atteints</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts client component */}
      <ProjectAnalyticsClient
        burndownDays={burndownDays}
        timeByUser={timeByUserList}
        budgets={budgets.map((b: any) => ({
          label: b.label,
          category: b.category,
          planned: Number(b.planned),
          actual: Number(b.actual),
        }))}
        taskStatusBreakdown={[
          { status: "Terminées", count: completedTasks, color: "#22c55e" },
          { status: "En cours", count: inProgressTasks, color: "#3b82f6" },
          { status: "Bloquées", count: blockedTasks, color: "#ef4444" },
          { status: "En attente", count: totalTasks - completedTasks - inProgressTasks - blockedTasks, color: "#94a3b8" },
        ].filter((s) => s.count > 0)}
        sprints={completedSprints.map((s: any) => ({
          name: s.name,
          velocity: s.velocity ?? 0,
        }))}
      />
    </div>
  );
}

