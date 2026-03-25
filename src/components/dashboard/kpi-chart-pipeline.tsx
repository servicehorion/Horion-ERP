"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { StableResponsiveChart } from "@/components/shared/stable-responsive-chart";

type PipelinePoint = {
  label: string;
  value: number;
};

export function KpiChartPipeline({
  data,
  formatter,
}: {
  data: PipelinePoint[];
  formatter?: (value: number) => string;
}) {
  return (
    <StableResponsiveChart className="h-[240px]">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.3)" />
          <XAxis dataKey="label" />
          <YAxis />
          <Tooltip formatter={(value: any) => (formatter ? formatter(Number(value ?? 0)) : Number(value ?? 0))} />
          <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
        </BarChart>
    </StableResponsiveChart>
  );
}
