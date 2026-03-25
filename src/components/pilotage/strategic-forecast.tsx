"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ComposedChart, Legend, Line, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Wallet, Package2, AlertTriangle } from "lucide-react";
import { StableResponsiveChart } from "@/components/shared/stable-responsive-chart";

type HistoryPoint = {
  month: string;
  label: string;
  revenue: number;
  grossMargin: number;
  marginPercent: number;
  volumeKg: number;
  shipmentCount: number;
  cashNet: number;
  cashBalance: number;
};

type ScenarioPoint = {
  month: string;
  label: string;
  revenue: number;
  marginPercent: number;
  grossMargin: number;
  volumeKg: number;
  shipmentCount: number;
  cashIn: number;
  cashOut: number;
  cashNet: number;
  cashBalance: number;
};

type Scenario = {
  key: string;
  name: string;
  type: "AUTO" | "MANUAL";
  assumptions: string[];
  points: ScenarioPoint[];
  summary: {
    revenue90d: number;
    grossMargin90d: number;
    marginPercent90d: number;
    importVolume90d: number;
    runwayMonths: number;
    riskLevel: "green" | "orange" | "red";
  };
};

type StrategicForecastData = {
  generatedAt: string;
  history: HistoryPoint[];
  scenarios: Scenario[];
  kpis: {
    forecastRevenue90d: number;
    forecastMarginPercent: number;
    forecastImportVolume90d: number;
    cashRunwayMonths: number;
  };
  forecastRisks: Array<{ title: string; severity: "red" | "orange"; description: string }>;
  analystNotes: string[];
};

const riskTheme: Record<string, string> = {
  green: "bg-emerald-100 text-emerald-700",
  orange: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
};

const formatNumber = (value: number) => new Intl.NumberFormat("fr-FR").format(Math.round(value));

export function StrategicForecast({ data }: { data: StrategicForecastData }) {
  const [scenarioKey, setScenarioKey] = useState(data.scenarios[0]?.key ?? "");

  const selectedScenario = useMemo(
    () => data.scenarios.find((scenario) => scenario.key === scenarioKey) || data.scenarios[0],
    [data.scenarios, scenarioKey]
  );

  const comparison = useMemo(() => {
    const scenario = selectedScenario;
    if (!scenario) return [];
    const historyTail = data.history.slice(-3).map((point) => ({
      label: point.label,
      actualRevenue: point.revenue,
      actualCash: point.cashBalance,
      forecastRevenue: null,
      forecastCash: null,
    }));
    const future = scenario.points.map((point) => ({
      label: point.label,
      actualRevenue: null,
      actualCash: null,
      forecastRevenue: point.revenue,
      forecastCash: point.cashBalance,
    }));
    return [...historyTail, ...future];
  }, [data.history, selectedScenario]);

  if (!selectedScenario) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No forecast scenario available.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-emerald-500" /> Revenue 90d
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{formatNumber(data.kpis.forecastRevenue90d)}</div>
            <div className="text-xs text-muted-foreground">Base case projected turnover</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4 text-blue-500" /> Cash runway
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{data.kpis.cashRunwayMonths} mo</div>
            <div className="text-xs text-muted-foreground">Estimated runway in the base scenario</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package2 className="h-4 w-4 text-indigo-500" /> Import volume 90d
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{formatNumber(data.kpis.forecastImportVolume90d)} kg</div>
            <div className="text-xs text-muted-foreground">Projected handled volume</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Margin 90d
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{data.kpis.forecastMarginPercent.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">Projected gross margin over 90 days</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base">Forecast curve</CardTitle>
              <div className="text-xs text-muted-foreground">
                Actual recent trend against the selected strategic scenario.
              </div>
            </div>
            <Select value={selectedScenario.key} onValueChange={setScenarioKey}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select scenario" />
              </SelectTrigger>
              <SelectContent>
                {data.scenarios.map((scenario) => (
                  <SelectItem key={scenario.key} value={scenario.key}>
                    {scenario.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="space-y-4">
            <StableResponsiveChart className="h-[320px]">
                <ComposedChart data={comparison}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="actualRevenue" name="Actual revenue" stroke="#0f172a" strokeWidth={2} dot={{ r: 2 }} />
                  <Line yAxisId="left" type="monotone" dataKey="forecastRevenue" name="Forecast revenue" stroke="#0f766e" strokeWidth={2} dot={{ r: 2 }} />
                  <Area yAxisId="right" type="monotone" dataKey="forecastCash" name="Forecast cash" fill="#60a5fa" stroke="#2563eb" fillOpacity={0.16} />
                </ComposedChart>
            </StableResponsiveChart>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border bg-slate-50 p-3">
                <div className="text-xs text-muted-foreground">Scenario type</div>
                <div className="text-lg font-semibold">{selectedScenario.type}</div>
              </div>
              <div className="rounded-lg border bg-slate-50 p-3">
                <div className="text-xs text-muted-foreground">90d margin</div>
                <div className="text-lg font-semibold">{selectedScenario.summary.marginPercent90d.toFixed(1)}%</div>
              </div>
              <div className="rounded-lg border bg-slate-50 p-3">
                <div className="text-xs text-muted-foreground">Runway</div>
                <div className="text-lg font-semibold">{selectedScenario.summary.runwayMonths} months</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">AI-assisted reading</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.analystNotes.map((note, index) => (
              <div key={`${note}-${index}`} className="rounded-lg border bg-slate-50 p-3 text-sm">
                {note}
              </div>
            ))}
            {data.forecastRisks.length > 0 ? (
              <div className="space-y-2">
                {data.forecastRisks.map((risk, index) => (
                  <div key={`${risk.title}-${index}`} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{risk.title}</div>
                      <Badge className={riskTheme[risk.severity]}>{risk.severity}</Badge>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">{risk.description}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No strategic forecast alert at this time.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Scenario comparison</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.scenarios.map((scenario) => (
              <div key={scenario.key} className="rounded-xl border p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{scenario.name}</div>
                  <Badge className={riskTheme[scenario.summary.riskLevel]}>{scenario.summary.riskLevel}</Badge>
                </div>
                <div className="mt-3 grid gap-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Revenue 90d</span>
                    <span className="font-semibold">{formatNumber(scenario.summary.revenue90d)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Margin</span>
                    <span className="font-semibold">{scenario.summary.marginPercent90d.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Volume</span>
                    <span className="font-semibold">{formatNumber(scenario.summary.importVolume90d)} kg</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Runway</span>
                    <span className="font-semibold">{scenario.summary.runwayMonths} mo</span>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {scenario.assumptions.map((assumption, index) => (
                    <div key={`${scenario.key}-${index}`} className="rounded border bg-slate-50 px-3 py-2 text-xs text-muted-foreground">
                      {assumption}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Actual trend</CardTitle>
          </CardHeader>
          <CardContent>
            <StableResponsiveChart className="h-[320px]">
                <AreaChart data={data.history}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#14b8a6" fill="#14b8a6" fillOpacity={0.16} />
                  <Line type="monotone" dataKey="grossMargin" name="Gross margin" stroke="#0f172a" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="volumeKg" name="Volume kg" stroke="#6366f1" strokeWidth={2} dot={{ r: 2 }} />
                </AreaChart>
            </StableResponsiveChart>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
