"use client";

import { BarChart3, MapPin, Ship, TrendingDown, TrendingUp } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogisticsDashboardData } from "@/components/logistics/types";
import { StableResponsiveChart } from "@/components/shared/stable-responsive-chart";

const CHART_COLORS = ["#0EA5E9", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444"];

export function AnalyticsTab({ data }: { data: LogisticsDashboardData }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Shipments par statut
          </CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {data.analytics.statusChart.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              Pas de data
            </div>
          ) : (
            <StableResponsiveChart className="h-full" minHeight={256}>
              <BarChart data={data.analytics.statusChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="status" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#0EA5E9" radius={[6, 6, 0, 0]} />
              </BarChart>
            </StableResponsiveChart>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Volume mensuel
          </CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {data.analytics.monthlyCounts.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              Pas de data
            </div>
          ) : (
            <StableResponsiveChart className="h-full" minHeight={256}>
              <LineChart data={data.analytics.monthlyCounts}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#10B981" strokeWidth={2} />
              </LineChart>
            </StableResponsiveChart>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ship className="h-5 w-5 text-purple-600" />
            Modes de transport
          </CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {data.analytics.modeChart.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              Pas de data
            </div>
          ) : (
            <StableResponsiveChart className="h-full" minHeight={256}>
              <PieChart>
                <Pie data={data.analytics.modeChart} dataKey="count" nameKey="mode" outerRadius={80}>
                  {data.analytics.modeChart.map((_, index) => (
                    <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </StableResponsiveChart>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-orange-600" />
            Transit moyen par mode
          </CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {data.analytics.transitByModeChart.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              Pas de data
            </div>
          ) : (
            <StableResponsiveChart className="h-full" minHeight={256}>
              <BarChart data={data.analytics.transitByModeChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mode" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="avgDays" fill="#F59E0B" radius={[6, 6, 0, 0]} />
              </BarChart>
            </StableResponsiveChart>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-purple-600" />
            Carte des ports
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Origines</p>
            {data.ports.origins.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune origine.</p>
            ) : (
              <div className="space-y-2">
                {data.ports.origins.map((o) => (
                  <div key={o.port} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{o.port}</span>
                      <span className="text-muted-foreground">{o.count}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted">
                      <div
                        className="h-1.5 rounded-full bg-primary"
                        style={{
                          width: `${Math.min(100, (o.count / (data.ports.origins[0]?.count || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Destinations</p>
            {data.ports.destinations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune destination.</p>
            ) : (
              <div className="space-y-2">
                {data.ports.destinations.map((d) => (
                  <div key={d.port} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{d.port}</span>
                      <span className="text-muted-foreground">{d.count}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted">
                      <div
                        className="h-1.5 rounded-full bg-primary"
                        style={{
                          width: `${Math.min(100, (d.count / (data.ports.destinations[0]?.count || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
