"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { StableResponsiveChart } from "@/components/shared/stable-responsive-chart";

type RevenuePoint = {
  date: string;
  value: number;
};

const formatDate = (value: any) => {
  const date = new Date(value);
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
};

const formatValue = (value: number, currency: string) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(value || 0);

export function KpiChartRevenue({
  data,
  currency,
}: {
  data: RevenuePoint[];
  currency: string;
}) {
  return (
    <StableResponsiveChart className="h-[240px]">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.3)" />
          <XAxis dataKey="date" tickFormatter={formatDate} />
          <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
          <Tooltip
            formatter={(value: any) => formatValue(Number(value ?? 0), currency)}
            labelFormatter={formatDate}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--primary))"
            strokeWidth={2.4}
            dot={false}
          />
        </LineChart>
    </StableResponsiveChart>
  );
}
