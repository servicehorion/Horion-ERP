"use client";

import { useMemo, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addCustomerSegment, removeCustomerSegment } from "@/lib/actions/customer-intelligence.actions";

interface SegmentManagerProps {
  contactId: string;
  currentSegments: string[];
  financialMetrics?: {
    lifetimeGrossRevenue: number | string;
    totalOrdersCount: number;
    averageMarginPercent: number | string;
    contributionScore: number | string;
    lastOrderDate: Date | null;
  } | null;
  riskProfile?: {
    globalRiskScore: number;
  } | null;
  demoMode?: boolean;
}

type SegmentDef = {
  key: string;
  label: string;
  rule: string;
  auto: boolean;
  isMatch: boolean;
};

function daysSince(date?: Date | null) {
  if (!date) return null;
  const diff = Date.now() - date.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function SegmentManager({
  contactId,
  currentSegments,
  financialMetrics,
  riskProfile,
  demoMode,
}: SegmentManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const metrics = financialMetrics
    ? {
        lifetimeGrossRevenue: Number(financialMetrics.lifetimeGrossRevenue || 0),
        totalOrdersCount: Number(financialMetrics.totalOrdersCount || 0),
        averageMarginPercent: Number(financialMetrics.averageMarginPercent || 0),
        contributionScore: Number(financialMetrics.contributionScore || 0),
        lastOrderDate: financialMetrics.lastOrderDate ? new Date(financialMetrics.lastOrderDate) : null,
      }
    : null;

  const risk = riskProfile ? { globalRiskScore: Number(riskProfile.globalRiskScore || 0) } : null;

  const segments = useMemo<SegmentDef[]>(() => {
    const revenue = metrics?.lifetimeGrossRevenue || 0;
    const orders = metrics?.totalOrdersCount || 0;
    const margin = metrics?.averageMarginPercent || 0;
    const contribution = metrics?.contributionScore || 0;
    const lastOrder = metrics?.lastOrderDate || null;
    const days = daysSince(lastOrder);
    const riskScore = risk?.globalRiskScore || 0;

    return [
      {
        key: "CASHFLOW_DRIVER",
        label: "Moteur Cashflow",
        rule: "> 50k CA et > 5 commandes",
        auto: true,
        isMatch: revenue > 50000 && orders > 5,
      },
      {
        key: "KEY_ACCOUNT",
        label: "Compte ClÃ©",
        rule: "Contribution > 70",
        auto: true,
        isMatch: contribution > 70,
      },
      {
        key: "HIGH_RISK_HIGH_REWARD",
        label: "Risque-Rendement Ã‰levÃ©",
        rule: "CA > 30k et risque > 60",
        auto: true,
        isMatch: revenue > 30000 && riskScore > 60,
      },
      {
        key: "AT_RISK",
        label: "Ã€ Risque",
        rule: "Aucune commande depuis 90 jours",
        auto: true,
        isMatch: days !== null ? days > 90 : false,
      },
      {
        key: "ONE_TIME_BUYER",
        label: "Achat Unique",
        rule: "1 seule commande",
        auto: true,
        isMatch: orders === 1,
      },
      {
        key: "LOW_MARGIN_VOLUME",
        label: "Volume Faible Marge",
        rule: "Marge < 8% et > 10 commandes",
        auto: true,
        isMatch: margin < 8 && orders > 10,
      },
      {
        key: "STRATEGIC_GROWTH",
        label: "Croissance StratÃ©gique",
        rule: "Segmentation manuelle",
        auto: false,
        isMatch: false,
      },
      {
        key: "TEST_CLIENT",
        label: "Client Test",
        rule: "Segmentation manuelle",
        auto: false,
        isMatch: false,
      },
    ];
  }, [metrics, risk]);

  const activeSet = new Set(currentSegments);

  const toggleSegment = (segment: SegmentDef) => {
    if (demoMode) {
      toast("Mode demo : modification desactivee.");
      return;
    }
    startTransition(async () => {
      try {
        if (activeSet.has(segment.key)) {
          const result = await removeCustomerSegment(contactId, segment.key as any);
          if (result.error) throw new Error(result.error);
        } else {
          const result = await addCustomerSegment(contactId, segment.key as any, "[manual] AjoutÃ© manuellement");
          if (result.error) throw new Error(result.error);
        }
        router.refresh();
      } catch (error: any) {
        toast.error(error?.message || "Erreur");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Segmentation client</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {segments.map((seg) => {
            const active = activeSet.has(seg.key);
            return (
              <Badge
                key={seg.key}
                variant={active ? "default" : "outline"}
                className={active ? "" : "text-muted-foreground"}
              >
                {seg.label}
              </Badge>
            );
          })}
        </div>

        {demoMode && (
          <p className="text-xs text-muted-foreground">
            Mode demo : les actions de segmentation sont desactivees.
          </p>
        )}

        <div className="space-y-3">
          {segments.map((seg) => {
            const active = activeSet.has(seg.key);
            return (
              <div key={seg.key} className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div>
                  <div className="font-medium">{seg.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {seg.rule} {seg.auto && metrics ? (seg.isMatch ? "â€” Ã©ligible" : "â€” non atteint") : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {seg.auto && (
                    <Badge variant="secondary" className="text-[10px]">Auto</Badge>
                  )}
                  <Button
                    variant={active ? "outline" : "default"}
                    size="sm"
                    disabled={isPending || demoMode}
                    onClick={() => toggleSegment(seg)}
                  >
                    {active ? "Retirer" : "Ajouter"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
