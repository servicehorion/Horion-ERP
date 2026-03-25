"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

import {
  approveOrderStep,
  rejectOrderStep,
  refreshOrderApprovals,
} from "@/lib/actions/order.actions";

type Approval = {
  id: string;
  status: string;
  note?: string | null;
  decidedAt?: Date | null;
  rule: { name: string; requiredRole: string; minAmountXAF: any };
  decidedBy?: { name?: string | null; email?: string | null } | null;
};

export function OrderApprovals({
  orderId,
  approvalStatus,
  approvals,
  canApprove,
}: {
  orderId: string;
  approvalStatus?: string | null;
  approvals: Approval[];
  canApprove?: boolean;
}) {
  const router = useRouter();
  const [rejectNote, setRejectNote] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleApprove = (stepId: string) => {
    startTransition(async () => {
      const res = await approveOrderStep(stepId);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Validation enregistrée");
        router.refresh();
      }
    });
  };

  const handleReject = (stepId: string) => {
    startTransition(async () => {
      const res = await rejectOrderStep(stepId, rejectNote || undefined);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Rejet enregistré");
        setRejectingId(null);
        setRejectNote("");
        router.refresh();
      }
    });
  };

  const handleRefresh = () => {
    startTransition(async () => {
      const res = await refreshOrderApprovals(orderId);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Approvals recalculés");
        router.refresh();
      }
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Approvals</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{approvalStatus || "NOT_REQUIRED"}</Badge>
          {canApprove && (
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={pending}>
              Refresh
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {approvals.length === 0 ? (
          <div className="text-sm text-muted-foreground">Aucune validation requise.</div>
        ) : (
          approvals.map((step) => (
            <div key={step.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{step.rule.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Role requis: {step.rule.requiredRole} · Seuil {Number(step.rule.minAmountXAF).toLocaleString("fr-FR")} XAF
                  </p>
                </div>
                <Badge variant={step.status === "APPROVED" ? "default" : step.status === "REJECTED" ? "destructive" : "secondary"}>
                  {step.status}
                </Badge>
              </div>
              {step.decidedBy && (
                <p className="text-xs text-muted-foreground">
                  Décidé par {step.decidedBy.name || step.decidedBy.email}
                </p>
              )}
              {canApprove && step.status === "PENDING" && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => handleApprove(step.id)} disabled={pending}>
                    Approuver
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setRejectingId(step.id)}>
                    Rejeter
                  </Button>
                </div>
              )}
              {rejectingId === step.id && (
                <div className="space-y-2">
                  <Input
                    placeholder="Motif du rejet"
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="destructive" onClick={() => handleReject(step.id)} disabled={pending}>
                      Confirmer rejet
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRejectingId(null)}>
                      Annuler
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
