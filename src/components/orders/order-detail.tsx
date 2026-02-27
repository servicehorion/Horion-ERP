"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge, PriorityBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { OrderTimeline } from "./order-timeline";
import { updateOrderStatus, duplicateOrder, archiveOrder } from "@/lib/actions/order.actions";
import { ORDER_STATUS_LABELS, ORDER_STATUS_TRANSITIONS } from "@/config/order-statuses";
import { formatDate } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { OrderQuotes } from "@/components/orders/order-quotes";
import { OrderPayments } from "@/components/orders/order-payments";
import { OrderAttachments } from "@/components/orders/order-attachments";
import { OrderTeam } from "@/components/orders/order-team";
import { OrderShipments, type Shipment } from "@/components/orders/order-shipments";
import { OrderQc, type QcRequest } from "@/components/orders/order-qc";
import { OrderDisputes, type Dispute } from "@/components/orders/order-disputes";

type SourcingCase = {
  id: string;
  status: string;
  requirement: string;
  budget?: any;
  currency: string;
  createdAt: Date;
  supplier?: { id: string; name: string; country: string } | null;
  offers: { id: string; unitPrice: any; currency: string; isSelected: boolean; moq?: number | null; leadTimeDays?: number | null }[];
};

type MarginReport = {
  revenue: any;
  cogs: any;
  commission: any;
  grossMargin: any;
  marginPercent: any;
  currency: string;
  calculatedAt: Date;
};

type OrderDetailProps = {
  order: {
    id: string;
    orderNumber: string;
    status: string;
    priority: string;
    riskLevel?: string;
    originCountry?: string;
    destinationCity: string;
    notes: string | null;
    merchandiseTotal?: any;
    logisticsCost?: any;
    commissionRate?: any;
    commissionAmount?: any;
    insuranceAmount?: any;
    totalClient: any;
    estimatedDelivery?: Date | null;
    actualDelivery?: Date | null;
    createdAt: Date;
    contact: {
      name: string;
      email: string | null;
      phone: string | null;
    };
    items: {
      id: string;
      description: string;
      quantity: number;
      unitPrice: any;
      currency: string;
      totalXAF: any;
    }[];
    timeline: {
      id: string;
      event: string;
      fromValue: string | null;
      toValue: string | null;
      note: string | null;
      userId: string | null;
      createdAt: Date;
    }[];
    tasks: {
      id: string;
      title: string;
      status: string;
      slaDeadline: Date | null;
      assignments: { user: { name: string } }[];
    }[];
    quotes: {
      id: string;
      version: number;
      status: string;
      merchandiseTotal: any;
      logisticsCost: any;
      commission: any;
      insuranceCost: any;
      total: any;
      currency: string;
      validUntil?: Date | null;
      sentAt?: Date | null;
      acceptedAt?: Date | null;
      createdAt: Date;
    }[];
    attachments: {
      id: string;
      name: string;
      url: string;
      type: string;
      createdAt: Date;
      user?: { name: string | null } | null;
    }[];
    payments: {
      id: string;
      direction: "INBOUND" | "OUTBOUND";
      type: string;
      status: string;
      amount: any;
      amountXAF: any;
      currency: string;
      method?: string | null;
      reference?: string | null;
      dueAt?: Date | null;
      createdAt: Date;
    }[];
    owner?: { id: string; name: string | null; email: string } | null;
    onboardedBy?: { id: string; name: string | null; email: string } | null;
    collaborators: { userId: string; user: { name: string | null; email: string } }[];
    shipments?: Shipment[];
    qcRequests?: QcRequest[];
    disputes?: Dispute[];
    sourcingCases?: SourcingCase[];
    marginReport?: MarginReport | null;
  };
  canUpdateStatus?: boolean;
  canEdit?: boolean;
  canArchive?: boolean;
  canCreateQuote?: boolean;
  canSendQuote?: boolean;
  canViewPayments?: boolean;
  canCreatePayment?: boolean;
  canManageLogistics?: boolean;
  canManageQc?: boolean;
  teamMembers?: { id: string; name: string | null; email: string; role: string }[];
};

function buildAllowedStatuses(current: string) {
  const transitions = (ORDER_STATUS_TRANSITIONS as Record<string, string[]>)[current] || [];
  return Array.from(new Set([current, ...transitions]));
}

export function OrderDetail({
  order,
  canUpdateStatus = false,
  canEdit = false,
  canArchive = false,
  canCreateQuote = false,
  canSendQuote = false,
  canViewPayments = false,
  canCreatePayment = false,
  canManageLogistics = false,
  canManageQc = false,
  teamMembers = [],
}: OrderDetailProps) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(order.status);
  const allowedStatuses = buildAllowedStatuses(order.status);

  async function handleStatusChange(newStatus: string) {
    if (newStatus === order.status) return;

    setIsUpdating(true);
    try {
      const result = await updateOrderStatus(order.id, newStatus);

      if (result.error) {
        toast.error(result.error);
        setSelectedStatus(order.status);
        return;
      }

      toast.success("Statut mis à jour");
      router.refresh();
    } catch (error) {
      toast.error("Une erreur est survenue");
      setSelectedStatus(order.status);
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleDuplicate() {
    setIsDuplicating(true);
    try {
      const result = await duplicateOrder(order.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Commande dupliquée");
      router.push(`/orders/${result.data?.id}`);
    } catch (error) {
      toast.error("Une erreur est survenue");
      console.error(error);
    } finally {
      setIsDuplicating(false);
    }
  }

  async function handleArchive() {
    setIsArchiving(true);
    try {
      const result = await archiveOrder(order.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Commande archivée");
      router.push("/orders");
    } catch (error) {
      toast.error("Une erreur est survenue");
      console.error(error);
    } finally {
      setIsArchiving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">{order.orderNumber}</h1>
          <p className="text-muted-foreground">
            Créée le {formatDate(order.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={order.status} />
          <PriorityBadge priority={order.priority} />
          {canEdit && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/orders/${order.id}/edit`}>Modifier</Link>
            </Button>
          )}
          {canEdit && (
            <Button variant="outline" size="sm" onClick={handleDuplicate} disabled={isDuplicating}>
              {isDuplicating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Dupliquer
            </Button>
          )}
          {canArchive && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={isArchiving}>
                  Archiver
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archiver la commande</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action masque la commande des listes actives. Vous pourrez la restaurer plus tard.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={handleArchive} disabled={isArchiving}>
                    Confirmer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Status change */}
      {canUpdateStatus && (
        <Card>
          <CardHeader>
            <CardTitle>Changer le statut</CardTitle>
            <CardDescription>
              Mettre à jour l'état de la commande
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Select
                value={selectedStatus}
                onValueChange={setSelectedStatus}
                disabled={isUpdating}
              >
                <SelectTrigger className="w-[280px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allowedStatuses.map((value) => (
                    <SelectItem key={value} value={value}>
                      {ORDER_STATUS_LABELS[value as keyof typeof ORDER_STATUS_LABELS] ?? value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => handleStatusChange(selectedStatus)}
                disabled={isUpdating || selectedStatus === order.status}
              >
                {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Mettre à jour
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="resume" className="space-y-6">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="resume">Résumé</TabsTrigger>
          <TabsTrigger value="items">Articles ({order.items.length})</TabsTrigger>
          <TabsTrigger value="sourcing">Sourcing ({(order.sourcingCases ?? []).length})</TabsTrigger>
          <TabsTrigger value="quotes">Devis ({order.quotes.length})</TabsTrigger>
          <TabsTrigger value="payments">Paiements ({order.payments.length})</TabsTrigger>
          <TabsTrigger value="shipments">
            Expéditions ({(order.shipments ?? []).length})
          </TabsTrigger>
          <TabsTrigger value="qc">
            QC ({(order.qcRequests ?? []).length})
          </TabsTrigger>
          <TabsTrigger value="disputes">
            {(order.disputes ?? []).filter((d) => !["RESOLVED","CLOSED"].includes(d.status)).length > 0 && (
              <span className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-bold">
                {(order.disputes ?? []).filter((d) => !["RESOLVED","CLOSED"].includes(d.status)).length}
              </span>
            )}
            Litiges ({(order.disputes ?? []).length})
          </TabsTrigger>
          <TabsTrigger value="documents">Documents ({order.attachments.length})</TabsTrigger>
          <TabsTrigger value="team">Equipe</TabsTrigger>
          <TabsTrigger value="timeline">Timeline ({order.timeline.length})</TabsTrigger>
          <TabsTrigger value="tasks">Tâches ({order.tasks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="resume" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Client */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Client</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <p className="font-medium">{order.contact.name}</p>
                </div>
                {order.contact.email && (
                  <p className="text-muted-foreground">{order.contact.email}</p>
                )}
                {order.contact.phone && (
                  <p className="text-muted-foreground">{order.contact.phone}</p>
                )}
              </CardContent>
            </Card>

            {/* Logistique */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Logistique</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Origine</span>
                  <span className="font-medium">{order.originCountry ?? "CN"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Destination</span>
                  <span className="font-medium">{order.destinationCity}</span>
                </div>
                {order.estimatedDelivery && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Livraison prévue</span>
                    <span className="font-medium">{formatDate(order.estimatedDelivery)}</span>
                  </div>
                )}
                {order.actualDelivery && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Livraison réelle</span>
                    <span className="font-medium text-green-600">{formatDate(order.actualDelivery)}</span>
                  </div>
                )}
                {order.riskLevel && order.riskLevel !== "LOW" && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Niveau de risque</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      order.riskLevel === "CRITICAL" ? "bg-red-100 text-red-700" :
                      order.riskLevel === "HIGH" ? "bg-orange-100 text-orange-700" :
                      "bg-yellow-100 text-yellow-700"
                    }`}>{order.riskLevel}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Finances */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Détail financier</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                {order.merchandiseTotal != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Marchandises</span>
                    <CurrencyDisplay amount={Number(order.merchandiseTotal)} currency="XAF" />
                  </div>
                )}
                {order.logisticsCost != null && Number(order.logisticsCost) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Logistique</span>
                    <CurrencyDisplay amount={Number(order.logisticsCost)} currency="XAF" />
                  </div>
                )}
                {order.commissionAmount != null && Number(order.commissionAmount) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Commission ({order.commissionRate != null ? `${(Number(order.commissionRate) * 100).toFixed(0)}%` : ""})
                    </span>
                    <CurrencyDisplay amount={Number(order.commissionAmount)} currency="XAF" />
                  </div>
                )}
                {order.insuranceAmount != null && Number(order.insuranceAmount) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Assurance</span>
                    <CurrencyDisplay amount={Number(order.insuranceAmount)} currency="XAF" />
                  </div>
                )}
                <div className="flex justify-between border-t pt-1.5 mt-1.5">
                  <span className="font-semibold">Total client</span>
                  <span className="font-bold text-base">
                    <CurrencyDisplay amount={Number(order.totalClient)} currency="XAF" />
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Margin report (if calculated) */}
          {order.marginReport && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Marge opérationnelle</CardTitle>
                <CardDescription className="text-xs">
                  Calculée le {formatDate(order.marginReport.calculatedAt)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Revenus</p>
                    <p className="font-semibold">
                      <CurrencyDisplay amount={Number(order.marginReport.revenue)} currency={order.marginReport.currency} />
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Coût (COGS)</p>
                    <p className="font-semibold">
                      <CurrencyDisplay amount={Number(order.marginReport.cogs)} currency={order.marginReport.currency} />
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Marge brute</p>
                    <p className="font-semibold text-green-600">
                      <CurrencyDisplay amount={Number(order.marginReport.grossMargin)} currency={order.marginReport.currency} />
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Taux marge</p>
                    <p className="font-bold text-lg text-green-600">
                      {Number(order.marginReport.marginPercent).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {order.notes && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{order.notes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="items">
          <Card>
            <CardHeader>
              <CardTitle>Articles commandés</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Quantité</TableHead>
                    <TableHead>Prix unitaire</TableHead>
                    <TableHead>Devise</TableHead>
                    <TableHead className="text-right">Total (XAF)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.description}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>
                        <CurrencyDisplay
                          amount={Number(item.unitPrice)}
                          currency={item.currency}
                        />
                      </TableCell>
                      <TableCell>{item.currency}</TableCell>
                      <TableCell className="text-right">
                        <CurrencyDisplay
                          amount={Number(item.totalXAF)}
                          currency="XAF"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sourcing">
          <Card>
            <CardHeader>
              <CardTitle>Cas de sourcing</CardTitle>
              <CardDescription>Recherche fournisseurs & négociations liées à cette commande</CardDescription>
            </CardHeader>
            <CardContent>
              {(order.sourcingCases ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun cas de sourcing pour le moment.</p>
              ) : (
                <div className="space-y-4">
                  {(order.sourcingCases ?? []).map((sc) => (
                    <div key={sc.id} className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm">{sc.requirement}</p>
                          {sc.supplier && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Fournisseur: {sc.supplier.name} ({sc.supplier.country})
                            </p>
                          )}
                        </div>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                          sc.status === "CONFIRMED" || sc.status === "SELECTED" ? "bg-green-100 text-green-700" :
                          sc.status === "CANCELLED" ? "bg-red-100 text-red-700" :
                          sc.status === "NEGOTIATING" ? "bg-blue-100 text-blue-700" :
                          "bg-gray-100 text-gray-700"
                        }`}>
                          {sc.status.replace("_", " ")}
                        </span>
                      </div>
                      {sc.budget && (
                        <p className="text-xs text-muted-foreground">
                          Budget: <span className="font-medium"><CurrencyDisplay amount={Number(sc.budget)} currency={sc.currency} /></span>
                        </p>
                      )}
                      {sc.offers.length > 0 && (
                        <div>
                          <p className="text-xs font-medium mb-1.5">Offres ({sc.offers.length})</p>
                          <div className="space-y-1">
                            {sc.offers.map((offer) => (
                              <div key={offer.id} className={`flex items-center justify-between text-xs px-2 py-1 rounded ${offer.isSelected ? "bg-green-50 border border-green-200" : "bg-muted/40"}`}>
                                <span>
                                  {offer.isSelected && <span className="mr-1 text-green-600 font-bold">✓</span>}
                                  <CurrencyDisplay amount={Number(offer.unitPrice)} currency={offer.currency} />
                                  {offer.moq && ` · MOQ: ${offer.moq}`}
                                  {offer.leadTimeDays && ` · ${offer.leadTimeDays}j`}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quotes">
          <OrderQuotes
            orderId={order.id}
            quotes={order.quotes}
            defaults={{
              merchandiseTotal: Number(order.merchandiseTotal || 0),
              logisticsCost: Number(order.logisticsCost || 0),
              commission: Number(order.commissionAmount || 0),
              insuranceCost: Number(order.insuranceAmount || 0),
            }}
            canCreate={canCreateQuote}
            canSend={canSendQuote}
          />
        </TabsContent>

        <TabsContent value="payments">
          <OrderPayments
            orderId={order.id}
            totalClient={Number(order.totalClient)}
            payments={order.payments}
            canCreate={canCreatePayment}
            canView={canViewPayments}
          />
        </TabsContent>

        <TabsContent value="shipments">
          <Card>
            <CardHeader>
              <CardTitle>Expéditions &amp; Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderShipments
                orderId={order.id}
                shipments={order.shipments ?? []}
                canManage={canManageLogistics}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="qc">
          <Card>
            <CardHeader>
              <CardTitle>Contrôle Qualité</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderQc
                orderId={order.id}
                qcRequests={order.qcRequests ?? []}
                canManage={canManageQc}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="disputes">
          <Card>
            <CardHeader>
              <CardTitle>Litiges</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderDisputes
                orderId={order.id}
                disputes={order.disputes ?? []}
                canManage={canManageQc || canEdit}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Documents et pièces jointes</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderAttachments orderId={order.id} attachments={order.attachments} canEdit={canEdit} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team">
          <OrderTeam
            orderId={order.id}
            ownerId={order.owner?.id}
            onboardedBy={order.onboardedBy}
            collaborators={order.collaborators || []}
            teamMembers={teamMembers}
            canEdit={canEdit}
          />
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>Historique</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderTimeline entries={order.timeline} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>Tâches liées</CardTitle>
            </CardHeader>
            <CardContent>
              {order.tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune tâche pour le moment</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titre</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Assignée à</TableHead>
                      <TableHead>Échéance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.tasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell className="font-medium">{task.title}</TableCell>
                        <TableCell>
                          <StatusBadge status={task.status} />
                        </TableCell>
                        <TableCell>
                          {task.assignments?.[0]?.user?.name || "Non assignée"}
                        </TableCell>
                        <TableCell>
                          {task.slaDeadline ? formatDate(task.slaDeadline, true) : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}


