"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  MessageSquare, Phone, Mail, Users, AlertCircle, CheckCircle,
  Package, TrendingUp, XCircle, Inbox, ArrowRight, Plus, Clock,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard, KpiGrid } from "@/components/shared/kpi-card";
import { qualifyDemandIntake, assignSourcingTask, markDemandLost } from "@/lib/actions/demand-intake.actions";

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  RAW: "Brut",
  QUALIFIED: "Qualifié",
  INDICATIF_PENDING: "Sourcing indicatif",
  QUOTE_DRAFT: "Devis en cours",
  QUOTE_PENDING_APPROVAL: "Attente COO",
  QUOTE_APPROVED: "Devis approuvé",
  QUOTE_SENT: "Devis envoyé",
  CLIENT_ACCEPTED: "Client OK",
  PAYMENT_SUBMITTED: "Paiement soumis",
  PAYMENT_VALIDATED: "Paiement validé",
  CONVERTED: "Converti",
  LOST: "Perdu",
};

const STATUS_COLORS: Record<string, string> = {
  RAW: "bg-muted text-muted-foreground border-0",
  QUALIFIED: "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-100 border-0",
  INDICATIF_PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-100 border-0",
  QUOTE_DRAFT: "bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-100 border-0",
  QUOTE_PENDING_APPROVAL: "bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-100 border-0",
  QUOTE_APPROVED: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-100 border-0",
  QUOTE_SENT: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/60 dark:text-cyan-100 border-0",
  CLIENT_ACCEPTED: "bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-100 border-0",
  PAYMENT_SUBMITTED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/60 dark:text-yellow-100 border-0",
  PAYMENT_VALIDATED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-100 border-0",
  CONVERTED: "bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-100 border-0",
  LOST: "bg-destructive/10 text-destructive border-0",
};

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  WHATSAPP: <MessageSquare className="h-3.5 w-3.5 text-green-600" />,
  PHONE: <Phone className="h-3.5 w-3.5 text-blue-600" />,
  EMAIL: <Mail className="h-3.5 w-3.5 text-violet-600" />,
  GROUP: <Users className="h-3.5 w-3.5 text-amber-600" />,
  CRM: <Users className="h-3.5 w-3.5 text-primary" />,
  MANUAL: <Plus className="h-3.5 w-3.5 text-muted-foreground" />,
  APP: <Package className="h-3.5 w-3.5 text-cyan-600" />,
};

const URGENCY_COLORS: Record<string, string> = {
  NORMAL: "",
  HIGH: "text-amber-600",
  CRITICAL: "text-destructive font-bold",
};

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "Toutes" },
  { value: "RAW", label: "Brutes" },
  { value: "QUALIFIED", label: "Qualifiées" },
  { value: "INDICATIF_PENDING", label: "Sourcing" },
  { value: "QUOTE_DRAFT,QUOTE_PENDING_APPROVAL,QUOTE_APPROVED,QUOTE_SENT", label: "Devis" },
  { value: "CLIENT_ACCEPTED,PAYMENT_SUBMITTED,PAYMENT_VALIDATED", label: "Paiement" },
  { value: "CONVERTED", label: "Converties" },
  { value: "LOST", label: "Perdues" },
];

// ─── Types ───────────────────────────────────────────────────────────────────

export type DemandRow = {
  id: string;
  clientName: string;
  rawDescription: string;
  category?: string | null;
  status: string;
  source: string;
  urgency: string;
  estimatedRevenue?: number | null;
  receivedAt: string | Date;
  contact?: { id: string; name: string } | null;
  cm?: { id: string; name: string | null } | null;
  assignedTo?: { id: string; name: string | null } | null;
};

export type DemandKpis = {
  total: number;
  raw: number;
  qualified: number;
  indicatifPending: number;
  quoteFlow: number;
  paymentFlow: number;
  converted: number;
  lost: number;
};

// ─── Component ───────────────────────────────────────────────────────────────

export function DemandsClient({ demands: initialDemands, kpis }: { demands: DemandRow[]; kpis: DemandKpis }) {
  const [demands, setDemands] = useState(initialDemands);
  const [statusFilter, setStatusFilter] = useState("all");
  const [, startTransition] = useTransition();

  const filtered =
    statusFilter === "all"
      ? demands
      : demands.filter((d) => statusFilter.split(",").includes(d.status));

  function updateStatus(id: string, status: string) {
    setDemands((prev) => prev.map((d) => (d.id === id ? { ...d, status } : d)));
  }

  function handleQualify(id: string) {
    startTransition(async () => {
      const res = await qualifyDemandIntake(id, {});
      if (res.error) toast.error(res.error);
      else { toast.success("Demande qualifiée"); updateStatus(id, "QUALIFIED"); }
    });
  }

  function handleAssignSourcing(id: string) {
    startTransition(async () => {
      const res = await assignSourcingTask(id);
      if (res.error) toast.error(res.error);
      else { toast.success("Tâche sourcing indicatif créée"); updateStatus(id, "INDICATIF_PENDING"); }
    });
  }

  function handleMarkLost(id: string) {
    startTransition(async () => {
      const res = await markDemandLost(id, "Perdue via tableau de bord");
      if (res.error) toast.error(res.error);
      else { toast.success("Demande marquée perdue"); updateStatus(id, "LOST"); }
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Demandes Clients"
        description="Pipeline pré-vente — de l'intention d'achat à la commande signée"
      />

      {/* KPIs */}
      <KpiGrid cols={4}>
        <KpiCard
          label="Total"
          value={kpis.total}
          icon={<Inbox className="h-4 w-4 text-muted-foreground" />}
        />
        <KpiCard
          label="Brutes à traiter"
          value={kpis.raw}
          icon={<AlertCircle className="h-4 w-4 text-muted-foreground" />}
          variant={kpis.raw > 0 ? "warning" : "default"}
          urgent={kpis.raw > 0}
          href="/crm/demands"
        />
        <KpiCard
          label="En sourcing"
          value={kpis.indicatifPending + kpis.quoteFlow}
          icon={<Package className="h-4 w-4 text-muted-foreground" />}
          sub={`${kpis.indicatifPending} indicatif · ${kpis.quoteFlow} devis`}
        />
        <KpiCard
          label="Converties"
          value={kpis.converted}
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
          variant={kpis.converted > 0 ? "success" : "default"}
          sub={kpis.lost > 0 ? `${kpis.lost} perdues` : undefined}
        />
      </KpiGrid>

      {/* Pipeline progress bar */}
      <div className="flex items-center gap-0 rounded-lg overflow-hidden border text-xs font-medium">
        {[
          { label: "Brutes", count: kpis.raw, color: "bg-muted" },
          { label: "Qualifiées", count: kpis.qualified, color: "bg-blue-500" },
          { label: "Sourcing", count: kpis.indicatifPending, color: "bg-amber-500" },
          { label: "Devis", count: kpis.quoteFlow, color: "bg-violet-500" },
          { label: "Paiement", count: kpis.paymentFlow, color: "bg-yellow-500" },
          { label: "Converties", count: kpis.converted, color: "bg-emerald-500" },
        ]
          .filter((s) => s.count > 0)
          .map((stage, i, arr) => (
            <div
              key={stage.label}
              className={`${stage.color} flex items-center justify-center py-2 text-white transition-all`}
              style={{ flex: stage.count, minWidth: "60px" }}
              title={`${stage.label} : ${stage.count}`}
            >
              {stage.label} {stage.count}
              {i < arr.length - 1 && <span className="ml-1 opacity-60">›</span>}
            </div>
          ))}
        {kpis.total === 0 && (
          <div className="flex-1 py-2 text-center text-muted-foreground text-xs bg-muted">
            Aucune demande pour le moment
          </div>
        )}
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              statusFilter === opt.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium">Aucune demande</p>
              <p className="text-xs text-muted-foreground mt-1">
                Les demandes WhatsApp, CRM et manuelles apparaissent ici
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>CM</TableHead>
                  <TableHead>Reçue le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((demand) => (
                  <TableRow key={demand.id}>
                    <TableCell>
                      <div>
                        <p className={`font-medium ${URGENCY_COLORS[demand.urgency] || ""}`}>
                          {demand.clientName}
                          {demand.urgency === "CRITICAL" && (
                            <span className="ml-1.5 text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full">
                              URGENT
                            </span>
                          )}
                        </p>
                        {demand.contact && (
                          <Link
                            href={`/contacts/${demand.contact.id}`}
                            className="text-xs text-primary hover:underline"
                          >
                            {demand.contact.name}
                          </Link>
                        )}
                        {demand.category && (
                          <p className="text-[11px] text-muted-foreground">{demand.category}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm max-w-[220px] truncate text-muted-foreground">
                        {demand.rawDescription}
                      </p>
                      {demand.estimatedRevenue && (
                        <p className="text-xs font-medium text-emerald-600">
                          ~{demand.estimatedRevenue.toLocaleString("fr-FR")} XAF
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${STATUS_COLORS[demand.status] || "bg-muted"}`}>
                        {STATUS_LABELS[demand.status] || demand.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {SOURCE_ICONS[demand.source]}
                        <span className="text-xs text-muted-foreground">{demand.source}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{demand.cm?.name || "—"}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {new Date(demand.receivedAt).toLocaleDateString("fr-FR")}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {demand.status === "RAW" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => handleQualify(demand.id)}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Qualifier
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-destructive"
                              onClick={() => handleMarkLost(demand.id)}
                            >
                              <XCircle className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                        {demand.status === "QUALIFIED" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => handleAssignSourcing(demand.id)}
                            >
                              <ArrowRight className="h-3 w-3 mr-1" />
                              Sourcing
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-destructive"
                              onClick={() => handleMarkLost(demand.id)}
                            >
                              <XCircle className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                        {demand.status === "INDICATIF_PENDING" && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
                            <Link href="/sourcing/indicatif">
                              <Clock className="h-3 w-3 mr-1" />
                              Voir sourcing
                            </Link>
                          </Button>
                        )}
                        {["QUOTE_DRAFT", "QUOTE_PENDING_APPROVAL", "QUOTE_APPROVED", "QUOTE_SENT"].includes(
                          demand.status
                        ) && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
                            <Link href="/quotes">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              Voir devis
                            </Link>
                          </Button>
                        )}
                        {["CLIENT_ACCEPTED", "PAYMENT_SUBMITTED", "PAYMENT_VALIDATED"].includes(
                          demand.status
                        ) && (
                          <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200">
                            Paiement
                          </Badge>
                        )}
                        {demand.status === "CONVERTED" && (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-200">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Converti
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
