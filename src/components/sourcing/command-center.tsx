"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Factory,
  AlertTriangle,
  Inbox,
  MessageCircle,
  Paperclip,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Truck,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SourcingCommandCenterOverview } from "@/components/sourcing/sourcing-command-center-overview";
import type { SourcingOverviewProjection, SourcingPriorityAction } from "@/lib/sourcing/types";

import {
  addDemandAttachment,
  approveSourcingDecision,
  autoAssignUnassignedDemands,
  assignDemandAI,
  assignDemand,
  convertDemandToSourcing,
  createDemandIntake,
  createShipmentsFromGroupageBatch,
  createMarketInsight,
  exportSourcingAuditCSV,
  getSourcingDecisionData,
  rejectDemand,
  rejectSourcingDecision,
  runSourcingSlaCheck,
  qualifyDemand,
  syncDemandIntakeFromAll,
  syncDemandIntakeFromCrm,
  syncDemandIntakeFromWhatsapp,
  addSupplierDocument,
  removeSupplierDocument,
} from "@/lib/actions/sourcing.actions";
import { getSupplierIntelligence } from "@/lib/actions/supplier-intelligence.actions";
import { formatCurrency } from "@/config/currencies";

interface DemandAttachment {
  id: string;
  name: string;
  url: string;
  type?: string | null;
}

interface DemandItem {
  id: string;
  source: string;
  sourceRef?: string | null;
  clientName: string;
  clientSegment: string;
  rawDescription: string;
  category?: string | null;
  quantity?: number | null;
  targetPrice?: string | number | null;
  currency?: string | null;
  urgency: string;
  country?: string | null;
  estimatedRevenue?: string | number | null;
  status: string;
  receivedAt?: string | Date | null;
  aiScore?: number | null;
  rejectionReason?: string | null;
  attachments: DemandAttachment[];
  assignedTo?: { id: string; name: string | null; email?: string | null } | null;
  qualifiedBy?: { id: string; name: string | null; email?: string | null } | null;
}

interface PipelineItem {
  id: string;
  orderNumber: string;
  clientName: string;
  requirement: string;
  status: string;
  pipelineType: string;
  assignedTo: string;
  suppliersFound: number;
  expectedShippingCost: number;
  qcCostEst: number;
  slaStatus?: "ON_TIME" | "WARNING" | "BREACHED";
  slaLabel?: string;
  slaHoursRemaining: number;
  slaPercentUsed?: number;
  stageEnteredAt?: string | Date | null;
  supplier?: string | null;
  country?: string | null;
}

interface SupplierOption {
  id: string;
  name: string;
  country?: string | null;
  city?: string | null;
  rating?: number | null;
}

interface MarketInsight {
  id: string;
  product: string;
  category?: string | null;
  currentPrice: string | number;
  priceChange30d: string | number;
  volatilityScore: number;
  marketTrend: string;
  recommendedTiming: string;
  averageMOQ: number;
  supplierCount: number;
  updatedAt?: string | Date | null;
}

interface AuditLogItem {
  id: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  createdAt?: string | Date | null;
  user?: { name?: string | null; email?: string | null } | null;
}

interface PerformanceData {
  dependency: { supplier: string; dependency: number; spend: number }[];
  categoryConcentration: { category: string; count: number }[];
  heatmap: {
    supplier: string;
    globalRisk: number;
    quality: number;
    delivery: number;
    compliance: number;
    financial: number;
  }[];
}

interface GroupageItem {
  id: string;
  weightKg?: number | null;
  cbm?: number | null;
  sourcingCase?: {
    requirement?: string | null;
    order?: { orderNumber?: string | null; contact?: { name?: string | null } | null } | null;
    supplier?: { name?: string | null } | null;
  } | null;
}

interface GroupageBatch {
  id: string;
  name: string;
  destination: string;
  status: string;
  mode: string;
  totalWeight?: string | number | null;
  totalCbm?: string | number | null;
  etd?: string | Date | null;
  eta?: string | Date | null;
  items: GroupageItem[];
  shipments?: { id: string; status: string }[];
}

interface Assignee {
  id: string;
  name: string | null;
  email?: string | null;
  role?: string | null;
}

interface DecisionOffer {
  offerId: string;
  supplierId: string;
  supplierName: string;
  unitPrice: number;
  currency: string;
  leadTimeDays?: number | null;
  reliability?: number | null;
  risk?: number | null;
  quality?: number | null;
  delivery?: number | null;
  score: number;
  marginPct?: number | null;
}

interface DecisionData {
  recommended: DecisionOffer | null;
  alternatives: DecisionOffer[];
  all: DecisionOffer[];
}

interface SupplierProfile {
  supplier: {
    id: string;
    name: string;
    country?: string | null;
    rating?: number | null;
    lifecycleStatus?: string | null;
  };
  performanceProfile?: { reliabilityIndex?: number | null; qualityScore?: number | null; onTimeDeliveryRate?: number | null } | null;
  riskProfile?: { globalRiskScore?: number | null; qualityRisk?: number | null; deliveryRisk?: number | null } | null;
  aiProfile?: { recommendedStrategy?: string | null; predictedPriceDirection?: string | null; predictedPriceChange?: number | null } | null;
  documents?: { id: string; name: string; url: string; type?: string | null }[];
}

interface SourcingCommandCenterProps {
  demands: DemandItem[];
  pipeline: PipelineItem[];
  suppliers: SupplierOption[];
  marketInsights: MarketInsight[];
  auditLogs: AuditLogItem[];
  performance: PerformanceData;
  groupageBatches: GroupageBatch[];
  assignees: Assignee[];
  overview?: SourcingOverviewProjection;
  priorityActions?: SourcingPriorityAction[];
}

const DEMAND_STATUS_STYLE: Record<string, string> = {
  RAW: "bg-slate-100 text-slate-800",
  QUALIFIED: "bg-blue-100 text-blue-800",
  REJECTED: "bg-red-100 text-red-800",
  CONVERTED: "bg-green-100 text-green-800",
};

const PIPELINE_STATUS_STYLE: Record<string, string> = {
  SEARCHING: "bg-slate-100 text-slate-700",
  OFFERS_RECEIVED: "bg-blue-100 text-blue-800",
  NEGOTIATING: "bg-amber-100 text-amber-800",
  SELECTED: "bg-purple-100 text-purple-800",
  CONFIRMED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

const SEGMENT_STYLE: Record<string, string> = {
  VIP: "bg-emerald-100 text-emerald-700",
  STANDARD: "bg-slate-100 text-slate-700",
  RISK: "bg-rose-100 text-rose-700",
};

const URGENCY_STYLE: Record<string, string> = {
  NORMAL: "bg-slate-100 text-slate-700",
  HIGH: "bg-amber-100 text-amber-700",
  CRITICAL: "bg-red-100 text-red-700",
};

const AI_AGENT_SENTINEL = "__AI_AGENT__";

function formatMoney(amount?: number | string | null, currency = "XAF") {
  if (amount === null || amount === undefined) return "-";
  const value = Number(amount);
  if (Number.isNaN(value)) return "-";
  try {
    return formatCurrency(value, currency);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function formatDateSafe(value?: string | Date | null) {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("fr-FR");
}

function slaBadge(status?: string, hours?: number) {
  if (status === "BREACHED" || (hours != null && hours <= 0)) {
    return "bg-red-100 text-red-800";
  }
  if (status === "WARNING" || (hours != null && hours <= 12)) {
    return "bg-amber-100 text-amber-800";
  }
  return "bg-green-100 text-green-800";
}

function slaBar(status?: string) {
  if (status === "BREACHED") return "bg-red-500";
  if (status === "WARNING") return "bg-amber-500";
  return "bg-emerald-500";
}

function scoreBadge(score?: number | null) {
  const value = score ?? 0;
  if (value >= 80) return "bg-emerald-100 text-emerald-800";
  if (value >= 60) return "bg-blue-100 text-blue-800";
  if (value >= 40) return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-800";
}

export function SourcingCommandCenter({
  demands,
  pipeline,
  suppliers,
  marketInsights,
  auditLogs,
  performance,
  groupageBatches,
  assignees,
  overview: serverOverview,
  priorityActions: serverPriorityActions,
}: SourcingCommandCenterProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [demandStatus, setDemandStatus] = useState<string>("ALL");
  const [demandSource, setDemandSource] = useState<string>("ALL");
  const [demandSegment, setDemandSegment] = useState<string>("ALL");
  const [demandUrgency, setDemandUrgency] = useState<string>("ALL");
  const [demandSearch, setDemandSearch] = useState<string>("");

  const [createOpen, setCreateOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [demandSheetOpen, setDemandSheetOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedDemandId, setSelectedDemandId] = useState<string | null>(null);

  const [newDemand, setNewDemand] = useState({
    source: "WHATSAPP",
    clientName: "",
    clientSegment: "STANDARD",
    rawDescription: "",
    category: "",
    quantity: "",
    targetPrice: "",
    currency: "USD",
    urgency: "NORMAL",
    country: "CG",
    estimatedRevenue: "",
    aiScore: "50",
    assignedToId: "",
    autoAssign: true,
  });

  const [attachmentForm, setAttachmentForm] = useState({ name: "", url: "", type: "document" });

  const [decisionCaseId, setDecisionCaseId] = useState<string>("");
  const [decisionData, setDecisionData] = useState<DecisionData | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [decisionLoading, setDecisionLoading] = useState(false);

  const [supplierId, setSupplierId] = useState<string>("");
  const [supplierProfile, setSupplierProfile] = useState<SupplierProfile | null>(null);
  const [supplierDoc, setSupplierDoc] = useState({ name: "", url: "", type: "document" });

  const [marketOpen, setMarketOpen] = useState(false);
  const [marketForm, setMarketForm] = useState({
    product: "",
    category: "",
    currentPrice: "",
    priceChange30d: "",
    volatilityScore: "0",
    marketTrend: "STABLE",
    recommendedTiming: "WAIT",
    averageMOQ: "0",
    supplierCount: "0",
  });

  const selectedDemand = useMemo(
    () => demands.find((d) => d.id === selectedDemandId) ?? null,
    [demands, selectedDemandId]
  );

  const filteredDemands = useMemo(() => {
    return demands.filter((d) => {
      if (demandStatus !== "ALL" && d.status !== demandStatus) return false;
      if (demandSource !== "ALL" && d.source !== demandSource) return false;
      if (demandSegment !== "ALL" && d.clientSegment !== demandSegment) return false;
      if (demandUrgency !== "ALL" && d.urgency !== demandUrgency) return false;
      if (demandSearch.trim()) {
        const query = demandSearch.toLowerCase();
        if (!d.clientName.toLowerCase().includes(query) && !d.rawDescription.toLowerCase().includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [demands, demandStatus, demandSource, demandSegment, demandUrgency, demandSearch]);

  const rawCount = demands.filter((d) => d.status === "RAW").length;
  const qualifiedCount = demands.filter((d) => d.status === "QUALIFIED").length;
  const convertedCount = demands.filter((d) => d.status === "CONVERTED").length;
  const slaBreachedCount = pipeline.filter((p) => p.slaStatus === "BREACHED").length;
  const slaWarningCount = pipeline.filter((p) => p.slaStatus === "WARNING").length;
  const intakeBySource = demands.reduce<Record<string, number>>((acc, demand) => {
    acc[demand.source] = (acc[demand.source] || 0) + 1;
    return acc;
  }, {});
  const intakeBySegment = demands.reduce<Record<string, number>>((acc, demand) => {
    acc[demand.clientSegment] = (acc[demand.clientSegment] || 0) + 1;
    return acc;
  }, {});
  const urgentCount = demands.filter((d) => d.urgency !== "NORMAL").length;
  const conversionRate = demands.length ? Math.round((convertedCount / demands.length) * 100) : 0;
  const localOverview: SourcingOverviewProjection = {
    demandInbox: rawCount,
    qualifiedDemandQueue: qualifiedCount,
    activeCases: pipeline.length,
    confirmedCases: pipeline.filter((item) => item.status === "CONFIRMED").length,
    breachedCases: slaBreachedCount,
    warningCases: slaWarningCount,
    conversionRate,
    canonicalJourney: [
      {
        key: "inbound",
        label: "Demandes brutes",
        count: rawCount,
        description: "Besoins entrants a qualifier avant toute promesse sourcing.",
      },
      {
        key: "pre_sourcing",
        label: "Pre-sourcing",
        count: qualifiedCount,
        description: "Demandes deja qualifiees a transformer en travail exploitable.",
      },
      {
        key: "quote",
        label: "Devis / indicatif",
        count: demands.filter((d) => ["QUOTE_DRAFT", "QUOTE_PENDING_APPROVAL", "QUOTE_APPROVED", "QUOTE_SENT"].includes(d.status)).length,
        description: "Moments ou le besoin est assez cadre pour une proposition economique.",
      },
      {
        key: "execution",
        label: "Sourcing profond",
        count: pipeline.filter((item) => !["CONFIRMED", "CANCELLED"].includes(item.status)).length,
        description: "Dossiers fournisseurs actifs lies a une execution reelle.",
      },
      {
        key: "confirmed",
        label: "Decision confirmee",
        count: pipeline.filter((item) => item.status === "CONFIRMED").length,
        description: "Dossiers prets a alimenter la logistique et la commande.",
      },
    ],
  };
  const localPriorityActions: SourcingPriorityAction[] = [
    slaBreachedCount > 0
      ? {
          id: "breached_cases",
          title: "Traiter les cas hors SLA",
          description: `${slaBreachedCount} dossier(s) sourcing sont deja en retard.`,
          severity: "critical",
          count: slaBreachedCount,
        }
      : null,
    demands.filter((d) => !d.assignedTo?.id && ["RAW", "QUALIFIED"].includes(d.status)).length > 0
      ? {
          id: "unassigned_demands",
          title: "Assigner les demandes sans proprietaire",
          description: "Des demandes qualifiees ou brutes n'ont pas encore de porteur explicite.",
          severity: "warning",
          count: demands.filter((d) => !d.assignedTo?.id && ["RAW", "QUALIFIED"].includes(d.status)).length,
        }
      : null,
    pipeline.filter((item) => item.status === "SELECTED").length > 0
      ? {
          id: "selected_cases",
          title: "Verifier les selections fournisseur",
          description: "Des dossiers selectionnes doivent encore etre verrouilles par contrat ou validation.",
          severity: "warning",
          count: pipeline.filter((item) => item.status === "SELECTED").length,
        }
      : null,
  ].filter((item): item is SourcingPriorityAction => Boolean(item));
  const resolvedOverview = serverOverview ?? localOverview;
  const resolvedPriorityActions = serverPriorityActions ?? localPriorityActions;

  function handleCreateDemand() {
    startTransition(async () => {
      const result = await createDemandIntake({
        source: newDemand.source,
        clientName: newDemand.clientName,
        clientSegment: newDemand.clientSegment,
        rawDescription: newDemand.rawDescription,
        category: newDemand.category || undefined,
        quantity: newDemand.quantity ? Number(newDemand.quantity) : undefined,
        targetPrice: newDemand.targetPrice ? Number(newDemand.targetPrice) : undefined,
        currency: newDemand.currency || undefined,
        urgency: newDemand.urgency,
        country: newDemand.country || undefined,
        estimatedRevenue: newDemand.estimatedRevenue ? Number(newDemand.estimatedRevenue) : undefined,
        aiScore: newDemand.aiScore ? Number(newDemand.aiScore) : undefined,
        assignedToId: newDemand.assignedToId || undefined,
        autoAssign: newDemand.autoAssign,
      });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Demande créée");
      setCreateOpen(false);
      router.refresh();
    });
  }

  function handleQualify(demandId: string) {
    startTransition(async () => {
      const result = await qualifyDemand(demandId);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Demande qualifiée");
      router.refresh();
    });
  }

  function handleReject() {
    if (!selectedDemandId) return;
    startTransition(async () => {
      const result = await rejectDemand(selectedDemandId, rejectReason || undefined);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Demande rejetée");
      setRejectOpen(false);
      setRejectReason("");
      router.refresh();
    });
  }

  function handleConvert(demandId: string) {
    startTransition(async () => {
      const result = await convertDemandToSourcing(demandId);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Demande convertie");
      router.refresh();
    });
  }

  function handleAssign(demandId: string, assigneeId: string | null) {
    startTransition(async () => {
      const result = await assignDemand(demandId, assigneeId || undefined);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Assignation mise à jour");
      router.refresh();
    });
  }

  function handleAssignAI(demandId: string) {
    startTransition(async () => {
      const result = await assignDemandAI(demandId);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Assignation mise à jour");
      router.refresh();
    });
  }

  function handleAddAttachment() {
    if (!selectedDemandId) return;
    startTransition(async () => {
      const result = await addDemandAttachment({
        demandId: selectedDemandId,
        name: attachmentForm.name,
        url: attachmentForm.url,
        type: attachmentForm.type,
      });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Pièce ajoutée");
      setAttachOpen(false);
      setAttachmentForm({ name: "", url: "", type: "document" });
      router.refresh();
    });
  }

  function handleSyncWhatsapp() {
    startTransition(async () => {
      const result = await syncDemandIntakeFromWhatsapp();
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      const created = result?.data?.created ?? 0;
      const skipped = result?.data?.skipped ?? 0;
      toast.success(`Sync WhatsApp : ${created} créées, ${skipped} ignorées`);
      router.refresh();
    });
  }

  function handleSyncCrm() {
    startTransition(async () => {
      const result = await syncDemandIntakeFromCrm();
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      const created = result?.data?.created ?? 0;
      const skipped = result?.data?.skipped ?? 0;
      toast.success(`Sync CRM : ${created} créées, ${skipped} ignorées`);
      router.refresh();
    });
  }

  function handleSyncAll() {
    startTransition(async () => {
      const result = await syncDemandIntakeFromAll();
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      const created = result?.data?.created ?? 0;
      const skipped = result?.data?.skipped ?? 0;
      toast.success(`Sync complet : ${created} créées, ${skipped} ignorées`);
      router.refresh();
    });
  }

  function handleAutoAssignUnassigned() {
    startTransition(async () => {
      const result = await autoAssignUnassignedDemands();
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      const updated = result?.data?.updated ?? 0;
      toast.success(`${updated} demandes assignées par IA`);
      router.refresh();
    });
  }

  function handleRunSlaCheck() {
    startTransition(async () => {
      const result = await runSourcingSlaCheck();
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("SLA sourcing recalculé");
      router.refresh();
    });
  }

  async function handleDecisionLoad() {
    if (!decisionCaseId) return;
    setDecisionLoading(true);
    const result = await getSourcingDecisionData(decisionCaseId);
    if (result?.error || !result.data) {
      toast.error(result?.error || "Erreur de chargement décision");
      setDecisionLoading(false);
      return;
    }
    setDecisionData(result.data as DecisionData);
    setDecisionLoading(false);
  }

  function handleApproveDecision(offer?: DecisionOffer | null) {
    if (!decisionCaseId || !offer) return;
    startTransition(async () => {
      const result = await approveSourcingDecision(decisionCaseId, {
        supplierId: offer.supplierId,
        note: decisionNote || undefined,
        marginImpact: offer.marginPct ?? undefined,
      });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Décision approuvée");
      router.refresh();
    });
  }

  function handleRejectDecision() {
    if (!decisionCaseId) return;
    startTransition(async () => {
      const result = await rejectSourcingDecision(decisionCaseId, { note: decisionNote || undefined });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Décision rejetée");
      router.refresh();
    });
  }

  async function handleSupplierLoad() {
    if (!supplierId) return;
    const res = await getSupplierIntelligence(supplierId);
    if (res?.error || !res.data) {
      toast.error(res?.error || "Erreur fournisseur");
      return;
    }
    setSupplierProfile(res.data as unknown as SupplierProfile);
  }

  function handleAddSupplierDoc() {
    if (!supplierId) return;
    startTransition(async () => {
      const res = await addSupplierDocument(supplierId, {
        name: supplierDoc.name,
        url: supplierDoc.url,
        type: supplierDoc.type,
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Document ajouté");
      setSupplierDoc({ name: "", url: "", type: "document" });
      router.refresh();
    });
  }

  function handleRemoveSupplierDoc(docId: string) {
    startTransition(async () => {
      const res = await removeSupplierDocument(docId);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Document retiré");
      router.refresh();
    });
  }

  function handleCreateMarketInsight() {
    startTransition(async () => {
      const result = await createMarketInsight({
        product: marketForm.product,
        category: marketForm.category || undefined,
        currentPrice: Number(marketForm.currentPrice || 0),
        priceChange30d: Number(marketForm.priceChange30d || 0),
        volatilityScore: Number(marketForm.volatilityScore || 0),
        marketTrend: marketForm.marketTrend,
        recommendedTiming: marketForm.recommendedTiming,
        averageMOQ: Number(marketForm.averageMOQ || 0),
        supplierCount: Number(marketForm.supplierCount || 0),
      });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Insight marché ajouté");
      setMarketOpen(false);
      router.refresh();
    });
  }

  function handleCreateShipments(batchId: string) {
    startTransition(async () => {
      const result = await createShipmentsFromGroupageBatch(batchId);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      const created = result?.data?.created ?? 0;
      const skipped = result?.data?.skipped ?? 0;
      toast.success(`Expéditions créées: ${created}, ignorées: ${skipped}`);
      router.refresh();
    });
  }

  async function handleExportAudit() {
    try {
      const res = await exportSourcingAuditCSV();
      if (res?.error || !res.data) {
      toast.error(res?.error || "Erreur export");
      return;
    }
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sourcing-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Audit exporté");
    } catch {
      toast.error("Erreur export");
    }
  }

  return (
    <div className="space-y-6">
      <SourcingCommandCenterOverview
        overview={resolvedOverview}
        priorityActions={resolvedPriorityActions}
        supplierCount={suppliers.length}
      />

      <Tabs defaultValue="intake" className="space-y-4">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="intake">Inbox</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="decision">Décision IA</TabsTrigger>
          <TabsTrigger value="suppliers">Intel fournisseurs</TabsTrigger>
          <TabsTrigger value="market">Intel marché</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="governance">Gouvernance</TabsTrigger>
          <TabsTrigger value="groupage">Groupage</TabsTrigger>
        </TabsList>

        <TabsContent value="intake" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Inbox multi-sources</CardTitle>
                <p className="text-sm text-muted-foreground">
                  WhatsApp, CRM et App centralisés avec qualification assistée IA.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={handleSyncAll} disabled={isPending}>
                  <Sparkles className="mr-2 h-4 w-4" /> Sync complet
                </Button>
                <Button size="sm" variant="outline" onClick={handleSyncWhatsapp} disabled={isPending}>
                  <MessageCircle className="mr-2 h-4 w-4" /> Sync WhatsApp
                </Button>
                <Button size="sm" variant="outline" onClick={handleSyncCrm} disabled={isPending}>
                  <Users className="mr-2 h-4 w-4" /> Sync CRM
                </Button>
                <Button size="sm" variant="outline" onClick={handleAutoAssignUnassigned} disabled={isPending}>
                  <Sparkles className="mr-2 h-4 w-4" /> Auto-assign IA
                </Button>
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" /> Nouvelle demande
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Créer une demande</DialogTitle>
                  </DialogHeader>
                    <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Source</Label>
                      <Select value={newDemand.source} onValueChange={(value) => setNewDemand({ ...newDemand, source: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                          <SelectItem value="CRM">CRM</SelectItem>
                          <SelectItem value="APP">App</SelectItem>
                          <SelectItem value="MANUAL">Manuel</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Client</Label>
                      <Input value={newDemand.clientName} onChange={(e) => setNewDemand({ ...newDemand, clientName: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Segment</Label>
                      <Select value={newDemand.clientSegment} onValueChange={(value) => setNewDemand({ ...newDemand, clientSegment: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="STANDARD">Standard</SelectItem>
                          <SelectItem value="VIP">VIP</SelectItem>
                          <SelectItem value="RISK">Risk</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Urgence</Label>
                      <Select value={newDemand.urgency} onValueChange={(value) => setNewDemand({ ...newDemand, urgency: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NORMAL">Normal</SelectItem>
                          <SelectItem value="HIGH">High</SelectItem>
                          <SelectItem value="CRITICAL">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Description</Label>
                      <Textarea value={newDemand.rawDescription} onChange={(e) => setNewDemand({ ...newDemand, rawDescription: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Catégorie</Label>
                      <Input value={newDemand.category} onChange={(e) => setNewDemand({ ...newDemand, category: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Quantité</Label>
                      <Input type="number" value={newDemand.quantity} onChange={(e) => setNewDemand({ ...newDemand, quantity: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Prix cible</Label>
                      <Input type="number" value={newDemand.targetPrice} onChange={(e) => setNewDemand({ ...newDemand, targetPrice: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Devise</Label>
                      <Input value={newDemand.currency} onChange={(e) => setNewDemand({ ...newDemand, currency: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Revenu estimé</Label>
                      <Input type="number" value={newDemand.estimatedRevenue} onChange={(e) => setNewDemand({ ...newDemand, estimatedRevenue: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Score IA</Label>
                      <Input type="number" value={newDemand.aiScore} onChange={(e) => setNewDemand({ ...newDemand, aiScore: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Auto-assign (IA)</Label>
                        <Switch
                          checked={newDemand.autoAssign}
                          onCheckedChange={(checked) => setNewDemand({ ...newDemand, autoAssign: checked })}
                        />
                      </div>
                      <Select
                        value={newDemand.assignedToId || AI_AGENT_SENTINEL}
                        onValueChange={(value) =>
                          setNewDemand({
                            ...newDemand,
                            assignedToId: value === AI_AGENT_SENTINEL ? "" : value,
                          })
                        }
                        disabled={newDemand.autoAssign}
                      >
                        <SelectTrigger><SelectValue placeholder="AI Agent" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={AI_AGENT_SENTINEL}>AI Agent</SelectItem>
                          {assignees.map((member) => (
                            <SelectItem key={member.id} value={member.id}>{member.name || member.email || member.id}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
                    <Button onClick={handleCreateDemand} disabled={isPending}>Créer</Button>
                  </div>
                </DialogContent>
              </Dialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <Card className="border-dashed">
                  <CardContent className="pt-4">
                    <div className="text-xs text-muted-foreground">Conversion</div>
                    <div className="text-xl font-semibold">{conversionRate}%</div>
                    <div className="text-xs text-muted-foreground">{convertedCount} demandes converties</div>
                  </CardContent>
                </Card>
                <Card className="border-dashed">
                  <CardContent className="pt-4">
                    <div className="text-xs text-muted-foreground">Urgence</div>
                    <div className="text-xl font-semibold">{urgentCount}</div>
                    <div className="text-xs text-muted-foreground">High + Critical</div>
                  </CardContent>
                </Card>
                <Card className="border-dashed">
                  <CardContent className="pt-4 space-y-1">
                    <div className="text-xs text-muted-foreground">Sources</div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="secondary">WA {intakeBySource.WHATSAPP || 0}</Badge>
                      <Badge variant="secondary">CRM {intakeBySource.CRM || 0}</Badge>
                      <Badge variant="secondary">App {intakeBySource.APP || 0}</Badge>
                      <Badge variant="secondary">Manuel {intakeBySource.MANUAL || 0}</Badge>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-dashed">
                  <CardContent className="pt-4 space-y-1">
                    <div className="text-xs text-muted-foreground">Segments</div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge className={SEGMENT_STYLE.VIP}>VIP {intakeBySegment.VIP || 0}</Badge>
                      <Badge className={SEGMENT_STYLE.STANDARD}>Standard {intakeBySegment.STANDARD || 0}</Badge>
                      <Badge className={SEGMENT_STYLE.RISK}>Risk {intakeBySegment.RISK || 0}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-3 md:grid-cols-5">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Rechercher une demande" value={demandSearch} onChange={(e) => setDemandSearch(e.target.value)} />
                </div>
                <Select value={demandStatus} onValueChange={setDemandStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tous statuts</SelectItem>
                    <SelectItem value="RAW">Nouveau</SelectItem>
                    <SelectItem value="QUALIFIED">Qualifié</SelectItem>
                    <SelectItem value="REJECTED">Rejeté</SelectItem>
                    <SelectItem value="CONVERTED">Converti</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={demandSource} onValueChange={setDemandSource}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Toutes sources</SelectItem>
                    <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                    <SelectItem value="CRM">CRM</SelectItem>
                    <SelectItem value="APP">App</SelectItem>
                    <SelectItem value="MANUAL">Manuel</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={demandSegment} onValueChange={setDemandSegment}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tous segments</SelectItem>
                    <SelectItem value="VIP">VIP</SelectItem>
                    <SelectItem value="STANDARD">Standard</SelectItem>
                    <SelectItem value="RISK">Risk</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={demandUrgency} onValueChange={setDemandUrgency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Toutes urgences</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Segment</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Urgence</TableHead>
                    <TableHead>Score IA</TableHead>
                    <TableHead>Reçu</TableHead>
                    <TableHead>Revenu</TableHead>
                    <TableHead>Assignation</TableHead>
                    <TableHead>Pièces</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDemands.map((demand) => (
                    <TableRow key={demand.id} className="hover:bg-slate-50/80">
                      <TableCell>
                        <div className="font-medium">{demand.clientName}</div>
                        <div className="text-xs text-muted-foreground">{demand.rawDescription}</div>
                      </TableCell>
                      <TableCell>
                        <Badge className={SEGMENT_STYLE[demand.clientSegment] || "bg-slate-100 text-slate-700"}>
                          {demand.clientSegment}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={DEMAND_STATUS_STYLE[demand.status] || "bg-slate-100 text-slate-800"}>
                          {demand.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{demand.source}</TableCell>
                      <TableCell>
                        <Badge className={URGENCY_STYLE[demand.urgency] || "bg-slate-100 text-slate-700"}>
                          {demand.urgency}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={scoreBadge(demand.aiScore)}>{demand.aiScore ?? 0}</Badge>
                      </TableCell>
                      <TableCell>{formatDateSafe(demand.receivedAt)}</TableCell>
                      <TableCell>{formatMoney(demand.estimatedRevenue, demand.currency || "USD")}</TableCell>
                      <TableCell>
                        <Select
                          value={demand.assignedTo?.id || AI_AGENT_SENTINEL}
                          onValueChange={(value) =>
                            handleAssign(demand.id, value === AI_AGENT_SENTINEL ? null : value)
                          }
                        >
                          <SelectTrigger className="w-[140px]"><SelectValue placeholder="AI Agent" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={AI_AGENT_SENTINEL}>AI Agent</SelectItem>
                            {assignees.map((member) => (
                              <SelectItem key={member.id} value={member.id}>{member.name || member.email || member.id}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Paperclip className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{demand.attachments.length}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setSelectedDemandId(demand.id);
                              setAttachOpen(true);
                            }}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedDemandId(demand.id);
                              setDemandSheetOpen(true);
                            }}
                          >
                            Détails
                          </Button>
                          {demand.status === "RAW" && (
                            <Button size="sm" variant="outline" onClick={() => handleQualify(demand.id)}>
                              <CheckCircle2 className="mr-1 h-4 w-4" /> Qualifier
                            </Button>
                          )}
                          {!demand.assignedTo?.id && (
                            <Button size="sm" variant="outline" onClick={() => handleAssignAI(demand.id)}>
                              <Sparkles className="mr-1 h-4 w-4" /> Assigner IA
                            </Button>
                          )}
                          {demand.status !== "REJECTED" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedDemandId(demand.id);
                                setRejectOpen(true);
                              }}
                            >
                              <XCircle className="mr-1 h-4 w-4" /> Rejeter
                            </Button>
                          )}
                          {demand.status !== "CONVERTED" && (
                            <Button size="sm" onClick={() => handleConvert(demand.id)}>
                              <ArrowRight className="mr-1 h-4 w-4" /> Convertir
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Rejeter la demande</DialogTitle>
              </DialogHeader>
              <Textarea placeholder="Motif du rejet" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRejectOpen(false)}>Annuler</Button>
                <Button onClick={handleReject} disabled={isPending}>Rejeter</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={attachOpen} onOpenChange={setAttachOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ajouter une pièce</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input value={attachmentForm.name} onChange={(e) => setAttachmentForm({ ...attachmentForm, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>URL</Label>
                <Input value={attachmentForm.url} onChange={(e) => setAttachmentForm({ ...attachmentForm, url: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Input value={attachmentForm.type} onChange={(e) => setAttachmentForm({ ...attachmentForm, type: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAttachOpen(false)}>Annuler</Button>
                <Button onClick={handleAddAttachment} disabled={isPending}>Ajouter</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Sheet open={demandSheetOpen} onOpenChange={setDemandSheetOpen}>
            <SheetContent className="sm:max-w-lg">
              <SheetHeader>
                <SheetTitle>Fiche demande</SheetTitle>
                <SheetDescription>Détails opérationnels et actions rapides.</SheetDescription>
              </SheetHeader>
              {selectedDemand ? (
                <div className="mt-4 space-y-4">
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Client</div>
                    <div className="text-lg font-semibold">{selectedDemand.clientName}</div>
                    <div className="text-xs text-muted-foreground">{selectedDemand.rawDescription}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className={SEGMENT_STYLE[selectedDemand.clientSegment] || "bg-slate-100 text-slate-700"}>
                      {selectedDemand.clientSegment}
                    </Badge>
                    <Badge className={URGENCY_STYLE[selectedDemand.urgency] || "bg-slate-100 text-slate-700"}>
                      {selectedDemand.urgency}
                    </Badge>
                    <Badge className={DEMAND_STATUS_STYLE[selectedDemand.status] || "bg-slate-100 text-slate-800"}>
                      {selectedDemand.status}
                    </Badge>
                    <Badge className={scoreBadge(selectedDemand.aiScore)}>AI {selectedDemand.aiScore ?? 0}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Source</div>
                      <div className="font-medium">{selectedDemand.source}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Reçu</div>
                      <div className="font-medium">{formatDateSafe(selectedDemand.receivedAt)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Prix cible</div>
                      <div className="font-medium">
                        {selectedDemand.targetPrice ? formatMoney(selectedDemand.targetPrice, selectedDemand.currency || "USD") : "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Revenu estimé</div>
                      <div className="font-medium">{formatMoney(selectedDemand.estimatedRevenue, selectedDemand.currency || "USD")}</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Assignation</Label>
                    <Select
                      value={selectedDemand.assignedTo?.id || AI_AGENT_SENTINEL}
                      onValueChange={(value) =>
                        handleAssign(selectedDemand.id, value === AI_AGENT_SENTINEL ? null : value)
                      }
                    >
                      <SelectTrigger><SelectValue placeholder="AI Agent" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={AI_AGENT_SENTINEL}>AI Agent</SelectItem>
                        {assignees.map((member) => (
                          <SelectItem key={member.id} value={member.id}>{member.name || member.email || member.id}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Pièces jointes</Label>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedDemandId(selectedDemand.id);
                          setAttachOpen(true);
                        }}
                      >
                        <Plus className="mr-1 h-4 w-4" /> Ajouter
                      </Button>
                    </div>
                    {selectedDemand.attachments.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Aucune pièce jointe.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedDemand.attachments.map((att) => (
                          <div key={att.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                            <div className="truncate">
                              <div className="font-medium">{att.name}</div>
                              <div className="text-xs text-muted-foreground">{att.type || "document"}</div>
                            </div>
                            <Button size="sm" variant="ghost" asChild>
                              <a href={att.url} target="_blank" rel="noreferrer">Ouvrir</a>
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedDemand.status === "RAW" && (
                      <Button size="sm" variant="outline" onClick={() => handleQualify(selectedDemand.id)}>
                        <CheckCircle2 className="mr-1 h-4 w-4" /> Qualifier
                      </Button>
                    )}
                    {!selectedDemand.assignedTo?.id && (
                      <Button size="sm" variant="outline" onClick={() => handleAssignAI(selectedDemand.id)}>
                        <Sparkles className="mr-1 h-4 w-4" /> Assigner IA
                      </Button>
                    )}
                    {selectedDemand.status !== "REJECTED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedDemandId(selectedDemand.id);
                          setRejectOpen(true);
                        }}
                      >
                        <XCircle className="mr-1 h-4 w-4" /> Rejeter
                      </Button>
                    )}
                    {selectedDemand.status !== "CONVERTED" && (
                      <Button size="sm" onClick={() => handleConvert(selectedDemand.id)}>
                        <ArrowRight className="mr-1 h-4 w-4" /> Convertir
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">Aucune demande sélectionnée.</p>
              )}
            </SheetContent>
          </Sheet>
        </TabsContent>

        <TabsContent value="pipeline" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Pipeline avancé</CardTitle>
                <p className="text-sm text-muted-foreground">
                  SLA par étape, coûts estimés et visibilité des assignations.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={handleRunSlaCheck} disabled={isPending}>
                <AlertTriangle className="mr-2 h-4 w-4" /> Lancer le check SLA
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Commande</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Assigné</TableHead>
                    <TableHead>Fournisseurs</TableHead>
                    <TableHead>Transport</TableHead>
                    <TableHead>QC</TableHead>
                    <TableHead>SLA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pipeline.map((item) => (
                    <TableRow
                      key={item.id}
                      className={`${item.slaStatus === "BREACHED" ? "bg-red-50/60" : ""} hover:bg-slate-50/80`}
                    >
                      <TableCell>
                        <div className="font-medium">{item.orderNumber}</div>
                        <div className="text-xs text-muted-foreground">{item.clientName}</div>
                        <div className="text-xs text-muted-foreground">{item.requirement}</div>
                      </TableCell>
                      <TableCell>
                        <Badge className={PIPELINE_STATUS_STYLE[item.status] || "bg-slate-100 text-slate-800"}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.pipelineType}</TableCell>
                      <TableCell>{item.assignedTo}</TableCell>
                      <TableCell>{item.suppliersFound}</TableCell>
                      <TableCell>{formatMoney(item.expectedShippingCost, "XAF")}</TableCell>
                      <TableCell>{formatMoney(item.qcCostEst, "XAF")}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge className={slaBadge(item.slaStatus, item.slaHoursRemaining)}>
                            {item.slaLabel || `${item.slaHoursRemaining}h`}
                          </Badge>
                          <div className="h-1.5 w-full rounded bg-muted">
                            <div
                              className={`h-full rounded ${slaBar(item.slaStatus)}`}
                              style={{ width: `${Math.min(100, item.slaPercentUsed ?? 0)}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="decision" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Moteur de décision</CardTitle>
              <p className="text-sm text-muted-foreground">
                Recommandations IA, impacts marge et alternatives comparées.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="flex-1 space-y-2">
                  <Label>Cas de sourcing</Label>
                  <Select value={decisionCaseId} onValueChange={setDecisionCaseId}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner un cas" /></SelectTrigger>
                    <SelectContent>
                      {pipeline.map((item) => (
                        <SelectItem key={item.id} value={item.id}>{item.orderNumber} - {item.requirement.slice(0, 32)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleDecisionLoad} disabled={decisionLoading || !decisionCaseId}>
                  <Sparkles className="mr-2 h-4 w-4" /> Charger la décision
                </Button>
              </div>

              {decisionData && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-base">Fournisseur recommandé</CardTitle>
                      <Badge variant="secondary">Score IA</Badge>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {decisionData.recommended ? (
                        <>
                          <div className="grid gap-2 md:grid-cols-4">
                            <div>
                              <div className="text-sm text-muted-foreground">Fournisseur</div>
                              <div className="font-medium">{decisionData.recommended.supplierName}</div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">Prix</div>
                              <div className="font-medium">{formatMoney(decisionData.recommended.unitPrice, decisionData.recommended.currency)}</div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">Score</div>
                              <div className="font-medium">{decisionData.recommended.score}/100</div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">Impact marge</div>
                              <div className="font-medium">{decisionData.recommended.marginPct ?? 0}%</div>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Qualité {decisionData.recommended.quality ?? 0} | Livraison {decisionData.recommended.delivery ?? 0} | Risque {decisionData.recommended.risk ?? 0}
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">Aucune offre disponible.</p>
                      )}
                      <Separator />
                      <div className="space-y-2">
                        <Label>Note de décision</Label>
                        <Textarea value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => handleApproveDecision(decisionData.recommended)} disabled={isPending || !decisionData.recommended}>
                          <ShieldCheck className="mr-1 h-4 w-4" /> Approuver
                        </Button>
                        <Button variant="outline" onClick={handleRejectDecision} disabled={isPending}>
                          <XCircle className="mr-1 h-4 w-4" /> Rejeter
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Alternatives</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fournisseur</TableHead>
                            <TableHead>Prix</TableHead>
                            <TableHead>Score</TableHead>
                            <TableHead>Risque</TableHead>
                            <TableHead>Délai</TableHead>
                            <TableHead>Qualité</TableHead>
                            <TableHead>Livraison</TableHead>
                            <TableHead>Marge</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {decisionData.alternatives.map((offer) => (
                            <TableRow key={offer.offerId}>
                              <TableCell>{offer.supplierName}</TableCell>
                              <TableCell>{formatMoney(offer.unitPrice, offer.currency)}</TableCell>
                              <TableCell>{offer.score}</TableCell>
                              <TableCell>{offer.risk ?? 0}</TableCell>
                              <TableCell>{offer.leadTimeDays ?? "-"}</TableCell>
                              <TableCell>{offer.quality ?? 0}</TableCell>
                              <TableCell>{offer.delivery ?? 0}</TableCell>
                              <TableCell>{offer.marginPct ?? 0}%</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Intelligence fournisseurs</CardTitle>
              <p className="text-sm text-muted-foreground">Scores composites, risques et cycle de vie.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="flex-1 space-y-2">
                  <Label>Fournisseur</Label>
                  <Select value={supplierId} onValueChange={setSupplierId}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner un fournisseur" /></SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name} ({s.country || "-"})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleSupplierLoad} disabled={!supplierId}>
                  <Users className="mr-2 h-4 w-4" /> Charger le profil
                </Button>
              </div>

              {supplierProfile && (
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Vue d’ensemble</CardTitle></CardHeader>
                    <CardContent className="space-y-1">
                      <div className="font-medium">{supplierProfile.supplier.name}</div>
                      <div className="text-sm text-muted-foreground">Pays : {supplierProfile.supplier.country || "-"}</div>
                      <div className="text-sm text-muted-foreground">Cycle de vie : {supplierProfile.supplier.lifecycleStatus || "ACTIVE"}</div>
                      <div className="text-sm text-muted-foreground">Note : {supplierProfile.supplier.rating ?? 0}/100</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Performance</CardTitle></CardHeader>
                    <CardContent className="space-y-1">
                      <div>Fiabilité : {supplierProfile.performanceProfile?.reliabilityIndex ?? 0}</div>
                      <div>Qualité : {supplierProfile.performanceProfile?.qualityScore ?? 0}</div>
                      <div>On‑time : {supplierProfile.performanceProfile?.onTimeDeliveryRate ?? 0}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Risque</CardTitle></CardHeader>
                    <CardContent className="space-y-1">
                      <div>Global : {supplierProfile.riskProfile?.globalRiskScore ?? 0}</div>
                      <div>Qualité : {supplierProfile.riskProfile?.qualityRisk ?? 0}</div>
                      <div>Livraison : {supplierProfile.riskProfile?.deliveryRisk ?? 0}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Insights IA</CardTitle></CardHeader>
                    <CardContent className="space-y-1">
                      <div>Stratégie : {supplierProfile.aiProfile?.recommendedStrategy || "-"}</div>
                      <div>Direction prix : {supplierProfile.aiProfile?.predictedPriceDirection || "-"}</div>
                      <div>Variation : {supplierProfile.aiProfile?.predictedPriceChange ?? 0}</div>
                    </CardContent>
                  </Card>
                  <Card className="md:col-span-3">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-sm">Documents</CardTitle>
                      <div className="flex items-center gap-2">
                        <Input placeholder="Nom" value={supplierDoc.name} onChange={(e) => setSupplierDoc({ ...supplierDoc, name: e.target.value })} className="h-8" />
                        <Input placeholder="URL" value={supplierDoc.url} onChange={(e) => setSupplierDoc({ ...supplierDoc, url: e.target.value })} className="h-8" />
                        <Button size="sm" onClick={handleAddSupplierDoc} disabled={isPending}>Ajouter</Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-2">
                        {(supplierProfile.documents || []).map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between rounded border p-2">
                            <div>
                              <div className="text-sm font-medium">{doc.name}</div>
                              <div className="text-xs text-muted-foreground">{doc.url}</div>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => handleRemoveSupplierDoc(doc.id)}>
                              Retirer
                            </Button>
                          </div>
                        ))}
                        {(!supplierProfile.documents || supplierProfile.documents.length === 0) && (
                          <div className="text-sm text-muted-foreground">Aucun document.</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="market" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Intelligence marché</CardTitle>
                <p className="text-sm text-muted-foreground">Tendances prix, volatilité et timing d’achat.</p>
              </div>
              <Dialog open={marketOpen} onOpenChange={setMarketOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" /> Nouvel insight
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Créer un insight marché</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Produit</Label>
                      <Input value={marketForm.product} onChange={(e) => setMarketForm({ ...marketForm, product: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Catégorie</Label>
                      <Input value={marketForm.category} onChange={(e) => setMarketForm({ ...marketForm, category: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Prix actuel</Label>
                      <Input type="number" value={marketForm.currentPrice} onChange={(e) => setMarketForm({ ...marketForm, currentPrice: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Variation 30j</Label>
                      <Input type="number" value={marketForm.priceChange30d} onChange={(e) => setMarketForm({ ...marketForm, priceChange30d: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Score volatilité</Label>
                      <Input type="number" value={marketForm.volatilityScore} onChange={(e) => setMarketForm({ ...marketForm, volatilityScore: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Tendance</Label>
                      <Select value={marketForm.marketTrend} onValueChange={(value) => setMarketForm({ ...marketForm, marketTrend: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                        <SelectItem value="TIGHTENING">Tension</SelectItem>
                        <SelectItem value="LOOSENING">Détente</SelectItem>
                        <SelectItem value="STABLE">Stable</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Timing</Label>
                      <Select value={marketForm.recommendedTiming} onValueChange={(value) => setMarketForm({ ...marketForm, recommendedTiming: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BUY_NOW">Acheter maintenant</SelectItem>
                          <SelectItem value="WAIT">Attendre</SelectItem>
                          <SelectItem value="URGENT">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>MOQ moyen</Label>
                      <Input type="number" value={marketForm.averageMOQ} onChange={(e) => setMarketForm({ ...marketForm, averageMOQ: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Nombre fournisseurs</Label>
                      <Input type="number" value={marketForm.supplierCount} onChange={(e) => setMarketForm({ ...marketForm, supplierCount: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setMarketOpen(false)}>Annuler</Button>
                    <Button onClick={handleCreateMarketInsight} disabled={isPending}>Créer</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead>Prix</TableHead>
                    <TableHead>Tendance</TableHead>
                    <TableHead>Timing</TableHead>
                    <TableHead>MOQ</TableHead>
                    <TableHead>Fournisseurs</TableHead>
                    <TableHead>Mis à jour</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {marketInsights.map((insight) => (
                    <TableRow key={insight.id}>
                      <TableCell>
                        <div className="font-medium">{insight.product}</div>
                        <div className="text-xs text-muted-foreground">{insight.category || "-"}</div>
                      </TableCell>
                      <TableCell>{formatMoney(insight.currentPrice, "USD")}</TableCell>
                      <TableCell>{insight.marketTrend}</TableCell>
                      <TableCell>{insight.recommendedTiming}</TableCell>
                      <TableCell>{insight.averageMOQ}</TableCell>
                      <TableCell>{insight.supplierCount}</TableCell>
                      <TableCell>{formatDateSafe(insight.updatedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance & risques</CardTitle>
              <p className="text-sm text-muted-foreground">Dépendance fournisseurs, concentration et heatmap.</p>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <Card className="md:col-span-1">
                <CardHeader>
                  <CardTitle className="text-sm">Dépendance fournisseurs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {performance.dependency.map((row) => (
                    <div key={row.supplier} className="flex items-center justify-between text-sm">
                      <span>{row.supplier}</span>
                      <span>{row.dependency}%</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card className="md:col-span-1">
                <CardHeader>
                  <CardTitle className="text-sm">Concentration par catégorie</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {performance.categoryConcentration.map((row) => (
                    <div key={row.category} className="flex items-center justify-between text-sm">
                      <span>{row.category}</span>
                      <span>{row.count}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card className="md:col-span-1">
                <CardHeader>
                  <CardTitle className="text-sm">Heatmap risques</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {performance.heatmap.slice(0, 6).map((row) => (
                    <div key={row.supplier} className="text-sm">
                      <div className="font-medium">{row.supplier}</div>
                      <div className="text-xs text-muted-foreground">
                        Risque {row.globalRisk} | Qualité {row.quality} | Livraison {row.delivery}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="governance" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Gouvernance & Audit</CardTitle>
                <p className="text-sm text-muted-foreground">Décisions sourcing et justification associée.</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleExportAudit}>
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Entité</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{formatDateSafe(log.createdAt)}</TableCell>
                      <TableCell>{log.action}</TableCell>
                      <TableCell>{log.user?.name || log.user?.email || "-"}</TableCell>
                      <TableCell>{log.entityType || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="groupage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Groupage & consolidation</CardTitle>
              <p className="text-sm text-muted-foreground">
                Relier les cas de sourcing aux lots et générer les expéditions.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {groupageBatches.map((batch) => (
                <Card key={batch.id} className="border-dashed">
                  <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle className="text-sm">{batch.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {batch.destination} | {batch.mode} | {batch.status}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">Items {batch.items.length}</Badge>
                      <Badge variant="secondary">Shipments {batch.shipments?.length ?? 0}</Badge>
                      <Button size="sm" variant="outline" onClick={() => handleCreateShipments(batch.id)} disabled={isPending}>
                        <Truck className="mr-2 h-4 w-4" /> Créer expéditions
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-2">
                      {batch.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between rounded border p-2 text-sm">
                          <div>
                            <div className="font-medium">{item.sourcingCase?.order?.orderNumber || "-"}</div>
                            <div className="text-xs text-muted-foreground">{item.sourcingCase?.requirement || "-"}</div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.weightKg ? `${item.weightKg} kg` : "-"} / {item.cbm ? `${item.cbm} cbm` : "-"}
                          </div>
                        </div>
                      ))}
                      {batch.items.length === 0 && (
                        <div className="text-sm text-muted-foreground">Aucun item pour ce lot.</div>
                      )}
                    </div>
                    {batch.shipments && batch.shipments.length > 0 && (
                      <div className="flex flex-wrap gap-2 text-xs">
                        {batch.shipments.map((shipment) => (
                          <Badge key={shipment.id} variant="outline">
                            {shipment.status}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {groupageBatches.length === 0 && (
                <div className="text-sm text-muted-foreground">Aucun lot de groupage disponible.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
