"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { StableResponsiveChart } from "@/components/shared/stable-responsive-chart";

type CashflowPoint = {
  month: string;
  inbound: number;
  outbound: number;
  balance: number;
};

const formatValue = (value: number, currency: string) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(value || 0);

export function KpiChartCashflow({
  data,
  currency,
}: {
  data: CashflowPoint[];
  currency: string;
}) {
  return (
    <StableResponsiveChart className="h-[260px]">
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.3)" />
          <XAxis dataKey="month" />
          <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
          <Tooltip formatter={(value: any) => formatValue(Number(value ?? 0), currency)} />
          <Legend />
          <Bar dataKey="inbound" name="Encaissements" fill="#22c55e" radius={[4, 4, 0, 0]} />
          <Bar dataKey="outbound" name="Decaissements" fill="#f97316" radius={[4, 4, 0, 0]} />
          <Line dataKey="balance" name="Solde" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
        </ComposedChart>
    </StableResponsiveChart>
  );
}
