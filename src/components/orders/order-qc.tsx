"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Loader2, Plus, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createQcRequest, updateQcRequestStatus, addQcReport, addQcNonConformity } from "@/lib/actions/order.actions";
import { formatDate } from "@/lib/utils";

export type QCNonConformity = {
  id: string;
  category: string;
  severity: string;
  description: string;
  photoUrl?: string | null;
  resolution?: string | null;
};

export type QcReport = {
  id: string;
  overallResult: string;
  defectRate?: any;
  recommendation?: string | null;
  createdAt: Date;
  nonConformities?: QCNonConformity[];
};

export type QcRequest = {
  id: string;
  type: string;
  status: string;
  inspector?: string | null;
  scheduledAt?: Date | null;
  completedAt?: Date | null;
  cost?: any;
  currency?: string | null;
  reports?: QcReport[];
};

const TYPE_LABELS: Record<string, string> = {
  DURING_PRODUCTION: "En cours de production",
  PRE_SHIPMENT:      "Avant expédition",
  CONTAINER_LOADING: "Chargement conteneur",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING:     "bg-gray-100 text-gray-700",
  SCHEDULED:   "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  PASSED:      "bg-green-100 text-green-700",
  FAILED:      "bg-red-100 text-red-700",
  CONDITIONAL: "bg-orange-100 text-orange-700",
  CANCELLED:   "bg-gray-200 text-gray-500",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING:     "En attente",
  SCHEDULED:   "Planifié",
  IN_PROGRESS: "En cours",
  PASSED:      "Conforme",
  FAILED:      "Non conforme",
  CONDITIONAL: "Conditionnel",
  CANCELLED:   "Annulé",
};

const RESULT_ICON: Record<string, React.ReactNode> = {
  PASS: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  FAIL: <XCircle className="h-4 w-4 text-red-600" />,
  CONDITIONAL: <ClipboardCheck className="h-4 w-4 text-orange-500" />,
};

const NC_SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700 border-red-200",
  MAJOR:    "bg-orange-100 text-orange-700 border-orange-200",
  MINOR:    "bg-yellow-100 text-yellow-700 border-yellow-200",
  COSMETIC: "bg-gray-100 text-gray-600 border-gray-200",
};

interface OrderQcProps {
  orderId: string;
  qcRequests: QcRequest[];
  canManage?: boolean;
}

export function OrderQc({ orderId, qcRequests, canManage }: OrderQcProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [reportOpenFor, setReportOpenFor] = useState<string | null>(null);

  // Create QC request form
  const [form, setForm] = useState({
    type: "PRE_SHIPMENT",
    inspector: "",
    scheduledAt: "",
    cost: "",
    currency: "XAF",
  });

  // QC report form
  const [reportForm, setReportForm] = useState({
    overallResult: "PASS",
    defectRate: "",
    recommendation: "",
  });

  // Non-conformity form
  const [ncOpenFor, setNcOpenFor] = useState<string | null>(null); // reportId
  const [ncForm, setNcForm] = useState({
    category: "",
    severity: "MAJOR",
    description: "",
    resolution: "",
  });

  const handleCreate = () => {
    startTransition(async () => {
      const res = await createQcRequest(orderId, {
        type: form.type,
        inspector: form.inspector || undefined,
        scheduledAt: form.scheduledAt || undefined,
        cost: form.cost ? Number(form.cost) : undefined,
        currency: form.currency || undefined,
      });
      if (res.error) toast.error(res.error);
      else { toast.success("Demande QC créée"); setCreateOpen(false); router.refresh(); }
    });
  };

  const handleStatusChange = (requestId: string, status: string) => {
    startTransition(async () => {
      const res = await updateQcRequestStatus(requestId, status);
      if (res.error) toast.error(res.error);
      else { toast.success("Statut mis à jour"); router.refresh(); }
    });
  };

  const handleAddReport = (requestId: string) => {
    startTransition(async () => {
      const res = await addQcReport(requestId, {
        overallResult: reportForm.overallResult,
        defectRate: reportForm.defectRate ? Number(reportForm.defectRate) : undefined,
        recommendation: reportForm.recommendation || undefined,
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("Rapport ajouté");
        setReportOpenFor(null);
        setReportForm({ overallResult: "PASS", defectRate: "", recommendation: "" });
        router.refresh();
      }
    });
  };

  const handleAddNc = (reportId: string) => {
    if (!ncForm.category.trim() || !ncForm.description.trim()) {
      toast.error("Catégorie et description requis");
      return;
    }
    startTransition(async () => {
      const res = await addQcNonConformity(reportId, {
        category: ncForm.category,
        severity: ncForm.severity,
        description: ncForm.description,
        resolution: ncForm.resolution || undefined,
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("Non-conformité enregistrée");
        setNcOpenFor(null);
        setNcForm({ category: "", severity: "MAJOR", description: "", resolution: "" });
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {qcRequests.length === 0
            ? "Aucune inspection QC"
            : `${qcRequests.length} inspection${qcRequests.length > 1 ? "s" : ""}`}
        </p>
        {canManage && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Nouvelle inspection
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Demande d&apos;inspection QC</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Type d&apos;inspection</Label>
                  <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TYPE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Inspecteur / Société</Label>
                  <Input
                    value={form.inspector}
                    onChange={(e) => setForm((f) => ({ ...f, inspector: e.target.value }))}
                    placeholder="SGS, Bureau Veritas..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Date planifiée</Label>
                    <Input
                      type="date"
                      value={form.scheduledAt}
                      onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Coût QC</Label>
                    <div className="flex gap-1.5">
                      <Input
                        type="number"
                        min="0"
                        value={form.cost}
                        onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
                        placeholder="0"
                        className="flex-1"
                      />
                      <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
                        <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["XAF", "USD", "EUR", "CNY"].map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Créer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {qcRequests.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Aucune inspection QC pour cette commande.
        </div>
      )}

      <div className="space-y-3">
        {qcRequests.map((req) => (
          <Card key={req.id}>
            <CardHeader className="p-4 pb-2">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{TYPE_LABELS[req.type] ?? req.type}</span>
                    <Badge className={STATUS_COLORS[req.status] ?? ""}>{STATUS_LABELS[req.status] ?? req.status}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {req.inspector && <span>Inspecteur : {req.inspector}</span>}
                    {req.scheduledAt && <span>Planifié : {formatDate(req.scheduledAt)}</span>}
                    {req.cost != null && <span>Coût : {Number(req.cost).toLocaleString("fr-FR")} {req.currency ?? "XAF"}</span>}
                  </div>
                </div>
                {canManage && (
                  <Select
                    value={req.status}
                    onValueChange={(v) => handleStatusChange(req.id, v)}
                    disabled={isPending}
                  >
                    <SelectTrigger className="h-7 w-36 text-xs shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardHeader>

            <CardContent className="px-4 pb-4 space-y-3">
              {/* Reports */}
              {(req.reports ?? []).length > 0 && (
                <div className="space-y-3">
                  {(req.reports ?? []).map((report) => (
                    <div key={report.id} className="rounded-md border bg-muted/20 text-xs overflow-hidden">
                      {/* Report header */}
                      <div className="flex items-start gap-2 p-2.5">
                        {RESULT_ICON[report.overallResult] ?? <ClipboardCheck className="h-4 w-4" />}
                        <div className="flex-1">
                          <span className="font-medium">{report.overallResult}</span>
                          {report.defectRate != null && (
                            <span className="text-muted-foreground ml-2">Taux défaut : {Number(report.defectRate).toFixed(1)}%</span>
                          )}
                          {report.recommendation && (
                            <p className="text-muted-foreground mt-0.5">{report.recommendation}</p>
                          )}
                        </div>
                        <span className="text-muted-foreground shrink-0">{formatDate(report.createdAt)}</span>
                      </div>

                      {/* Non-conformities */}
                      {(report.nonConformities ?? []).length > 0 && (
                        <div className="border-t px-2.5 py-2 space-y-1.5">
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Non-conformités ({report.nonConformities!.length})
                          </p>
                          {report.nonConformities!.map((nc) => (
                            <div key={nc.id} className={`rounded border px-2 py-1.5 ${NC_SEVERITY_COLORS[nc.severity] ?? "bg-gray-50 border-gray-200"}`}>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-[11px] uppercase">{nc.severity}</span>
                                <span className="font-medium">{nc.category}</span>
                              </div>
                              <p className="mt-0.5 text-[11px]">{nc.description}</p>
                              {nc.resolution && (
                                <p className="mt-0.5 text-[11px] italic">✓ {nc.resolution}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add non-conformity */}
                      {canManage && (
                        <div className="border-t px-2.5 py-2">
                          {ncOpenFor === report.id ? (
                            <div className="space-y-2">
                              <p className="text-[11px] font-semibold">Ajouter une non-conformité</p>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-[11px]">Catégorie</Label>
                                  <input
                                    className="flex h-7 w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    value={ncForm.category}
                                    onChange={(e) => setNcForm((f) => ({ ...f, category: e.target.value }))}
                                    placeholder="Emballage, Dimensions..."
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[11px]">Sévérité</Label>
                                  <Select value={ncForm.severity} onValueChange={(v) => setNcForm((f) => ({ ...f, severity: v }))}>
                                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="CRITICAL">Critique</SelectItem>
                                      <SelectItem value="MAJOR">Majeur</SelectItem>
                                      <SelectItem value="MINOR">Mineur</SelectItem>
                                      <SelectItem value="COSMETIC">Cosmétique</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <Textarea
                                value={ncForm.description}
                                onChange={(e) => setNcForm((f) => ({ ...f, description: e.target.value }))}
                                placeholder="Description du défaut..."
                                rows={2}
                                className="text-xs"
                              />
                              <input
                                className="flex h-7 w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                value={ncForm.resolution}
                                onChange={(e) => setNcForm((f) => ({ ...f, resolution: e.target.value }))}
                                placeholder="Résolution / Action corrective (optionnel)"
                              />
                              <div className="flex gap-2">
                                <Button size="sm" className="h-7 text-xs" onClick={() => handleAddNc(report.id)} disabled={isPending}>
                                  {isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                                  Enregistrer
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setNcOpenFor(null)}>
                                  Annuler
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <button
                              className="text-[11px] text-primary hover:underline flex items-center gap-1"
                              onClick={() => { setNcForm({ category: "", severity: "MAJOR", description: "", resolution: "" }); setNcOpenFor(report.id); }}
                            >
                              <Plus className="h-3 w-3" />
                              Non-conformité
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add report */}
              {canManage && (
                reportOpenFor === req.id ? (
                  <div className="space-y-2 pt-2 border-t">
                    <p className="text-xs font-medium">Ajouter un rapport</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Résultat</Label>
                        <Select
                          value={reportForm.overallResult}
                          onValueChange={(v) => setReportForm((f) => ({ ...f, overallResult: v }))}
                        >
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PASS">Conforme (PASS)</SelectItem>
                            <SelectItem value="FAIL">Non conforme (FAIL)</SelectItem>
                            <SelectItem value="CONDITIONAL">Conditionnel</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Taux de défaut (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={reportForm.defectRate}
                          onChange={(e) => setReportForm((f) => ({ ...f, defectRate: e.target.value }))}
                          className="h-7 text-xs"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <Textarea
                      value={reportForm.recommendation}
                      onChange={(e) => setReportForm((f) => ({ ...f, recommendation: e.target.value }))}
                      placeholder="Recommandations..."
                      rows={2}
                      className="text-xs"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleAddReport(req.id)}
                        disabled={isPending}
                      >
                        {isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                        Enregistrer
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => setReportOpenFor(null)}
                      >
                        Annuler
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setReportOpenFor(req.id)}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Rapport d&apos;inspection
                  </Button>
                )
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
