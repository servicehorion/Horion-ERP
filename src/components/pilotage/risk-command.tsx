"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, RefreshCw, ShieldAlert, ShieldCheck, Siren, UserCog } from "lucide-react";
import { toast } from "sonner";

import {
  addRiskMitigationEntry,
  escalateStrategicRisk,
  syncRiskRegistry,
  updateStrategicRisk,
} from "@/lib/actions/pilotage.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Owner = {
  id: string;
  name: string;
  role: string;
  email: string;
};

type RiskEntry = {
  id: string;
  type: string;
  title: string;
  detail?: string | null;
  createdAt: string | Date;
  createdBy?: { id: string; name: string } | null;
};

type RiskRecord = {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  severity: string;
  status: string;
  sourceMetric?: string | null;
  sourceValue?: number | null;
  thresholdValue?: number | null;
  linkedHref?: string | null;
  ownerId?: string | null;
  owner?: { id: string; name: string; role: string } | null;
  mitigationPlan: Array<{ title: string; ownerArea: string; module: string }>;
  entries: RiskEntry[];
  lastDetectedAt: string | Date;
};

type TimelineEntry = {
  id: string;
  type: string;
  title: string;
  detail?: string | null;
  createdAt: string | Date;
  createdBy?: { id: string; name: string } | null;
  risk: {
    id: string;
    title: string;
    category: string;
    severity: string;
    linkedHref?: string | null;
  };
};

type RiskCommandData = {
  syncedAt: string;
  summary: {
    open: number;
    mitigating: number;
    escalated: number;
    resolved: number;
    critical: number;
    byCategory: Array<{ category: string; label: string; count: number }>;
    sync: { created: number; updated: number; escalated: number; resolved: number };
  };
  risks: RiskRecord[];
  timeline: TimelineEntry[];
  owners: Owner[];
  suggestedActions: Array<{ id: string; title: string; reason: string; href: string; severity: string }>;
  assistantNotes: string[];
};

const severityTheme: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800",
};

const statusTheme: Record<string, string> = {
  OPEN: "bg-slate-100 text-slate-700",
  MITIGATING: "bg-blue-100 text-blue-700",
  ESCALATED: "bg-red-100 text-red-800",
  RESOLVED: "bg-emerald-100 text-emerald-700",
  ACCEPTED: "bg-zinc-100 text-zinc-700",
};

const metricLabel: Record<string, string> = {
  marginPercent: "Marge",
  cashPosition: "Trésorerie",
  overdueRate: "Retard",
  logisticsDelayRate: "Délai logistique",
  qcFailRate: "Échec QC",
  supplierRiskScore: "Risque fournisseur",
  fxExposure: "Exposition FX",
  liquidityMetric: "Liquidité",
  crmConversionRate: "Conversion CRM",
};

function formatMetric(metric?: string | null, value?: number | null) {
  if (value === null || value === undefined) return "-";
  if (!metric) return value.toLocaleString("fr-FR");
  if (metric.toLowerCase().includes("rate")) return `${(value * 100).toFixed(1)}%`;
  if (metric.toLowerCase().includes("percent")) return `${value.toFixed(1)}%`;
  return value.toLocaleString("fr-FR");
}

export function RiskCommand({ data }: { data: RiskCommandData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [noteRiskId, setNoteRiskId] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteDetail, setNoteDetail] = useState("");

  const activeRisks = data.risks.filter((risk) => risk.status !== "RESOLVED");
  const criticalRisks = activeRisks.filter((risk) => ["HIGH", "CRITICAL"].includes(risk.severity));
  const maxCategory = Math.max(...data.summary.byCategory.map((item) => item.count), 1);

  function refreshPage() {
    router.refresh();
  }

  function handleSync() {
    startTransition(async () => {
      const res = await syncRiskRegistry();
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const summary = res.data;
      toast.success(
        `Registre synchronise : ${summary?.created || 0} crees, ${summary?.updated || 0} maj, ${summary?.resolved || 0} resolus`
      );
      refreshPage();
    });
  }

  function handleOwnerChange(riskId: string, ownerId: string) {
    startTransition(async () => {
      const res = await updateStrategicRisk(riskId, {
        ownerId: ownerId === "unassigned" ? null : ownerId,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Responsable mis à jour");
      refreshPage();
    });
  }

  function handleStatusChange(riskId: string, status: string) {
    startTransition(async () => {
      const res = await updateStrategicRisk(riskId, {
        status: status as "OPEN" | "MITIGATING" | "ESCALATED" | "RESOLVED" | "ACCEPTED",
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Statut du risque mis à jour");
      refreshPage();
    });
  }

  function handleEscalate(riskId: string) {
    startTransition(async () => {
      const res = await escalateStrategicRisk(riskId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Tâche corrective créée");
      refreshPage();
    });
  }

  function submitNote() {
    if (!noteRiskId || !noteTitle.trim()) {
      toast.error("Le titre de l'action corrective est requis");
      return;
    }

    startTransition(async () => {
      const res = await addRiskMitigationEntry({
        riskId: noteRiskId,
        title: noteTitle,
        detail: noteDetail,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Entrée corrective ajoutée");
      setNoteRiskId(null);
      setNoteTitle("");
      setNoteDetail("");
      refreshPage();
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4 text-red-500" /> Risques critiques
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{data.summary.critical}</div>
            <div className="text-xs text-muted-foreground">Nécessitent une action immédiate</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Siren className="h-4 w-4 text-amber-500" /> Escaladés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{data.summary.escalated}</div>
            <div className="text-xs text-muted-foreground">Atténuation inter-modules en cours</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCog className="h-4 w-4 text-blue-500" /> En atténuation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{data.summary.mitigating}</div>
            <div className="text-xs text-muted-foreground">Assignés avec suivi actif</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-emerald-500" /> Activité récente du registre
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div>Créés 24h : {data.summary.sync.created}</div>
            <div>Mis à jour 24h : {data.summary.sync.updated}</div>
            <div>Résolus 24h : {data.summary.sync.resolved}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base">Registre des risques</CardTitle>
              <div className="text-xs text-muted-foreground">
                Risques stratégiques détectés sur finance, logistique, sourcing, QC et CRM.
              </div>
            </div>
            <Button variant="outline" onClick={handleSync} disabled={pending}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Risque</TableHead>
                    <TableHead>Signal</TableHead>
                    <TableHead>Responsable</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {criticalRisks.map((risk) => (
                    <TableRow key={risk.id} id={`risk-${risk.id}`}>
                      <TableCell className="align-top">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{risk.title}</span>
                            <Badge className={severityTheme[risk.severity] || severityTheme.MEDIUM}>
                              {risk.severity}
                            </Badge>
                            <Badge variant="outline">{risk.category}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">{risk.description}</div>
                          <div className="text-xs text-muted-foreground">
                            {metricLabel[risk.sourceMetric || ""] || risk.sourceMetric || "Signal"}:{" "}
                            {formatMetric(risk.sourceMetric, risk.sourceValue)}
                            {" / "}
                            {formatMetric(risk.sourceMetric, risk.thresholdValue)}
                          </div>
                          {risk.linkedHref ? (
                            <Link href={risk.linkedHref} className="text-xs text-blue-600">
                              Voir le module
                            </Link>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="text-sm">{risk.entries[0]?.title || "Aucune entrée"}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(risk.lastDetectedAt).toLocaleString("fr-FR")}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <Select
                          value={risk.ownerId || "unassigned"}
                          onValueChange={(value) => handleOwnerChange(risk.id, value)}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Responsable" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Non assigné</SelectItem>
                            {data.owners.map((owner) => (
                              <SelectItem key={owner.id} value={owner.id}>
                                {owner.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="align-top">
                        <Select value={risk.status} onValueChange={(value) => handleStatusChange(risk.id, value)}>
                          <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Statut" />
                          </SelectTrigger>
                          <SelectContent>
                            {["OPEN", "MITIGATING", "ESCALATED", "RESOLVED", "ACCEPTED"].map((status) => (
                              <SelectItem key={status} value={status}>
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="align-top text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setNoteRiskId(risk.id)}>
                            Ajouter note
                          </Button>
                          <Button size="sm" onClick={() => handleEscalate(risk.id)}>
                            Escalader
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {criticalRisks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                        Aucun risque critique ne nécessite d'escalade pour le moment.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Priorités assistées par IA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.assistantNotes.map((note, index) => (
              <div key={`${note}-${index}`} className="rounded-lg border bg-slate-50 p-3 text-sm">
                {note}
              </div>
            ))}
            {data.summary.byCategory.map((item) => (
              <div key={item.category} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{item.label}</span>
                  <span className="font-medium">{item.count}</span>
                </div>
                <Progress value={(item.count / maxCategory) * 100} className="h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Chronologie des actions correctives</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.timeline.map((entry) => (
              <div key={entry.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{entry.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {entry.risk.title} · {entry.risk.category}
                    </div>
                  </div>
                  <Badge className={severityTheme[entry.risk.severity] || severityTheme.MEDIUM}>
                    {entry.type}
                  </Badge>
                </div>
                {entry.detail ? <div className="mt-2 text-sm text-muted-foreground">{entry.detail}</div> : null}
                <div className="mt-2 text-xs text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleString("fr-FR")}
                </div>
              </div>
            ))}
            {data.timeline.length === 0 ? (
              <div className="text-sm text-muted-foreground">Aucune activité corrective pour le moment.</div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Plans d'action</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeRisks.slice(0, 5).map((risk) => (
              <div key={risk.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{risk.title}</div>
                  <Badge className={statusTheme[risk.status] || statusTheme.OPEN}>{risk.status}</Badge>
                </div>
                <div className="mt-2 space-y-2 text-sm">
                  {risk.mitigationPlan.map((step, index) => (
                    <div key={`${risk.id}-${index}`} className="rounded border bg-slate-50 px-3 py-2">
                      <div className="font-medium">{step.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {step.ownerArea} · {step.module}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(noteRiskId)} onOpenChange={(open) => !open && setNoteRiskId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une entrée corrective</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Titre</Label>
              <Input value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Détail</Label>
              <Textarea value={noteDetail} onChange={(event) => setNoteDetail(event.target.value)} rows={5} />
            </div>
            <Button onClick={submitNote} disabled={pending}>
              Enregistrer l'entrée
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
