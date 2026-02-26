"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ProjectAnalyticsClientProps {
  burndownDays: { date: string; completed: number; remaining: number }[];
  timeByUser: { name: string; minutes: number; cost: number }[];
  budgets: { label: string; category: string; planned: number; actual: number }[];
  taskStatusBreakdown: { status: string; count: number; color: string }[];
  sprints: { name: string; velocity: number }[];
}

function formatMinutes(m: number) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h === 0 ? `${min}min` : min === 0 ? `${h}h` : `${h}h ${min}min`;
}

export function ProjectAnalyticsClient({
  burndownDays,
  timeByUser,
  budgets,
  taskStatusBreakdown,
  sprints,
}: ProjectAnalyticsClientProps) {
  const totalTasks =
    burndownDays.length > 0 ? burndownDays[0].remaining + burndownDays[0].completed : 0;
  const maxRemaining = Math.max(...burndownDays.map((d) => d.remaining), 1);
  const maxUserMinutes = Math.max(...timeByUser.map((u) => u.minutes), 1);
  const totalCount = taskStatusBreakdown.reduce((s, t) => s + t.count, 0);
  const maxVelocity = Math.max(...sprints.map((s) => s.velocity), 1);
  const maxBudget = Math.max(...budgets.map((b) => Math.max(b.planned, b.actual)), 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Burndown chart */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Burndown — tâches restantes (30 jours)</CardTitle>
        </CardHeader>
        <CardContent>
          {burndownDays.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Pas encore de données</p>
          ) : (
            <div className="flex items-end gap-0.5 h-40">
              {burndownDays.map((day, i) => {
                const heightPct = maxRemaining > 0 ? Math.round((day.remaining / maxRemaining) * 100) : 0;
                // Show every 5th label
                const showLabel = i === 0 || i === burndownDays.length - 1 || i % 7 === 0;
                return (
                  <div key={i} className="flex flex-col items-center flex-1 gap-1 group relative">
                    <div
                      className="w-full bg-primary/20 hover:bg-primary/40 transition-colors rounded-t-sm"
                      style={{ height: `${heightPct}%` }}
                      title={`${day.date}: ${day.remaining} restantes`}
                    />
                    {showLabel && (
                      <span className="text-[9px] text-muted-foreground rotate-45 origin-left absolute -bottom-5 left-0 whitespace-nowrap">
                        {day.date}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex items-center gap-4 mt-8 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-primary/20" />
              Tâches restantes
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Task status donut (CSS-based) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Répartition des tâches</CardTitle>
        </CardHeader>
        <CardContent>
          {taskStatusBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucune tâche</p>
          ) : (
            <div className="space-y-3">
              {/* Stacked bar */}
              <div className="flex h-6 rounded-full overflow-hidden gap-0.5">
                {taskStatusBreakdown.map((s) => (
                  <div
                    key={s.status}
                    style={{
                      width: `${Math.round((s.count / totalCount) * 100)}%`,
                      backgroundColor: s.color,
                    }}
                    title={`${s.status}: ${s.count}`}
                    className="transition-all"
                  />
                ))}
              </div>
              {/* Legend */}
              <div className="space-y-2">
                {taskStatusBreakdown.map((s) => (
                  <div key={s.status} className="flex items-center gap-2 text-sm">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="flex-1">{s.status}</span>
                    <span className="font-medium">{s.count}</span>
                    <span className="text-muted-foreground">
                      ({Math.round((s.count / totalCount) * 100)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Velocity per sprint */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Vélocité par sprint (story points)</CardTitle>
        </CardHeader>
        <CardContent>
          {sprints.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Aucun sprint terminé. La vélocité s&apos;affichera après le premier sprint complété.
            </p>
          ) : (
            <div className="space-y-2">
              {sprints.map((s, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate max-w-[160px]">{s.name}</span>
                    <span className="font-medium">{s.velocity} pts</span>
                  </div>
                  <Progress
                    value={maxVelocity > 0 ? Math.round((s.velocity / maxVelocity) * 100) : 0}
                    className="h-2"
                  />
                </div>
              ))}
              {sprints.length >= 2 && (
                <p className="text-xs text-muted-foreground pt-1">
                  Moyenne : {Math.round(sprints.reduce((s, sp) => s + sp.velocity, 0) / sprints.length)} pts/sprint
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Budget breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Budget par ligne</CardTitle>
        </CardHeader>
        <CardContent>
          {budgets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucune ligne budgétaire</p>
          ) : (
            <div className="space-y-3">
              {budgets.map((b, i) => {
                const pct = b.planned > 0 ? Math.round((b.actual / b.planned) * 100) : 0;
                const over = b.actual > b.planned;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate max-w-[140px]">{b.label}</span>
                      <span className={cn("font-medium", over && "text-red-600")}>
                        {b.actual.toLocaleString("fr-FR")} / {b.planned.toLocaleString("fr-FR")} XAF
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={Math.min(100, pct)}
                        className={cn("h-2 flex-1", over && "[&>div]:bg-red-500")}
                      />
                      <span className={cn("text-xs w-9 text-right", over && "text-red-600 font-medium")}>
                        {pct}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Time by user */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Temps par membre</CardTitle>
        </CardHeader>
        <CardContent>
          {timeByUser.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucune entrée de temps</p>
          ) : (
            <div className="space-y-3">
              {timeByUser.map((u, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-medium">
                        {u.name.charAt(0)}
                      </div>
                      <span>{u.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{formatMinutes(u.minutes)}</span>
                      {u.cost > 0 && (
                        <span className="text-muted-foreground">{u.cost.toLocaleString("fr-FR")} XAF</span>
                      )}
                    </div>
                  </div>
                  <Progress
                    value={maxUserMinutes > 0 ? Math.round((u.minutes / maxUserMinutes) * 100) : 0}
                    className="h-1.5"
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
