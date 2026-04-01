"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Filter,
  Search,
  Users,
  MessageSquare,
  Mail,
  Phone,
  MapPin,
  AlertTriangle,
  Trash2,
  RefreshCw,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { formatDate } from "@/lib/utils";
import {
  createDispute,
  resolveDispute,
  syncShipmentTracking,
  updateShipmentStatus,
} from "@/lib/actions/order.actions";
import {
  createShipmentCostLine,
  createShipmentIncident,
  createShipmentPortalToken,
  recalcShipmentAI,
  removeShipmentCostLine,
  updateShipmentIncident,
} from "@/lib/actions/logistics.actions";
import { LogisticsDashboardData, LogisticsShipment } from "@/components/logistics/types";
import { MODE_LABELS, RISK_COLORS, RISK_RANK, STATUS_COLORS, STATUS_LABELS } from "@/components/logistics/constants";

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

export function ShipmentsTab({
  data,
  canManage,
}: {
  data: LogisticsDashboardData;
  canManage: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [partnerFilter, setPartnerFilter] = useState("all");
  const [trackingFilter, setTrackingFilter] = useState("all");
  const [sortField, setSortField] = useState("orderNumber");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedShipments, setSelectedShipments] = useState<string[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<LogisticsShipment | null>(null);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("IN_TRANSIT");
  const [actionPending, startActionTransition] = useTransition();
  const [costForm, setCostForm] = useState({ type: "", amount: "", currency: "USD", notes: "" });
  const [incidentForm, setIncidentForm] = useState({
    type: "",
    severity: "MEDIUM",
    description: "",
    amount: "",
    currency: "USD",
  });
  const [disputeForm, setDisputeForm] = useState({
    type: "DELAY",
    description: "",
    amount: "",
    currency: "XAF",
  });
  const [resolveDisputeId, setResolveDisputeId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const router = useRouter();

  const shipments = data.shipments || [];
  const selectedCostTotal = selectedShipment?.costLines
    ? selectedShipment.costLines.reduce((sum, l) => sum + l.amount, 0)
    : 0;

  const partnerOptions = useMemo(() => {
    return Array.from(new Set(shipments.map((s) => s.freightPartner).filter(Boolean))).sort();
  }, [shipments]);

  const filteredShipments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = shipments.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (modeFilter !== "all" && s.mode !== modeFilter) return false;
      if (riskFilter !== "all" && s.riskLevel !== riskFilter) return false;
      if (partnerFilter !== "all" && s.freightPartner !== partnerFilter) return false;
      if (trackingFilter === "live" && !(s.trackingProvider && s.trackingNumber)) return false;
      if (trackingFilter === "missing" && s.trackingProvider && s.trackingNumber) return false;
      if (!query) return true;
      const haystack = [
        s.orderNumber,
        s.customerName,
        s.trackingNumber || "",
        s.freightPartner || "",
        s.origin || "",
        s.destination || "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });

    const sorted = [...filtered].sort((a, b) => {
      let result = 0;
      switch (sortField) {
        case "customerName":
          result = a.customerName.localeCompare(b.customerName);
          break;
        case "status":
          result = a.status.localeCompare(b.status);
          break;
        case "daysInStatus":
          result = a.daysInStatus - b.daysInStatus;
          break;
        case "cost":
          result = (a.cost || 0) - (b.cost || 0);
          break;
        case "margin":
          result = (a.marginPercent || 0) - (b.marginPercent || 0);
          break;
        case "riskLevel":
          result = (RISK_RANK[a.riskLevel] || 0) - (RISK_RANK[b.riskLevel] || 0);
          break;
        default:
          result = a.orderNumber.localeCompare(b.orderNumber);
      }
      return sortDirection === "asc" ? result : -result;
    });

    return sorted;
  }, [
    shipments,
    searchQuery,
    statusFilter,
    modeFilter,
    riskFilter,
    partnerFilter,
    trackingFilter,
    sortField,
    sortDirection,
  ]);

  const allVisibleSelected =
    filteredShipments.length > 0 &&
    filteredShipments.every((s) => selectedShipments.includes(s.id));

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedShipments(filteredShipments.map((s) => s.id));
    } else {
      setSelectedShipments([]);
    }
  };

  const toggleSelect = (shipmentId: string, checked: boolean) => {
    setSelectedShipments((prev) =>
      checked ? [...prev, shipmentId] : prev.filter((id) => id !== shipmentId)
    );
  };

  const handleBulkUpdate = () => {
    if (selectedShipments.length === 0) return;
    startActionTransition(async () => {
      const results = await Promise.all(
        selectedShipments.map((id) => updateShipmentStatus(id, bulkStatus))
      );
      const hasError = results.some((r) => r.error);
      if (hasError) toast.error("Erreur mise a jour");
      else toast.success("Statuts mis a jour");
      setBulkDialogOpen(false);
      router.refresh();
    });
  };

  const handleSingleStatus = (shipmentId: string, status: string) => {
    startActionTransition(async () => {
      const res = await updateShipmentStatus(shipmentId, status);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Statut mis a jour");
        router.refresh();
      }
    });
  };

  const handleRecalcAI = (shipmentId: string) => {
    startActionTransition(async () => {
      const res = await recalcShipmentAI(shipmentId);
      if (res.error) toast.error(res.error);
      else {
        toast.success("AI recalculee");
        router.refresh();
      }
    });
  };

  const handleSyncTracking = (shipmentId: string) => {
    startActionTransition(async () => {
      const res = await syncShipmentTracking(shipmentId);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Tracking mis a jour");
        router.refresh();
      }
    });
  };

  const handleAddCostLine = (shipmentId: string) => {
    if (!costForm.type || !costForm.amount) {
      toast.error("Type et montant requis");
      return;
    }
    startActionTransition(async () => {
      const res = await createShipmentCostLine({
        shipmentId,
        type: costForm.type,
        amount: costForm.amount,
        currency: costForm.currency,
        notes: costForm.notes,
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("Cout ajoute");
        setCostForm({ type: "", amount: "", currency: "USD", notes: "" });
        router.refresh();
      }
    });
  };

  const handleRemoveCostLine = (lineId: string) => {
    startActionTransition(async () => {
      const res = await removeShipmentCostLine(lineId);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Cout supprime");
        router.refresh();
      }
    });
  };

  const handleAddIncident = (shipmentId: string) => {
    if (!incidentForm.type || !incidentForm.description) {
      toast.error("Type et description requis");
      return;
    }
    startActionTransition(async () => {
      const res = await createShipmentIncident({
        shipmentId,
        type: incidentForm.type,
        severity: incidentForm.severity,
        description: incidentForm.description,
        amount: incidentForm.amount || undefined,
        currency: incidentForm.currency,
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("Incident cree");
        setIncidentForm({ type: "", severity: "MEDIUM", description: "", amount: "", currency: "USD" });
        router.refresh();
      }
    });
  };

  const handleResolveIncident = (incidentId: string) => {
    startActionTransition(async () => {
      const res = await updateShipmentIncident(incidentId, { status: "RESOLVED" });
      if (res.error) toast.error(res.error);
      else {
        toast.success("Incident resolu");
        router.refresh();
      }
    });
  };

  const handleAddDispute = (orderId: string) => {
    if (!disputeForm.type || !disputeForm.description) {
      toast.error("Type et description requis");
      return;
    }
    startActionTransition(async () => {
      const parsedAmount = disputeForm.amount ? Number(disputeForm.amount) : undefined;
      const safeAmount = parsedAmount !== undefined && Number.isFinite(parsedAmount) ? parsedAmount : undefined;
      const res = await createDispute(orderId, {
        type: disputeForm.type,
        description: disputeForm.description,
        amount: safeAmount,
        currency: disputeForm.currency,
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("Litige cree");
        setDisputeForm({ type: "DELAY", description: "", amount: "", currency: "XAF" });
        router.refresh();
      }
    });
  };

  const handleResolveDispute = () => {
    if (!resolveDisputeId) return;
    startActionTransition(async () => {
      const res = await resolveDispute(resolveDisputeId, resolveNote || "Resolution");
      if (res.error) toast.error(res.error);
      else {
        toast.success("Litige resolu");
        setResolveDisputeId(null);
        setResolveNote("");
        router.refresh();
      }
    });
  };

  const handleCreatePortal = (shipmentId: string, role: "CLIENT" | "CARRIER") => {
    startActionTransition(async () => {
      const res = await createShipmentPortalToken(shipmentId, role);
      if (res.error || !res.data) {
        toast.error(res.error || "Erreur lien portal");
        return;
      }
      const url = res.data.url;
      await navigator.clipboard.writeText(url);
      toast.success("Lien copie dans le presse-papier");
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-600" />
            Expeditions
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                className="pl-8 h-9 w-56"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-36">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {Object.keys(STATUS_LABELS).map((status) => (
                  <SelectItem key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={modeFilter} onValueChange={setModeFilter}>
              <SelectTrigger className="h-9 w-32">
                <SelectValue placeholder="Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {Object.keys(data.modeCounts || {}).map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {MODE_LABELS[mode] || mode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="h-9 w-28">
                <SelectValue placeholder="Risque" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
              </SelectContent>
            </Select>
            <Select value={partnerFilter} onValueChange={setPartnerFilter}>
              <SelectTrigger className="h-9 w-40">
                <SelectValue placeholder="Partenaire" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {partnerOptions.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={trackingFilter} onValueChange={setTrackingFilter}>
              <SelectTrigger className="h-9 w-32">
                <SelectValue placeholder="Tracking" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="live">Live</SelectItem>
                <SelectItem value="missing">Manuel</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortField} onValueChange={setSortField}>
              <SelectTrigger className="h-9 w-40">
                <SelectValue placeholder="Tri" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="orderNumber">Order</SelectItem>
                <SelectItem value="customerName">Client</SelectItem>
                <SelectItem value="status">Statut</SelectItem>
                <SelectItem value="daysInStatus">Jours</SelectItem>
                <SelectItem value="cost">Cout</SelectItem>
                <SelectItem value="margin">Marge</SelectItem>
                <SelectItem value="riskLevel">Risque</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
            >
              <Filter className="mr-2 h-4 w-4" />
              {sortDirection === "asc" ? "Asc" : "Desc"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filteredShipments.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              Aucune expedition trouvee
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={(checked) => toggleSelectAll(Boolean(checked))}
                  />
                  <span className="text-xs text-muted-foreground">
                    {selectedShipments.length} selection(s)
                  </span>
                </div>
                {canManage && selectedShipments.length > 0 && (
                  <Button size="sm" onClick={() => setBulkDialogOpen(true)}>
                    Mettre a jour
                  </Button>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Mode</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Risque</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Tracking</TableHead>
                  <TableHead>ETA</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Cout</TableHead>
                  <TableHead></TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredShipments.map((ship) => (
                    <TableRow key={ship.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedShipments.includes(ship.id)}
                          onCheckedChange={(checked) => toggleSelect(ship.id, Boolean(checked))}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{ship.orderNumber}</TableCell>
                      <TableCell>{ship.customerName}</TableCell>
                      <TableCell>{MODE_LABELS[ship.mode] || ship.mode}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[ship.status] || ""}>
                          {STATUS_LABELS[ship.status] || ship.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={RISK_COLORS[ship.riskLevel]}>{ship.riskLevel}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate">
                        {ship.origin || "-"} {"->"} {ship.destination || "-"}
                      </TableCell>
                      <TableCell>
                        {ship.trackingProvider ? (
                          <div className="text-xs">
                            <div className="font-medium">{ship.trackingProvider}</div>
                            <div className="text-muted-foreground">{ship.trackingStatus || "OK"}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Manual</span>
                        )}
                      </TableCell>
                      <TableCell>{formatDateSafe(ship.aiInsight?.predictedArrival || ship.estimatedArrival)}</TableCell>
                      <TableCell>
                        {ship.daysLate && ship.daysLate > 0 ? (
                          <Badge className="bg-red-100 text-red-700">
                            {ship.daysLate}j retard
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">OK</span>
                        )}
                      </TableCell>
                      <TableCell>{formatNumber(ship.cost || 0, 0)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => setSelectedShipment(ship)}>
                            Voir
                          </Button>
                          <Button size="sm" variant="ghost" asChild>
                            <Link href={`/logistics/shipments/${ship.id}`}>Dossier</Link>
                          </Button>
                          {canManage && (
                            <Select
                              value={ship.status}
                              onValueChange={(value) => handleSingleStatus(ship.id, value)}
                            >
                              <SelectTrigger className="h-7 w-28 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.keys(STATUS_LABELS).map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {STATUS_LABELS[status]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mettre a jour statut</DialogTitle>
            <DialogDescription>
              {selectedShipments.length} shipment(s) selectionnes
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Nouveau statut</Label>
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(STATUS_LABELS).map((status) => (
                  <SelectItem key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleBulkUpdate} disabled={actionPending}>
              Mettre a jour
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(resolveDisputeId)}
        onOpenChange={(open) => {
          if (!open) {
            setResolveDisputeId(null);
            setResolveNote("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resoudre litige</DialogTitle>
            <DialogDescription>Ajoutez une note de resolution</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Resolution</Label>
            <Textarea
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              placeholder="Ex: Compensation accordee, dossier clos..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDisputeId(null)}>
              Annuler
            </Button>
            <Button onClick={handleResolveDispute} disabled={actionPending}>
              Resoudre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={Boolean(selectedShipment)} onOpenChange={() => setSelectedShipment(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedShipment && (
            <div className="space-y-6">
              <SheetHeader>
                <SheetTitle>Shipment {selectedShipment.orderNumber}</SheetTitle>
              </SheetHeader>

              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Client</p>
                      <p className="font-medium">{selectedShipment.customerName}</p>
                    </div>
                    <Badge className={STATUS_COLORS[selectedShipment.status] || ""}>
                      {STATUS_LABELS[selectedShipment.status] || selectedShipment.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Partenaire</p>
                      <p className="font-medium">{selectedShipment.freightPartner || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Tracking</p>
                      <p className="font-medium">{selectedShipment.trackingNumber || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Route</p>
                      <p className="font-medium">
                        {selectedShipment.origin || "-"} {"->"} {selectedShipment.destination || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">ETA</p>
                      <p className="font-medium">{formatDateSafe(selectedShipment.estimatedArrival)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <p className="text-sm text-muted-foreground">Poids</p>
                    <p className="text-lg font-semibold">
                      {selectedShipment.weight ? formatNumber(selectedShipment.weight, 1) : "-"} kg
                    </p>
                    <p className="text-sm text-muted-foreground">Volume</p>
                    <p className="text-lg font-semibold">
                      {selectedShipment.volume ? formatNumber(selectedShipment.volume, 2) : "-"} cbm
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <p className="text-sm text-muted-foreground">Cout</p>
                    <p className="text-lg font-semibold">{formatNumber(selectedShipment.cost, 0)}</p>
                    <p className="text-sm text-muted-foreground">Marge</p>
                    <div className="flex items-center gap-2">
                      <Progress value={Math.min(100, selectedShipment.marginPercent)} className="h-2" />
                      <span className="text-sm font-medium">{formatNumber(selectedShipment.marginPercent, 0)}%</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Wifi className="h-4 w-4" />
                    Live tracking
                  </CardTitle>
                  {canManage && selectedShipment.trackingProvider && selectedShipment.trackingNumber && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSyncTracking(selectedShipment.id)}
                    >
                      <RefreshCw className="mr-2 h-3 w-3" />
                      Sync
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Provider</span>
                    <span className="font-medium text-foreground">
                      {selectedShipment.trackingProvider || "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Numero</span>
                    <span className="font-medium text-foreground">
                      {selectedShipment.trackingNumber || "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Statut</span>
                    <span className="font-medium text-foreground">
                      {selectedShipment.trackingStatus || "Manual"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Dernier sync</span>
                    <span className="font-medium text-foreground">
                      {formatDateSafe(selectedShipment.lastTrackingSyncAt)}
                    </span>
                  </div>
                  {selectedShipment.trackingUrl && (
                    <a
                      href={selectedShipment.trackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline text-xs"
                    >
                      Ouvrir tracking
                    </a>
                  )}
                  {!selectedShipment.trackingProvider || !selectedShipment.trackingNumber ? (
                    <p className="text-xs text-muted-foreground">
                      Tracking non connecte: ajoute un provider + numero.
                    </p>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MapPin className="h-4 w-4" />
                    Tracking timeline
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {selectedShipment.trackingEvents.length === 0 && (
                    <p className="text-sm text-muted-foreground">Aucun evenement de tracking</p>
                  )}
                  {selectedShipment.trackingEvents
                    .slice()
                    .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())
                    .map((event) => (
                      <div key={event.id} className="flex items-start gap-3">
                        <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{event.event}</p>
                          <p className="text-xs text-muted-foreground">
                            {event.location || "-"} - {formatDateSafe(event.occurredAt)}
                          </p>
                          {event.description && (
                            <p className="text-xs text-muted-foreground">{event.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Wifi className="h-4 w-4" />
                    Shipment workflow
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Tracking freshness</span>
                    <Badge variant="outline">
                      {selectedShipment.workflow?.trackingFreshness || "MISSING"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Shipment health</span>
                    <Badge variant="outline">
                      {selectedShipment.workflow?.shipmentHealth || "WATCH"}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Prochaine action</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedShipment.workflow?.nextAction || "Aucune action consolidee disponible."}
                    </p>
                  </div>
                  {selectedShipment.workflow?.blockers && selectedShipment.workflow.blockers.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Blocages actifs</p>
                      <ul className="list-disc list-inside text-sm text-muted-foreground">
                        {selectedShipment.workflow.blockers.map((blocker) => (
                          <li key={blocker}>{blocker}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucun gate bloquant sur la prochaine transition.</p>
                  )}
                  <div className="space-y-1 rounded-md border p-3">
                    <p className="text-sm font-medium">Responsabilite active</p>
                    <p className="text-sm text-muted-foreground">
                      Principal: {selectedShipment.workflow?.responsibility?.primaryOwner?.name || "Non defini"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Backup: {selectedShipment.workflow?.responsibility?.backupOwner?.name || "Non defini"} | Manager:{" "}
                      {selectedShipment.workflow?.responsibility?.managerOwner?.name || "Non defini"}
                    </p>
                    {selectedShipment.workflow?.responsibility?.assignmentReason ? (
                      <p className="text-xs text-muted-foreground">
                        {selectedShipment.workflow.responsibility.assignmentReason}
                      </p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-4 w-4" />
                    Risk analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Niveau</span>
                    <Badge className={RISK_COLORS[selectedShipment.riskLevel] || ""}>
                      {selectedShipment.riskLevel}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>SLA</span>
                    <span>
                      {selectedShipment.daysLate && selectedShipment.daysLate > 0
                        ? `${selectedShipment.daysLate}j retard`
                        : "OK"}
                    </span>
                  </div>
                  {selectedShipment.riskReasons.length > 0 ? (
                    <ul className="text-sm text-muted-foreground list-disc list-inside">
                      {selectedShipment.riskReasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucun signal fort</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-4 w-4" />
                    AI predictive
                  </CardTitle>
                  {canManage && (
                    <Button size="sm" variant="outline" onClick={() => handleRecalcAI(selectedShipment.id)}>
                      Recalculer
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>ETA predicted</span>
                    <span>{selectedShipment.aiInsight?.predictedArrival ? formatDateSafe(selectedShipment.aiInsight.predictedArrival) : "-"}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Delay predicted</span>
                    <span>{selectedShipment.aiInsight?.predictedDelayDays ?? 0}j</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Risk score</span>
                    <span>{selectedShipment.aiInsight?.riskScore ?? 0}/100</span>
                  </div>
                  {selectedShipment.aiInsight?.calculatedAt && (
                    <p className="text-xs text-muted-foreground">
                      Calcule le {formatDateSafe(selectedShipment.aiInsight.calculatedAt)}
                    </p>
                  )}
                  {selectedShipment.aiInsight?.factors && selectedShipment.aiInsight.factors.length > 0 && (
                    <ul className="text-xs text-muted-foreground list-disc list-inside">
                      {selectedShipment.aiInsight.factors.map((factor, idx) => (
                        <li key={`${factor}-${idx}`}>{factor}</li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-4 w-4" />
                    Cost breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedShipment.costLines && selectedShipment.costLines.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div className="rounded-md border p-2">
                        <p>Total detail</p>
                        <p className="text-base font-semibold text-foreground">
                          {formatNumber(selectedCostTotal, 2)}{" "}
                          {selectedShipment.costLines[0]?.currency || "USD"}
                        </p>
                      </div>
                      <div className="rounded-md border p-2">
                        <p>Delta vs cout</p>
                        <p className="text-base font-semibold text-foreground">
                          {formatNumber(selectedCostTotal - (selectedShipment.cost || 0), 2)}
                        </p>
                      </div>
                      <div className="rounded-md border p-2">
                        <p>Cost / kg</p>
                        <p className="text-base font-semibold text-foreground">
                          {selectedShipment.weight
                            ? formatNumber(selectedCostTotal / Math.max(1, selectedShipment.weight), 2)
                            : "-"}
                        </p>
                      </div>
                      <div className="rounded-md border p-2">
                        <p>Cost / cbm</p>
                        <p className="text-base font-semibold text-foreground">
                          {selectedShipment.volume
                            ? formatNumber(selectedCostTotal / Math.max(1, selectedShipment.volume), 2)
                            : "-"}
                        </p>
                      </div>
                    </div>
                  )}
                  {selectedShipment.costLines && selectedShipment.costLines.length > 0 ? (
                    <div className="space-y-2">
                      {selectedShipment.costLines.map((line) => (
                        <div key={line.id} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{line.type}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {formatNumber(line.amount, 2)} {line.currency}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {selectedCostTotal > 0 ? formatNumber((line.amount / selectedCostTotal) * 100, 0) : 0}%
                            </span>
                            {canManage && (
                              <Button size="icon" variant="ghost" onClick={() => handleRemoveCostLine(line.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucun cout detaille</p>
                  )}
                  {canManage && (
                    <div className="grid gap-2 pt-2 border-t">
                      <Label>Ajouter un cout</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Type (freight, duty, insurance...)"
                          value={costForm.type}
                          onChange={(e) => setCostForm((c) => ({ ...c, type: e.target.value }))}
                        />
                        <Input
                          type="number"
                          placeholder="Montant"
                          value={costForm.amount}
                          onChange={(e) => setCostForm((c) => ({ ...c, amount: e.target.value }))}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Devise"
                          value={costForm.currency}
                          onChange={(e) => setCostForm((c) => ({ ...c, currency: e.target.value }))}
                        />
                        <Input
                          placeholder="Notes"
                          value={costForm.notes}
                          onChange={(e) => setCostForm((c) => ({ ...c, notes: e.target.value }))}
                        />
                      </div>
                      <Button size="sm" onClick={() => handleAddCostLine(selectedShipment.id)}>
                        Ajouter
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-4 w-4" />
                    Incidents
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedShipment.incidents && selectedShipment.incidents.length > 0 ? (
                    <div className="space-y-2">
                      {selectedShipment.incidents.map((inc) => (
                        <div key={inc.id} className="rounded-md border p-2 text-sm space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{inc.type}</span>
                            <Badge className={RISK_COLORS[inc.severity] || ""}>{inc.severity}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{inc.description}</p>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{inc.status}</span>
                            {canManage && inc.status !== "RESOLVED" && (
                              <Button size="sm" variant="outline" onClick={() => handleResolveIncident(inc.id)}>
                                Resoudre
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucun incident</p>
                  )}
                  {canManage && (
                    <div className="grid gap-2 pt-2 border-t">
                      <Label>Nouvel incident</Label>
                      <Input
                        placeholder="Type"
                        value={incidentForm.type}
                        onChange={(e) => setIncidentForm((i) => ({ ...i, type: e.target.value }))}
                      />
                      <Input
                        placeholder="Description"
                        value={incidentForm.description}
                        onChange={(e) => setIncidentForm((i) => ({ ...i, description: e.target.value }))}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Select
                          value={incidentForm.severity}
                          onValueChange={(value) => setIncidentForm((i) => ({ ...i, severity: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Severite" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="LOW">LOW</SelectItem>
                            <SelectItem value="MEDIUM">MEDIUM</SelectItem>
                            <SelectItem value="HIGH">HIGH</SelectItem>
                            <SelectItem value="CRITICAL">CRITICAL</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="Montant"
                          value={incidentForm.amount}
                          onChange={(e) => setIncidentForm((i) => ({ ...i, amount: e.target.value }))}
                        />
                      </div>
                      <Input
                        placeholder="Devise"
                        value={incidentForm.currency}
                        onChange={(e) => setIncidentForm((i) => ({ ...i, currency: e.target.value }))}
                      />
                      <Button size="sm" onClick={() => handleAddIncident(selectedShipment.id)}>
                        Ajouter incident
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-4 w-4" />
                    Litiges
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedShipment.disputes && selectedShipment.disputes.length > 0 ? (
                    <div className="space-y-2">
                      {selectedShipment.disputes.map((d) => (
                        <div key={d.id} className="rounded-md border p-2 text-sm space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{d.type}</span>
                            <Badge
                              className={
                                d.status === "RESOLVED"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-amber-100 text-amber-700"
                              }
                            >
                              {d.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{d.description}</p>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{d.amount ? `${formatNumber(d.amount, 2)} ${d.currency || ""}` : "-"}</span>
                            {canManage && d.status !== "RESOLVED" && (
                              <Button size="sm" variant="outline" onClick={() => setResolveDisputeId(d.id)}>
                                Resoudre
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucun litige</p>
                  )}
                  {canManage && (
                    <div className="grid gap-2 pt-2 border-t">
                      <Label>Nouveau litige</Label>
                      <Select
                        value={disputeForm.type}
                        onValueChange={(value) => setDisputeForm((d) => ({ ...d, type: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="QUALITY">QUALITY</SelectItem>
                          <SelectItem value="DELAY">DELAY</SelectItem>
                          <SelectItem value="PRICING">PRICING</SelectItem>
                          <SelectItem value="MISSING_ITEMS">MISSING_ITEMS</SelectItem>
                          <SelectItem value="DAMAGE">DAMAGE</SelectItem>
                          <SelectItem value="OTHER">OTHER</SelectItem>
                        </SelectContent>
                      </Select>
                      <Textarea
                        placeholder="Description"
                        value={disputeForm.description}
                        onChange={(e) => setDisputeForm((d) => ({ ...d, description: e.target.value }))}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          placeholder="Montant"
                          value={disputeForm.amount}
                          onChange={(e) => setDisputeForm((d) => ({ ...d, amount: e.target.value }))}
                        />
                        <Input
                          placeholder="Devise"
                          value={disputeForm.currency}
                          onChange={(e) => setDisputeForm((d) => ({ ...d, currency: e.target.value }))}
                        />
                      </div>
                      <Button size="sm" onClick={() => handleAddDispute(selectedShipment.orderId)}>
                        Ajouter litige
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-4 w-4" />
                    Portails
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-2">
                  {canManage && (
                    <>
                      <Button variant="outline" onClick={() => handleCreatePortal(selectedShipment.id, "CLIENT")}>
                        Lien client
                      </Button>
                      <Button variant="outline" onClick={() => handleCreatePortal(selectedShipment.id, "CARRIER")}>
                        Lien transporteur
                      </Button>
                    </>
                  )}
                  {!canManage && (
                    <p className="text-sm text-muted-foreground">Acces restreint</p>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={() => toast.success("Ouverture WhatsApp")}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  WhatsApp
                </Button>
                <Button
                  variant="outline"
                  onClick={() => toast.success("Email client préparé")}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
                <Button
                  variant="outline"
                  onClick={() => toast.success("Appel client")}
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Appeler
                </Button>
                <Button
                  variant="outline"
                  onClick={() => toast.success("Contact partenaire")}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Partenaire
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
