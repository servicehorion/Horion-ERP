"use client";

import Link from "next/link";
import { AlertTriangle, Activity, Target, TrendingUp } from "lucide-react";
import { PolarAngleAxis, PolarGrid, Radar as RechartsRadar, RadarChart } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StableResponsiveChart } from "@/components/shared/stable-responsive-chart";

export type StrategicIntelligenceData = {
  generatedAt: string;
  kpis: {
    marginPercent: number;
    cashPosition: number;
    overdueRate: number;
    crmConversionRate: number;
    pipelineValue: number;
    sourcingSlaBreachRate: number;
    logisticsDelayRate: number;
    delayedShipments: number;
    qcPassRate: number;
    qcFailRate: number;
  };
  healthRadar: Array<{
    module: string;
    score: number;
    status: "green" | "orange" | "red";
    details: string;
    href: string;
  }>;
  anomalies: Array<{
    id: string;
    severity: "red" | "orange" | "green";
    title: string;
    description: string;
    metric: string;
    value: number;
    href: string;
    createdAt: string;
  }>;
  signals: {
    red: StrategicIntelligenceData["anomalies"];
    orange: StrategicIntelligenceData["anomalies"];
    green: StrategicIntelligenceData["anomalies"];
  };
  operationalHealth: { score: number; status: "green" | "orange" | "red" };
  suggestedPriorities: Array<{ title: string; reason: string; href: string; severity: "high" | "medium" | "low" }>;
  objectives: Array<{ id: string; title: string; progress: number; status: string; targetDate?: string | null }>;
};

const statusColor: Record<string, string> = {
  green: "bg-emerald-100 text-emerald-700",
  orange: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
};

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

const formatNumber = (value: number) => new Intl.NumberFormat("fr-FR").format(value);

export function StrategicIntelligence({ data }: { data: StrategicIntelligenceData }) {
  const k = data.kpis;
  const radarData = data.healthRadar.map((item) => ({
    module: item.module,
    score: item.score,
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-indigo-500" /> Operational Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-4xl font-semibold">{data.operationalHealth.score}</div>
                <Badge className={statusColor[data.operationalHealth.status]}>Health</Badge>
              </div>
              <div className="text-xs text-muted-foreground">Updated {new Date(data.generatedAt).toLocaleString("fr-FR")}</div>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <StableResponsiveChart className="h-[280px]">
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="module" />
                    <RechartsRadar dataKey="score" stroke="#0f766e" fill="#14b8a6" fillOpacity={0.35} />
                  </RadarChart>
              </StableResponsiveChart>
              <div className="space-y-3">
                {data.healthRadar.map((item) => (
                  <Link key={item.module} href={item.href} className="block rounded border p-3 hover:bg-slate-50">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{item.module}</div>
                      <Badge className={statusColor[item.status]}>{item.score}</Badge>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">{item.details}</div>
                    <Progress value={item.score} className="mt-2 h-1.5" />
                  </Link>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-emerald-500" /> Strategic KPIs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Margin</span>
              <span className="font-semibold">{k.marginPercent.toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Cash position</span>
              <span className="font-semibold">{formatNumber(k.cashPosition)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Overdue rate</span>
              <span className="font-semibold">{formatPercent(k.overdueRate)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>CRM conversion</span>
              <span className="font-semibold">{formatPercent(k.crmConversionRate)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>QC pass</span>
              <span className="font-semibold">{formatPercent(k.qcPassRate)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Signal board
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[
              { key: "red", label: "Red", className: "border-red-200 bg-red-50" },
              { key: "orange", label: "Orange", className: "border-amber-200 bg-amber-50" },
              { key: "green", label: "Green", className: "border-emerald-200 bg-emerald-50" },
            ].map((lane) => {
              const items = data.signals[lane.key as keyof StrategicIntelligenceData["signals"]];
              return (
                <div key={lane.key}>
                  <div className="text-xs uppercase text-muted-foreground">{lane.label}</div>
                  {items.length === 0 ? <div className="text-xs text-muted-foreground">None</div> : null}
                  {items.slice(0, 3).map((signal) => (
                    <Link key={signal.id} href={signal.href} className={`mt-1 block rounded border px-2 py-1 ${lane.className}`}>
                      {signal.title}
                    </Link>
                  ))}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-blue-500" /> Anomaly timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.anomalies.length === 0 ? (
              <div className="text-sm text-muted-foreground">No anomalies detected.</div>
            ) : (
              data.anomalies.map((a) => (
                <div key={a.id} className="flex items-start gap-3 border-b pb-3 last:border-b-0">
                  <Badge className={statusColor[a.severity]}>{a.severity}</Badge>
                  <div className="flex-1">
                    <div className="font-medium">{a.title}</div>
                    <div className="text-xs text-muted-foreground">{a.description}</div>
                  </div>
                  <Link href={a.href} className="text-xs text-blue-600">Drill-down</Link>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-purple-500" /> Objectives vs Realized
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.objectives.length === 0 ? (
              <div className="text-sm text-muted-foreground">No goals configured.</div>
            ) : (
              data.objectives.map((goal) => (
                <div key={goal.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{goal.title}</span>
                    <span className="font-medium">{Math.round(goal.progress)}%</span>
                  </div>
                  <Progress value={goal.progress} className="h-1.5" />
                  <div className="text-xs text-muted-foreground">{goal.status}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Suggested priorities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {data.suggestedPriorities.length === 0 ? (
            <div className="text-muted-foreground">No priority suggestions.</div>
          ) : (
            data.suggestedPriorities.map((p, idx) => (
              <Link key={`${p.title}-${idx}`} href={p.href} className="flex items-center justify-between rounded border p-2">
                <div>
                  <div className="font-medium">{p.title}</div>
                  <div className="text-xs text-muted-foreground">{p.reason}</div>
                </div>
                <Badge variant="outline">{p.severity}</Badge>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
