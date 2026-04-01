import Link from "next/link";
import {
  Activity, ArrowLeft, BarChart3, Bot, CheckCircle2, Clock,
  Gauge, TrendingDown, TrendingUp, Users, Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { getTaskAnalytics, getTaskDashboardData } from "@/lib/actions/task.actions";
import { cn } from "@/lib/utils";

export const metadata = { title: "Analytique Taches | Horion ERP" };

const STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  IN_PROGRESS: "En cours",
  WAITING_APPROVAL: "Approbation",
  BLOCKED: "Bloqué",
  COMPLETED: "Terminé",
  CANCELLED: "Annulé",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-400",
  IN_PROGRESS: "bg-blue-500",
  WAITING_APPROVAL: "bg-yellow-500",
  BLOCKED: "bg-orange-500",
  COMPLETED: "bg-green-500",
  CANCELLED: "bg-red-400",
};

const OWNER_LABELS: Record<string, string> = {
  HUMAN: "Humain",
  AI_AGENT: "Agent IA",
  SYSTEM: "Système",
};

export default async function TaskAnalyticsPage() {
  const [analyticsResult, dashResult] = await Promise.all([
    getTaskAnalytics(),
    getTaskDashboardData(),
  ]);

  const analytics = analyticsResult.data;
  const dashboard = dashResult.data;

  if (!analytics || !dashboard) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center text-destructive">
        Erreur lors du chargement des donnees analytiques
      </div>
    );
  }

  const { dailyData, slaCompliance, avgResolution, statusBreakdown, ownerBreakdown } = analytics;
  const { metrics, teamWorkload } = dashboard;

  // Calculate chart max for scaling
  const maxDaily = Math.max(...dailyData.map((d) => Math.max(d.created, d.completed)), 1);

  // Total tasks by status
  const totalTasks = statusBreakdown.reduce((s, b) => s + b.count, 0);

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/tasks"><ArrowLeft className="h-4 w-4 mr-1" />Tâches</Link>
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-violet-600" />
              Analytique & rapports
            </h1>
            <p className="text-sm text-muted-foreground">Performance, SLA, vélocité et tendances</p>
          </div>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Gauge className="h-5 w-5 text-green-600" />
              <Badge className={cn("text-xs",
                slaCompliance >= 90 ? "bg-green-100 text-green-700" :
                slaCompliance >= 70 ? "bg-yellow-100 text-yellow-700" :
                "bg-red-100 text-red-700"
              )}>
                {slaCompliance >= 90 ? "Excellent" : slaCompliance >= 70 ? "Moyen" : "Critique"}
              </Badge>
            </div>
            <div className="text-3xl font-bold text-green-700">{slaCompliance}%</div>
            <div className="text-xs text-muted-foreground mt-1">Conformité SLA</div>
            <Progress value={slaCompliance} className="h-1.5 mt-2" />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div className="text-3xl font-bold text-blue-700">{avgResolution}h</div>
            <div className="text-xs text-muted-foreground mt-1">Temps moyen résolution</div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <div className="text-3xl font-bold text-purple-700">{metrics.completedThisWeek}</div>
            <div className="text-xs text-muted-foreground mt-1">Terminées cette semaine</div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Activity className="h-5 w-5 text-amber-600" />
            </div>
            <div className="text-3xl font-bold text-amber-700">{totalTasks}</div>
            <div className="text-xs text-muted-foreground mt-1">Total tâches</div>
          </CardContent>
        </Card>
      </div>

      {/* Burndown chart (CSS bars) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-indigo-500" />
            Vélocité — 14 derniers jours
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 h-40">
            {dailyData.map((day) => {
              const createdH = Math.max(2, Math.round((day.created / maxDaily) * 100));
              const completedH = Math.max(2, Math.round((day.completed / maxDaily) * 100));
              const dateLabel = day.date.split("-").slice(1).join("/");
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="flex items-end gap-0.5 h-32 w-full">
                    <div
                      className="flex-1 bg-blue-200 dark:bg-blue-800 rounded-t-sm transition-all"
                      style={{ height: `${createdH}%` }}
                      title={`Créées: ${day.created}`}
                    />
                    <div
                      className="flex-1 bg-green-400 dark:bg-green-700 rounded-t-sm transition-all"
                      style={{ height: `${completedH}%` }}
                      title={`Terminées: ${day.completed}`}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground">{dateLabel}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-6 mt-3 justify-center">
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded-sm bg-blue-200 dark:bg-blue-800" />
              <span className="text-muted-foreground">Créées</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded-sm bg-green-400 dark:bg-green-700" />
              <span className="text-muted-foreground">Terminées</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Status breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              Par statut
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {statusBreakdown.map((s) => {
                const pct = totalTasks > 0 ? Math.round((s.count / totalTasks) * 100) : 0;
                return (
                  <div key={s.status} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2.5 h-2.5 rounded-full", STATUS_COLORS[s.status] ?? "bg-gray-400")} />
                        <span>{STATUS_LABELS[s.status] ?? s.status}</span>
                      </div>
                      <span className="font-mono text-xs">{s.count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full rounded-full", STATUS_COLORS[s.status] ?? "bg-gray-400")} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Repartition par type de responsable */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-4 w-4 text-purple-500" />
              Par type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {ownerBreakdown.map((o) => {
                const totalActive = ownerBreakdown.reduce((s, b) => s + b.count, 0);
                const pct = totalActive > 0 ? Math.round((o.count / totalActive) * 100) : 0;
                return (
                  <div key={o.ownerType} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span>{OWNER_LABELS[o.ownerType] ?? o.ownerType}</span>
                      <span className="font-bold">{o.count}</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                    <div className="text-xs text-muted-foreground text-right">{pct}%</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Team performance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-green-500" />
              Performance équipe
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {teamWorkload.slice(0, 8).map((member: any) => {
                const completionRate = member.assignedCount > 0
                  ? Math.round((member.completedCount / member.assignedCount) * 100)
                  : 0;
                return (
                  <div key={member.userId} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate max-w-[120px]">{member.name}</span>
                      <div className="flex items-center gap-2 text-xs">
                        <span>{member.completedCount}/{member.assignedCount}</span>
                        <Badge variant={completionRate >= 80 ? "default" : completionRate >= 50 ? "secondary" : "destructive"} className="text-xs px-1">
                          {completionRate}%
                        </Badge>
                      </div>
                    </div>
                    <Progress value={completionRate} className="h-1.5" />
                    {member.slaBreaches > 0 && (
                      <div className="text-xs text-red-600">{member.slaBreaches} SLA dépassé</div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary numbers */}
      <Card className="border-0 bg-gradient-to-r from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950/20 dark:via-blue-950/20 dark:to-indigo-950/20">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-6 text-center">
            {[
              { label: "Total actives", value: metrics.totalActive, icon: Zap },
              { label: "SLA dépassé", value: metrics.slaBreaches, icon: Clock },
              { label: "Bloquées", value: metrics.blocked, icon: Activity },
              { label: "Terminées (total)", value: metrics.totalCompleted, icon: CheckCircle2 },
              { label: "Annulées", value: metrics.totalCancelled, icon: TrendingDown },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label}>
                <Icon className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <div className="text-2xl font-bold">{value}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

