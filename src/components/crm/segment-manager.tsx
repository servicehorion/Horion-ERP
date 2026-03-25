"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Plus, X, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addCustomerSegment,
  removeCustomerSegment,
  getCustomSegmentRules,
  saveCustomSegmentRule,
  deleteCustomSegmentRule,
  type SegmentRule,
} from "@/lib/actions/customer-intelligence.actions";
import type { CustomerSegment } from "@prisma/client";

// ── Types & Constants ─────────────────────────────────────────────────────

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
  key: CustomerSegment;
  label: string;
  rule: string;
  auto: boolean;
  isMatch: boolean;
};

const SEGMENT_LABELS: Record<CustomerSegment, string> = {
  CASHFLOW_DRIVER:     "Moteur Cashflow",
  KEY_ACCOUNT:         "Compte Clé",
  HIGH_RISK_HIGH_REWARD: "Risque-Rendement Élevé",
  AT_RISK:             "À Risque",
  ONE_TIME_BUYER:      "Achat Unique",
  LOW_MARGIN_VOLUME:   "Volume Faible Marge",
  STRATEGIC_GROWTH:    "Croissance Stratégique",
  TEST_CLIENT:         "Client Test",
};

const FIELD_LABELS: Record<SegmentRule["field"], string> = {
  lifetimeGrossRevenue:  "Revenus totaux XAF",
  totalOrdersCount:      "Nb commandes",
  averageMarginPercent:  "Marge %",
  globalRiskScore:       "Score risque",
  contributionScore:     "Score contribution",
};

const OPERATOR_LABELS: Record<SegmentRule["operator"], string> = {
  gt:  ">",
  gte: "≥",
  lt:  "<",
  lte: "≤",
};

function daysSince(date?: Date | null) {
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function checkRule(rule: SegmentRule, metrics: Record<string, number>): boolean {
  const fieldValue = metrics[rule.field] ?? 0;
  switch (rule.operator) {
    case "gt":  return fieldValue > rule.value;
    case "gte": return fieldValue >= rule.value;
    case "lt":  return fieldValue < rule.value;
    case "lte": return fieldValue <= rule.value;
    default:    return false;
  }
}

function ruleDescription(rule: SegmentRule): string {
  return `${FIELD_LABELS[rule.field]} ${OPERATOR_LABELS[rule.operator]} ${rule.value.toLocaleString("fr-FR")}`;
}

// ── Main Component ────────────────────────────────────────────────────────

export function SegmentManager({
  contactId,
  currentSegments,
  financialMetrics,
  riskProfile,
  demoMode,
}: SegmentManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // ── Custom rules state ──
  const [customRules, setCustomRules] = useState<SegmentRule[]>([]);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rulesLoaded, setRulesLoaded] = useState(false);

  // New rule form
  const [newSegment, setNewSegment] = useState<CustomerSegment>("KEY_ACCOUNT");
  const [newField, setNewField] = useState<SegmentRule["field"]>("contributionScore");
  const [newOperator, setNewOperator] = useState<SegmentRule["operator"]>("gt");
  const [newValue, setNewValue] = useState("");

  useEffect(() => {
    if (rulesOpen && !rulesLoaded) {
      startTransition(async () => {
        const rules = await getCustomSegmentRules();
        setCustomRules(rules);
        setRulesLoaded(true);
      });
    }
  }, [rulesOpen, rulesLoaded]);

  // ── Normalize metrics ──
  const metrics = financialMetrics
    ? {
        lifetimeGrossRevenue:  Number(financialMetrics.lifetimeGrossRevenue  || 0),
        totalOrdersCount:      Number(financialMetrics.totalOrdersCount      || 0),
        averageMarginPercent:  Number(financialMetrics.averageMarginPercent  || 0),
        contributionScore:     Number(financialMetrics.contributionScore     || 0),
        lastOrderDate:         financialMetrics.lastOrderDate
          ? new Date(financialMetrics.lastOrderDate) : null,
      }
    : null;

  const risk = riskProfile
    ? { globalRiskScore: Number(riskProfile.globalRiskScore || 0) }
    : null;

  const metricsFlat: Record<string, number> = {
    lifetimeGrossRevenue: metrics?.lifetimeGrossRevenue ?? 0,
    totalOrdersCount:     metrics?.totalOrdersCount     ?? 0,
    averageMarginPercent: metrics?.averageMarginPercent ?? 0,
    contributionScore:    metrics?.contributionScore    ?? 0,
    globalRiskScore:      risk?.globalRiskScore         ?? 0,
  };

  // ── Built-in segments ──
  const segments = useMemo<SegmentDef[]>(() => {
    const revenue  = metrics?.lifetimeGrossRevenue ?? 0;
    const orders   = metrics?.totalOrdersCount     ?? 0;
    const margin   = metrics?.averageMarginPercent ?? 0;
    const contrib  = metrics?.contributionScore    ?? 0;
    const days     = daysSince(metrics?.lastOrderDate ?? null);
    const riskScore = risk?.globalRiskScore ?? 0;

    return [
      {
        key: "CASHFLOW_DRIVER",
        label: SEGMENT_LABELS.CASHFLOW_DRIVER,
        rule: "> 50 000 CA et > 5 commandes",
        auto: true,
        isMatch: revenue > 50000 && orders > 5,
      },
      {
        key: "KEY_ACCOUNT",
        label: SEGMENT_LABELS.KEY_ACCOUNT,
        rule: "Contribution > 70",
        auto: true,
        isMatch: contrib > 70,
      },
      {
        key: "HIGH_RISK_HIGH_REWARD",
        label: SEGMENT_LABELS.HIGH_RISK_HIGH_REWARD,
        rule: "CA > 30 000 et risque > 60",
        auto: true,
        isMatch: revenue > 30000 && riskScore > 60,
      },
      {
        key: "AT_RISK",
        label: SEGMENT_LABELS.AT_RISK,
        rule: "Aucune commande depuis 90 jours",
        auto: true,
        isMatch: days !== null ? days > 90 : false,
      },
      {
        key: "ONE_TIME_BUYER",
        label: SEGMENT_LABELS.ONE_TIME_BUYER,
        rule: "1 seule commande",
        auto: true,
        isMatch: orders === 1,
      },
      {
        key: "LOW_MARGIN_VOLUME",
        label: SEGMENT_LABELS.LOW_MARGIN_VOLUME,
        rule: "Marge < 8% et > 10 commandes",
        auto: true,
        isMatch: margin < 8 && orders > 10,
      },
      {
        key: "STRATEGIC_GROWTH",
        label: SEGMENT_LABELS.STRATEGIC_GROWTH,
        rule: "Segmentation manuelle",
        auto: false,
        isMatch: false,
      },
      {
        key: "TEST_CLIENT",
        label: SEGMENT_LABELS.TEST_CLIENT,
        rule: "Segmentation manuelle",
        auto: false,
        isMatch: false,
      },
    ];
  }, [metrics, risk]);

  const activeSet = new Set(currentSegments);

  const toggleSegment = (segment: SegmentDef) => {
    if (demoMode) { toast("Mode démo : modification désactivée."); return; }
    startTransition(async () => {
      try {
        if (activeSet.has(segment.key)) {
          const res = await removeCustomerSegment(contactId, segment.key);
          if (res.error) throw new Error(res.error);
        } else {
          const res = await addCustomerSegment(contactId, segment.key, "[manual] Ajouté manuellement");
          if (res.error) throw new Error(res.error);
        }
        router.refresh();
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Erreur");
      }
    });
  };

  // ── Save custom rule ──
  const handleSaveRule = () => {
    const val = parseFloat(newValue);
    if (isNaN(val)) { toast.error("Valeur invalide"); return; }
    startTransition(async () => {
      const res = await saveCustomSegmentRule({
        segment: newSegment,
        field: newField,
        operator: newOperator,
        value: val,
      });
      if (res.error) { toast.error(res.error); return; }
      const updated = await getCustomSegmentRules();
      setCustomRules(updated);
      setNewValue("");
      toast.success("Règle ajoutée");
    });
  };

  // ── Delete custom rule ──
  const handleDeleteRule = (id: string) => {
    startTransition(async () => {
      await deleteCustomSegmentRule(id);
      setCustomRules((prev) => prev.filter((r) => r.id !== id));
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Segmentation client</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Active segment badges */}
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
            Mode démo : les actions de segmentation sont désactivées.
          </p>
        )}

        {/* Segment list */}
        <div className="space-y-3">
          {segments.map((seg) => {
            const active = activeSet.has(seg.key);
            return (
              <div key={seg.key} className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div>
                  <div className="font-medium">{seg.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {seg.rule}
                    {seg.auto && metrics && (
                      <span className={seg.isMatch ? " text-green-600" : " text-muted-foreground"}>
                        {" "}— {seg.isMatch ? "éligible" : "non atteint"}
                      </span>
                    )}
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

        {/* ── Custom Rules Editor ── */}
        <div className="rounded-lg border">
          <button
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
            onClick={() => setRulesOpen((v) => !v)}
          >
            <span>Règles automatiques personnalisées</span>
            {rulesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {rulesOpen && (
            <div className="border-t px-4 py-4 space-y-4">
              {/* New rule form */}
              <div className="flex flex-wrap gap-2 items-end">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Segment</p>
                  <Select value={newSegment} onValueChange={(v) => setNewSegment(v as CustomerSegment)}>
                    <SelectTrigger className="h-8 text-xs w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SEGMENT_LABELS).map(([k, label]) => (
                        <SelectItem key={k} value={k} className="text-xs">{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Champ</p>
                  <Select value={newField} onValueChange={(v) => setNewField(v as SegmentRule["field"])}>
                    <SelectTrigger className="h-8 text-xs w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(FIELD_LABELS).map(([k, label]) => (
                        <SelectItem key={k} value={k} className="text-xs">{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Op.</p>
                  <Select value={newOperator} onValueChange={(v) => setNewOperator(v as SegmentRule["operator"])}>
                    <SelectTrigger className="h-8 text-xs w-16">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(OPERATOR_LABELS).map(([k, label]) => (
                        <SelectItem key={k} value={k} className="text-xs">{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Valeur</p>
                  <Input
                    type="number"
                    placeholder="ex : 70"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    className="h-8 text-xs w-24"
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveRule(); }}
                  />
                </div>
                <Button size="sm" className="h-8 gap-1" onClick={handleSaveRule} disabled={isPending || !newValue}>
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Ajouter
                </Button>
              </div>

              {/* Rules list */}
              {!rulesLoaded && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Chargement…
                </p>
              )}
              {rulesLoaded && customRules.length === 0 && (
                <p className="text-xs text-muted-foreground">Aucune règle personnalisée définie.</p>
              )}
              {customRules.length > 0 && (
                <div className="space-y-2">
                  {customRules.map((rule) => {
                    const isEligible = checkRule(rule, metricsFlat);
                    return (
                      <div key={rule.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className="text-[10px]">
                            {SEGMENT_LABELS[rule.segment]}
                          </Badge>
                          <span className="text-muted-foreground text-xs">{ruleDescription(rule)}</span>
                          {metrics && (
                            <Badge
                              className={`text-[10px] ${
                                isEligible
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {isEligible ? "✓ Éligible" : "Non atteint"}
                            </Badge>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="text-muted-foreground hover:text-destructive ml-2 shrink-0"
                          disabled={isPending}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
