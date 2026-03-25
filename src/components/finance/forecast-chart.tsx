"use client";

import {
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Line,
  Bar,
} from "recharts";
import { TrendingUp } from "lucide-react";

import { StableResponsiveChart } from "@/components/shared/stable-responsive-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ForecastPoint {
  month: string;
  revenue: number;
  cogs: number;
  expenses: number;
  cashIn: number;
  cashOut: number;
}

const formatMonth = (m: string) => {
  const [year, month] = m.split("-");
  const months = ["Jan", "Fev", "Mar", "Avr", "Mai", "Jun", "Jul", "Aou", "Sep", "Oct", "Nov", "Dec"];
  const idx = Math.max(0, Math.min(months.length - 1, Number(month) - 1));
  return `${months[idx]} ${year.slice(2)}`;
};

export function ForecastChart({ data, title }: { data: ForecastPoint[]; title?: string }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            Forecast
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground">Aucune projection</CardContent>
      </Card>
    );
  }

  const formatted = data.map((d) => ({ ...d, label: formatMonth(d.month) }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-emerald-600" />
          {title || "Projection mensuelle"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <StableResponsiveChart className="h-[320px]" minHeight={320}>
          <ComposedChart data={formatted} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="revenue" name="Revenue" fill="#22c55e" radius={[2, 2, 0, 0]} />
            <Bar dataKey="cogs" name="COGS" fill="#f97316" radius={[2, 2, 0, 0]} />
            <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[2, 2, 0, 0]} />
            <Line type="monotone" dataKey="cashIn" name="Cash In" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} />
            <Line type="monotone" dataKey="cashOut" name="Cash Out" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 2 }} />
          </ComposedChart>
        </StableResponsiveChart>
      </CardContent>
    </Card>
  );
}
