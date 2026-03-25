"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Users, TrendingUp, Target, Globe, Zap, Plus, X, Edit3, Trash2,
  Loader2, ArrowRight, Star, AlertTriangle, Lightbulb, Shield,
  ShoppingCart, MessageSquare, BarChart3, Package, Layers,
  CheckCircle2, Circle, Crown, Building2, Map,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  savePersona, deletePersona, saveMarketTrend, deleteMarketTrend,
  type AudienceData, type MarketingPersona, type MarketTrend,
} from "@/lib/actions/marketing.actions";

// ── Config ──────────────────────────────────────────────────────────────────

const COUNTRY_NAMES: Record<string, string> = {
  CN: "🇨🇳 Chine", CG: "🇨🇬 Congo-Brazza", CD: "🇨🇩 RDC", CM: "🇨🇲 Cameroun",
  GA: "🇬🇦 Gabon", US: "🇺🇸 États-Unis", FR: "🇫🇷 France", AE: "🇦🇪 Émirats",
  TR: "🇹🇷 Turquie", IN: "🇮🇳 Inde", BD: "🇧🇩 Bangladesh", VN: "🇻🇳 Vietnam",
  TH: "🇹🇭 Thaïlande", KR: "🇰🇷 Corée du Sud", JP: "🇯🇵 Japon",
};

const PLATFORMS = ["FACEBOOK","INSTAGRAM","LINKEDIN","TIKTOK","EMAIL","WHATSAPP"];
const PLATFORM_LABELS: Record<string, string> = {
  FACEBOOK: "📘 Facebook", INSTAGRAM: "📷 Instagram", LINKEDIN: "💼 LinkedIn",
  TIKTOK: "🎵 TikTok", EMAIL: "📧 Email", WHATSAPP: "💬 WhatsApp",
};
const CONTENT_TYPES = ["Témoignages clients","Conseils pratiques","Offres spéciales","Études de cas","Coulisses","Tendances secteur","Tutoriels","Infographies"];

const TREND_CATEGORY_CONFIG = {
  opportunite: { label: "Opportunité", color: "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300", icon: "🚀" },
  menace:      { label: "Menace",      color: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",         icon: "⚠️" },
  tendance:    { label: "Tendance",    color: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",     icon: "📈" },
  insight:     { label: "Insight",     color: "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300", icon: "💡" },
};

const IMPACT_CONFIG = {
  high:   { label: "Impact fort",   color: "text-red-600"    },
  medium: { label: "Impact moyen",  color: "text-yellow-600" },
  low:    { label: "Impact faible", color: "text-gray-500"   },
};

// ── Persona Form Dialog ──────────────────────────────────────────────────────

function PersonaDialog({
  open, onClose, onSaved, editPersona,
}: {
  open: boolean; onClose: () => void; onSaved: () => void;
  editPersona?: MarketingPersona | null;
}) {
  const [form, setForm] = useState<Omit<MarketingPersona, "id">>(() => editPersona ?? {
    name: "", avatar: "👤", role: "", ageRange: "", location: "", companySize: "",
    sector: "", painPoints: [], goals: [], preferredPlatforms: [], contentTypes: [],
    budgetRange: "", buyingCycle: "",
  });
  const [isPending, startTransition] = useTransition();
  const [newPain, setNewPain] = useState("");
  const [newGoal, setNewGoal] = useState("");

  function update<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }
  function addItem(field: "painPoints" | "goals", val: string) {
    if (!val.trim()) return;
    update(field, [...form[field], val.trim()]);
  }
  function removeItem(field: "painPoints" | "goals", i: number) {
    update(field, form[field].filter((_, idx) => idx !== i));
  }
  function togglePlatform(p: string) {
    update("preferredPlatforms", form.preferredPlatforms.includes(p)
      ? form.preferredPlatforms.filter((x) => x !== p)
      : [...form.preferredPlatforms, p]);
  }
  function toggleContent(c: string) {
    update("contentTypes", form.contentTypes.includes(c)
      ? form.contentTypes.filter((x) => x !== c)
      : [...form.contentTypes, c]);
  }

  const AVATARS = ["👤","👔","🏭","👩‍💼","👨‍💼","🧑‍🤝‍🧑","👷","🏪","🧑‍💻","🎯","💼","🏢"];

  function handleSubmit() {
    if (!form.name.trim()) return;
    startTransition(async () => {
      await savePersona({ ...form, id: editPersona?.id ?? `persona-${Date.now()}` });
      onSaved(); onClose();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-indigo-600" />
            {editPersona ? "Modifier le persona" : "Créer un Persona Cible"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          {/* Avatar picker */}
          <div className="space-y-1.5">
            <Label>Avatar</Label>
            <div className="flex flex-wrap gap-2">
              {AVATARS.map((a) => (
                <button key={a} onClick={() => update("avatar", a)}
                  className={`text-2xl p-1.5 rounded-lg border-2 transition-all ${form.avatar === a ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30" : "border-muted hover:border-indigo-300"}`}
                >{a}</button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nom du persona *</Label>
              <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Ex: L'Importateur PME" />
            </div>
            <div className="space-y-1.5">
              <Label>Rôle / Titre</Label>
              <Input value={form.role} onChange={(e) => update("role", e.target.value)} placeholder="Ex: Directeur Commercial" />
            </div>
            <div className="space-y-1.5">
              <Label>Tranche d&apos;âge</Label>
              <Input value={form.ageRange} onChange={(e) => update("ageRange", e.target.value)} placeholder="35-50 ans" />
            </div>
            <div className="space-y-1.5">
              <Label>Localisation</Label>
              <Input value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="Brazzaville / Pointe-Noire" />
            </div>
            <div className="space-y-1.5">
              <Label>Taille d&apos;entreprise</Label>
              <Input value={form.companySize} onChange={(e) => update("companySize", e.target.value)} placeholder="PME 5-50 employés" />
            </div>
            <div className="space-y-1.5">
              <Label>Secteur d&apos;activité</Label>
              <Input value={form.sector} onChange={(e) => update("sector", e.target.value)} placeholder="Commerce de gros / détail" />
            </div>
            <div className="space-y-1.5">
              <Label>Budget d&apos;achat typique</Label>
              <Input value={form.budgetRange} onChange={(e) => update("budgetRange", e.target.value)} placeholder="5M - 50M XAF / commande" />
            </div>
            <div className="space-y-1.5">
              <Label>Cycle d&apos;achat</Label>
              <Input value={form.buyingCycle} onChange={(e) => update("buyingCycle", e.target.value)} placeholder="1-3 mois" />
            </div>
          </div>

          {/* Pain points */}
          <div className="space-y-2">
            <Label className="text-red-700 dark:text-red-400 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />Points de douleur
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {form.painPoints.map((p, i) => (
                <Badge key={i} variant="outline" className="gap-1 border-red-200 text-red-700 dark:text-red-400 text-xs pr-1">
                  {p}<button onClick={() => removeItem("painPoints", i)}><X className="h-3 w-3" /></button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={newPain} onChange={(e) => setNewPain(e.target.value)} placeholder="Ajouter un point de douleur..."
                onKeyDown={(e) => { if (e.key === "Enter") { addItem("painPoints", newPain); setNewPain(""); } }}
                className="flex-1 text-sm h-8" />
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => { addItem("painPoints", newPain); setNewPain(""); }}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Goals */}
          <div className="space-y-2">
            <Label className="text-green-700 dark:text-green-400 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />Objectifs & motivations
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {form.goals.map((g, i) => (
                <Badge key={i} variant="outline" className="gap-1 border-green-200 text-green-700 dark:text-green-400 text-xs pr-1">
                  {g}<button onClick={() => removeItem("goals", i)}><X className="h-3 w-3" /></button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={newGoal} onChange={(e) => setNewGoal(e.target.value)} placeholder="Ajouter un objectif..."
                onKeyDown={(e) => { if (e.key === "Enter") { addItem("goals", newGoal); setNewGoal(""); } }}
                className="flex-1 text-sm h-8" />
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => { addItem("goals", newGoal); setNewGoal(""); }}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Preferred platforms */}
          <div className="space-y-2">
            <Label>Plateformes préférées</Label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <button key={p} onClick={() => togglePlatform(p)}
                  className={`rounded-full px-3 py-1 text-xs border-2 font-medium transition-all ${form.preferredPlatforms.includes(p) ? "bg-primary text-primary-foreground border-primary" : "border-muted hover:border-primary/40"}`}
                >{PLATFORM_LABELS[p]}</button>
              ))}
            </div>
          </div>

          {/* Content preferences */}
          <div className="space-y-2">
            <Label>Types de contenu appréciés</Label>
            <div className="flex flex-wrap gap-2">
              {CONTENT_TYPES.map((c) => (
                <button key={c} onClick={() => toggleContent(c)}
                  className={`rounded-full px-3 py-1 text-xs border-2 font-medium transition-all ${form.contentTypes.includes(c) ? "bg-indigo-600 text-white border-indigo-600" : "border-muted hover:border-indigo-300"}`}
                >{c}</button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={isPending || !form.name.trim()}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {editPersona ? "Enregistrer" : "Créer le persona"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Persona Card ─────────────────────────────────────────────────────────────

function PersonaCard({
  persona, onEdit, onDelete,
}: { persona: MarketingPersona; onEdit: () => void; onDelete: () => void }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Card className="hover:shadow-md transition-all overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{persona.avatar}</span>
            <div>
              <p className="font-bold text-sm">{persona.name}</p>
              <p className="text-xs text-muted-foreground">{persona.role}</p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}><Edit3 className="h-3 w-3" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-600" disabled={isPending}
              onClick={() => { if (!confirm(`Supprimer "${persona.name}" ?`)) return; startTransition(async () => { await deletePersona(persona.id); onDelete(); }); }}>
              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 text-xs text-muted-foreground">
          {persona.ageRange    && <span className="flex items-center gap-1"><Circle className="h-2 w-2 fill-indigo-400 text-indigo-400" />{persona.ageRange}</span>}
          {persona.location    && <span className="flex items-center gap-1"><Map className="h-2.5 w-2.5" />{persona.location}</span>}
          {persona.companySize && <span className="flex items-center gap-1"><Building2 className="h-2.5 w-2.5" />{persona.companySize}</span>}
          {persona.budgetRange && <span className="flex items-center gap-1"><Star className="h-2.5 w-2.5" />{persona.budgetRange}</span>}
        </div>

        {persona.painPoints.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-red-600 mb-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Douleurs</p>
            <div className="flex flex-wrap gap-1">
              {persona.painPoints.slice(0, 3).map((p, i) => (
                <span key={i} className="rounded-full bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 px-2 py-0.5 text-xs">{p}</span>
              ))}
              {persona.painPoints.length > 3 && <span className="text-xs text-muted-foreground">+{persona.painPoints.length - 3}</span>}
            </div>
          </div>
        )}

        {persona.goals.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-green-600 mb-1 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Objectifs</p>
            <div className="flex flex-wrap gap-1">
              {persona.goals.slice(0, 2).map((g, i) => (
                <span key={i} className="rounded-full bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300 px-2 py-0.5 text-xs">{g}</span>
              ))}
            </div>
          </div>
        )}

        {persona.preferredPlatforms.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1 border-t">
            {persona.preferredPlatforms.map((p) => (
              <span key={p} className="rounded-full bg-muted px-2 py-0.5 text-xs">{PLATFORM_LABELS[p] ?? p}</span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Market Trend Form ────────────────────────────────────────────────────────

function TrendForm({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState({ title: "", description: "", category: "tendance" as MarketTrend["category"], impact: "medium" as MarketTrend["impact"], source: "" });
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleSubmit() {
    if (!form.title.trim()) return;
    startTransition(async () => {
      await saveMarketTrend(form);
      setOpen(false);
      setForm({ title: "", description: "", category: "tendance", impact: "medium", source: "" });
      onSaved();
    });
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />Ajouter une tendance
      </Button>
    );
  }

  return (
    <Card className="border-2 border-dashed border-indigo-300 dark:border-indigo-700">
      <CardContent className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label>Titre *</Label>
            <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Ex: Boom e-commerce Afrique Centrale" />
          </div>
          <div className="space-y-1.5">
            <Label>Catégorie</Label>
            <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v as MarketTrend["category"] }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TREND_CATEGORY_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.icon} {v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Impact</Label>
            <Select value={form.impact} onValueChange={(v) => setForm((p) => ({ ...p, impact: v as MarketTrend["impact"] }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="high">🔴 Fort</SelectItem>
                <SelectItem value="medium">🟡 Moyen</SelectItem>
                <SelectItem value="low">🟢 Faible</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={2} placeholder="Contexte et implications..." className="resize-none text-sm" />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Source</Label>
            <Input value={form.source} onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))} placeholder="Ex: Rapport GSMA 2025" />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Annuler</Button>
          <Button size="sm" onClick={handleSubmit} disabled={isPending || !form.title.trim()}>
            {isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            Ajouter
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Targeting Recommendations ────────────────────────────────────────────────

function buildTargetingRecommendations(data: AudienceData): { icon: string; title: string; detail: string; type: "action" | "insight" | "warning" }[] {
  const recs: { icon: string; title: string; detail: string; type: "action" | "insight" | "warning" }[] = [];

  const topType = data.contacts.byType[0];
  if (topType) recs.push({ icon: "🎯", title: `Ciblez en priorité : ${topType.label}s`, detail: `${topType.pct}% de votre base (${topType.count} contacts). Adaptez votre message à leurs besoins spécifiques.`, type: "insight" });

  const topCt = data.leads.byContainerType[0];
  if (topCt) recs.push({ icon: "📦", title: `Fret ${topCt.type} dominant (${topCt.pct}%)`, detail: `Créez du contenu spécifique aux avantages du ${topCt.type}. C'est ce que recherchent vos prospects.`, type: "action" });

  const topCountry = data.leads.byOriginCountry[0];
  if (topCountry) recs.push({ icon: "🇨🇳", title: `Chine comme origine principale`, detail: `${topCountry.count} leads depuis ${COUNTRY_NAMES[topCountry.country] ?? topCountry.country}. Mettez en avant votre expertise Chine → Congo.`, type: "insight" });

  if (data.leads.conversionRate < 30) recs.push({ icon: "⚠️", title: `Taux de conversion faible (${data.leads.conversionRate}%)`, detail: "Renforcez les contenus de qualification : témoignages, études de cas, comparatifs.", type: "warning" });
  else recs.push({ icon: "✅", title: `Bon taux de conversion (${data.leads.conversionRate}%)`, detail: "Capitalisez avec des témoignages et cas clients pour maintenir cette dynamique.", type: "insight" });

  if (data.contacts.prospects > data.contacts.clients * 2) recs.push({ icon: "🚀", title: "Fort ratio prospects/clients", detail: `${data.contacts.prospects} prospects pour ${data.contacts.clients} clients — potentiel de conversion important. Activez vos nurturing campaigns.`, type: "action" });

  if (data.orders.avgValue > 0) recs.push({ icon: "💰", title: `Panier moyen : ${data.orders.avgValue.toLocaleString("fr-FR")} XAF`, detail: "Adaptez vos messages au profil budgétaire moyen de vos clients réels.", type: "insight" });

  const newLeads = data.leads.byStatus.find((s) => s.status === "NEW");
  if (newLeads && newLeads.count > 5) recs.push({ icon: "📞", title: `${newLeads.count} leads non contactés`, detail: "Créez une séquence de nurturing automatisée WhatsApp/Email pour les activer.", type: "warning" });

  return recs.slice(0, 6);
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  audienceData: AudienceData;
  personas: MarketingPersona[];
  trends: MarketTrend[];
}

export function AudienceIntelligence({ audienceData: initialData, personas: initialPersonas, trends: initialTrends }: Props) {
  const [personas, setPersonas]     = useState<MarketingPersona[]>(initialPersonas);
  const [trends, setTrends]         = useState<MarketTrend[]>(initialTrends);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editPersona, setEditPersona] = useState<MarketingPersona | null>(null);
  const [, startTransition]         = useTransition();
  const data = initialData;

  const recs = buildTargetingRecommendations(data);

  function refreshPersonas() { window.location.reload(); }
  function refreshTrends()   { window.location.reload(); }

  const handleDeleteTrend = (id: string) => {
    if (!confirm("Supprimer cette tendance ?")) return;
    startTransition(async () => {
      await deleteMarketTrend(id);
      setTrends((p) => p.filter((t) => t.id !== id));
    });
  };

  return (
    <div className="space-y-6 pt-4">
      {/* ── Audience Command Bar ──────────────────────────────────────── */}
      <div className="rounded-xl border bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-900 px-5 py-4 text-white">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-5 w-5 text-indigo-300" />
          <h2 className="text-base font-bold text-white">Audience Intelligence Center</h2>
          <Badge className="bg-indigo-700/60 text-indigo-200 border-indigo-600 text-xs ml-auto">Connecté CRM + Orders + Contacts</Badge>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { icon: "👥", value: data.contacts.total,          label: "Contacts totaux"         },
            { icon: "🏆", value: data.contacts.clients,        label: "Clients actifs"           },
            { icon: "🔍", value: data.contacts.prospects,      label: "Prospects"                },
            { icon: "🎯", value: data.leads.total,             label: "Leads pipeline"           },
            { icon: "✅", value: `${data.leads.conversionRate}%`, label: "Taux conversion"       },
            { icon: "💰", value: data.leads.totalPipelineValue > 0 ? `${(data.leads.totalPipelineValue / 1_000_000).toFixed(1)}M` : "—", label: "Valeur pipeline XAF" },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-lg bg-white/10 px-3 py-2 text-center">
              <p className="text-lg">{kpi.icon}</p>
              <p className="text-xl font-black tabular-nums">{kpi.value}</p>
              <p className="text-xs text-indigo-300 mt-0.5">{kpi.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Audience Breakdown 3-col ─────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Contact Types Distribution */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4 text-blue-600" />
              Composition de l&apos;audience
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.contacts.byType.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Aucun contact dans le CRM</p>
            ) : (
              <div className="space-y-3">
                {data.contacts.byType.map((t) => (
                  <div key={t.type} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{t.label}</span>
                      <span className="text-muted-foreground tabular-nums">{t.count} ({t.pct}%)</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full ${t.color}`} style={{ width: `${t.pct}%` }} />
                    </div>
                  </div>
                ))}
                <Link href="/contacts" className="flex items-center gap-1 text-xs text-blue-600 hover:underline pt-1 mt-1 border-t">
                  Gérer les contacts <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lead Pipeline by Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Layers className="h-4 w-4 text-purple-600" />
              Pipeline CRM — Entonnoir leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.leads.byStatus.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Aucun lead dans le CRM</p>
            ) : (
              <div className="space-y-2">
                {data.leads.byStatus.map((s) => {
                  const pct = data.leads.total > 0 ? Math.round((s.count / data.leads.total) * 100) : 0;
                  return (
                    <div key={s.status} className="space-y-0.5">
                      <div className="flex justify-between text-xs">
                        <span className="flex items-center gap-1.5">
                          <span className={`h-2.5 w-2.5 rounded-full ${s.color}`} />
                          <span className="font-medium">{s.label}</span>
                        </span>
                        <span className="tabular-nums font-bold">{s.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full ${s.color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                <div className="pt-2 border-t flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">WON : <span className="font-bold text-green-600">{data.leads.wonCount}</span></span>
                  <span className="text-muted-foreground">Conversion : <span className={`font-bold ${data.leads.conversionRate >= 40 ? "text-green-600" : data.leads.conversionRate >= 20 ? "text-yellow-600" : "text-red-500"}`}>{data.leads.conversionRate}%</span></span>
                </div>
                <Link href="/crm/leads" className="flex items-center gap-1 text-xs text-purple-600 hover:underline mt-1">
                  Voir le CRM <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fret preferences */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Package className="h-4 w-4 text-orange-600" />
              Préférences de fret (leads)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.leads.byContainerType.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Pas encore de données de fret</p>
            ) : (
              <>
                {data.leads.byContainerType.map((ct) => (
                  <div key={ct.type} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-bold">{ct.type}</span>
                      <span className="text-muted-foreground tabular-nums">{ct.count} leads ({ct.pct}%)</span>
                    </div>
                    <Progress value={ct.pct} className="h-3" />
                    <p className="text-xs text-muted-foreground">
                      {ct.type === "LCL" ? "Groupage — petits volumes, prix réduit"
                        : ct.type === "FCL" ? "Container complet — volumes importants"
                        : "Aérien — urgence, délais courts"}
                    </p>
                  </div>
                ))}
                <Link href="/sourcing" className="flex items-center gap-1 text-xs text-orange-600 hover:underline pt-1 border-t">
                  Voir le Sourcing OS <ArrowRight className="h-3 w-3" />
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Geographic Intelligence ───────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Globe className="h-4 w-4 text-blue-600" />
              Pays d&apos;origine — Leads (où sourcent vos clients)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.leads.byOriginCountry.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">Pas de données géographiques</p>
            ) : (
              <div className="space-y-2">
                {data.leads.byOriginCountry.slice(0, 8).map((c, i) => {
                  const max = data.leads.byOriginCountry[0].count;
                  const pct = Math.round((c.count / max) * 100);
                  return (
                    <div key={c.country} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-4 tabular-nums">{i + 1}</span>
                      <span className="text-sm min-w-0 flex-1 font-medium">{COUNTRY_NAMES[c.country] ?? `🌍 ${c.country}`}</span>
                      <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-bold tabular-nums w-6 text-right">{c.count}</span>
                    </div>
                  );
                })}
                <p className="text-xs text-muted-foreground pt-2 border-t flex items-center gap-1">
                  <Lightbulb className="h-3 w-3" />
                  Adaptez votre contenu aux pays les plus fréquents
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Crown className="h-4 w-4 text-yellow-500" />
              Top clients par valeur (Orders OS)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.contacts.topClients.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">Aucune commande enregistrée</p>
            ) : (
              <div className="space-y-2">
                {data.contacts.topClients.slice(0, 6).map((c, i) => (
                  <div key={c.id} className="flex items-center gap-3 rounded-lg border px-3 py-2 hover:bg-muted/30">
                    <span className={`text-sm font-black w-4 tabular-nums ${i === 0 ? "text-yellow-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-orange-500" : "text-muted-foreground"}`}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.company ?? "Particulier"} · {c.orderCount} commande{c.orderCount > 1 ? "s" : ""}</p>
                    </div>
                    <span className="text-xs font-bold text-green-700 dark:text-green-400 tabular-nums shrink-0">
                      {c.totalValue > 0 ? `${(c.totalValue / 1_000_000).toFixed(1)}M XAF` : "—"}
                    </span>
                  </div>
                ))}
                <Link href="/orders" className="flex items-center gap-1 text-xs text-yellow-600 hover:underline pt-1 border-t">
                  Voir toutes les commandes <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── ERP Cross-Reference ───────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-500" />
          Interconnexions ERP — Données en temps réel
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: "CRM OS", icon: <Users className="h-5 w-5 text-purple-600" />,
              bg: "from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20",
              border: "border-purple-200 dark:border-purple-800",
              stats: [
                { label: "Leads actifs", value: data.leads.byStatus.filter((s) => !["WON","LOST"].includes(s.status)).reduce((s, x) => s + x.count, 0) },
                { label: "Qualifiés", value: data.leads.byStatus.find((s) => s.status === "QUALIFIED")?.count ?? 0 },
              ],
              href: "/crm",
            },
            {
              title: "Orders OS", icon: <ShoppingCart className="h-5 w-5 text-blue-600" />,
              bg: "from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20",
              border: "border-blue-200 dark:border-blue-800",
              stats: [
                { label: "Commandes", value: data.orders.total },
                { label: "90 derniers jours", value: data.orders.recent90d },
              ],
              href: "/orders",
            },
            {
              title: "WhatsApp OS", icon: <MessageSquare className="h-5 w-5 text-green-600" />,
              bg: "from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20",
              border: "border-green-200 dark:border-green-800",
              stats: [
                { label: "Contacts WA", value: data.contacts.total },
                { label: "Canaux actifs", value: "—" },
              ],
              href: "/whatsapp",
            },
            {
              title: "Finance OS", icon: <BarChart3 className="h-5 w-5 text-orange-600" />,
              bg: "from-orange-50 to-yellow-50 dark:from-orange-950/20 dark:to-yellow-950/20",
              border: "border-orange-200 dark:border-orange-800",
              stats: [
                { label: "CA clients", value: data.orders.totalValue > 0 ? `${(data.orders.totalValue / 1_000_000).toFixed(0)}M XAF` : "—" },
                { label: "Panier moyen", value: data.orders.avgValue > 0 ? `${(data.orders.avgValue / 1_000_000).toFixed(1)}M` : "—" },
              ],
              href: "/finance/ledger",
            },
          ].map((mod) => (
            <Card key={mod.title} className={`bg-gradient-to-br ${mod.bg} border ${mod.border} hover:shadow-md transition-all`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {mod.icon}
                    <span className="text-sm font-bold">{mod.title}</span>
                  </div>
                  <Link href={mod.href} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-0.5">
                    Ouvrir <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                {mod.stats.map((s) => (
                  <div key={s.label} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className="font-bold tabular-nums">{s.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* ── Personas Builder ──────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Target className="h-5 w-5 text-indigo-600" />
              Personas Cibles
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Profils de vos acheteurs types — basez vos campagnes sur ces personas</p>
          </div>
          <Button onClick={() => { setEditPersona(null); setDialogOpen(true); }} className="gap-1.5">
            <Plus className="h-4 w-4" />Créer un persona
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {personas.map((p) => (
            <PersonaCard key={p.id} persona={p}
              onEdit={() => { setEditPersona(p); setDialogOpen(true); }}
              onDelete={refreshPersonas}
            />
          ))}
          {personas.length === 0 && (
            <Card className="border-dashed col-span-3">
              <CardContent className="py-12 text-center space-y-2">
                <Target className="mx-auto h-10 w-10 text-muted-foreground opacity-30" />
                <p className="text-sm text-muted-foreground">Aucun persona défini — créez votre premier profil cible</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── Market Intelligence ───────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Intelligence de Marché
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Tendances, opportunités et menaces qui influencent votre stratégie</p>
          </div>
          <TrendForm onSaved={refreshTrends} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {trends.map((t) => {
            const cat = TREND_CATEGORY_CONFIG[t.category];
            const imp = IMPACT_CONFIG[t.impact];
            return (
              <Card key={t.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1">
                      <span className="text-lg leading-none mt-0.5 shrink-0">{cat.icon}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold leading-tight">{t.title}</p>
                        {t.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>}
                      </div>
                    </div>
                    <button onClick={() => handleDeleteTrend(t.id)} className="text-muted-foreground hover:text-red-500 shrink-0 transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cat.color}`}>{cat.label}</span>
                    <span className={`text-xs font-medium ${imp.color}`}>{imp.label}</span>
                    {t.source && <span className="text-xs text-muted-foreground">· {t.source}</span>}
                    <span className="text-xs text-muted-foreground ml-auto">{t.createdAt}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {trends.length === 0 && (
            <Card className="border-dashed col-span-2">
              <CardContent className="py-8 text-center">
                <p className="text-sm text-muted-foreground">Aucune tendance ajoutée</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── Targeting Recommendations ─────────────────────────────────── */}
      <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-purple-50/80 dark:from-indigo-950/30 dark:to-purple-950/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-indigo-800 dark:text-indigo-300">
            <Lightbulb className="h-5 w-5" />
            Recommandations de ciblage — basées sur vos données réelles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recs.map((rec, i) => (
              <div key={i} className={`rounded-lg px-4 py-3 text-sm flex items-start gap-3 ${rec.type === "warning" ? "bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800" : rec.type === "action" ? "bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800" : "bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-900"}`}>
                <span className="text-xl leading-none shrink-0">{rec.icon}</span>
                <div>
                  <p className={`font-semibold text-xs mb-0.5 ${rec.type === "warning" ? "text-amber-800 dark:text-amber-300" : rec.type === "action" ? "text-blue-800 dark:text-blue-300" : "text-slate-800 dark:text-slate-200"}`}>{rec.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{rec.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Recent Leads Feed (CRM Live) ──────────────────────────────── */}
      {data.leads.recent.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm font-semibold">
              <span className="flex items-center gap-2">
                <Circle className="h-3 w-3 fill-green-500 text-green-500 animate-pulse" />
                Derniers leads CRM — Signaux d&apos;intérêt récents
              </span>
              <Link href="/crm/leads" className="text-xs text-purple-600 hover:underline flex items-center gap-1">
                Tous les leads <ArrowRight className="h-3 w-3" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.leads.recent.map((l) => {
                const statusCfg = { NEW: "bg-blue-100 text-blue-800", CONTACTED: "bg-indigo-100 text-indigo-800", QUALIFIED: "bg-purple-100 text-purple-800", QUOTED: "bg-yellow-100 text-yellow-800", WON: "bg-green-100 text-green-800", LOST: "bg-red-100 text-red-800" } as Record<string, string>;
                const statusLabel = { NEW: "Nouveau", CONTACTED: "Contacté", QUALIFIED: "Qualifié", QUOTED: "Devisé", WON: "Gagné ✅", LOST: "Perdu" } as Record<string, string>;
                return (
                  <div key={l.id} className="flex items-center gap-3 rounded-lg border px-3 py-2.5 hover:bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{l.contactName}</p>
                      <p className="text-xs text-muted-foreground">{l.company ?? "—"} {l.originCountry ? `· ${COUNTRY_NAMES[l.originCountry] ?? l.originCountry}` : ""} {l.containerType ? `· ${l.containerType}` : ""}</p>
                    </div>
                    {l.estimatedValue && (
                      <span className="text-xs font-bold text-green-700 dark:text-green-400 shrink-0 tabular-nums">
                        {(l.estimatedValue / 1_000_000).toFixed(1)}M XAF
                      </span>
                    )}
                    <Badge variant="secondary" className={`text-xs shrink-0 ${statusCfg[l.status] ?? "bg-gray-100 text-gray-700"}`}>
                      {statusLabel[l.status] ?? l.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {l.createdAt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Persona Dialog */}
      <PersonaDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={refreshPersonas}
        editPersona={editPersona}
      />
    </div>
  );
}
