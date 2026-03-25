"use client";

// ============================================================
// HORION — OrderSynthesisTab
// Cross-system matrix: Sourcing × QC × Shipments × Payments
// Risk panel with signals + SLA indicator
// ============================================================

import {
  ShieldAlert, Clock, CheckCircle2, AlertTriangle,
  XCircle, Package, Truck, CreditCard, Search,
  TrendingUp, TrendingDown, Zap,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskCalculatorService, type RiskResult, type RiskInputFull } from "@/lib/services/risk-calculator.service";
import { SlaService } from "@/lib/services/sla.service";

// ─── Types (matching OrderDetail props) ────────────────────────────────────

type SourcingCase = {
  id: string;
  status: string;
  requirement: string;
  supplier?: { name: string } | null;
  offers: { id: string; isSelected: boolean; unitPrice: any; currency: string }[];
};

type Payment = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  status: string;
  amount: any;
  currency: string;
  dueAt?: Date | null;
};

type Dispute = { id: string; status: string; resolvedAt?: Date | null };

type QcRequest = { id: string; status: string };

type Shipment = { id: string; status: string; eta?: Date | null };

type Timeline = {
  id: string;
  event: string;
  fromValue: string | null;
  toValue: string | null;
  createdAt: Date;
};

type MarginReport = {
  marginPercent: any;
  calculatedAt: Date;
};

type Props = {
  order: {
    id: string;
    status: string;
    priority: string;
    estimatedDelivery?: Date | null;
    createdAt: Date;
    updatedAt: Date;
    riskLevel?: string | null;
    marginReport?: MarginReport | null;
    payments?: Payment[];
    disputes?: Dispute[];
    qcRequests?: QcRequest[];
    sourcingCases?: SourcingCase[];
    shipments?: Shipment[];
    timeline?: Timeline[];
  };
};

// ─── Risk Score Panel ───────────────────────────────────────────────────────

function RiskPanel({ order }: Props) {
  const input: RiskInputFull = {
    status: order.status,
    priority: order.priority,
    estimatedDelivery: order.estimatedDelivery,
    createdAt: order.createdAt,
    marginReport: order.marginReport
      ? { marginPercent: order.marginReport.marginPercent }
      : undefined,
    payments: order.payments?.map((p) => ({
      status: p.status,
      direction: p.direction,
      dueAt: p.dueAt,
    })),
    disputes: order.disputes?.map((d) => ({ resolvedAt: d.resolvedAt })),
    qcRequests: order.qcRequests?.map((q) => ({ status: q.status })),
    sourcingCases: order.sourcingCases?.map((s) => ({ status: s.status })),
  };

  const risk: RiskResult = RiskCalculatorService.compute(input);

  const levelConfig = {
    LOW:      { color: "text-green-600",  bg: "bg-green-100",  border: "border-green-200", bar: "bg-green-500",  label: "Faible" },
    MEDIUM:   { color: "text-yellow-600", bg: "bg-yellow-100", border: "border-yellow-200", bar: "bg-yellow-400", label: "Moyen" },
    HIGH:     { color: "text-orange-600", bg: "bg-orange-100", border: "border-orange-200", bar: "bg-orange-500", label: "Élevé" },
    CRITICAL: { color: "text-red-600",    bg: "bg-red-100",    border: "border-red-200",    bar: "bg-red-500",    label: "Critique" },
  }[risk.level];

  return (
    <Card className={`border ${levelConfig.border}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ShieldAlert className={`h-4 w-4 ${levelConfig.color}`} />
          Score de risque
          <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${levelConfig.bg} ${levelConfig.color}`}>
            {levelConfig.label}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Score gauge */}
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${levelConfig.bar}`}
              style={{ width: `${risk.score}%` }}
            />
          </div>
          <span className={`text-2xl font-bold tabular-nums ${levelConfig.color}`}>
            {risk.score}
            <span className="text-sm font-normal text-muted-foreground">/100</span>
          </span>
        </div>

        {/* AI confidence */}
        <p className="text-xs text-muted-foreground">
          Confiance IA : <span className="font-medium">{risk.aiConfidence}%</span>
        </p>

        {/* Signals */}
        {risk.signals.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Signaux détectés</p>
            {risk.signals.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1">
                <span>{s.label}</span>
                <span className="font-bold text-red-600">+{s.points}</span>
              </div>
            ))}
          </div>
        )}

        {/* Recommendations */}
        {risk.recommendations.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recommandations IA</p>
            {risk.recommendations.map((r, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Zap className={`h-3 w-3 mt-0.5 shrink-0 ${levelConfig.color}`} />
                <span>{r}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── SLA Panel ──────────────────────────────────────────────────────────────

function SlaPanel({ order }: Props) {
  // Use the actual status-change timestamp from timeline for accuracy
  const statusEnteredAt = (() => {
    const events = (order.timeline ?? [])
      .filter((e) => e.event === "status_changed" && e.toValue === order.status)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return events[0]?.createdAt ?? order.updatedAt;
  })();

  const sla = SlaService.compute(order.status, statusEnteredAt);
  const barColor = SlaService.getBarColor(sla.status);
  const textColor = SlaService.getStatusColor(sla.status);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          SLA du statut actuel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Budget: {sla.totalHours}h</span>
          <span className={`font-semibold ${textColor}`}>{sla.label}</span>
        </div>
        {sla.totalHours > 0 && (
          <div className="bg-muted rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full ${barColor}`}
              style={{ width: `${Math.min(100, sla.percentUsed)}%` }}
            />
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {sla.status === "BREACHED"
            ? "Délai de traitement dépassé — action requise"
            : sla.status === "WARNING"
            ? "Délai de traitement proche — surveiller"
            : "Dans les délais"}
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Cross-System Matrix ─────────────────────────────────────────────────────

type MatrixRow = {
  module: string;
  icon: React.ElementType;
  status: string;
  detail: string;
  ok: boolean | null; // null = neutral
};

function CrossSystemMatrix({ order }: Props) {
  const rows: MatrixRow[] = [];

  // Sourcing
  const sourcingCases = order.sourcingCases ?? [];
  if (sourcingCases.length > 0) {
    const confirmed = sourcingCases.filter((s) => s.status === "CONFIRMED").length;
    const selected  = sourcingCases.filter((s) => s.status === "SELECTED").length;
    rows.push({
      module: "Sourcing",
      icon: Search,
      status: confirmed > 0 ? "Confirmé" : selected > 0 ? "Sélectionné" : sourcingCases[0].status,
      detail: `${sourcingCases.length} cas · ${sourcingCases.filter((s) => s.supplier).length} fournisseur(s)`,
      ok: confirmed > 0 || selected > 0,
    });
  } else {
    rows.push({ module: "Sourcing", icon: Search, status: "Aucun cas", detail: "Pas de sourcing initié", ok: null });
  }

  // QC
  const qcRequests = order.qcRequests ?? [];
  if (qcRequests.length > 0) {
    const passed = qcRequests.some((q) => q.status === "PASS" || q.status === "PASSED" || q.status === "APPROVED" || q.status === "CONDITIONAL");
    const failed = qcRequests.some((q) => q.status === "FAIL" || q.status === "FAILED" || q.status === "REJECTED");
    rows.push({
      module: "QC",
      icon: Package,
      status: failed ? "Échec" : passed ? "Validé" : "En cours",
      detail: `${qcRequests.length} demande(s) QC`,
      ok: failed ? false : passed ? true : null,
    });
  } else {
    rows.push({ module: "QC", icon: Package, status: "Non requis", detail: "Aucune demande QC", ok: null });
  }

  // Shipments
  const shipments = order.shipments ?? [];
  if (shipments.length > 0) {
    const delivered = shipments.some((s) => s.status === "DELIVERED");
    const inTransit = shipments.some((s) => s.status === "IN_TRANSIT" || s.status === "EN_TRANSIT");
    rows.push({
      module: "Expédition",
      icon: Truck,
      status: delivered ? "Livré" : inTransit ? "En transit" : shipments[0].status,
      detail: `${shipments.length} expédition(s)`,
      ok: delivered ? true : inTransit ? null : null,
    });
  } else {
    rows.push({ module: "Expédition", icon: Truck, status: "Non planifiée", detail: "Aucune expédition créée", ok: null });
  }

  // Payments
  const payments = order.payments ?? [];
  const inbound  = payments.filter((p) => p.direction === "INBOUND");
  const paidIn   = inbound.filter((p) => p.status === "PAID" || p.status === "CONFIRMED").length;
  const overdueIn = inbound.filter((p) => p.status === "PENDING" && p.dueAt && new Date(p.dueAt) < new Date()).length;
  if (inbound.length > 0) {
    rows.push({
      module: "Paiements client",
      icon: CreditCard,
      status: overdueIn > 0 ? `${overdueIn} en retard` : paidIn === inbound.length ? "Tout réglé" : "En attente",
      detail: `${paidIn}/${inbound.length} paiement(s) reçu(s)`,
      ok: overdueIn > 0 ? false : paidIn === inbound.length,
    });
  } else {
    rows.push({ module: "Paiements client", icon: CreditCard, status: "Aucun", detail: "Pas de paiement enregistré", ok: null });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Matrice cross-système</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rows.map((row) => {
            const Icon = row.icon;
            return (
              <div key={row.module} className="flex items-center gap-3 rounded-md border px-3 py-2">
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{row.module}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      row.ok === true  ? "bg-green-100 text-green-700" :
                      row.ok === false ? "bg-red-100 text-red-700" :
                      "bg-muted text-muted-foreground"
                    }`}>{row.status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{row.detail}</p>
                </div>
                {row.ok === true  && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
                {row.ok === false && <XCircle      className="h-4 w-4 text-red-500 shrink-0" />}
                {row.ok === null  && <div className="h-4 w-4 rounded-full border-2 border-muted shrink-0" />}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Timeline unifiée ────────────────────────────────────────────────────────

function UnifiedTimeline({ events }: { events: Timeline[] }) {
  const last8 = [...events].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8);

  const EVENT_ICONS: Record<string, React.ElementType> = {
    status_changed:   TrendingUp,
    order_created:    CheckCircle2,
    payment_created:  CreditCard,
    qc_created:       Package,
    shipment_created: Truck,
    dispute_opened:   AlertTriangle,
    dispute_resolved: CheckCircle2,
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Timeline d&apos;exécution</CardTitle>
      </CardHeader>
      <CardContent>
        {last8.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucun événement enregistré.</p>
        ) : (
          <div className="space-y-2">
            {last8.map((ev) => {
              const Icon = EVENT_ICONS[ev.event] ?? TrendingUp;
              return (
                <div key={ev.id} className="flex items-start gap-3 text-xs">
                  <div className="mt-0.5 shrink-0">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium capitalize">{ev.event.replace(/_/g, " ")}</span>
                    {ev.fromValue && ev.toValue && (
                      <span className="text-muted-foreground"> · {ev.fromValue} → {ev.toValue}</span>
                    )}
                  </div>
                  <span className="text-muted-foreground shrink-0">
                    {new Date(ev.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
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

// ─── Main export ─────────────────────────────────────────────────────────────

export function OrderSynthesisTab({ order }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <RiskPanel order={order} />
        <div className="space-y-4">
          <SlaPanel order={order} />
          <CrossSystemMatrix order={order} />
        </div>
      </div>
      <UnifiedTimeline events={order.timeline ?? []} />
    </div>
  );
}
