import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, CheckCircle2, Clock, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getGanttData } from "@/lib/actions/task.actions";
import { cn } from "@/lib/utils";

export const metadata = { title: "Gantt | Tâches | Horion ERP" };

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-300",
  IN_PROGRESS: "bg-blue-500",
  WAITING_APPROVAL: "bg-yellow-400",
  BLOCKED: "bg-red-500",
  COMPLETED: "bg-green-500",
  CANCELLED: "bg-gray-200",
};

const PRIORITY_BORDER: Record<string, string> = {
  CRITICAL: "border-l-4 border-red-500",
  HIGH: "border-l-4 border-orange-400",
  NORMAL: "border-l-4 border-blue-400",
  LOW: "border-l-4 border-gray-300",
};

const MODULE_COLORS: Record<string, string> = {
  sourcing: "bg-purple-100 text-purple-700",
  qc: "bg-teal-100 text-teal-700",
  logistics: "bg-blue-100 text-blue-700",
  finance: "bg-green-100 text-green-700",
  orders: "bg-orange-100 text-orange-700",
  crm: "bg-pink-100 text-pink-700",
  manual: "bg-gray-100 text-gray-700",
};

async function GanttChart() {
  const result = await getGanttData();
  if (result.error || !result.data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Erreur lors du chargement des données Gantt
      </div>
    );
  }

  const { rows, modules, rangeStart, rangeEnd, today } = result.data;

  if (rows.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p>Aucune tâche à afficher sur le Gantt</p>
      </div>
    );
  }

  // Timeline span in days
  const totalDays = Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / 86400000);

  function dayOffset(date: Date) {
    return Math.max(0, Math.ceil((date.getTime() - rangeStart.getTime()) / 86400000));
  }

  function dayWidth(start: Date, end: Date) {
    const days = Math.ceil((end.getTime() - start.getTime()) / 86400000);
    return Math.max(1, days);
  }

  const todayOffset = dayOffset(today);
  const todayPct = Math.min(100, (todayOffset / totalDays) * 100);

  // Group by module
  const byModule: Record<string, typeof rows> = {};
  for (const row of rows) {
    if (!byModule[row.module]) byModule[row.module] = [];
    byModule[row.module].push(row);
  }

  // Generate month labels
  const monthLabels: { label: string; pct: number }[] = [];
  const cursor = new Date(rangeStart);
  cursor.setDate(1);
  while (cursor <= rangeEnd) {
    const pct = (dayOffset(cursor) / totalDays) * 100;
    if (pct <= 100) {
      monthLabels.push({
        label: cursor.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
        pct,
      });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold">{rows.length}</div>
          <div className="text-xs text-muted-foreground">Tâches</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-blue-600">
            {rows.filter((r) => r.status === "IN_PROGRESS").length}
          </div>
          <div className="text-xs text-muted-foreground">En cours</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-red-600">
            {rows.filter((r) => r.slaBreach).length}
          </div>
          <div className="text-xs text-muted-foreground">SLA dépassé</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-600">
            {rows.filter((r) => r.status === "COMPLETED").length}
          </div>
          <div className="text-xs text-muted-foreground">Terminées</div>
        </div>
      </div>

      {/* Gantt chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Vue Gantt — {totalDays} jours</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div style={{ minWidth: "800px" }}>
            {/* Month header */}
            <div className="relative h-6 mb-1 border-b">
              {monthLabels.map((m, i) => (
                <span
                  key={i}
                  className="absolute top-0 text-xs text-muted-foreground font-medium"
                  style={{ left: `${m.pct}%` }}
                >
                  {m.label}
                </span>
              ))}
              {/* Today line */}
              <div
                className="absolute top-0 bottom-0 w-px bg-red-500 z-10"
                style={{ left: `${todayPct}%` }}
              />
            </div>

            {/* Task rows grouped by module */}
            {modules.map((mod) => (
              <div key={mod} className="mb-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge className={cn("text-xs capitalize", MODULE_COLORS[mod] ?? "bg-gray-100 text-gray-700")}>
                    {mod}
                  </Badge>
                  <span className="text-xs text-muted-foreground">({byModule[mod].length})</span>
                </div>

                <div className="space-y-1">
                  {byModule[mod].map((row) => {
                    const startPct = (dayOffset(row.startDate) / totalDays) * 100;
                    const widthPct = (dayWidth(row.startDate, row.endDate) / totalDays) * 100;

                    return (
                      <div key={row.id} className="relative h-8 flex items-center">
                        {/* Row label */}
                        <div className="w-40 shrink-0 pr-2 truncate">
                          <Link
                            href={`/tasks/${row.id}`}
                            className="text-xs font-medium hover:text-primary truncate block"
                          >
                            {row.title}
                          </Link>
                        </div>

                        {/* Timeline area */}
                        <div className="flex-1 relative h-5 bg-muted/30 rounded">
                          {/* Today line */}
                          <div
                            className="absolute top-0 bottom-0 w-px bg-red-400 z-20"
                            style={{ left: `${todayPct}%` }}
                          />

                          {/* Task bar */}
                          <div
                            className={cn(
                              "absolute top-1 h-3 rounded text-[10px] flex items-center px-1 truncate cursor-pointer",
                              STATUS_COLORS[row.status],
                              row.slaBreach && "ring-1 ring-red-600"
                            )}
                            style={{
                              left: `${Math.min(startPct, 98)}%`,
                              width: `${Math.min(widthPct, 100 - startPct)}%`,
                              minWidth: "4px",
                            }}
                            title={`${row.title} (${row.status})`}
                          />

                          {/* SLA breach icon */}
                          {row.slaBreach && (
                            <div
                              className="absolute top-0 z-30"
                              style={{ left: `${Math.min(startPct + widthPct, 98)}%` }}
                            >
                              <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                            </div>
                          )}

                          {/* Completed check */}
                          {row.status === "COMPLETED" && (
                            <div
                              className="absolute top-0.5 z-30"
                              style={{ left: `${Math.min(startPct + widthPct, 97)}%` }}
                            >
                              <CheckCircle2 className="h-3 w-3 text-green-600" />
                            </div>
                          )}
                        </div>

                        {/* Assignee */}
                        {row.assignee && (
                          <span className="w-20 pl-2 text-[10px] text-muted-foreground shrink-0 truncate">
                            {row.assignee}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t">
              {Object.entries(STATUS_COLORS).map(([status, color]) => (
                <div key={status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className={cn("w-4 h-2.5 rounded", color)} />
                  {status.replace(/_/g, " ")}
                </div>
              ))}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-px h-4 bg-red-500" />
                Aujourd&apos;hui
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default async function GanttPage() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/tasks"><ArrowLeft className="h-4 w-4 mr-1" />Retour</Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Gantt</h1>
          <p className="text-sm text-muted-foreground">Vue temporelle de toutes les tâches</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/tasks/timeline">Timeline</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/tasks/board">Kanban</Link>
          </Button>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Chargement du Gantt...
          </div>
        }
      >
        <GanttChart />
      </Suspense>
    </div>
  );
}
