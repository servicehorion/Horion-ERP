"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Package } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { LogisticsDashboardData } from "@/components/logistics/types";
import { MODE_LABELS } from "@/components/logistics/constants";
import { assignShipmentsToBatch, createConsolidationBatch } from "@/lib/actions/logistics.actions";
import { formatDate } from "@/lib/utils";

function formatNumber(value: number, digits = 0) {
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatDateSafe(value?: string | Date | null) {
  if (!value) return "-";
  return formatDate(value);
}

export function ConsolidationTab({
  data,
  canManage,
}: {
  data: LogisticsDashboardData;
  canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleCreateBatch = (shipmentsToAssign: LogisticsDashboardData["consolidationSuggestions"][number]["shipments"]) => {
    startTransition(async () => {
      const batchRes = await createConsolidationBatch({ notes: "Auto batch" });
      if (batchRes.error || !batchRes.data) {
        toast.error(batchRes.error || "Erreur creation lot");
        return;
      }
      const assignRes = await assignShipmentsToBatch({
        batchId: batchRes.data.id,
        shipmentIds: shipmentsToAssign.map((s) => s.id),
      });
      if (assignRes.error) toast.error(assignRes.error);
      else {
        toast.success("Lot cree et affecte");
        router.refresh();
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5 text-indigo-600" />
          Consolidation LCL
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          {data.consolidationSuggestions.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
              Pas de suggestions LCL
            </div>
          ) : (
            data.consolidationSuggestions.map((group, idx) => (
              <Card key={`${group.destination}-${idx}`} className="border">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{group.destination}</p>
                      <p className="text-xs text-muted-foreground">
                        {group.shipments.length} shipments - {MODE_LABELS[group.mode] || group.mode}
                      </p>
                    </div>
                    {canManage && (
                      <Button
                        size="sm"
                        disabled={pending}
                        onClick={() => handleCreateBatch(group.shipments)}
                      >
                        Creer lot
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Poids total</span>
                    <span>{formatNumber(group.totalWeight, 1)} kg</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Volume total</span>
                    <span>{formatNumber(group.totalVolume, 2)} cbm</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <Separator />

        <div>
          <h3 className="font-semibold mb-2">Lots en cours</h3>
          {data.consolidationBatches.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
              Aucun lot actif
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Destinations</TableHead>
                  <TableHead>Modes</TableHead>
                  <TableHead>Shipments</TableHead>
                  <TableHead>Maj</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.consolidationBatches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className="font-medium">{batch.batchNumber}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{batch.status}</Badge>
                    </TableCell>
                    <TableCell>{batch.destinations.join(", ") || "-"}</TableCell>
                    <TableCell>{batch.modes.join(", ") || "-"}</TableCell>
                    <TableCell>{batch.shipmentsCount}</TableCell>
                    <TableCell>{formatDateSafe(batch.updatedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
