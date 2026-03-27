"use client";

import type { ElementType } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CreditCard,
  Package,
  Search,
  ShieldAlert,
  TrendingUp,
  Truck,
  Wallet,
  XCircle,
  Zap,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskCalculatorService, type RiskInputFull, type RiskResult } from "@/lib/services/risk-calculator.service";
import { SlaService } from "@/lib/services/sla.service";

type SourcingCase = {
  id: string;
  status: string;
  requirement: string;
  supplier?: { name: string } | null;
  offers: { id: string; isSelected: boolean; unitPrice: unknown; currency: string }[];
};

type Payment = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  status: string;
  amount: unknown;
  currency: string;
  dueAt?: Date | string | null;
};

type Dispute = { id: string; status: string; resolvedAt?: Date | string | null };

type QcRequest = { id: string; status: string };

type Shipment = { id: string; status: string; eta?: Date | string | null };

type Timeline = {
  id: string;
  event: string;
  fromValue: string | null;
  toValue: string | null;
  createdAt: Date | string;
};

type MarginReport = {
  marginPercent?: unknown;
  netMarginPct?: unknown;
  calculatedAt: Date | string;
};

type ProjectionTone = "neutral" | "success" | "warning" | "danger";

type ProjectionState = {
  label: string;
  detail: string;
  tone: ProjectionTone;
};

type OrderDetailProjection = {
  subsystemStates: {
    commercial: ProjectionState;
    payment: ProjectionState & {
      collectedXAF: number;
      outstandingXAF: number;
    };
    logistics: ProjectionState;
    quality: ProjectionState;
    execution: ProjectionState & {
      openTasks: number;
      blockedTasks: number;
      overdueTasks: number;
    };
    finance: ProjectionState & {
      netMarginXAF: number;
      netMarginPct: number;
      spendXAF: number;
    };
  };
  transitionReadiness: Array<{
    status: string;
    label: string;
    ready: boolean;
    blockers: string[];
  }>;
  activeBlockers: string[];
  nextRecommendedStatus: {
    status: string;
    label: string;
    ready: boolean;
  } | null;
};

type Props = {
  order: {
    id: string;
    status: string;
    priority: string;
    estimatedDelivery?: Date | string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
    riskLevel?: string | null;
    marginReport?: MarginReport | null;
    payments?: Payment[];
    disputes?: Dispute[];
    qcRequests?: QcRequest[];
    sourcingCases?: SourcingCase[];
    shipments?: Shipment[];
    timeline?: Timeline[];
    projection?: OrderDetailProjection | null;
  };
};

type MatrixRow = {
  module: string;
  icon: ElementType;
  status: string;
  detail: string;
  ok: boolean | null;
};

const toneClasses: Record<ProjectionTone, { border: string; badge: string; text: string }> = {
  neutral: {
    border: "border-slate-200",
    badge: "bg-slate-100 text-slate-700",
    text: "text-slate-700",
  },
  success: {
    border: "border-green-200",
    badge: "bg-green-100 text-green-700",
    text: "text-green-700",
  },
  warning: {
    border: "border-amber-200",
    badge: "bg-amber-100 text-amber-700",
    text: "text-amber-700",
  },
  danger: {
    border: "border-red-200",
    badge: "bg-red-100 text-red-700",
    text: "text-red-700",
  },
};

function toDate(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function formatMoney(value: number) {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} XAF`;
}

function getRiskLevelConfig(level: RiskResult["level"]) {
  return {
    LOW: {
      color: "text-green-600",
      bg: "bg-green-100",
      border: "border-green-200",
      bar: "bg-green-500",
      label: "Faible",
    },
    MEDIUM: {
      color: "text-yellow-600",
      bg: "bg-yellow-100",
      border: "border-yellow-200",
      bar: "bg-yellow-400",
      label: "Moyen",
    },
    HIGH: {
      color: "text-orange-600",
      bg: "bg-orange-100",
      border: "border-orange-200",
      bar: "bg-orange-500",
      label: "Eleve",
    },
    CRITICAL: {
      color: "text-red-600",
      bg: "bg-red-100",
      border: "border-red-200",
      bar: "bg-red-500",
      label: "Critique",
    },
  }[level];
}

function RiskPanel({ order }: Pick<Props, "order">) {
  const input: RiskInputFull = {
    status: order.status,
    priority: order.priority,
    estimatedDelivery: toDate(order.estimatedDelivery) ?? undefined,
    createdAt: toDate(order.createdAt) ?? new Date(),
    marginReport: order.marginReport
      ? { marginPercent: order.marginReport.marginPercent ?? order.marginReport.netMarginPct ?? 0 }
      : undefined,
    payments: order.payments?.map((payment) => ({
      status: payment.status,
      direction: payment.direction,
      dueAt: toDate(payment.dueAt) ?? undefined,
    })),
    disputes: order.disputes?.map((dispute) => ({ resolvedAt: toDate(dispute.resolvedAt) ?? undefined })),
    qcRequests: order.qcRequests?.map((request) => ({ status: request.status })),
    sourcingCases: order.sourcingCases?.map((sourcingCase) => ({ status: sourcingCase.status })),
  };

  const risk = RiskCalculatorService.compute(input);
  const levelConfig = getRiskLevelConfig(risk.level);

  return (
    <Card className={`border ${levelConfig.border}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <ShieldAlert className={`h-4 w-4 ${levelConfig.color}`} />
          Score de risque
          <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-bold ${levelConfig.bg} ${levelConfig.color}`}>
            {levelConfig.label}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div className={`h-full rounded-full ${levelConfig.bar}`} style={{ width: `${risk.score}%` }} />
          </div>
          <span className={`text-2xl font-bold tabular-nums ${levelConfig.color}`}>
            {risk.score}
            <span className="text-sm font-normal text-muted-foreground">/100</span>
          </span>
        </div>

        <p className="text-xs text-muted-foreground">
          Confiance IA : <span className="font-medium">{risk.aiConfidence}%</span>
        </p>

        {risk.signals.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Signaux detectes</p>
            {risk.signals.map((signal, index) => (
              <div key={`${signal.label}-${index}`} className="flex items-center justify-between rounded bg-muted/50 px-2 py-1 text-xs">
                <span>{signal.label}</span>
                <span className="font-bold text-red-600">+{signal.points}</span>
              </div>
            ))}
          </div>
        ) : null}

        {risk.recommendations.length > 0 ? (
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recommandations IA</p>
            {risk.recommendations.map((recommendation, index) => (
              <div key={`${recommendation}-${index}`} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Zap className={`mt-0.5 h-3 w-3 shrink-0 ${levelConfig.color}`} />
                <span>{recommendation}</span>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SlaPanel({ order }: Pick<Props, "order">) {
  const statusEnteredAt = (() => {
    const events = (order.timeline ?? [])
      .filter((event) => event.event === "status_changed" && event.toValue === order.status)
      .sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0));
    return toDate(events[0]?.createdAt) ?? toDate(order.updatedAt) ?? new Date();
  })();

  const sla = SlaService.compute(order.status, statusEnteredAt);
  const barColor = SlaService.getBarColor(sla.status);
  const textColor = SlaService.getStatusColor(sla.status);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Clock className="h-4 w-4 text-muted-foreground" />
          SLA du statut actuel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Budget: {sla.totalHours}h</span>
          <span className={`font-semibold ${textColor}`}>{sla.label}</span>
        </div>
        {sla.totalHours > 0 ? (
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, sla.percentUsed)}%` }} />
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {sla.status === "BREACHED"
            ? "Delai de traitement depasse - action requise"
            : sla.status === "WARNING"
              ? "Delai de traitement proche - surveillance recommandee"
              : "Dans les delais"}
        </p>
      </CardContent>
    </Card>
  );
}

function CrossSystemMatrix({ order }: Pick<Props, "order">) {
  const rows: MatrixRow[] = [];

  const sourcingCases = order.sourcingCases ?? [];
  if (sourcingCases.length > 0) {
    const confirmed = sourcingCases.filter((item) => item.status === "CONFIRMED").length;
    const selected = sourcingCases.filter((item) => item.status === "SELECTED").length;
    rows.push({
      module: "Sourcing",
      icon: Search,
      status: confirmed > 0 ? "Confirme" : selected > 0 ? "Selectionne" : sourcingCases[0].status,
      detail: `${sourcingCases.length} cas · ${sourcingCases.filter((item) => item.supplier).length} fournisseur(s)`,
      ok: confirmed > 0 || selected > 0,
    });
  } else {
    rows.push({
      module: "Sourcing",
      icon: Search,
      status: "Aucun cas",
      detail: "Pas de sourcing initie",
      ok: null,
    });
  }

  const qcRequests = order.qcRequests ?? [];
  if (qcRequests.length > 0) {
    const passed = qcRequests.some((item) => ["PASS", "PASSED", "APPROVED", "CONDITIONAL"].includes(item.status));
    const failed = qcRequests.some((item) => ["FAIL", "FAILED", "REJECTED"].includes(item.status));
    rows.push({
      module: "QC",
      icon: Package,
      status: failed ? "Echec" : passed ? "Valide" : "En cours",
      detail: `${qcRequests.length} demande(s) QC`,
      ok: failed ? false : passed ? true : null,
    });
  } else {
    rows.push({
      module: "QC",
      icon: Package,
      status: "Non requis",
      detail: "Aucune demande QC",
      ok: null,
    });
  }

  const shipments = order.shipments ?? [];
  if (shipments.length > 0) {
    const delivered = shipments.some((item) => item.status === "DELIVERED");
    const inTransit = shipments.some((item) => ["IN_TRANSIT", "EN_TRANSIT", "BOOKED", "PICKED_UP", "IN_DELIVERY"].includes(item.status));
    rows.push({
      module: "Expedition",
      icon: Truck,
      status: delivered ? "Livre" : inTransit ? "En transit" : shipments[0].status,
      detail: `${shipments.length} expedition(s)`,
      ok: delivered ? true : inTransit ? null : null,
    });
  } else {
    rows.push({
      module: "Expedition",
      icon: Truck,
      status: "Non planifiee",
      detail: "Aucune expedition creee",
      ok: null,
    });
  }

  const inboundPayments = (order.payments ?? []).filter((item) => item.direction === "INBOUND");
  const paidInbound = inboundPayments.filter((item) => ["PAID", "CONFIRMED", "COMPLETED"].includes(item.status)).length;
  const overdueInbound = inboundPayments.filter((item) => item.status === "PENDING" && toDate(item.dueAt) && (toDate(item.dueAt)?.getTime() ?? 0) < Date.now()).length;
  if (inboundPayments.length > 0) {
    rows.push({
      module: "Paiements client",
      icon: CreditCard,
      status: overdueInbound > 0 ? `${overdueInbound} en retard` : paidInbound === inboundPayments.length ? "Tout regle" : "En attente",
      detail: `${paidInbound}/${inboundPayments.length} paiement(s) recu(s)`,
      ok: overdueInbound > 0 ? false : paidInbound === inboundPayments.length,
    });
  } else {
    rows.push({
      module: "Paiements client",
      icon: CreditCard,
      status: "Aucun",
      detail: "Pas de paiement enregistre",
      ok: null,
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Matrice cross-systeme</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rows.map((row) => {
            const Icon = row.icon;
            return (
              <div key={row.module} className="flex items-center gap-3 rounded-md border px-3 py-2">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{row.module}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        row.ok === true
                          ? "bg-green-100 text-green-700"
                          : row.ok === false
                            ? "bg-red-100 text-red-700"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {row.status}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{row.detail}</p>
                </div>
                {row.ok === true ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" /> : null}
                {row.ok === false ? <XCircle className="h-4 w-4 shrink-0 text-red-500" /> : null}
                {row.ok === null ? <div className="h-4 w-4 shrink-0 rounded-full border-2 border-muted" /> : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ProjectionOverview({ projection }: { projection: OrderDetailProjection }) {
  const cards = [
    {
      key: "commercial",
      title: "Commercial",
      icon: TrendingUp,
      state: projection.subsystemStates.commercial,
      footer: null,
    },
    {
      key: "payment",
      title: "Paiement",
      icon: CreditCard,
      state: projection.subsystemStates.payment,
      footer: `${formatMoney(projection.subsystemStates.payment.collectedXAF)} encaisses · ${formatMoney(projection.subsystemStates.payment.outstandingXAF)} restants`,
    },
    {
      key: "logistics",
      title: "Logistique",
      icon: Truck,
      state: projection.subsystemStates.logistics,
      footer: null,
    },
    {
      key: "quality",
      title: "Qualite",
      icon: Package,
      state: projection.subsystemStates.quality,
      footer: null,
    },
    {
      key: "execution",
      title: "Execution",
      icon: AlertTriangle,
      state: projection.subsystemStates.execution,
      footer: `${projection.subsystemStates.execution.openTasks} ouverte(s) · ${projection.subsystemStates.execution.blockedTasks} bloquee(s) · ${projection.subsystemStates.execution.overdueTasks} en retard SLA`,
    },
    {
      key: "finance",
      title: "Finance",
      icon: Wallet,
      state: projection.subsystemStates.finance,
      footer: `${formatMoney(projection.subsystemStates.finance.netMarginXAF)} net · ${projection.subsystemStates.finance.netMarginPct.toFixed(1)}%`,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Lecture consolidee du dossier</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon;
            const tone = toneClasses[card.state.tone];
            return (
              <div key={card.key} className={`rounded-lg border p-3 ${tone.border}`}>
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{card.title}</p>
                    <p className="mt-1 text-sm font-semibold">{card.state.label}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone.badge}`}>
                    <Icon className="mr-1 inline h-3 w-3" />
                    {card.state.tone === "success"
                      ? "OK"
                      : card.state.tone === "warning"
                        ? "A surveiller"
                        : card.state.tone === "danger"
                          ? "Bloquant"
                          : "Info"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{card.state.detail}</p>
                {card.footer ? <p className={`mt-2 text-xs font-medium ${tone.text}`}>{card.footer}</p> : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function TransitionReadinessPanel({ projection }: { projection: OrderDetailProjection }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[0.9fr,1.1fr]">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Gates de progression</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {projection.nextRecommendedStatus ? (
            <div className={`rounded-lg border p-3 ${projection.nextRecommendedStatus.ready ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prochaine etape recommandee</p>
              <div className="mt-1 flex items-center gap-2">
                {projection.nextRecommendedStatus.ready ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                )}
                <span className="font-semibold">{projection.nextRecommendedStatus.label}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {projection.nextRecommendedStatus.ready
                  ? "Le dossier est pret pour cette transition."
                  : "Cette transition est la plus proche, mais il reste des prerequis a fermer."}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune transition recommandee pour le moment.</p>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Blocages actifs</p>
            {projection.activeBlockers.length > 0 ? (
              <div className="space-y-2">
                {projection.activeBlockers.slice(0, 5).map((blocker) => (
                  <div key={blocker} className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <span>{blocker}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Aucun blocage critique detecte.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Lecture des prochains statuts</CardTitle>
        </CardHeader>
        <CardContent>
          {projection.transitionReadiness.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune transition disponible depuis le statut actuel.</p>
          ) : (
            <div className="space-y-2">
              {projection.transitionReadiness.map((step) => (
                <div key={step.status} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {step.ready ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="font-medium">{step.label}</span>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${step.ready ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {step.ready ? "Pret" : "Bloque"}
                    </span>
                  </div>
                  {step.blockers.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {step.blockers.map((blocker) => (
                        <li key={blocker} className="flex items-start gap-2">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                          <span>{blocker}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">Tous les prerequis sont valides pour ce passage.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UnifiedTimeline({ events }: { events: Timeline[] }) {
  const lastEvents = [...events]
    .sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0))
    .slice(0, 8);

  const eventIcons: Record<string, ElementType> = {
    status_changed: TrendingUp,
    order_created: CheckCircle2,
    payment_created: CreditCard,
    qc_created: Package,
    shipment_created: Truck,
    dispute_opened: AlertTriangle,
    dispute_resolved: CheckCircle2,
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Timeline d'execution</CardTitle>
      </CardHeader>
      <CardContent>
        {lastEvents.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucun evenement enregistre.</p>
        ) : (
          <div className="space-y-2">
            {lastEvents.map((event) => {
              const Icon = eventIcons[event.event] ?? TrendingUp;
              return (
                <div key={event.id} className="flex items-start gap-3 text-xs">
                  <div className="mt-0.5 shrink-0">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-medium capitalize">{event.event.replace(/_/g, " ")}</span>
                    {event.fromValue && event.toValue ? (
                      <span className="text-muted-foreground">
                        {" · "}
                        {event.fromValue}
                        {" -> "}
                        {event.toValue}
                      </span>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-muted-foreground">
                    {toDate(event.createdAt)?.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function OrderSynthesisTab({ order }: Props) {
  const projection = order.projection ?? null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-4">
          <RiskPanel order={order} />
          {projection ? <ProjectionOverview projection={projection} /> : null}
        </div>
        <div className="space-y-4">
          <SlaPanel order={order} />
          <CrossSystemMatrix order={order} />
        </div>
      </div>
      {projection ? <TransitionReadinessPanel projection={projection} /> : null}
      <UnifiedTimeline events={order.timeline ?? []} />
    </div>
  );
}
