"use client";

import { Target, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogisticsDashboardData } from "@/components/logistics/types";
import { ALERT_COLORS } from "@/components/logistics/constants";

export function AiTab({ data }: { data: LogisticsDashboardData }) {
  const highRiskCount = data.shipmentsInProgress.filter(
    (s) => s.riskLevel === "HIGH" || s.riskLevel === "CRITICAL"
  ).length;
  const predictedDelayCount = data.shipmentsInProgress.filter(
    (s) => (s.aiInsight?.predictedDelayDays ?? 0) >= 5
  ).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-purple-600" />
          AI Alerts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="rounded-md border p-2">
            <p>Risque eleve</p>
            <p className="text-base font-semibold text-foreground">{highRiskCount}</p>
          </div>
          <div className="rounded-md border p-2">
            <p>Retards predicts</p>
            <p className="text-base font-semibold text-foreground">{predictedDelayCount}</p>
          </div>
        </div>
        {data.aiAlerts.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            Aucun signal detecte
          </div>
        )}
        {data.aiAlerts.map((alert) => (
          <div key={alert.id} className="rounded-lg border p-3 flex items-start gap-3">
            <div className="mt-1">
              <Target className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{alert.title}</p>
                <Badge className={ALERT_COLORS[alert.severity] || ""}>{alert.severity}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{alert.description}</p>
              <p className="text-xs text-muted-foreground mt-1">Action: {alert.action}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
