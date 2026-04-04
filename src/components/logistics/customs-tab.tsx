"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { LogisticsDashboardData } from "@/components/logistics/types";
import { ALERT_COLORS } from "@/components/logistics/constants";
import {
  addCustomsDocument,
  resolveCustomsIssue,
  updateCustomsDocumentStatus,
} from "@/lib/actions/logistics.actions";

export function CustomsTab({
  data,
  canManage,
}: {
  data: LogisticsDashboardData;
  canManage: boolean;
}) {
  const [customsDialog, setCustomsDialog] = useState<{ open: boolean; shipmentId?: string }>({
    open: false,
  });
  const [docForm, setDocForm] = useState({ name: "", url: "", note: "" });
  const [docFile, setDocFile] = useState<File | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [actionPending, startActionTransition] = useTransition();
  const router = useRouter();
  const activeIssue = data.customsIssues.find(
    (issue) => issue.shipmentId === customsDialog.shipmentId
  );

  const handleAddDoc = () => {
    const shipmentId = customsDialog.shipmentId;
    if (!shipmentId || !docForm.name || !docForm.url) {
      toast.error("Nom et URL requis");
      return;
    }
    startActionTransition(async () => {
      const res = await addCustomsDocument({
        shipmentId,
        name: docForm.name,
        url: docForm.url,
        note: docForm.note,
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("Document ajouté");
        setDocForm({ name: "", url: "", note: "" });
        router.refresh();
      }
    });
  };

  const handleResolveCustoms = () => {
    const shipmentId = customsDialog.shipmentId;
    if (!shipmentId) return;
    startActionTransition(async () => {
      const res = await resolveCustomsIssue({
        shipmentId,
        resolutionNote: resolutionNote || undefined,
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("Dossier dedouane");
        router.refresh();
      }
      setCustomsDialog({ open: false });
      setResolutionNote("");
    });
  };

  const handleUploadDoc = () => {
    const shipmentId = customsDialog.shipmentId;
    if (!shipmentId || !docFile) {
      toast.error("Fichier requis");
      return;
    }
    startActionTransition(async () => {
      const formData = new FormData();
      formData.append("shipmentId", shipmentId);
      formData.append("file", docFile);
      if (docForm.name) formData.append("name", docForm.name);
      if (docForm.note) formData.append("note", docForm.note);

      const res = await fetch("/api/logistics/customs/documents", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error || "Erreur upload");
        return;
      }
      toast.success("Document uploadé");
      setDocFile(null);
      setDocForm({ name: "", url: "", note: "" });
      router.refresh();
    });
  };

  const handleDocStatus = (docId: string, status: "APPROVED" | "REJECTED") => {
    const shipmentId = customsDialog.shipmentId;
    if (!shipmentId) return;
    startActionTransition(async () => {
      const res = await updateCustomsDocumentStatus({
        shipmentId,
        docId,
        status,
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("Document mis a jour");
        router.refresh();
      }
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Dossiers douane
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.customsIssues.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              Aucun dossier en attente
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Pays</TableHead>
                  <TableHead>Raison</TableHead>
                  <TableHead>Jours</TableHead>
                  <TableHead>Priorite</TableHead>
                  <TableHead>Docs</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.customsIssues.map((issue) => (
                  <TableRow key={issue.id}>
                    <TableCell className="font-medium">{issue.orderId}</TableCell>
                    <TableCell>{issue.customerName}</TableCell>
                    <TableCell>{issue.country || "-"}</TableCell>
                    <TableCell>{issue.reason}</TableCell>
                    <TableCell>{issue.daysBlocked}</TableCell>
                    <TableCell>
                      <Badge className={ALERT_COLORS[issue.priority] || ""}>{issue.priority}</Badge>
                    </TableCell>
                    <TableCell>{issue.documentsCount}</TableCell>
                    <TableCell>
                      {canManage && (
                        <Button
                          size="sm"
                          onClick={() =>
                            setCustomsDialog({ open: true, shipmentId: issue.shipmentId })
                          }
                        >
                          Gerer
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={customsDialog.open} onOpenChange={(open) => setCustomsDialog({ open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerer dossier douane</DialogTitle>
            <DialogDescription>Ajouter un document ou marquer le dossier comme dedouane</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {activeIssue && activeIssue.documentsCount > 0 && (
              <div className="rounded-md border p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Documents existants</p>
                {activeIssue.documents.map((doc, idx) => (
                  <div key={`${doc.id || doc.name}-${idx}`} className="space-y-1 border-b pb-2 last:border-b-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <span>{doc.name || `Document ${idx + 1}`}</span>
                      {doc.status && (
                        <Badge className={ALERT_COLORS[doc.status === "APPROVED" ? "LOW" : doc.status === "REJECTED" ? "HIGH" : "MEDIUM"]}>
                          {doc.status}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {(doc.downloadUrl || doc.url) && (
                        <a
                          href={doc.downloadUrl || doc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline"
                        >
                          Ouvrir
                        </a>
                      )}
                      {canManage && doc.id && doc.status !== "APPROVED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDocStatus(doc.id, "APPROVED")}
                        >
                          Valider
                        </Button>
                      )}
                      {canManage && doc.id && doc.status !== "REJECTED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDocStatus(doc.id, "REJECTED")}
                        >
                          Rejeter
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="grid gap-2">
              <Label>Document</Label>
              <Input
                placeholder="Nom document"
                value={docForm.name}
                onChange={(e) => setDocForm((d) => ({ ...d, name: e.target.value }))}
              />
              <Input
                type="file"
                onChange={(e) => setDocFile(e.target.files?.[0] || null)}
              />
              <Button onClick={handleUploadDoc} disabled={actionPending}>
                Uploader fichier
              </Button>
              <p className="text-xs text-muted-foreground">Ou ajoute un lien manuel :</p>
              <Input
                placeholder="URL document"
                value={docForm.url}
                onChange={(e) => setDocForm((d) => ({ ...d, url: e.target.value }))}
              />
              <Input
                placeholder="Note (optionnel)"
                value={docForm.note}
                onChange={(e) => setDocForm((d) => ({ ...d, note: e.target.value }))}
              />
              <Button onClick={handleAddDoc} disabled={actionPending}>
                Ajouter doc
              </Button>
            </div>
            <div className="grid gap-2">
              <Label>Resolution</Label>
              <Input
                placeholder="Note de résolution"
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomsDialog({ open: false })}>
              Annuler
            </Button>
            <Button onClick={handleResolveCustoms} disabled={actionPending}>
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
