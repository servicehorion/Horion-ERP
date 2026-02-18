"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Line, ComposedChart,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

interface CashflowPoint {
  month: string;
  inbound: number;
  outbound: number;
  net: number;
  balance: number;
}

function formatK(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

function formatMonth(m: string): string {
  const [year, month] = m.split("-");
  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  return `${months[parseInt(month) - 1]} ${year.slice(2)}`;
}

export function CashflowChart({ data }: { data: CashflowPoint[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Cash-flow mensuel
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground py-8">
          Aucune donnée de cash-flow disponible
        </CardContent>
      </Card>
    );
  }

  const formatted = data.map((d) => ({
    ...d,
    label: formatMonth(d.month),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          Cash-flow mensuel (XAF)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={formatted} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={formatK} tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value: number | undefined) => `${formatK(value ?? 0)} FCFA`}
              labelStyle={{ fontWeight: "bold" }}
            />
            <Legend />
            <Bar dataKey="inbound" name="Encaissements" fill="#22c55e" radius={[2, 2, 0, 0]} />
            <Bar dataKey="outbound" name="Décaissements" fill="#ef4444" radius={[2, 2, 0, 0]} />
            <Line
              type="monotone"
              dataKey="balance"
              name="Solde cumulé"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
