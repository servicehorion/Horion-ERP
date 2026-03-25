"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { upsertCustomsClearance } from "@/lib/actions/order.actions";
import { ShieldCheck, FileText, AlertCircle } from "lucide-react";

const CUSTOMS_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  DOCUMENTS_SUBMITTED: "Documents soumis",
  UNDER_REVIEW: "En cours d'examen",
  DUTY_ASSESSED: "Droits évalués",
  DUTY_PAID: "Droits payés",
  CLEARED: "Dédouané",
};

const CUSTOMS_STATUS_COLORS: Record<string, string> = {
  PENDING: "secondary",
  DOCUMENTS_SUBMITTED: "outline",
  UNDER_REVIEW: "outline",
  DUTY_ASSESSED: "default",
  DUTY_PAID: "default",
  CLEARED: "default",
};

export type CustomsClearance = {
  id: string;
  shipmentId: string;
  status: string;
  declarationNum?: string | null;
  dutyAmount?: number | null;
  dutyCurrency?: string;
  brokerName?: string | null;
  submittedAt?: string | null;
  clearedAt?: string | null;
};

export type ShipmentWithCustoms = {
  id: string;
  reference?: string | null;
  mode?: string | null;
  status?: string | null;
  customsClearance?: CustomsClearance | null;
};

interface OrderCustomsProps {
  orderId: string;
  shipments: ShipmentWithCustoms[];
  canManage: boolean;
}

interface ClearanceFormProps {
  shipmentId: string;
  orderId: string;
  existing?: CustomsClearance | null;
}

function ClearanceForm({ shipmentId, orderId, existing }: ClearanceFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(existing?.status ?? "PENDING");
  const [declarationNum, setDeclarationNum] = useState(existing?.declarationNum ?? "");
  const [brokerName, setBrokerName] = useState(existing?.brokerName ?? "");
  const [dutyAmount, setDutyAmount] = useState(existing?.dutyAmount?.toString() ?? "");
  const [dutyCurrency, setDutyCurrency] = useState(existing?.dutyCurrency ?? "XAF");

  async function handleSave() {
    setLoading(true);
    const result = await upsertCustomsClearance(shipmentId, {
      status,
      declarationNum: declarationNum || undefined,
      brokerName: brokerName || undefined,
      dutyAmount: dutyAmount ? parseFloat(dutyAmount) : undefined,
      dutyCurrency,
    });
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Dédouanement mis à jour");
      router.refresh();
    }
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Statut</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CUSTOMS_STATUS_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>N° déclaration</Label>
          <Input
            placeholder="D-2025-XXXXX"
            value={declarationNum}
            onChange={(e) => setDeclarationNum(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Transitaire / Broker</Label>
          <Input
            placeholder="Nom du transitaire"
            value={brokerName}
            onChange={(e) => setBrokerName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Droits de douane</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="0"
              value={dutyAmount}
              onChange={(e) => setDutyAmount(e.target.value)}
              className="flex-1"
            />
            <Select value={dutyCurrency} onValueChange={setDutyCurrency}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["XAF", "USD", "EUR", "RMB"].map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <Button onClick={handleSave} disabled={loading} size="sm">
        {loading ? "Sauvegarde..." : "Sauvegarder"}
      </Button>
    </div>
  );
}

export function OrderCustoms({ orderId, shipments, canManage }: OrderCustomsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (shipments.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <FileText className="mx-auto mb-3 h-8 w-8 opacity-40" />
          <p>Aucune expédition — créez une expédition d'abord pour gérer le dédouanement.</p>
        </CardContent>
      </Card>
    );
  }

  const cleared = shipments.filter((s) => s.customsClearance?.status === "CLEARED").length;
  const pending = shipments.filter(
    (s) => !s.customsClearance || s.customsClearance.status === "PENDING"
  ).length;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center gap-4 text-sm">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-green-500" />
          <strong>{cleared}</strong> dédouanée(s)
        </span>
        {pending > 0 && (
          <span className="flex items-center gap-1.5 text-amber-600">
            <AlertCircle className="h-4 w-4" />
            <strong>{pending}</strong> en attente
          </span>
        )}
      </div>

      {shipments.map((shipment) => {
        const clearance = shipment.customsClearance;
        const isExpanded = expandedId === shipment.id;
        const statusLabel =
          clearance ? CUSTOMS_STATUS_LABELS[clearance.status] ?? clearance.status : "Non démarré";

        return (
          <Card key={shipment.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Expédition{shipment.reference ? ` — ${shipment.reference}` : ""}
                  {shipment.mode && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({shipment.mode})
                    </span>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={(clearance ? CUSTOMS_STATUS_COLORS[clearance.status] : "secondary") as any}>
                    {statusLabel}
                  </Badge>
                  {canManage && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setExpandedId(isExpanded ? null : shipment.id)}
                    >
                      {isExpanded ? "Fermer" : clearance ? "Modifier" : "Ouvrir"}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            {clearance && !isExpanded && (
              <CardContent className="grid grid-cols-2 gap-2 text-sm pt-0">
                {clearance.declarationNum && (
                  <div>
                    <span className="text-muted-foreground">N° déclaration :</span>{" "}
                    <span className="font-medium">{clearance.declarationNum}</span>
                  </div>
                )}
                {clearance.brokerName && (
                  <div>
                    <span className="text-muted-foreground">Transitaire :</span>{" "}
                    <span className="font-medium">{clearance.brokerName}</span>
                  </div>
                )}
                {clearance.dutyAmount != null && (
                  <div>
                    <span className="text-muted-foreground">Droits :</span>{" "}
                    <span className="font-medium tabular-nums">
                      {Number(clearance.dutyAmount).toLocaleString("fr-FR")} {clearance.dutyCurrency}
                    </span>
                  </div>
                )}
              </CardContent>
            )}

            {isExpanded && (
              <CardContent className="pt-0">
                <ClearanceForm
                  shipmentId={shipment.id}
                  orderId={orderId}
                  existing={clearance}
                />
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
