
"use client";

import { useState, useTransition } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/empty-state";
import {
  ClipboardCheck,
  Plus,
  BarChart3,
  ListChecks,
  Trash2,
  Play,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Users,
  MessageSquare,
  ShieldCheck,
  Send,
  FlaskConical,
  Activity,
  Package,
  Sparkles,
  Loader2,
  Search,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { toast } from "sonner";
import { StableResponsiveChart } from "@/components/shared/stable-responsive-chart";
import {
  createQcPlan,
  deleteQcPlan,
  createQcInspection,
  startQcInspection,
  submitQcReport,
  createQcRequest,
  updateQcRequest,
  addQcReportToRequest,
  shareQcReportWithClient,
  createQcPartner,
  deleteQcPartner,
  createLabConnection,
  deleteLabConnection,
  submitTestToLab,
  fetchLabResults,
  analyzeQcPhotoWithAI,
  createSpcChart,
  getSpcChartData,
  addSpcDataPoint,
  createOrUpdateLotTrace,
  recallLot,
  getLotHistory,
  linkOrderToLot,
  linkQcRequestToLot,
} from "@/lib/actions/qc.actions";

type QcPlanRow = {
  id: string;
  name: string;
  type: string;
  productCategory: string | null;
  description: string | null;
  checklist: unknown;
  isActive: boolean;
  createdAt: Date;
  _count: { inspections: number };
};

type QcInspectionRow = {
  id: string;
  status: string;
  overall: string | null;
  defectRate: any;
  scheduledAt: Date;
  completedAt: Date | null;
  notes: string | null;
  plan: { id: string; name: string; type: string };
  order: { id: string; orderNumber: string } | null;
  supplier: { id: string; name: string } | null;
  inspector: { id: string; name: string } | null;
  items: Array<{ id: string; criterion: string; result: string | null; notes: string | null }>;
};

type QcRequestRow = {
  id: string;
  type: string;
  level: string;
  status: string;
  inspector?: string | null;
  cost?: any;
  currency?: string | null;
  scheduledAt?: Date | null;
  completedAt?: Date | null;
  decisionNotes?: string | null;
  order: { id: string; orderNumber: string; contact?: { name?: string | null; email?: string | null } | null };
  partner?: { id: string; name: string; city?: string | null; country?: string | null } | null;
  supplier?: { id: string; name: string } | null;
  product?: { id: string; name: string } | null;
  reports: Array<{ id: string; overallResult: string; defectRate?: any; summary?: string | null; createdAt: Date }>;
};

type QcReportRow = {
  id: string;
  overallResult: string;
  defectRate?: any;
  summary?: string | null;
  recommendation?: string | null;
  photos?: any;
  videos?: any;
  createdAt: Date;
  sharedWithClient: boolean;
  sharedAt?: Date | null;
  qcRequest: { id: string; order: { id: string; orderNumber: string; contact?: { name?: string | null; email?: string | null } | null } };
  nonConformities: Array<{ id: string; category: string; severity: string; description: string }>;
};

type QcPartnerRow = {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  email?: string | null;
  phone?: string | null;
  qcPartnerProfile?: {
    rating?: number | null;
    leadTimeDays?: number | null;
    basePrice?: any;
    priceGrid?: any;
    specialties?: string[];
  } | null;
};

type QcOptions = {
  orders: Array<{ id: string; orderNumber: string; contact?: { name?: string | null } | null }>;
  suppliers: Array<{ id: string; name: string; city?: string | null }>;
  products: Array<{ id: string; name: string; qcRecommendedLevel?: string | null }>;
  partners: Array<{ id: string; name: string; city?: string | null; country?: string | null; qcPartnerProfile?: any }>;
};

type DashboardData = {
  plansCount: number;
  total: number;
  scheduled: number;
  inProgress: number;
  completed: number;
  passed: number;
  failed: number;
  conditional: number;
  passRate: number;
  avgDefectRate: string;
  monthlyTrend: Array<{ label: string; total: number; pass: number; fail: number }>;
};

function overallBadge(overall: string | null) {
  if (!overall) return null;
  const map: Record<string, { label: string; color: string }> = {
    PASS: { label: "Conforme", color: "bg-green-100 text-green-800" },
    FAIL: { label: "Non conforme", color: "bg-red-100 text-red-800" },
    CONDITIONAL: { label: "Sous reserve", color: "bg-amber-100 text-amber-800" },
  };
  const s = map[overall] ?? { label: overall, color: "bg-gray-100 text-gray-700" };
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${s.color}`}>{s.label}</span>
  );
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    SCHEDULED: "bg-blue-100 text-blue-800",
    IN_PROGRESS: "bg-amber-100 text-amber-800",
    COMPLETED: "bg-green-100 text-green-800",
    CANCELLED: "bg-gray-100 text-gray-600",
  };
  const labels: Record<string, string> = {
    SCHEDULED: "Planifie",
    IN_PROGRESS: "En cours",
    COMPLETED: "Termine",
    CANCELLED: "Annule",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${map[status] ?? "bg-gray-100 text-gray-700"}`}>
      {labels[status] ?? status}
    </span>
  );
}

const QC_TYPES = ["INCOMING", "IN_PROCESS", "FINAL", "AUDIT"];
const QC_TYPE_LABELS: Record<string, string> = {
  INCOMING: "Reception",
  IN_PROCESS: "En production",
  FINAL: "Final",
  AUDIT: "Audit fournisseur",
};

const QC_LEVELS = [
  { value: "VIRTUAL", label: "QC virtuelle", description: "Photos, videos et controle visuel" },
  { value: "PHYSICAL", label: "QC physique", description: "Inspection physique avant expedition" },
  { value: "EXTREME", label: "QC approfondie", description: "Tests avances et certification" },
];

const QC_LEVEL_LABELS: Record<string, string> = {
  VIRTUAL: "QC virtuelle",
  PHYSICAL: "QC physique",
  EXTREME: "QC approfondie",
};

const QC_REQUEST_TYPES = [
  { value: "DURING_PRODUCTION", label: "Pendant la production" },
  { value: "PRE_SHIPMENT", label: "Avant expedition" },
  { value: "CONTAINER_LOADING", label: "Chargement conteneur" },
];

const QC_REQUEST_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  SCHEDULED: "Planifie",
  IN_PROGRESS: "En cours",
  PASSED: "Valide",
  FAILED: "Echoue",
  CONDITIONAL: "Sous reserve",
  CANCELLED: "Annule",
};

const QC_REQUEST_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-700",
  SCHEDULED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  PASSED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  CONDITIONAL: "bg-orange-100 text-orange-800",
  CANCELLED: "bg-gray-100 text-gray-600",
};

function requestStatusBadge(status: string) {
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${QC_REQUEST_STATUS_STYLES[status] ?? "bg-gray-100 text-gray-700"}`}>
      {QC_REQUEST_STATUS_LABELS[status] ?? status}
    </span>
  );
}

function formatDate(value?: Date | string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 10);
}

function formatMoney(value: any, currency?: string | null) {
  if (value === null || value === undefined) return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return "-";
  return `${num.toFixed(2)} ${currency ?? ""}`.trim();
}

function parseLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
function CreatePlanDialog({ onCreated }: { onCreated: (p: QcPlanRow) => void }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [type, setType] = useState("INCOMING");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [criteria, setCriteria] = useState<string[]>(["Conformité visuelle", "Dimensions", "Poids"]);
  const [newCriterion, setNewCriterion] = useState("");

  function addCriterion() {
    if (newCriterion.trim()) {
      setCriteria((prev) => [...prev, newCriterion.trim()]);
      setNewCriterion("");
    }
  }

  function handleSubmit() {
    if (!name.trim()) return;
    startTransition(async () => {
      const res = await createQcPlan({
        name,
        type,
        productCategory: category || undefined,
        description: description || undefined,
        checklist: criteria.map((c, i) => ({ criterion: c, weight: 1, required: true, id: String(i) })),
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success("Plan QC cree");
      onCreated(res.data as unknown as QcPlanRow);
      setOpen(false);
      setName("");
      setType("INCOMING");
      setCategory("");
      setDescription("");
      setCriteria(["Conformité visuelle", "Dimensions", "Poids"]);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-1 h-4 w-4" />Nouveau plan</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Creer un plan QC</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Nom du plan *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : controle textile a reception" /></div>
          <div><Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{QC_TYPES.map((t) => <SelectItem key={t} value={t}>{QC_TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Categorie produit</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex : textile, electronique" /></div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
          <div>
            <Label>Criteres de controle ({criteria.length})</Label>
            <div className="mt-1 space-y-1 max-h-32 overflow-y-auto border rounded p-2">
              {criteria.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span>{c}</span>
                  <button onClick={() => setCriteria(criteria.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-700">x</button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Input value={newCriterion} onChange={(e) => setNewCriterion(e.target.value)} placeholder="Ajouter un critere" onKeyDown={(e) => e.key === "Enter" && addCriterion()} className="flex-1" />
              <Button variant="outline" size="sm" onClick={addCriterion}>+</Button>
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={pending || !name.trim()} className="w-full">
            {pending ? "Creation..." : "Creer le plan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateInspectionDialog({
  plans,
  onCreated,
}: {
  plans: QcPlanRow[];
  onCreated: (i: QcInspectionRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [planId, setPlanId] = useState("");
  const [scheduledAt, setScheduledAt] = useState(new Date().toISOString().slice(0, 16));
  const [sampleSize, setSampleSize] = useState("30");
  const [notes, setNotes] = useState("");

  function handleSubmit() {
    if (!planId || !scheduledAt) return;
    startTransition(async () => {
      const res = await createQcInspection({
        planId,
        scheduledAt,
        sampleSize: sampleSize ? Number(sampleSize) : undefined,
        notes: notes || undefined,
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success("Inspection creee");
      onCreated(res.data as unknown as QcInspectionRow);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-1 h-4 w-4" />Nouvelle inspection</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Planifier une inspection</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>QC plan *</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger><SelectValue placeholder="Choisir un plan" /></SelectTrigger>
              <SelectContent>{plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Planifiee le *</Label><Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /></div>
          <div><Label>Taille echantillon</Label><Input type="number" value={sampleSize} onChange={(e) => setSampleSize(e.target.value)} placeholder="30" /></div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
          <Button onClick={handleSubmit} disabled={pending || !planId} className="w-full">
            {pending ? "Creation..." : "Creer l'inspection"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SubmitReportDialog({
  inspection,
  onSubmitted,
}: {
  inspection: QcInspectionRow;
  onSubmitted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [overall, setOverall] = useState<"PASS" | "FAIL" | "CONDITIONAL">("PASS");
  const [defectRate, setDefectRate] = useState("0");
  const [notes, setNotes] = useState("");
  const [itemResults, setItemResults] = useState<Record<string, "PASS" | "FAIL" | "NA">>(
    Object.fromEntries(inspection.items.map((it) => [it.id, (it.result as "PASS" | "FAIL" | "NA") || "PASS"]))
  );

  function handleSubmit() {
    startTransition(async () => {
      const res = await submitQcReport(inspection.id, {
        overall,
        defectRate: defectRate ? Number(defectRate) : undefined,
        notes: notes || undefined,
        items: inspection.items.map((it) => ({ id: it.id, result: itemResults[it.id] ?? "NA" })),
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success("Rapport soumis");
      onSubmitted();
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><ClipboardCheck className="mr-1 h-4 w-4" />Soumettre le rapport</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>QC report - {inspection.plan.name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Resultat global *</Label>
            <Select value={overall} onValueChange={(v) => setOverall(v as typeof overall)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PASS">Conforme</SelectItem>
                <SelectItem value="FAIL">Non conforme</SelectItem>
                <SelectItem value="CONDITIONAL">Sous reserve</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Taux de defaut (%)</Label><Input type="number" value={defectRate} onChange={(e) => setDefectRate(e.target.value)} step="0.1" min="0" max="100" /></div>

          {inspection.items.length > 0 && (
            <div>
              <Label>Points de controle ({inspection.items.length})</Label>
              <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                {inspection.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex-1 truncate">{item.criterion}</span>
                    <Select
                      value={itemResults[item.id] ?? "PASS"}
                      onValueChange={(v) => setItemResults((prev) => ({ ...prev, [item.id]: v as "PASS" | "FAIL" | "NA" }))}
                    >
                      <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PASS">Conforme</SelectItem>
                        <SelectItem value="FAIL">Non conforme</SelectItem>
                        <SelectItem value="NA">N/A</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
          <Button onClick={handleSubmit} disabled={pending} className="w-full">
            {pending ? "Soumission..." : "Soumettre le rapport"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
function CreateRequestDialog({
  options,
  onCreated,
}: {
  options: QcOptions;
  onCreated: (r: QcRequestRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [orderId, setOrderId] = useState("");
  const [type, setType] = useState("PRE_SHIPMENT");
  const [level, setLevel] = useState("VIRTUAL");
  const [partnerId, setPartnerId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [productId, setProductId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [cost, setCost] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [inspector, setInspector] = useState("");
  const [notes, setNotes] = useState("");

  function handleSubmit() {
    if (!orderId) return;
    startTransition(async () => {
      const res = await createQcRequest({
        orderId,
        type,
        level,
        partnerId: partnerId || undefined,
        supplierId: supplierId || undefined,
        productId: productId || undefined,
        inspector: inspector || undefined,
        cost: cost ? Number(cost) : undefined,
        currency,
        scheduledAt: scheduledAt || undefined,
        notes: notes || undefined,
      });
      if (res.error) { toast.error(res.error); return; }

      const order = options.orders.find((o) => o.id === orderId);
      const partner = options.partners.find((p) => p.id === partnerId);
      const supplier = options.suppliers.find((s) => s.id === supplierId);
      const product = options.products.find((p) => p.id === productId);

      const newRow: QcRequestRow = {
        ...(res.data as any),
        order: {
          id: orderId,
          orderNumber: order?.orderNumber ?? "N/A",
          contact: order?.contact ?? null,
        },
        partner: partner ? { id: partner.id, name: partner.name, city: partner.city, country: partner.country } : null,
        supplier: supplier ? { id: supplier.id, name: supplier.name } : null,
        product: product ? { id: product.id, name: product.name } : null,
        reports: [],
      };

      onCreated(newRow);
      toast.success("QC request created");
      setOpen(false);
      setOrderId("");
      setType("PRE_SHIPMENT");
      setLevel("VIRTUAL");
      setPartnerId("");
      setSupplierId("");
      setProductId("");
      setScheduledAt("");
      setCost("");
      setCurrency("USD");
      setInspector("");
      setNotes("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-1 h-4 w-4" />Nouvelle demande QC</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Creer une demande QC</DialogTitle></DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Order *</Label>
            <Select value={orderId} onValueChange={setOrderId}>
              <SelectTrigger><SelectValue placeholder="Choisir une commande" /></SelectTrigger>
              <SelectContent>
                {options.orders.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.orderNumber} {o.contact?.name ? `- ${o.contact.name}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Type de QC</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {QC_REQUEST_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Niveau QC</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {QC_LEVELS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Partenaire</Label>
            <Select value={partnerId} onValueChange={setPartnerId}>
              <SelectTrigger><SelectValue placeholder="Optionnel" /></SelectTrigger>
              <SelectContent>
                {options.partners.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} {p.city ? `(${p.city})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fournisseur</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger><SelectValue placeholder="Optionnel" /></SelectTrigger>
              <SelectContent>
                {options.suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} {s.city ? `(${s.city})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Produit</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue placeholder="Optionnel" /></SelectTrigger>
              <SelectContent>
                {options.products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} {p.qcRecommendedLevel ? `- ${QC_LEVEL_LABELS[p.qcRecommendedLevel] ?? p.qcRecommendedLevel}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Planifiee le</Label>
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Label>Cout</Label>
              <Input value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>Devise</Label>
              <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Inspector</Label>
            <Input value={inspector} onChange={(e) => setInspector(e.target.value)} placeholder="Partner or agent" />
          </div>
          <div className="md:col-span-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <Button onClick={handleSubmit} disabled={pending || !orderId} className="w-full mt-4">
          {pending ? "Creation..." : "Creer une demande QC"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
function CreatePartnerDialog({ onCreated }: { onCreated: (p: QcPartnerRow) => void }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("CN");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [specialties, setSpecialties] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [rating, setRating] = useState("70");
  const [priceGrid, setPriceGrid] = useState("");

  function handleSubmit() {
    if (!name.trim()) return;
    startTransition(async () => {
      let parsedGrid: Record<string, any> | undefined;
      if (priceGrid.trim()) {
        try {
          parsedGrid = JSON.parse(priceGrid);
        } catch (err) {
          toast.error("Invalid price grid JSON");
          return;
        }
      }

      const res = await createQcPartner({
        name,
        city: city || undefined,
        country: country || undefined,
        phone: phone || undefined,
        email: email || undefined,
        specialties: specialties ? specialties.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        leadTimeDays: leadTimeDays ? Number(leadTimeDays) : undefined,
        basePrice: basePrice ? Number(basePrice) : undefined,
        rating: rating ? Number(rating) : undefined,
        priceGrid: parsedGrid,
      });
      if (res.error) { toast.error(res.error); return; }

      const contact = (res.data as any).contact ?? {};
      const profile = (res.data as any).profile ?? {};
      onCreated({
        id: contact.id,
        name: contact.name,
        city: contact.city,
        country: contact.country,
        email: contact.email,
        phone: contact.phone,
        qcPartnerProfile: profile,
      });
      toast.success("Partner created");
      setOpen(false);
      setName("");
      setCity("");
      setCountry("CN");
      setPhone("");
      setEmail("");
      setSpecialties("");
      setLeadTimeDays("");
      setBasePrice("");
      setRating("70");
      setPriceGrid("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-1 h-4 w-4" />Nouveau partenaire</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Creer un partenaire QC</DialogTitle></DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Nom du partenaire *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Company or inspector" />
          </div>
          <div><Label>City</Label><Input value={city} onChange={(e) => setCity(e.target.value)} /></div>
          <div><Label>Country</Label><Input value={country} onChange={(e) => setCountry(e.target.value)} /></div>
          <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="md:col-span-2">
            <Label>Specialites (separees par des virgules)</Label>
            <Input value={specialties} onChange={(e) => setSpecialties(e.target.value)} placeholder="Electronics, Textile" />
          </div>
          <div><Label>Delai (jours)</Label><Input value={leadTimeDays} onChange={(e) => setLeadTimeDays(e.target.value)} /></div>
          <div><Label>Prix de base (USD)</Label><Input value={basePrice} onChange={(e) => setBasePrice(e.target.value)} /></div>
          <div><Label>Note (0-100)</Label><Input value={rating} onChange={(e) => setRating(e.target.value)} /></div>
          <div className="md:col-span-2">
            <Label>Grille tarifaire (JSON)</Label>
            <Textarea value={priceGrid} onChange={(e) => setPriceGrid(e.target.value)} rows={3} placeholder='{"electronics": 120, "textile": 80}' />
          </div>
        </div>
        <Button onClick={handleSubmit} disabled={pending || !name.trim()} className="w-full mt-4">
          {pending ? "Creation..." : "Creer le partenaire"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
function AddReportDialog({
  request,
  onAdded,
}: {
  request: QcRequestRow;
  onAdded: (r: QcReportRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [overall, setOverall] = useState<"PASS" | "FAIL" | "CONDITIONAL">("PASS");
  const [defectRate, setDefectRate] = useState("");
  const [summary, setSummary] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [photos, setPhotos] = useState("");
  const [videos, setVideos] = useState("");
  const [packagingVideo, setPackagingVideo] = useState("");
  const [quantityConfirmed, setQuantityConfirmed] = useState(true);
  const [qualityConfirmed, setQualityConfirmed] = useState(true);
  const [packagingConfirmed, setPackagingConfirmed] = useState(true);
  const [nonConformities, setNonConformities] = useState<
    Array<{ category: string; severity: string; description: string }>
  >([]);

  function addNonConformity() {
    setNonConformities((prev) => [...prev, { category: "", severity: "LOW", description: "" }]);
  }

  function updateNonConformity(index: number, patch: Partial<{ category: string; severity: string; description: string }>) {
    setNonConformities((prev) => prev.map((n, i) => (i === index ? { ...n, ...patch } : n)));
  }

  function handleSubmit() {
    startTransition(async () => {
      const res = await addQcReportToRequest(request.id, {
        overallResult: overall,
        defectRate: defectRate ? Number(defectRate) : undefined,
        recommendation: recommendation || undefined,
        summary: summary || undefined,
        photos: parseLines(photos),
        videos: parseLines(videos),
        packagingVideo: packagingVideo || undefined,
        quantityConfirmed,
        qualityConfirmed,
        packagingConfirmed,
        nonConformities: nonConformities
          .filter((n) => n.category || n.description)
          .map((n) => ({ ...n, severity: n.severity || "LOW" })),
      });
      if (res.error) { toast.error(res.error); return; }
      const report = res.data as any;
      const newReport: QcReportRow = {
        ...report,
        qcRequest: { id: request.id, order: request.order },
        nonConformities: report.nonConformities ?? [],
        sharedWithClient: report.sharedWithClient ?? false,
      };
      onAdded(newReport);
      toast.success("Rapport QC ajoute");
      setOpen(false);
      setOverall("PASS");
      setDefectRate("");
      setSummary("");
      setRecommendation("");
      setPhotos("");
      setVideos("");
      setPackagingVideo("");
      setQuantityConfirmed(true);
      setQualityConfirmed(true);
      setPackagingConfirmed(true);
      setNonConformities([]);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><ClipboardCheck className="mr-1 h-4 w-4" />Add report</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>QC report - {request.order.orderNumber}</DialogTitle></DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Resultat global *</Label>
            <Select value={overall} onValueChange={(v) => setOverall(v as typeof overall)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PASS">Conforme</SelectItem>
                <SelectItem value="FAIL">Non conforme</SelectItem>
                <SelectItem value="CONDITIONAL">Sous reserve</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Taux de defaut (%)</Label>
            <Input value={defectRate} onChange={(e) => setDefectRate(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Resume</Label>
            <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} />
          </div>
          <div className="md:col-span-2">
            <Label>Recommandation</Label>
            <Textarea value={recommendation} onChange={(e) => setRecommendation(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Photos (une URL par ligne)</Label>
            <Textarea value={photos} onChange={(e) => setPhotos(e.target.value)} rows={3} />
          </div>
          <div>
            <Label>Videos (une URL par ligne)</Label>
            <Textarea value={videos} onChange={(e) => setVideos(e.target.value)} rows={3} />
          </div>
          <div className="md:col-span-2">
            <Label>URL video emballage</Label>
            <Input value={packagingVideo} onChange={(e) => setPackagingVideo(e.target.value)} />
          </div>
          <div className="md:col-span-2 flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Input type="checkbox" checked={quantityConfirmed} onChange={(e) => setQuantityConfirmed(e.target.checked)} className="h-4 w-4" />
              Quantity confirmed
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Input type="checkbox" checked={qualityConfirmed} onChange={(e) => setQualityConfirmed(e.target.checked)} className="h-4 w-4" />
              Quality confirmed
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Input type="checkbox" checked={packagingConfirmed} onChange={(e) => setPackagingConfirmed(e.target.checked)} className="h-4 w-4" />
              Packaging confirmed
            </label>
          </div>
          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <Label>Non conformities</Label>
              <Button size="sm" variant="outline" onClick={addNonConformity}>Add anomaly</Button>
            </div>
            {nonConformities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No anomalies recorded.</p>
            ) : (
              <div className="space-y-2">
                {nonConformities.map((n, idx) => (
                  <div key={idx} className="grid gap-2 md:grid-cols-3">
                    <Input value={n.category} onChange={(e) => updateNonConformity(idx, { category: e.target.value })} placeholder="Category" />
                    <Select value={n.severity} onValueChange={(v) => updateNonConformity(idx, { severity: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="CRITICAL">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input value={n.description} onChange={(e) => updateNonConformity(idx, { description: e.target.value })} placeholder="Description" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <Button onClick={handleSubmit} disabled={pending} className="w-full mt-4">
          {pending ? "Saving..." : "Save report"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
export function QcClient({
  dashboard,
  plans: initialPlans,
  inspections: initialInspections,
  requests: initialRequests,
  reports: initialReports,
  partners: initialPartners,
  options,
  labConnections: initialLabConnections,
  labTests: initialLabTests,
  spcCharts: initialSpcCharts,
  lotTraces: initialLotTraces,
}: {
  dashboard: DashboardData;
  plans: QcPlanRow[];
  inspections: QcInspectionRow[];
  requests: QcRequestRow[];
  reports: QcReportRow[];
  partners: QcPartnerRow[];
  options: QcOptions;
  labConnections: any[];
  labTests: any[];
  spcCharts: any[];
  lotTraces: any[];
}) {
  const [plans, setPlans] = useState(initialPlans);
  const [inspections, setInspections] = useState(initialInspections);
  const [requests, setRequests] = useState(initialRequests);
  const [reports, setReports] = useState(initialReports);
  const [partners, setPartners] = useState(initialPartners);
  const [labConnections, setLabConnections] = useState(initialLabConnections);
  const [labTests, setLabTests] = useState(initialLabTests);
  const [spcCharts, setSpcCharts] = useState(initialSpcCharts);
  const [lotTraces, setLotTraces] = useState(initialLotTraces);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [levelFilter, setLevelFilter] = useState("ALL");
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [shareNotes, setShareNotes] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [lotSearch, setLotSearch] = useState("");
  const [lotHistory, setLotHistory] = useState<any>(null);
  const [lotSearching, setLotSearching] = useState(false);
  const [selectedSpcChart, setSelectedSpcChart] = useState<string>("");
  const [spcPointValue, setSpcPointValue] = useState("");
  const [selectedLabConnections, setSelectedLabConnections] = useState<Record<string, string>>({});
  const [aiAnalysisByPhoto, setAiAnalysisByPhoto] = useState<Record<string, any>>({});
  const [lotDraft, setLotDraft] = useState({ lotNumber: "", productId: "", supplierId: "" });
  const [lotOrderId, setLotOrderId] = useState("");
  const [lotRequestId, setLotRequestId] = useState("");
  const [recallDialog, setRecallDialog] = useState<{ open: boolean; lotNumber: string }>({
    open: false,
    lotNumber: "",
  });
  const [recallReason, setRecallReason] = useState("");

  const filteredRequests = requests.filter((r) => {
    if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
    if (levelFilter !== "ALL" && r.level !== levelFilter) return false;
    return true;
  });

  const pendingReports = reports.filter((r) => !r.sharedWithClient);

  function handleRequestUpdate(id: string, patch: any) {
    startTransition(async () => {
      const res = await updateQcRequest(id, patch);
      if (res.error) { toast.error(res.error); return; }
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, ...(res.data as any) } : r)));
      toast.success("QC request updated");
    });
  }

  function handleDeletePlan(planId: string) {
    startTransition(async () => {
      const res = await deleteQcPlan(planId);
      if (res.error) { toast.error(res.error); return; }
      setPlans((prev) => prev.filter((p) => p.id !== planId));
      toast.success("Plan deleted");
    });
  }

  function getReportPhotos(report: QcReportRow) {
    if (Array.isArray(report.photos)) {
      return report.photos.filter((photo): photo is string => typeof photo === "string");
    }
    return [];
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Requests</CardTitle>
            <ListChecks className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{requests.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Partners</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{partners.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Inspections</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{dashboard.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Taux de conformite</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{dashboard.passRate}%</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg defects</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{dashboard.avgDefectRate}%</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Rapports QC</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{reports.length}</div></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="requests" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 md:grid-cols-8">
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="partners">Partners</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="decision">Decision</TabsTrigger>
          <TabsTrigger value="client">Client</TabsTrigger>
          <TabsTrigger value="labs" className="flex items-center gap-1"><FlaskConical className="h-3.5 w-3.5" />Laboratoires</TabsTrigger>
          <TabsTrigger value="spc" className="flex items-center gap-1"><Activity className="h-3.5 w-3.5" />SPC</TabsTrigger>
          <TabsTrigger value="tracabilite" className="flex items-center gap-1"><Package className="h-3.5 w-3.5" />Lots</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Statut" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous les statuts</SelectItem>
                  {Object.keys(QC_REQUEST_STATUS_LABELS).map((s) => (
                    <SelectItem key={s} value={s}>{QC_REQUEST_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Niveau" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous les niveaux</SelectItem>
                  {QC_LEVELS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <CreateRequestDialog
              options={options}
              onCreated={(r) => setRequests((prev) => [r, ...prev])}
            />
          </div>

          {filteredRequests.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <EmptyState
                  title="Aucune demande QC"
                  description="Cr�ez une demande de contr�le qualit� pour planifier une inspection, un rapport ou un envoi vers un laboratoire."
                />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map((req) => {
                const latestReport = req.reports?.[0];
                return (
                  <Card key={req.id}>
                    <CardHeader className="flex flex-row items-start justify-between gap-4">
                      <div className="space-y-1">
                        <CardTitle className="text-base">{req.order.orderNumber}</CardTitle>
                        <div className="text-sm text-muted-foreground">
                          {req.order.contact?.name ?? "Client inconnu"}
                          {req.supplier ? ` � Fournisseur : ${req.supplier.name}` : ""}
                          {req.product ? ` � Produit : ${req.product.name}` : ""}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Niveau : {QC_LEVEL_LABELS[req.level] ?? req.level} � Type : {req.type}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {requestStatusBadge(req.status)}
                        <span className="text-xs text-muted-foreground">Scheduled: {formatDate(req.scheduledAt)}</span>
                        <span className="text-xs text-muted-foreground">Cost: {formatMoney(req.cost, req.currency)}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {latestReport ? (
                        <div className="rounded border bg-slate-50 p-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">Latest report</span>
                            {overallBadge(latestReport.overallResult)}
                          </div>
                          <p className="text-muted-foreground mt-1">{latestReport.summary ?? "Aucun resume"}</p>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">No report yet.</div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRequestUpdate(req.id, { status: "IN_PROGRESS" })}
                          disabled={pending}
                        >
                          <Play className="mr-1 h-4 w-4" /> Start
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRequestUpdate(req.id, { status: "PASSED" })}
                          disabled={pending}
                        >
                          <CheckCircle className="mr-1 h-4 w-4" /> Valider
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRequestUpdate(req.id, { status: "CONDITIONAL" })}
                          disabled={pending}
                        >
                          <AlertTriangle className="mr-1 h-4 w-4" /> Sous reserve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRequestUpdate(req.id, { status: "FAILED" })}
                          disabled={pending}
                        >
                          <XCircle className="mr-1 h-4 w-4" /> Echec
                        </Button>
                        <AddReportDialog
                          request={req}
                          onAdded={(report) => {
                            setReports((prev) => [report, ...prev]);
                            const statusFromReport =
                              report.overallResult === "PASS" ? "PASSED" : report.overallResult === "CONDITIONAL" ? "CONDITIONAL" : "FAILED";
                            setRequests((prev) =>
                              prev.map((r) =>
                                r.id === req.id ? { ...r, status: statusFromReport, reports: [report, ...(r.reports ?? [])] } : r
                              )
                            );
                          }}
                        />
                        {labConnections.filter((connection: any) => connection.isActive).length > 0 && (
                          <>
                            <Select
                              value={
                                selectedLabConnections[req.id] ??
                                labConnections.find((connection: any) => connection.isActive)?.id ??
                                ""
                              }
                              onValueChange={(value) =>
                                setSelectedLabConnections((prev) => ({ ...prev, [req.id]: value }))
                              }
                            >
                              <SelectTrigger className="h-9 w-[220px]">
                                <SelectValue placeholder="Choisir un laboratoire" />
                              </SelectTrigger>
                              <SelectContent>
                                {labConnections
                                  .filter((connection: any) => connection.isActive)
                                  .map((connection: any) => (
                                    <SelectItem key={connection.id} value={connection.id}>
                                      {connection.provider} - {connection.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={pending}
                              onClick={() => {
                                const connectionId =
                                  selectedLabConnections[req.id] ??
                                  labConnections.find((connection: any) => connection.isActive)?.id;
                                if (!connectionId) {
                                  toast.error("Choisissez une connexion laboratoire");
                                  return;
                                }
                                startTransition(async () => {
                                  const res = await submitTestToLab(req.id, connectionId);
                                  if (res.error) {
                                    toast.error(res.error);
                                    return;
                                  }
                                  setLabTests((prev) => [res.data, ...prev]);
                                  toast.success("Test soumis au laboratoire");
                                });
                              }}
                            >
                              <FlaskConical className="mr-1 h-4 w-4" /> Soumettre au laboratoire
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="partners" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">QC partner network</h3>
              <p className="text-sm text-muted-foreground">Manage partner pricing, lead time, and specialization.</p>
            </div>
            <CreatePartnerDialog onCreated={(p) => setPartners((prev) => [p, ...prev])} />
          </div>
          {partners.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No partners yet.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {partners.map((p) => (
                <Card key={p.id}>
                  <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{p.city ?? "Unknown city"} {p.country ? `� ${p.country}` : ""}</p>
                      <p className="text-xs text-muted-foreground">{p.email ?? ""} {p.phone ? `� ${p.phone}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{p.qcPartnerProfile?.rating ?? 0}/100</Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          startTransition(async () => {
                            const res = await deleteQcPartner(p.id);
                            if (res.error) { toast.error(res.error); return; }
                            setPartners((prev) => prev.filter((x) => x.id !== p.id));
                            toast.success("Partner deleted");
                          });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-2 text-sm md:grid-cols-3">
                    <div><span className="text-muted-foreground">Lead time:</span> {p.qcPartnerProfile?.leadTimeDays ?? "-"} days</div>
                    <div><span className="text-muted-foreground">Base price:</span> {formatMoney(p.qcPartnerProfile?.basePrice, "USD")}</div>
                    <div><span className="text-muted-foreground">Specialties:</span> {(p.qcPartnerProfile?.specialties ?? []).join(", ") || "-"}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Inspections</CardTitle>
                <CreateInspectionDialog
                  plans={plans}
                  onCreated={(i) => setInspections((prev) => [i, ...prev])}
                />
              </CardHeader>
              <CardContent className="space-y-2">
                {inspections.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No inspections.</p>
                ) : (
                  inspections.map((i) => (
                    <div key={i.id} className="flex items-start justify-between gap-3 rounded border p-3">
                      <div>
                        <p className="text-sm font-medium">{i.plan.name}</p>
                        <p className="text-xs text-muted-foreground">Scheduled: {formatDate(i.scheduledAt)}</p>
                        <p className="text-xs text-muted-foreground">Order: {i.order?.orderNumber ?? "-"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {statusBadge(i.status)}
                        {i.status === "SCHEDULED" && (
                          <Button size="sm" variant="outline" onClick={() => startTransition(async () => {
                            const res = await startQcInspection(i.id);
                            if (res.error) { toast.error(res.error); return; }
                            setInspections((prev) => prev.map((x) => (x.id === i.id ? { ...x, status: "IN_PROGRESS" } : x)));
                          })}>
                            Start
                          </Button>
                        )}
                        {(i.status === "IN_PROGRESS" || i.status === "COMPLETED") && (
                          <SubmitReportDialog inspection={i} onSubmitted={() => toast.success("Rapport soumis")} />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Plans QC</CardTitle>
                <CreatePlanDialog onCreated={(p) => setPlans((prev) => [p, ...prev])} />
              </CardHeader>
              <CardContent className="space-y-2">
                {plans.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No plans created yet.</p>
                ) : (
                  plans.map((p) => (
                    <div key={p.id} className="flex items-start justify-between gap-3 rounded border p-3">
                      <div>
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{QC_TYPE_LABELS[p.type] ?? p.type}</p>
                        <p className="text-xs text-muted-foreground">Categorie : {p.productCategory ?? "-"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{p._count.inspections} inspections</Badge>
                        <Button size="icon" variant="ghost" onClick={() => handleDeletePlan(p.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Rapports QC</CardTitle>
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-3">
              {reports.length === 0 ? (
                <EmptyState
                  title="Aucun rapport QC"
                  description="Les rapports d'inspection, les photos et les non-conformit�s appara�tront ici d�s leur cr�ation."
                />
              ) : (
                reports.map((r) => (
                  <div key={r.id} className="flex items-start justify-between gap-4 rounded border p-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium">Order {r.qcRequest.order.orderNumber}</p>
                      <p className="text-xs text-muted-foreground">{r.qcRequest.order.contact?.name ?? "Client unknown"}</p>
                      <p className="text-xs text-muted-foreground">Resume : {r.summary ?? "Aucun resume"}</p>
                      {getReportPhotos(r).length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Analyse photo IA</p>
                          <div className="space-y-2">
                            {getReportPhotos(r).slice(0, 3).map((photoUrl) => {
                              const analysis = aiAnalysisByPhoto[photoUrl];
                              return (
                                <div
                                  key={photoUrl}
                                  className="rounded-md border border-dashed bg-background/70 p-2 text-xs"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <a
                                      href={photoUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="truncate text-primary underline"
                                    >
                                      {photoUrl}
                                    </a>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={pending}
                                      onClick={() => {
                                        startTransition(async () => {
                                          const res = await analyzeQcPhotoWithAI(
                                            photoUrl,
                                            r.nonConformities[0]?.id
                                          );
                                          if (res.error) {
                                            toast.error(res.error);
                                            return;
                                          }
                                          setAiAnalysisByPhoto((prev) => ({
                                            ...prev,
                                            [photoUrl]: res.data,
                                          }));
                                          toast.success("Analyse IA termin�e");
                                        });
                                      }}
                                    >
                                      <Sparkles className="mr-1 h-3.5 w-3.5" /> Analyser avec IA
                                    </Button>
                                  </div>
                                  {analysis && (
                                    <div className="mt-2 space-y-1 text-muted-foreground">
                                      <p>
                                        Severite globale:{" "}
                                        <span className="font-medium text-foreground">
                                          {analysis.overallSeverity ?? "-"}
                                        </span>
                                      </p>
                                      <p>
                                        Recommandation:{" "}
                                        <span className="text-foreground">
                                          {analysis.recommendation ?? "-"}
                                        </span>
                                      </p>
                                      <p>
                                        Defauts detectes:{" "}
                                        <span className="text-foreground">
                                          {Array.isArray(analysis.defects) ? analysis.defects.length : 0}
                                        </span>
                                      </p>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {overallBadge(r.overallResult)}
                      <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="decision" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Decision engine</CardTitle>
              <p className="text-sm text-muted-foreground">Validez le resultat QC et ajoutez des notes de decision.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {requests.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune demande QC.</p>
              ) : (
                requests.map((req) => (
                  <div key={req.id} className="rounded border p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{req.order.orderNumber}</p>
                        <p className="text-xs text-muted-foreground">Niveau : {QC_LEVEL_LABELS[req.level] ?? req.level}</p>
                      </div>
                      {requestStatusBadge(req.status)}
                    </div>
                    <Textarea
                      value={decisionNotes[req.id] ?? req.decisionNotes ?? ""}
                      onChange={(e) => setDecisionNotes((prev) => ({ ...prev, [req.id]: e.target.value }))}
                      rows={2}
                      placeholder="Notes de decision pour le client, le fournisseur et la logistique"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleRequestUpdate(req.id, { status: "PASSED", decisionNotes: decisionNotes[req.id] })}>
                        Pass
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleRequestUpdate(req.id, { status: "CONDITIONAL", decisionNotes: decisionNotes[req.id] })}>
                        Conditional
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleRequestUpdate(req.id, { status: "FAILED", decisionNotes: decisionNotes[req.id] })}>
                        Fail
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="client" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Client communication</CardTitle>
              <p className="text-sm text-muted-foreground">Partagez les rapports QC et les confirmations avec le client.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingReports.length === 0 ? (
                <p className="text-sm text-muted-foreground">All reports are shared.</p>
              ) : (
                pendingReports.map((r) => (
                  <div key={r.id} className="rounded border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Order {r.qcRequest.order.orderNumber}</p>
                        <p className="text-xs text-muted-foreground">{r.qcRequest.order.contact?.name ?? "Client unknown"} {r.qcRequest.order.contact?.email ? `� ${r.qcRequest.order.contact?.email}` : ""}</p>
                      </div>
                      {overallBadge(r.overallResult)}
                    </div>
                    <Textarea
                      value={shareNotes[r.id] ?? r.summary ?? ""}
                      onChange={(e) => setShareNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      rows={2}
                      placeholder="Message to client"
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        startTransition(async () => {
                          const res = await shareQcReportWithClient(r.id, shareNotes[r.id]);
                          if (res.error) { toast.error(res.error); return; }
                          setReports((prev) => prev.map((x) => (x.id === r.id ? { ...x, sharedWithClient: true, sharedAt: new Date() } : x)));
                          toast.success("Report shared");
                        });
                      }}
                    >
                      <Send className="mr-1 h-4 w-4" /> Share with client
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* -- Tab Laboratoires ------------------------------------------- */}
        <TabsContent value="labs" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5" /> Connexions Laboratoire
              </CardTitle>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="mr-1 h-4 w-4" />Nouvelle connexion</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Nouvelle connexion laboratoire</DialogTitle></DialogHeader>
                  <form
                    action={async (fd: FormData) => {
                      startTransition(async () => {
                        const res = await createLabConnection(fd);
                        if (res.error) { toast.error(res.error); return; }
                        setLabConnections(prev => [res.data as any, ...prev]);
                        toast.success("Connexion cr��e");
                      });
                    }}
                    className="space-y-3 pt-2"
                  >
                    <div>
                      <Label>Fournisseur</Label>
                      <select name="provider" className="mt-1 h-9 w-full rounded-md border bg-transparent px-3 text-sm">
                        <option value="SGS">SGS</option>
                        <option value="BUREAU_VERITAS">Bureau Veritas</option>
                        <option value="TUV">T�V</option>
                        <option value="INTERTEK">Intertek</option>
                        <option value="CUSTOM">Personnalis�</option>
                      </select>
                    </div>
                    <div><Label>Nom</Label><Input name="name" placeholder="Ex: SGS Guangzhou" required className="mt-1" /></div>
                    <div><Label>URL API</Label><Input name="apiEndpoint" placeholder="https://api.lab.com/v1" required className="mt-1" /></div>
                    <div><Label>Cl� API</Label><Input name="apiKey" type="password" required className="mt-1" /></div>
                    <Button type="submit" className="w-full">Cr�er</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {labConnections.length === 0 ? (
                <EmptyState
                  title="Aucune connexion laboratoire"
                  description="Ajoutez une connexion SGS, Bureau Veritas, TUV, Intertek ou un endpoint personnalise pour envoyer des tests."
                />
              ) : (
                <div className="space-y-2">
                  {labConnections.map((conn: any) => (
                    <div key={conn.id} className="flex items-center justify-between rounded border p-3">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{conn.provider}</Badge>
                        <div>
                          <p className="text-sm font-medium">{conn.name}</p>
                          <p className="text-xs text-muted-foreground">{conn.apiEndpoint}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={conn.isActive ? "default" : "secondary"}>
                          {conn.isActive ? "Actif" : "Inactif"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{conn._count?.tests ?? 0} tests</span>
                        <Button size="sm" variant="ghost" onClick={() => {
                          startTransition(async () => {
                            const res = await deleteLabConnection(conn.id);
                            if (res.error) { toast.error(res.error); return; }
                            setLabConnections(prev => prev.filter(c => c.id !== conn.id));
                            toast.success("Connexion supprim�e");
                          });
                        }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Tests laboratoire ({labTests.length})</CardTitle></CardHeader>
            <CardContent>
              {labTests.length === 0 ? (
                <EmptyState
                  title="Aucun test laboratoire"
                  description='Utilisez "Soumettre au laboratoire" depuis une demande QC pour cr�er un test externe.'
                />
              ) : (
                <div className="space-y-2">
                  {labTests.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between rounded border p-3 text-sm">
                      <div>
                        <p className="font-medium">{t.connection?.name}</p>
                        <p className="text-xs text-muted-foreground">Request: {t.qcRequestId.slice(0, 8)}�</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          t.status === "COMPLETED" ? "default" :
                          t.status === "FAILED" ? "destructive" : "secondary"
                        }>{t.status}</Badge>
                        {t.reportUrl && (
                          <a href={t.reportUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline">Rapport</a>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => {
                            startTransition(async () => {
                              const res = await fetchLabResults(t.id);
                              if (res.error) {
                                toast.error(res.error);
                                return;
                              }
                              setLabTests((prev) =>
                                prev.map((test: any) => (test.id === t.id ? { ...test, ...res.data } : test))
                              );
                              toast.success("Resultats laboratoire mis a jour");
                            });
                          }}
                        >
                          Rafraichir resultats
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          {new Date(t.submittedAt).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* -- Tab SPC --------------------------------------------------- */}
        <TabsContent value="spc" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Contr�le Statistique des Proc�d�s</h3>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-1 h-4 w-4" />Nouveau graphique</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nouveau graphique SPC</DialogTitle></DialogHeader>
                <form
                  action={async (fd: FormData) => {
                    startTransition(async () => {
                      const res = await createSpcChart(fd);
                      if (res.error) { toast.error(res.error); return; }
                      setSpcCharts(prev => [res.data as any, ...prev]);
                      toast.success("Graphique cr��");
                    });
                  }}
                  className="space-y-3 pt-2"
                >
                  <div><Label>Nom</Label><Input name="name" placeholder="Ex: Taux de d�fauts - Produit A" required className="mt-1" /></div>
                  <div>
                    <Label>M�trique</Label>
                    <select name="metric" className="mt-1 h-9 w-full rounded-md border bg-transparent px-3 text-sm">
                      <option value="defect_rate">Taux de d�fauts</option>
                      <option value="dimension">Dimension</option>
                      <option value="weight">Poids</option>
                      <option value="custom">Personnalis�</option>
                    </select>
                  </div>
                  <Button type="submit" className="w-full">Cr�er</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {spcCharts.some((chart: any) => (chart.dataPoints ?? []).some((point: any) => point.isOutOfControl)) && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              Au moins un point SPC est hors controle. Verifiez les graphiques et declenchez une revue qualite.
            </div>
          )}

          {spcCharts.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <EmptyState
                  title="Aucun graphique SPC"
                  description="Creez un graphique pour suivre les mesures, recalculer UCL/LCL et detecter les derives."
                />
              </CardContent>
            </Card>
          ) : (
            spcCharts.map((chart: any) => {
              const pts = chart.dataPoints ?? [];
              const outOfControl = pts.filter((p: any) => p.isOutOfControl).length;
              return (
                <Card key={chart.id}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div>
                      <CardTitle className="text-base">{chart.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{chart.metric} � {pts.length} points</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {outOfControl > 0 && (
                        <Badge variant="destructive">{outOfControl} hors contr�le</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {pts.length > 0 ? (
                      <StableResponsiveChart className="h-[220px]" minHeight={220}>
                        <LineChart data={pts.map((p: any, i: number) => ({ x: i + 1, value: Number(p.value), outOfControl: p.isOutOfControl }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="x" />
                          <YAxis />
                          <Tooltip />
                          {chart.ucl != null && <ReferenceLine y={Number(chart.ucl)} stroke="red" strokeDasharray="4 2" label={{ value: "UCL", position: "right", fontSize: 11 }} />}
                          {chart.lcl != null && <ReferenceLine y={Number(chart.lcl)} stroke="red" strokeDasharray="4 2" label={{ value: "LCL", position: "right", fontSize: 11 }} />}
                          {chart.mean != null && <ReferenceLine y={Number(chart.mean)} stroke="green" strokeDasharray="4 2" label={{ value: "�", position: "right", fontSize: 11 }} />}
                          <Line type="monotone" dataKey="value" stroke="#2563eb" dot={(dotProps: any) => {
                            const pt = pts[dotProps.index];
                            return <circle key={dotProps.index} cx={dotProps.cx} cy={dotProps.cy} r={4} fill={pt?.isOutOfControl ? "#ef4444" : "#22c55e"} />;
                          }} />
                        </LineChart>
                      </StableResponsiveChart>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">Aucun point de donn�es. Ajoutez en-dessous.</p>
                    )}
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Valeur mesur�e"
                        value={selectedSpcChart === chart.id ? spcPointValue : ""}
                        onChange={(e) => { setSelectedSpcChart(chart.id); setSpcPointValue(e.target.value); }}
                        className="h-8 w-40"
                      />
                      <Button size="sm" onClick={() => {
                        if (!spcPointValue) return;
                        startTransition(async () => {
                          const res = await addSpcDataPoint(chart.id, parseFloat(spcPointValue));
                          if (res.error) { toast.error(res.error); return; }
                          const refreshed = await getSpcChartData(chart.id);
                          if (refreshed.data) {
                            setSpcCharts((prev) => prev.map((c) => (c.id === chart.id ? refreshed.data : c)));
                          }
                          setSpcPointValue("");
                          setSelectedSpcChart("");
                          toast.success("Point ajout�");
                        });
                      }}>
                        <Plus className="mr-1 h-3.5 w-3.5" />Ajouter mesure
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* -- Tab Tra�abilit� Lots ---------------------------------------- */}
        <TabsContent value="tracabilite" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Recherche de lot</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-lg border p-3 space-y-3">
                  <div>
                    <p className="text-sm font-medium">Creer ou mettre a jour un lot</p>
                    <p className="text-xs text-muted-foreground">Enregistrez un lot, puis rattachez commandes et demandes QC.</p>
                  </div>
                  <Input
                    placeholder="Numero de lot"
                    value={lotDraft.lotNumber}
                    onChange={(event) => setLotDraft((prev) => ({ ...prev, lotNumber: event.target.value }))}
                  />
                  <Select
                    value={lotDraft.productId || "none"}
                    onValueChange={(value) => setLotDraft((prev) => ({ ...prev, productId: value === "none" ? "" : value }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Produit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun produit</SelectItem>
                      {options.products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={lotDraft.supplierId || "none"}
                    onValueChange={(value) => setLotDraft((prev) => ({ ...prev, supplierId: value === "none" ? "" : value }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Fournisseur" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun fournisseur</SelectItem>
                      {options.suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    disabled={pending || !lotDraft.lotNumber.trim()}
                    onClick={() => {
                      startTransition(async () => {
                        const res = await createOrUpdateLotTrace(lotDraft.lotNumber.trim(), {
                          productId: lotDraft.productId || undefined,
                          supplierId: lotDraft.supplierId || undefined,
                        });
                        if (res.error) {
                          toast.error(res.error);
                          return;
                        }
                        if (!res.data) {
                          toast.error("Lot introuvable apres creation");
                          return;
                        }
                        setLotTraces((prev) => {
                          const existingIndex = prev.findIndex((lot: any) => lot.id === res.data.id);
                          if (existingIndex >= 0) {
                            return prev.map((lot: any) => (lot.id === res.data.id ? res.data : lot));
                          }
                          return [res.data, ...prev];
                        });
                        setLotSearch(lotDraft.lotNumber.trim());
                        toast.success("Lot enregistre");
                      });
                    }}
                  >
                    Enregistrer le lot
                  </Button>
                </div>

                <div className="rounded-lg border p-3 space-y-3">
                  <div>
                    <p className="text-sm font-medium">Lier une commande</p>
                    <p className="text-xs text-muted-foreground">Associez une commande a un lot pour reconstituer l'historique.</p>
                  </div>
                  <Select value={lotOrderId || "none"} onValueChange={(value) => setLotOrderId(value === "none" ? "" : value)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Commande" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune commande</SelectItem>
                      {options.orders.map((order) => (
                        <SelectItem key={order.id} value={order.id}>
                          {order.orderNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending || !lotSearch.trim() || !lotOrderId}
                    onClick={() => {
                      startTransition(async () => {
                        const res = await linkOrderToLot(lotSearch.trim(), lotOrderId);
                        if (res.error) {
                          toast.error(res.error);
                          return;
                        }
                        toast.success("Commande liee au lot");
                        const history = await getLotHistory(lotSearch.trim());
                        if (history.data) {
                          setLotHistory(history.data);
                        }
                      });
                    }}
                  >
                    Lier la commande
                  </Button>
                </div>

                <div className="rounded-lg border p-3 space-y-3">
                  <div>
                    <p className="text-sm font-medium">Lier une demande QC</p>
                    <p className="text-xs text-muted-foreground">Rattachez la demande QC concernee au meme lot pour la tra�abilite.</p>
                  </div>
                  <Select value={lotRequestId || "none"} onValueChange={(value) => setLotRequestId(value === "none" ? "" : value)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Demande QC" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune demande QC</SelectItem>
                      {requests.map((request) => (
                        <SelectItem key={request.id} value={request.id}>
                          {request.order.orderNumber} - {request.type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending || !lotSearch.trim() || !lotRequestId}
                    onClick={() => {
                      startTransition(async () => {
                        const res = await linkQcRequestToLot(lotSearch.trim(), lotRequestId);
                        if (res.error) {
                          toast.error(res.error);
                          return;
                        }
                        toast.success("Demande QC liee au lot");
                        const history = await getLotHistory(lotSearch.trim());
                        if (history.data) {
                          setLotHistory(history.data);
                        }
                      });
                    }}
                  >
                    Lier la demande QC
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  placeholder="Num�ro de lot (ex: LOT-2026-001)"
                  value={lotSearch}
                  onChange={(e) => setLotSearch(e.target.value)}
                  className="max-w-xs"
                />
                <Button
                  size="sm"
                  disabled={!lotSearch || lotSearching}
                  onClick={() => {
                    setLotSearching(true);
                    startTransition(async () => {
                      const res = await getLotHistory(lotSearch);
                      setLotSearching(false);
                      if (res.error) { toast.error(res.error); return; }
                      setLotHistory(res.data);
                    });
                  }}
                >
                  {lotSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>

              {lotHistory === null ? (
                <EmptyState
                  title="Aucune recherche de lot"
                  description="Entrez un numero de lot pour afficher la timeline, les commandes liees et les demandes QC associees."
                />
              ) : lotHistory === undefined || !lotHistory.lot ? (
                <EmptyState
                  title="Lot introuvable"
                  description="Ce numero de lot n'existe pas encore. Creez-le ci-dessus pour commencer la tra�abilite."
                />
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded border">
                    <Package className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium">{lotHistory.lot.lotNumber}</p>
                      <p className="text-xs text-muted-foreground">Cr�� le {new Date(lotHistory.lot.createdAt).toLocaleDateString("fr-FR")}</p>
                    </div>
                    <Badge variant={
                      lotHistory.lot.status === "RECALLED" ? "destructive" :
                      lotHistory.lot.status === "QUARANTINE" ? "secondary" : "default"
                    }>{lotHistory.lot.status}</Badge>
                    {lotHistory.lot.status !== "RECALLED" && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setRecallDialog({ open: true, lotNumber: lotHistory.lot.lotNumber });
                          setRecallReason("");
                        }}
                      >
                        <AlertTriangle className="mr-1 h-3.5 w-3.5" />Rappel
                      </Button>
                    )}
                  </div>

                  {lotHistory.lot.recallReason && (
                    <div className="rounded bg-destructive/10 p-3 text-sm text-destructive">
                      <strong>Raison du rappel:</strong> {lotHistory.lot.recallReason}
                    </div>
                  )}

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <h4 className="text-sm font-medium mb-2">Commandes li�es ({lotHistory.orders?.length ?? 0})</h4>
                      {(lotHistory.orders ?? []).length === 0 ? (
                        <p className="text-xs text-muted-foreground">Aucune commande</p>
                      ) : (
                        <div className="space-y-1">
                          {lotHistory.orders.map((o: any) => (
                            <div key={o.id} className="flex items-center justify-between rounded border p-2 text-xs">
                              <span className="font-mono">{o.orderNumber || o.id.slice(0, 8)}</span>
                              <Badge variant="outline">{o.status}</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-2">Demandes QC liees ({lotHistory.qcRequests?.length ?? 0})</h4>
                      {(lotHistory.qcRequests ?? []).length === 0 ? (
                        <p className="text-xs text-muted-foreground">Aucune demande QC</p>
                      ) : (
                        <div className="space-y-1">
                          {lotHistory.qcRequests.map((q: any) => (
                            <div key={q.id} className="flex items-center justify-between rounded border p-2 text-xs">
                              <span>{q.type}</span>
                              <Badge variant={q.status === "PASSED" ? "default" : q.status === "FAILED" ? "destructive" : "outline"}>{q.status}</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Lots actifs ({lotTraces.filter((l: any) => l.status === "ACTIVE").length})</CardTitle></CardHeader>
            <CardContent>
              {lotTraces.length === 0 ? (
                <EmptyState
                  title="Aucun lot enregistre"
                  description="Les lots actifs, recalls et quarantaines appara�tront ici une fois crees."
                />
              ) : (
                <div className="space-y-2">
                  {lotTraces.map((lot: any) => (
                    <div key={lot.id} className="flex items-center justify-between rounded border p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">{lot.lotNumber}</span>
                        <span className="text-xs text-muted-foreground">{new Date(lot.createdAt).toLocaleDateString("fr-FR")}</span>
                      </div>
                      <Badge variant={
                        lot.status === "RECALLED" ? "destructive" :
                        lot.status === "QUARANTINE" ? "secondary" : "default"
                      }>{lot.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog
            open={recallDialog.open}
            onOpenChange={(open) => {
              setRecallDialog((prev) => ({ ...prev, open }));
              if (!open) setRecallReason("");
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Rappeler le lot {recallDialog.lotNumber || "-"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Cette action bascule le lot en statut RECALLED et doit �tre motiv�e.
                </p>
                <Textarea
                  value={recallReason}
                  onChange={(event) => setRecallReason(event.target.value)}
                  placeholder="Expliquez la raison du rappel"
                  rows={4}
                />
                <div className="flex items-center justify-end gap-2">
                  <Button variant="outline" onClick={() => setRecallDialog({ open: false, lotNumber: "" })}>
                    Annuler
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={pending || !recallReason.trim() || !recallDialog.lotNumber}
                    onClick={() => {
                      startTransition(async () => {
                        const res = await recallLot(recallDialog.lotNumber, recallReason.trim());
                        if (res.error) {
                          toast.error(res.error);
                          return;
                        }
                        setLotHistory((prev: any) =>
                          prev?.lot?.lotNumber === recallDialog.lotNumber ? { ...prev, lot: res.data } : prev
                        );
                        setLotTraces((prev) =>
                          prev.map((lot: any) =>
                            lot.lotNumber === recallDialog.lotNumber ? { ...lot, ...res.data } : lot
                          )
                        );
                        setRecallDialog({ open: false, lotNumber: "" });
                        setRecallReason("");
                        toast.success("Lot rappele");
                      });
                    }}
                  >
                    Confirmer le rappel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}





