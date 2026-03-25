"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle, Clock,
  Eye, Briefcase, DollarSign, Users,
  ChevronRight, Search, ArrowUp, ArrowDown,
  ShieldAlert, CheckCircle2, X, Filter,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

import { RiskCalculatorService, type RiskLevel } from "@/lib/services/risk-calculator.service";
import { SlaService, type SlaStatus } from "@/lib/services/sla.service";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@/config/order-statuses";

// ─── Types ─────────────────────────────────────────────────────────────────

type View = "CEO" | "OPS" | "FINANCE" | "COMMERCIAL";

export type IntelligenceOrder = {
  id: string;
  orderNumber: string;
  status: string;
  priority: string;
  riskLevel: string | null;
  estimatedDelivery: Date | null;
  updatedAt: Date;
  createdAt: Date;
  totalClient: number;
  contactName: string;
};

type StatusCount = { status: string; count: number };

type Props = {
  orders: IntelligenceOrder[];
  statusCounts: StatusCount[];
  defaultView?: View;
};

// ─── Constants ──────────────────────────────────────────────────────────────

const PIPELINE_STATUSES = [
  "DEMANDE", "RECHERCHE_PRODUIT", "DEVIS", "PAIEMENT_EN_COURS",
  "SOURCING", "EN_PRODUCTION", "RECU_ENTREPOT", "QC_EN_COURS", "QC_VALIDE",
  "EN_TRANSIT", "DEDOUANE", "LIVRE",
];

const RISK_COLORS: Record<RiskLevel, string> = {
  LOW:      "bg-green-100 text-green-700 border-green-200",
  MEDIUM:   "bg-yellow-100 text-yellow-700 border-yellow-200",
  HIGH:     "bg-orange-100 text-orange-700 border-orange-200",
  CRITICAL: "bg-red-100 text-red-700 border-red-200",
};

const SLA_COLORS: Record<SlaStatus, string> = {
  ON_TIME:  "text-green-600",
  WARNING:  "text-orange-500",
  BREACHED: "text-red-600 font-semibold",
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW:    "bg-gray-100 text-gray-600",
  NORMAL: "bg-blue-50 text-blue-700",
  HIGH:   "bg-orange-100 text-orange-700",
  URGENT: "bg-red-100 text-red-700",
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Basse", NORMAL: "Normale", HIGH: "Haute", URGENT: "Urgent",
};

// ─── Helper ─────────────────────────────────────────────────────────────────

function enrichOrder(order: IntelligenceOrder) {
  const risk = RiskCalculatorService.computeLight({
    status: order.status,
    priority: order.priority,
    riskLevel: order.riskLevel,
    estimatedDelivery: order.estimatedDelivery,
  });
  const sla = SlaService.compute(order.status, order.updatedAt);
  return { ...order, risk, sla };
}

type EnrichedOrder = ReturnType<typeof enrichOrder>;

// ─── Sub-components ─────────────────────────────────────────────────────────

function ViewButton({
  view, current, icon: Icon, label, onClick,
}: { view: View; current: View; icon: any; label: string; onClick: () => void }) {
  const active = view === current;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function RiskBadge({ score, level }: { score: number; level: RiskLevel }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${RISK_COLORS[level]}`}>
      <ShieldAlert className="h-3 w-3" />
      {score}
    </span>
  );
}

function SlaBadge({ sla }: { sla: ReturnType<typeof SlaService.compute> }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`text-xs font-medium ${SLA_COLORS[sla.status]}`}>{sla.label}</span>
      <div className="h-1 w-16 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            sla.status === "BREACHED" ? "bg-red-500" :
            sla.status === "WARNING"  ? "bg-orange-400" : "bg-green-400"
          }`}
          style={{ width: `${Math.min(sla.percentUsed, 100)}%` }}
        />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = (ORDER_STATUS_COLORS as Record<string, string>)[status] ?? "bg-gray-100 text-gray-700";
  const label = (ORDER_STATUS_LABELS as Record<string, string>)[status] ?? status;
  return (
    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${color}`}>
      {label}
    </span>
  );
}

function PipelineBar({
  counts,
  activeFilter,
  onFilter,
}: {
  counts: StatusCount[];
  activeFilter: string | null;
  onFilter: (s: string | null) => void;
}) {
  const stages = PIPELINE_STATUSES.map((s) => ({
    status: s,
    label: (ORDER_STATUS_LABELS as Record<string, string>)[s] ?? s,
    count: counts.find((c) => c.status === s)?.count ?? 0,
  }));
  const max = Math.max(...stages.map((s) => s.count), 1);

  return (
    <Card className="border-0 bg-muted/30">
      <CardHeader className="pb-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Pipeline — cliquez pour filtrer</CardTitle>
          {activeFilter && (
            <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => onFilter(null)}>
              <X className="h-3 w-3" /> Effacer
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 md:grid-cols-11 gap-1.5">
          {stages.map((s) => {
            const isActive = activeFilter === s.status;
            return (
              <button
                key={s.status}
                onClick={() => onFilter(isActive ? null : s.status)}
                className={`text-center rounded-md p-1 transition-all hover:bg-background focus:outline-none ${
                  isActive ? "ring-2 ring-primary ring-offset-1 bg-primary/5" : ""
                }`}
                title={`Filtrer: ${s.label}`}
              >
                <div className="h-10 flex items-end justify-center mb-1">
                  <div
                    className={`w-5/6 rounded-t transition-all ${
                      isActive ? "bg-primary" :
                      activeFilter ? "bg-primary/20" : "bg-primary/50"
                    }`}
                    style={{ height: `${Math.max(4, (s.count / max) * 40)}px` }}
                  />
                </div>
                <p className={`text-sm font-bold leading-none ${isActive ? "text-primary" : ""}`}>{s.count}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight break-words">{s.label}</p>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function AlertsPanel({ orders }: { orders: EnrichedOrder[] }) {
  const alerts = useMemo(() => {
    const result: { id: string; orderNumber: string; type: string; message: string; severity: "critical" | "high" | "medium" }[] = [];
    for (const o of orders) {
      if (o.risk.level === "CRITICAL") result.push({ id: o.id, orderNumber: o.orderNumber, type: "RISQUE", message: `Score critique (${o.risk.score}/100)`, severity: "critical" });
      if (o.sla.status === "BREACHED") result.push({ id: o.id, orderNumber: o.orderNumber, type: "SLA", message: o.sla.label, severity: "critical" });
      if (o.risk.level === "HIGH" && !result.find((a) => a.id === o.id && a.type === "RISQUE")) result.push({ id: o.id, orderNumber: o.orderNumber, type: "RISQUE", message: `Score élevé (${o.risk.score}/100)`, severity: "high" });
      if (o.sla.status === "WARNING" && !result.find((a) => a.id === o.id && a.type === "SLA")) result.push({ id: o.id, orderNumber: o.orderNumber, type: "SLA", message: o.sla.label, severity: "medium" });
    }
    return result.sort((a, b) => ({ critical: 0, high: 1, medium: 2 }[a.severity] - { critical: 0, high: 1, medium: 2 }[b.severity])).slice(0, 8);
  }, [orders]);

  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-700">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span className="text-sm font-medium">Aucune alerte — toutes les commandes sont dans les délais.</span>
      </div>
    );
  }

  return (
    <Card className="border-orange-100">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-orange-700">
          <AlertTriangle className="h-4 w-4" />
          {alerts.length} alerte{alerts.length > 1 ? "s" : ""} active{alerts.length > 1 ? "s" : ""}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {alerts.map((alert, i) => (
          <Link key={i} href={`/orders/${alert.id}`}
            className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-muted transition-colors group">
            <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
              alert.severity === "critical" ? "bg-red-100 text-red-700" :
              alert.severity === "high"     ? "bg-orange-100 text-orange-700" :
                                             "bg-yellow-100 text-yellow-700"
            }`}>{alert.type}</span>
            <span className="font-mono text-xs font-semibold text-primary">{alert.orderNumber}</span>
            <span className="text-xs text-muted-foreground flex-1 truncate">{alert.message}</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function OrdersTable({ orders, view }: { orders: EnrichedOrder[]; view: View }) {
  const [sortBy, setSortBy] = useState<string>("riskScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const arr = [...orders];
    arr.sort((a, b) => {
      let va: number | string, vb: number | string;
      switch (sortBy) {
        case "riskScore": va = a.risk.score; vb = b.risk.score; break;
        case "total":     va = a.totalClient; vb = b.totalClient; break;
        case "sla":       va = a.sla.percentUsed; vb = b.sla.percentUsed; break;
        case "date":      va = new Date(a.createdAt).getTime(); vb = new Date(b.createdAt).getTime(); break;
        default:          va = a.orderNumber; vb = b.orderNumber;
      }
      if (typeof va === "number" && typeof vb === "number") return sortDir === "desc" ? vb - va : va - vb;
      return sortDir === "desc" ? String(vb).localeCompare(String(va)) : String(va).localeCompare(String(vb));
    });
    return arr;
  }, [orders, sortBy, sortDir]);

  function toggleSort(key: string) {
    if (sortBy === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortBy(key); setSortDir("desc"); }
  }

  function SortIcon({ col }: { col: string }) {
    if (sortBy !== col) return null;
    return sortDir === "desc" ? <ArrowDown className="h-3 w-3 inline ml-0.5" /> : <ArrowUp className="h-3 w-3 inline ml-0.5" />;
  }

  if (sorted.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center">
        <Filter className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-40" />
        <p className="text-sm text-muted-foreground">Aucune commande ne correspond aux filtres</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="text-xs bg-muted/30 hover:bg-muted/30">
            <TableHead className="cursor-pointer select-none font-semibold" onClick={() => toggleSort("order")}>Commande <SortIcon col="order" /></TableHead>
            <TableHead className="font-semibold">Client</TableHead>
            <TableHead className="font-semibold">Statut</TableHead>
            {view === "CEO" && <>
              <TableHead className="cursor-pointer select-none font-semibold" onClick={() => toggleSort("riskScore")}>Risque <SortIcon col="riskScore" /></TableHead>
              <TableHead className="cursor-pointer select-none font-semibold" onClick={() => toggleSort("sla")}>SLA <SortIcon col="sla" /></TableHead>
              <TableHead className="cursor-pointer select-none text-right font-semibold" onClick={() => toggleSort("total")}>Total <SortIcon col="total" /></TableHead>
            </>}
            {view === "OPS" && <>
              <TableHead className="font-semibold">Priorité</TableHead>
              <TableHead className="cursor-pointer select-none font-semibold" onClick={() => toggleSort("sla")}>SLA <SortIcon col="sla" /></TableHead>
              <TableHead className="cursor-pointer select-none font-semibold" onClick={() => toggleSort("riskScore")}>Risque <SortIcon col="riskScore" /></TableHead>
            </>}
            {view === "FINANCE" && <>
              <TableHead className="cursor-pointer select-none text-right font-semibold" onClick={() => toggleSort("total")}>Total XAF <SortIcon col="total" /></TableHead>
              <TableHead className="cursor-pointer select-none font-semibold" onClick={() => toggleSort("riskScore")}>Risque fin. <SortIcon col="riskScore" /></TableHead>
            </>}
            {view === "COMMERCIAL" && <>
              <TableHead className="font-semibold">Priorité</TableHead>
              <TableHead className="cursor-pointer select-none font-semibold" onClick={() => toggleSort("date")}>Date <SortIcon col="date" /></TableHead>
              <TableHead className="font-semibold">Livraison prév.</TableHead>
            </>}
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((order) => (
            <TableRow key={order.id} className="hover:bg-muted/40 group cursor-pointer">
              <TableCell>
                <Link href={`/orders/${order.id}`} className="font-mono text-sm font-semibold text-primary hover:underline">
                  {order.orderNumber}
                </Link>
              </TableCell>
              <TableCell className="text-sm font-medium">{order.contactName}</TableCell>
              <TableCell><StatusBadge status={order.status} /></TableCell>
              {view === "CEO" && <>
                <TableCell><RiskBadge score={order.risk.score} level={order.risk.level} /></TableCell>
                <TableCell><SlaBadge sla={order.sla} /></TableCell>
                <TableCell className="text-right text-sm font-semibold tabular-nums">
                  {Number(order.totalClient).toLocaleString("fr-FR")} <span className="text-muted-foreground font-normal text-xs">XAF</span>
                </TableCell>
              </>}
              {view === "OPS" && <>
                <TableCell>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${PRIORITY_COLORS[order.priority] ?? "bg-gray-100 text-gray-600"}`}>
                    {PRIORITY_LABELS[order.priority] ?? order.priority}
                  </span>
                </TableCell>
                <TableCell><SlaBadge sla={order.sla} /></TableCell>
                <TableCell><RiskBadge score={order.risk.score} level={order.risk.level} /></TableCell>
              </>}
              {view === "FINANCE" && <>
                <TableCell className="text-right text-sm font-semibold tabular-nums">
                  {Number(order.totalClient).toLocaleString("fr-FR")} <span className="text-muted-foreground font-normal text-xs">XAF</span>
                </TableCell>
                <TableCell><RiskBadge score={order.risk.score} level={order.risk.level} /></TableCell>
              </>}
              {view === "COMMERCIAL" && <>
                <TableCell>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${PRIORITY_COLORS[order.priority] ?? "bg-gray-100"}`}>
                    {PRIORITY_LABELS[order.priority] ?? order.priority}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString("fr-FR")}</TableCell>
                <TableCell className="text-xs">
                  {order.estimatedDelivery ? (
                    <span className={`font-medium ${new Date(order.estimatedDelivery) < new Date() ? "text-red-600" : "text-foreground"}`}>
                      {new Date(order.estimatedDelivery).toLocaleDateString("fr-FR")}
                    </span>
                  ) : <span className="text-muted-foreground">—</span>}
                </TableCell>
              </>}
              <TableCell>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Status filter pills ─────────────────────────────────────────────────────

function StatusFilterPills({ counts, active, onSelect }: { counts: StatusCount[]; active: string | null; onSelect: (s: string | null) => void }) {
  const withCount = counts.filter((c) => c.count > 0);
  if (withCount.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-muted-foreground font-medium mr-1">Statut</span>
      <button
        onClick={() => onSelect(null)}
        className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
          active === null
            ? "bg-foreground text-background border-foreground"
            : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
        }`}
      >
        Tous
      </button>
      {withCount.map(({ status, count }) => {
        const color = (ORDER_STATUS_COLORS as Record<string, string>)[status] ?? "bg-gray-100 text-gray-700";
        const label = (ORDER_STATUS_LABELS as Record<string, string>)[status] ?? status;
        const isActive = active === status;
        return (
          <button
            key={status}
            onClick={() => onSelect(isActive ? null : status)}
            className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition-all ${
              isActive ? `${color} border-current ring-2 ring-current ring-offset-1` : `${color} opacity-60 hover:opacity-100 border-transparent`
            }`}
          >
            {label} <span className="ml-0.5 opacity-75">({count})</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function OrdersIntelligence({ orders, statusCounts, defaultView = "CEO" }: Props) {
  const [view, setView] = useState<View>(defaultView);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);

  const enriched = useMemo(() => orders.map(enrichOrder), [orders]);

  const filtered = useMemo(() => {
    let result = enriched;
    if (statusFilter)   result = result.filter((o) => o.status === statusFilter);
    if (priorityFilter) result = result.filter((o) => o.priority === priorityFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.contactName.toLowerCase().includes(q) ||
        (ORDER_STATUS_LABELS as Record<string, string>)[o.status]?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [enriched, search, statusFilter, priorityFilter]);

  const kpis = useMemo(() => ({
    critical:   enriched.filter((o) => o.risk.level === "CRITICAL").length,
    breached:   enriched.filter((o) => o.sla.status === "BREACHED").length,
    totalValue: enriched.reduce((s, o) => s + o.totalClient, 0),
    count:      enriched.length,
  }), [enriched]);

  const hasFilters = statusFilter !== null || priorityFilter !== null || search.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* View switcher + search */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
          <ViewButton view="CEO"        current={view} icon={Eye}        label="CEO"        onClick={() => setView("CEO")} />
          <ViewButton view="OPS"        current={view} icon={Briefcase}  label="Ops"        onClick={() => setView("OPS")} />
          <ViewButton view="FINANCE"    current={view} icon={DollarSign} label="Finance"    onClick={() => setView("FINANCE")} />
          <ViewButton view="COMMERCIAL" current={view} icon={Users}      label="Commercial" onClick={() => setView("COMMERCIAL")} />
        </div>
        <div className="flex items-center gap-2 flex-1 justify-end">
          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-muted-foreground"
              onClick={() => { setStatusFilter(null); setPriorityFilter(null); setSearch(""); }}>
              <X className="h-3 w-3" /> Effacer filtres
            </Button>
          )}
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8 h-8 text-sm" placeholder="N° commande, client, statut..."
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-lg border bg-card px-3 py-2.5 text-center">
          <p className="text-2xl font-bold tabular-nums">{hasFilters ? filtered.length : kpis.count}</p>
          <p className="text-xs text-muted-foreground">{hasFilters ? `sur ${kpis.count}` : "commandes"}</p>
        </div>
        <div className={`rounded-lg border px-3 py-2.5 text-center ${kpis.critical > 0 ? "border-red-200 bg-red-50" : "bg-card"}`}>
          <p className={`text-2xl font-bold tabular-nums ${kpis.critical > 0 ? "text-red-600" : ""}`}>{kpis.critical}</p>
          <p className="text-xs text-muted-foreground">Risque critique</p>
        </div>
        <div className={`rounded-lg border px-3 py-2.5 text-center ${kpis.breached > 0 ? "border-orange-200 bg-orange-50" : "bg-card"}`}>
          <p className={`text-2xl font-bold tabular-nums ${kpis.breached > 0 ? "text-orange-600" : ""}`}>{kpis.breached}</p>
          <p className="text-xs text-muted-foreground">SLA dépassé</p>
        </div>
        <div className="rounded-lg border bg-card px-3 py-2.5 text-center">
          <p className="text-xl font-bold tabular-nums">
            {kpis.totalValue >= 1_000_000 ? `${(kpis.totalValue / 1_000_000).toFixed(1)}M` : `${(kpis.totalValue / 1_000).toFixed(0)}k`}
          </p>
          <p className="text-xs text-muted-foreground">Valeur totale XAF</p>
        </div>
      </div>

      {/* Filter pills row */}
      <div className="flex flex-col gap-2">
        <StatusFilterPills counts={statusCounts} active={statusFilter} onSelect={setStatusFilter} />
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium mr-1 flex items-center gap-1">
            <Clock className="h-3 w-3" /> Priorité
          </span>
          {([
            { value: null,     label: "Toutes" },
            { value: "URGENT", label: "Urgent" },
            { value: "HIGH",   label: "Haute" },
            { value: "NORMAL", label: "Normale" },
            { value: "LOW",    label: "Basse" },
          ] as const).map(({ value, label }) => {
            const isActive = priorityFilter === (value as string | null);
            const color = value ? PRIORITY_COLORS[value] ?? "bg-gray-100" : "";
            return (
              <button key={label} onClick={() => setPriorityFilter(value as string | null)}
                className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition-all ${
                  isActive
                    ? value ? `${color} border-current ring-2 ring-current ring-offset-1` : "bg-foreground text-background border-foreground"
                    : value ? `${color} opacity-60 hover:opacity-100 border-transparent` : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >{label}</button>
            );
          })}
        </div>
      </div>

      {/* Clickable pipeline bar */}
      <PipelineBar counts={statusCounts} activeFilter={statusFilter} onFilter={setStatusFilter} />

      {/* Alerts */}
      <AlertsPanel orders={filtered} />

      {/* Table */}
      <OrdersTable orders={filtered} view={view} />
    </div>
  );
}
