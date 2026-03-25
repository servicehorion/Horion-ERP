"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  Clock,
  Globe,
  Calendar,
  ChevronUp,
  ChevronDown,
  ChevronsRight,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type FunnelItem = {
  status: string;
  count: number;
  totalValue: number;
};

type VelocityItem = {
  status: string;
  avgDays: number;
};

type SourceItem = {
  source: string;
  count: number;
  totalValue: number;
  wonRate: number;
};

type CohortItem = {
  month: string;
  created: number;
  won: number;
};

type AnalyticsData = {
  funnel: FunnelItem[];
  conversionRate: number;
  velocity: VelocityItem[];
  sources: SourceItem[];
  cohorts: CohortItem[];
  slaCompliance: number;
  totalLeads: number;
  forecast?: {
    expectedValue: number;
    avgWinProbability: number;
    byStage?: { status: string; expectedValue: number; count: number }[];
    byMonth?: { month: string; expectedValue: number; count: number }[];
    byTeam?: { team: string; expectedValue: number; count: number }[];
  };
};

// ── Label maps ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  NEW: "Nouveau",
  CONTACTED: "Contacté",
  QUALIFIED: "Qualifié",
  QUOTED: "Devis envoyé",
  WON: "Gagné",
  LOST: "Perdu",
};

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-slate-100 border-slate-300",
  CONTACTED: "bg-blue-100 border-blue-300",
  QUALIFIED: "bg-violet-100 border-violet-300",
  QUOTED: "bg-amber-100 border-amber-300",
  WON: "bg-green-100 border-green-300",
  LOST: "bg-red-100 border-red-300",
};

const STATUS_TEXT: Record<string, string> = {
  NEW: "text-slate-700",
  CONTACTED: "text-blue-700",
  QUALIFIED: "text-violet-700",
  QUOTED: "text-amber-700",
  WON: "text-green-700",
  LOST: "text-red-700",
};

function formatXAF(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M XAF`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K XAF`;
  return `${v} XAF`;
}

// ── Funnel ────────────────────────────────────────────────────────────────────

function FunnelSection({ funnel, conversionRate, totalLeads }: {
  funnel: FunnelItem[];
  conversionRate: number;
  totalLeads: number;
}) {
  const ACTIVE = ["NEW", "CONTACTED", "QUALIFIED", "QUOTED", "WON"];
  const active = funnel.filter((f) => ACTIVE.includes(f.status));
  const maxCount = Math.max(...active.map((f) => f.count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ChevronsRight className="h-4 w-4 text-violet-600" />
          Entonnoir de conversion
          <Badge variant="secondary" className="ml-auto">
            {conversionRate}% closing
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {active.map((item, i) => {
            const pct = maxCount > 0 ? Math.max(10, Math.round((item.count / maxCount) * 100)) : 10;
            return (
              <div key={item.status} className="flex items-center gap-3">
                <div className="w-24 text-xs text-muted-foreground text-right shrink-0">
                  {STATUS_LABELS[item.status] ?? item.status}
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <div
                    className={`h-8 rounded border flex items-center px-3 transition-all ${STATUS_COLORS[item.status] ?? "bg-slate-100 border-slate-300"}`}
                    style={{ width: `${pct}%` }}
                  >
                    <span className={`text-xs font-semibold ${STATUS_TEXT[item.status] ?? "text-slate-700"}`}>
                      {item.count}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatXAF(item.totalValue)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-3 border-t flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{totalLeads} leads au total</span>
          <span className="font-medium text-green-700">
            {funnel.find((f) => f.status === "WON")?.count ?? 0} gagnés
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Sources ───────────────────────────────────────────────────────────────────

function SourcesSection({ sources }: { sources: SourceItem[] }) {
  const [sortKey, setSortKey] = useState<"count" | "totalValue" | "wonRate">("count");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = [...sources].sort((a, b) => {
    const diff = (a[sortKey] as number) - (b[sortKey] as number);
    return sortDir === "desc" ? -diff : diff;
  });

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }
  function setDir(d: "asc" | "desc") { setSortDir(d); }

  function SortIcon({ k }: { k: typeof sortKey }) {
    if (sortKey !== k) return <ChevronUp className="h-3 w-3 opacity-30" />;
    return sortDir === "desc"
      ? <ChevronDown className="h-3 w-3" />
      : <ChevronUp className="h-3 w-3" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="h-4 w-4 text-blue-600" />
          Performance par source
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left p-3 font-medium text-muted-foreground">Source</th>
              <th
                className="text-right p-3 font-medium text-muted-foreground cursor-pointer select-none"
                onClick={() => toggleSort("count")}
              >
                <span className="flex items-center justify-end gap-1">
                  Leads <SortIcon k="count" />
                </span>
              </th>
              <th
                className="text-right p-3 font-medium text-muted-foreground cursor-pointer select-none"
                onClick={() => toggleSort("totalValue")}
              >
                <span className="flex items-center justify-end gap-1">
                  Valeur <SortIcon k="totalValue" />
                </span>
              </th>
              <th
                className="text-right p-3 font-medium text-muted-foreground cursor-pointer select-none"
                onClick={() => toggleSort("wonRate")}
              >
                <span className="flex items-center justify-end gap-1">
                  % WON <SortIcon k="wonRate" />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-8 text-muted-foreground text-sm">
                  Aucune donnée de source disponible
                </td>
              </tr>
            )}
            {sorted.map((s) => (
              <tr key={s.source} className="border-b last:border-0 hover:bg-muted/20">
                <td className="p-3 font-medium capitalize">{s.source}</td>
                <td className="p-3 text-right">{s.count}</td>
                <td className="p-3 text-right text-muted-foreground">{formatXAF(s.totalValue)}</td>
                <td className="p-3 text-right">
                  <span className={`font-semibold ${s.wonRate >= 30 ? "text-green-600" : s.wonRate >= 15 ? "text-amber-600" : "text-red-600"}`}>
                    {s.wonRate}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ── Velocity ──────────────────────────────────────────────────────────────────

function VelocitySection({ velocity }: { velocity: VelocityItem[] }) {
  const maxDays = Math.max(...velocity.map((v) => v.avgDays), 1);
  const ORDER = ["NEW", "CONTACTED", "QUALIFIED", "QUOTED", "WON"];
  const ordered = ORDER.map((s) => velocity.find((v) => v.status === s)).filter(Boolean) as VelocityItem[];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-amber-600" />
          Vélocité pipeline (jours moyens)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {ordered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Pas encore de données</p>
        ) : (
          <div className="space-y-3">
            {ordered.map((item) => {
              const pct = Math.max(5, Math.round((item.avgDays / maxDays) * 100));
              const color =
                item.avgDays <= 2
                  ? "bg-green-200"
                  : item.avgDays <= 7
                  ? "bg-amber-200"
                  : "bg-red-200";
              return (
                <div key={item.status} className="flex items-center gap-3">
                  <div className="w-24 text-xs text-muted-foreground text-right shrink-0">
                    {STATUS_LABELS[item.status] ?? item.status}
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <div
                      className={`h-6 rounded ${color} flex items-center px-2`}
                      style={{ width: `${pct}%` }}
                    />
                    <span className="text-xs font-medium">{item.avgDays}j</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Cohorts ───────────────────────────────────────────────────────────────────

function CohortsSection({ cohorts }: { cohorts: CohortItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-4 w-4 text-green-600" />
          Cohortes mensuelles (6 derniers mois)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left p-3 font-medium text-muted-foreground">Mois</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Créés</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Gagnés</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Taux</th>
            </tr>
          </thead>
          <tbody>
            {cohorts.map((c) => {
              const rate = c.created > 0 ? Math.round((c.won / c.created) * 100) : 0;
              return (
                <tr key={c.month} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="p-3 font-medium capitalize">{c.month}</td>
                  <td className="p-3 text-right">{c.created}</td>
                  <td className="p-3 text-right text-green-700 font-medium">{c.won}</td>
                  <td className="p-3 text-right">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        rate >= 30
                          ? "bg-green-100 text-green-800"
                          : rate >= 15
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {rate}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function ForecastBreakdown({ forecast }: { forecast: AnalyticsData["forecast"] }) {
  if (!forecast) return null;
  const byMonth = forecast.byMonth || [];
  const byTeam = forecast.byTeam || [];
  const byStage = forecast.byStage || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prevision par mois</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-3 font-medium text-muted-foreground">Mois</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Valeur</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Leads</th>
              </tr>
            </thead>
            <tbody>
              {byMonth.map((item) => (
                <tr key={item.month} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="p-3 font-medium">{item.month}</td>
                  <td className="p-3 text-right">{formatXAF(Math.round(item.expectedValue))}</td>
                  <td className="p-3 text-right text-muted-foreground">{item.count}</td>
                </tr>
              ))}
              {byMonth.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-6 text-center text-muted-foreground">
                    Aucun forecast disponible
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Forecast par equipe</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-3 font-medium text-muted-foreground">Equipe</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Valeur</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Leads</th>
              </tr>
            </thead>
            <tbody>
              {byTeam.map((item) => (
                <tr key={item.team} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="p-3 font-medium">{item.team}</td>
                  <td className="p-3 text-right">{formatXAF(Math.round(item.expectedValue))}</td>
                  <td className="p-3 text-right text-muted-foreground">{item.count}</td>
                </tr>
              ))}
              {byTeam.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-6 text-center text-muted-foreground">
                    Aucune equipe parametree
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prevision par etape</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {byStage.map((item) => (
            <div key={item.status} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{STATUS_LABELS[item.status] ?? item.status}</span>
              <span className="font-semibold">{formatXAF(Math.round(item.expectedValue))}</span>
            </div>
          ))}
          {byStage.length === 0 && (
            <div className="text-sm text-muted-foreground">Aucune donnee</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function CrmAnalytics({ data }: { data: AnalyticsData }) {
  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{data.totalLeads}</div>
            <div className="text-xs text-muted-foreground mt-1">Leads total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{data.conversionRate}%</div>
            <div className="text-xs text-muted-foreground mt-1">Taux de closing</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-600">
              {data.velocity.find((v) => v.status === "QUALIFIED")?.avgDays ?? 0}j
            </div>
            <div className="text-xs text-muted-foreground mt-1">Délai qualification</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className={`text-2xl font-bold ${data.slaCompliance >= 80 ? "text-green-600" : data.slaCompliance >= 60 ? "text-amber-600" : "text-red-600"}`}>
              {data.slaCompliance}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">Conformité SLA</div>
          </CardContent>
        </Card>
      </div>

      {data.forecast && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Forecast pipeline (pondere)
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-2xl font-bold text-emerald-700">
                {formatXAF(Math.round(data.forecast.expectedValue))}
              </div>
              <div className="text-xs text-muted-foreground">Valeur attendue</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-700">
                {data.forecast.avgWinProbability}%
              </div>
              <div className="text-xs text-muted-foreground">Probabilite moyenne</div>
            </div>
          </CardContent>
        </Card>
      )}

      <ForecastBreakdown forecast={data.forecast} />

      {/* Funnel + Velocity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FunnelSection
          funnel={data.funnel}
          conversionRate={data.conversionRate}
          totalLeads={data.totalLeads}
        />
        <VelocitySection velocity={data.velocity} />
      </div>

      {/* Sources + Cohorts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SourcesSection sources={data.sources} />
        <CohortsSection cohorts={data.cohorts} />
      </div>
    </div>
  );
}



