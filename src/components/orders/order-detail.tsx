"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
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
import { updateOrderStatus, duplicateOrder, archiveOrder, restoreOrder, deleteOrder, calculateMargin } from "@/lib/actions/order.actions";
import { ORDER_STATUS_LABELS, ORDER_STATUS_TRANSITIONS } from "@/config/order-statuses";
import { formatDate } from "@/lib/utils";
import { Loader2, CheckCircle2, AlertCircle, XCircle } from "lucide-react";

// Main linear pipeline steps (LITIGE / ANNULE are side branches)
const PIPELINE_STEPS = [
  "DEMANDE", "RECHERCHE_PRODUIT", "DEVIS", "PAIEMENT_EN_COURS",
  "SOURCING", "EN_PRODUCTION", "RECU_ENTREPOT", "QC_EN_COURS", "QC_VALIDE",
  "EN_TRANSIT", "DEDOUANE", "LIVRE", "CLOTURE",
] as const;

const STEP_SHORT: Record<string, string> = {
  DEMANDE:           "Demande",
  RECHERCHE_PRODUIT: "Recherche",
  DEVIS:             "Devis",
  PAIEMENT_EN_COURS: "Paiement",
  SOURCING:          "Sourcing",
  EN_PRODUCTION:     "Production",
  RECU_ENTREPOT:     "Entrepôt",
  QC_EN_COURS:       "QC",
  QC_VALIDE:         "QC OK",
  EN_TRANSIT:        "Transit",
  DEDOUANE:          "Douane",
  LIVRE:             "Livré",
  CLOTURE:           "Clôturé",
};

function PipelineStepper({ status }: { status: string }) {
  const isSideStatus = status === "LITIGE" || status === "ANNULE";
  const currentIndex = PIPELINE_STEPS.indexOf(status as (typeof PIPELINE_STEPS)[number]);

  return (
    <div className="rounded-lg border bg-muted/30 px-4 py-3">
      {isSideStatus ? (
        <div className={`flex items-center gap-2 text-sm font-medium ${status === "LITIGE" ? "text-orange-600" : "text-red-600"}`}>
          {status === "LITIGE" ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          {status === "LITIGE" ? "Commande en litige" : "Commande annulée"}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex items-center min-w-max gap-0">
            {PIPELINE_STEPS.map((step, i) => {
              const isCompleted = currentIndex > i;
              const isCurrent = currentIndex === i;
              const isLast = i === PIPELINE_STEPS.length - 1;
              return (
                <div key={step} className="flex items-center">
                  {/* Step node */}
                  <div className="flex flex-col items-center gap-1">
                    <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                      isCurrent
                        ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                        : isCompleted
                        ? "bg-primary/80 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {isCompleted ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <span>{i + 1}</span>
                      )}
                    </div>
                    <span className={`text-[9px] leading-tight text-center max-w-[48px] truncate ${
                      isCurrent
                        ? "text-primary font-semibold"
                        : isCompleted
                        ? "text-muted-foreground"
                        : "text-muted-foreground/60"
                    }`}>
                      {STEP_SHORT[step] ?? step}
                    </span>
                  </div>
                  {/* Connector line */}
                  {!isLast && (
                    <div className={`h-[2px] w-6 mx-0.5 rounded-full transition-colors ${
                      isCompleted ? "bg-primary/70" : "bg-muted-foreground/20"
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
import type { Shipment } from "@/components/orders/order-shipments";
import type { QcRequest } from "@/components/orders/order-qc";
import type { Dispute } from "@/components/orders/order-disputes";
import type { ReturnMerchandise } from "@/components/orders/order-returns";
import type { ShipmentWithCustoms } from "@/components/orders/order-customs";
import { createOrderPortalLink, recalculateOrderBudget, sendOrderEdi } from "@/lib/actions/order.actions";

const tabLoading = () => (
  <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
    Chargement du module...
  </div>
);

const OrderQuotes = dynamic(() => import("@/components/orders/order-quotes").then((mod) => mod.OrderQuotes), {
  loading: tabLoading,
});
const OrderPayments = dynamic(() => import("@/components/orders/order-payments").then((mod) => mod.OrderPayments), {
  loading: tabLoading,
});
const OrderAttachments = dynamic(
  () => import("@/components/orders/order-attachments").then((mod) => mod.OrderAttachments),
  { loading: tabLoading },
);
const OrderTeam = dynamic(() => import("@/components/orders/order-team").then((mod) => mod.OrderTeam), {
  loading: tabLoading,
});
const OrderShipments = dynamic(() => import("@/components/orders/order-shipments").then((mod) => mod.OrderShipments), {
  loading: tabLoading,
});
const OrderQc = dynamic(() => import("@/components/orders/order-qc").then((mod) => mod.OrderQc), {
  loading: tabLoading,
});
const OrderDisputes = dynamic(
  () => import("@/components/orders/order-disputes").then((mod) => mod.OrderDisputes),
  { loading: tabLoading },
);
const OrderReturns = dynamic(() => import("@/components/orders/order-returns").then((mod) => mod.OrderReturns), {
  loading: tabLoading,
});
const OrderSynthesisTab = dynamic(
  () => import("@/components/orders/order-synthesis-tab").then((mod) => mod.OrderSynthesisTab),
  { loading: tabLoading },
);
const OrderApprovals = dynamic(
  () => import("@/components/orders/order-approvals").then((mod) => mod.OrderApprovals),
  { loading: tabLoading },
);
const OrderCustoms = dynamic(() => import("@/components/orders/order-customs").then((mod) => mod.OrderCustoms), {
  loading: tabLoading,
});

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

type OrderDetailProjection = {
  subsystemStates: {
    commercial: { label: string; detail: string; tone: "neutral" | "success" | "warning" | "danger" };
    payment: { label: string; detail: string; tone: "neutral" | "success" | "warning" | "danger"; collectedXAF: number; outstandingXAF: number };
    logistics: { label: string; detail: string; tone: "neutral" | "success" | "warning" | "danger" };
    quality: { label: string; detail: string; tone: "neutral" | "success" | "warning" | "danger" };
    execution: { label: string; detail: string; tone: "neutral" | "success" | "warning" | "danger"; openTasks: number; blockedTasks: number; overdueTasks: number };
    finance: { label: string; detail: string; tone: "neutral" | "success" | "warning" | "danger"; netMarginXAF: number; netMarginPct: number; spendXAF: number };
  };
  transitionReadiness: { status: string; label: string; ready: boolean; blockers: string[] }[];
  activeBlockers: string[];
  nextRecommendedStatus: { status: string; label: string; ready: boolean } | null;
};

type OrderDetailProps = {
  order: {
    id: string;
    orderNumber: string;
    status: string;
    approvalStatus?: string | null;
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
    budgetPlannedXAF?: any;
    budgetActualXAF?: any;
    fxImpactXAF?: any;
    fxRatesSnapshot?: any;
    estimatedDelivery?: Date | null;
    actualDelivery?: Date | null;
    archivedAt?: Date | null;
    createdAt: Date;
    updatedAt?: Date;
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
      approvalStatus?: string;
      merchandiseTotal: any;
      logisticsCost: any;
      commission: any;
      insuranceCost: any;
      total: any;
      currency: string;
      validUntil?: Date | null;
      sentAt?: Date | null;
      sentByEmailAt?: Date | null;
      sentByEmailTo?: string | null;
      acceptedAt?: Date | null;
      signatureToken?: string | null;
      signedAt?: Date | null;
      signedByName?: string | null;
      signedByEmail?: string | null;
      createdAt: Date;
    }[];
    attachments: {
      id: string;
      name: string;
      url: string;
      downloadUrl?: string;
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
    returns?: ReturnMerchandise[];
    sourcingCases?: SourcingCase[];
    marginReport?: MarginReport | null;
    approvals?: {
      id: string;
      status: string;
      note?: string | null;
      decidedAt?: Date | null;
      rule: { name: string; requiredRole: string; minAmountXAF: any };
      decidedBy?: { name?: string | null; email?: string | null } | null;
    }[];
    revisions?: { id: string; revisionNumber: number; reason?: string | null; createdAt: Date }[];
    ediTransmissions?: { id: string; provider: string; status: string; sentAt?: Date | null }[];
    projection?: OrderDetailProjection | null;
  };
  canUpdateStatus?: boolean;
  canEdit?: boolean;
  canArchive?: boolean;
  canCreateQuote?: boolean;
  canSendQuote?: boolean;
  canApproveQuote?: boolean;
  canApproveOrder?: boolean;
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
  canApproveQuote = false,
  canApproveOrder = false,
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
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCalcMargin, setIsCalcMargin] = useState(false);
  const [isBudgetCalc, setIsBudgetCalc] = useState(false);
  const [isPortalLink, setIsPortalLink] = useState(false);
  const [isEdiSend, setIsEdiSend] = useState(false);
  const [isClosingDelivery, setIsClosingDelivery] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(order.status);
  const [pendingBlockedStatus, setPendingBlockedStatus] = useState<string | null>(null);
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

  async function handleDeliveredToClient() {
    setIsClosingDelivery(true);
    try {
      const result = await updateOrderStatus(order.id, "CLOTURE", "Remise physique au client confirmée");
      if (result.error) {
        toast.error(result.error);
        return;
      }
      // Also trigger margin calculation
      await calculateMargin(order.id).catch(() => null);
      toast.success("Commande clôturée — marge calculée");
      router.refresh();
    } catch (error) {
      toast.error("Une erreur est survenue");
      console.error(error);
    } finally {
      setIsClosingDelivery(false);
    }
  }

  async function handleCalculateMargin() {
    setIsCalcMargin(true);
    try {
      const result = await calculateMargin(order.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Marge calculée avec succès");
      router.refresh();
    } catch {
      toast.error("Une erreur est survenue");
    } finally {
      setIsCalcMargin(false);
    }
  }

  async function handleBudgetRecalc() {
    setIsBudgetCalc(true);
    try {
      const result = await recalculateOrderBudget(order.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Budget mis à jour");
      router.refresh();
    } finally {
      setIsBudgetCalc(false);
    }
  }

  async function handlePortalLink() {
    setIsPortalLink(true);
    try {
      const result = await createOrderPortalLink(order.id);
      if (result.error || !result.data) {
        toast.error(result.error || "Erreur portail");
        return;
      }
      await navigator.clipboard.writeText(result.data.url);
      toast.success("Lien portail copié");
    } finally {
      setIsPortalLink(false);
    }
  }

  async function handleEdiSend() {
    setIsEdiSend(true);
    try {
      const result = await sendOrderEdi(order.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("EDI envoyé");
      router.refresh();
    } finally {
      setIsEdiSend(false);
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

  async function handleRestore() {
    setIsRestoring(true);
    try {
      const result = await restoreOrder(order.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Commande restauree");
      router.refresh();
    } catch (error) {
      toast.error("Une erreur est survenue");
      console.error(error);
    } finally {
      setIsRestoring(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const result = await deleteOrder(order.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Commande supprimee");
      router.push("/orders");
    } catch (error) {
      toast.error("Une erreur est survenue");
      console.error(error);
    } finally {
      setIsDeleting(false);
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
          {canArchive && order.archivedAt && (
            <>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={isRestoring}>
                    Restaurer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Restaurer la commande</AlertDialogTitle>
                    <AlertDialogDescription>
                      La commande redeviendra visible dans les listes actives.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRestore} disabled={isRestoring}>
                      Confirmer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={isDeleting}>
                    Supprimer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer la commande</AlertDialogTitle>
                    <AlertDialogDescription>
                      Suppression definitive. Refusee si des elements lies existent.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                      Confirmer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      {/* Pipeline stepper */}
      <PipelineStepper status={order.status} />

      {/* DELIVERED_TO_CLIENT — one-click close for local logistics agent */}
      {order.status === "LIVRE" && canManageLogistics && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="lg" className="w-full bg-green-600 hover:bg-green-700 text-white gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Confirmer la remise au client → Clôturer la commande
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmer la livraison au client ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action passera la commande <strong>{order.orderNumber}</strong> en statut{" "}
                <strong>Clôturé</strong>, calculera la marge finale et enverra un message de fidélité
                au client via WhatsApp. Cette action est irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                disabled={isClosingDelivery}
                onClick={handleDeliveredToClient}
                className="bg-green-600 hover:bg-green-700"
              >
                {isClosingDelivery && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmer et clôturer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Blocked status confirmation dialog */}
      {pendingBlockedStatus && (() => {
        const readiness = order.projection?.transitionReadiness.find(
          (r) => r.status === pendingBlockedStatus
        );
        return (
          <AlertDialog open onOpenChange={(open) => { if (!open) setPendingBlockedStatus(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Transition bloquée — continuer quand même ?</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-2">
                    <p>
                      Le statut{" "}
                      <strong>{ORDER_STATUS_LABELS[pendingBlockedStatus as keyof typeof ORDER_STATUS_LABELS] ?? pendingBlockedStatus}</strong>{" "}
                      présente des blocages actifs :
                    </p>
                    {readiness && readiness.blockers.length > 0 && (
                      <ul className="space-y-1 text-sm">
                        {readiness.blockers.map((b) => (
                          <li key={b} className="flex items-start gap-2">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-sm font-medium text-destructive">
                      Forcer cette transition peut créer des incohérences dans le suivi de la commande.
                    </p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setPendingBlockedStatus(null)}>
                  Annuler
                </AlertDialogCancel>
                <AlertDialogAction
                  className="bg-amber-600 hover:bg-amber-700"
                  onClick={() => {
                    const s = pendingBlockedStatus;
                    setPendingBlockedStatus(null);
                    handleStatusChange(s);
                  }}
                >
                  Forcer la transition
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        );
      })()}

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
                  {allowedStatuses.map((value) => {
                    const readiness = order.projection?.transitionReadiness.find(
                      (r) => r.status === value
                    );
                    return (
                      <SelectItem key={value} value={value}>
                        <span className="flex items-center gap-2">
                          {readiness ? (
                            readiness.ready ? (
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
                            ) : (
                              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                            )
                          ) : null}
                          {ORDER_STATUS_LABELS[value as keyof typeof ORDER_STATUS_LABELS] ?? value}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Button
                onClick={() => {
                  const readiness = order.projection?.transitionReadiness.find(
                    (r) => r.status === selectedStatus
                  );
                  if (readiness && !readiness.ready && readiness.blockers.length > 0) {
                    setPendingBlockedStatus(selectedStatus);
                  } else {
                    handleStatusChange(selectedStatus);
                  }
                }}
                disabled={isUpdating || selectedStatus === order.status}
              >
                {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Mettre à jour
              </Button>
            </div>
            {order.projection ? (
              <div className="mt-4 space-y-3 rounded-lg border bg-muted/20 p-3">
                {order.projection.nextRecommendedStatus ? (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">Prochaine etape recommandee :</span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                      {order.projection.nextRecommendedStatus.label}
                    </span>
                    <span className={order.projection.nextRecommendedStatus.ready ? "text-green-600" : "text-amber-600"}>
                      {order.projection.nextRecommendedStatus.ready ? "prete a etre lancee" : "encore bloquee"}
                    </span>
                  </div>
                ) : null}

                {order.projection.activeBlockers.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Blocages actifs
                    </p>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {order.projection.activeBlockers.slice(0, 3).map((blocker) => (
                        <li key={blocker} className="flex items-start gap-2">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                          <span>{blocker}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-green-600">Aucun blocage critique detecte pour la progression immediate.</p>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="synthese" className="space-y-6">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="synthese">Synthèse</TabsTrigger>
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
          <TabsTrigger value="returns">
            Retours ({(order.returns ?? []).length})
          </TabsTrigger>
          <TabsTrigger value="customs">
            Dédouanement
            {(order.shipments ?? []).some((s: any) => s.customsClearance?.status === "CLEARED") && (
              <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] text-white font-bold">✓</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="documents">Documents ({order.attachments.length})</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="team">Equipe</TabsTrigger>
          <TabsTrigger value="timeline">Timeline ({order.timeline.length})</TabsTrigger>
          <TabsTrigger value="tasks">Tâches ({order.tasks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="synthese">
          <OrderSynthesisTab
            order={{
              id: order.id,
              status: order.status,
              priority: order.priority,
              estimatedDelivery: order.estimatedDelivery,
              createdAt: order.createdAt,
              updatedAt: order.updatedAt ?? order.createdAt,
              riskLevel: order.riskLevel,
              marginReport: order.marginReport ?? null,
              payments: order.payments,
              disputes: order.disputes,
              qcRequests: order.qcRequests,
              sourcingCases: order.sourcingCases,
              shipments: order.shipments,
              timeline: order.timeline,
              projection: order.projection ?? null,
            }}
          />
        </TabsContent>

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

            {/* Budget & FX */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Budget & FX</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Budget prévu</span>
                  <CurrencyDisplay amount={Number(order.budgetPlannedXAF || 0)} currency="XAF" />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Budget réalisé</span>
                  <CurrencyDisplay amount={Number(order.budgetActualXAF || 0)} currency="XAF" />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Impact FX</span>
                  <span className={`font-semibold ${Number(order.fxImpactXAF || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                    <CurrencyDisplay amount={Number(order.fxImpactXAF || 0)} currency="XAF" />
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={handleBudgetRecalc} disabled={isBudgetCalc}>
                  {isBudgetCalc && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Recalculer
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Margin report */}
          {canViewPayments && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCalculateMargin}
                disabled={isCalcMargin}
              >
                {isCalcMargin && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {order.marginReport ? "Recalculer la marge" : "Calculer la marge"}
              </Button>
            </div>
          )}
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
            canApprove={canApproveQuote}
            contactEmail={order.contact?.email}
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

        <TabsContent value="returns">
          <Card>
            <CardHeader>
              <CardTitle>Retours marchandise (RMA)</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderReturns
                orderId={order.id}
                returns={order.returns ?? []}
                canManage={canManageQc || canManageLogistics || canUpdateStatus}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customs">
          <OrderCustoms
            orderId={order.id}
            shipments={(order.shipments ?? []) as ShipmentWithCustoms[]}
            canManage={canManageLogistics}
          />
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

        <TabsContent value="approvals" className="space-y-4">
          <OrderApprovals
            orderId={order.id}
            approvalStatus={order.approvalStatus}
            approvals={order.approvals ?? []}
            canApprove={canApproveOrder}
          />

          <Card>
            <CardHeader>
              <CardTitle>Portail client & EDI</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handlePortalLink} disabled={isPortalLink}>
                  {isPortalLink && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Générer lien portail client
                </Button>
                <Button variant="outline" onClick={handleEdiSend} disabled={isEdiSend}>
                  {isEdiSend && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Envoyer EDI
                </Button>
              </div>
              {(order.ediTransmissions ?? []).length > 0 && (
                <div className="rounded-md border p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Derniers EDI</p>
                  {(order.ediTransmissions ?? []).map((edi) => (
                    <div key={edi.id} className="flex items-center justify-between">
                      <span>{edi.provider}</span>
                      <span>{edi.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {(order.revisions ?? []).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Historique des amendments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {(order.revisions ?? []).map((rev) => (
                  <div key={rev.id} className="flex items-center justify-between">
                    <span>Version {rev.revisionNumber}</span>
                    <span className="text-muted-foreground">{formatDate(rev.createdAt, true)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
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
