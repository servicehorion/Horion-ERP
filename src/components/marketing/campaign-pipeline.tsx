"use client";

import { useState, useTransition } from "react";
import {
  Plus, Megaphone, Loader2, ChevronRight, Trash2,
  CalendarDays, Target, DollarSign, TrendingUp, Clock,
  Flame, PauseCircle, CheckCircle2, Zap, BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  createCampaign, updateCampaignStatus, deleteCampaign, type CampaignItem,
} from "@/lib/actions/marketing.actions";

// ── Config ──────────────────────────────────────────────────────────────────

const STAGES: {
  key: string; label: string; color: string; bg: string;
  icon: React.ReactNode; next: string | null; nextLabel: string | null;
}[] = [
  {
    key: "draft",     label: "Brouillon",      color: "text-gray-600",
    bg: "bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700",
    icon: <FileIcon />, next: "planning", nextLabel: "Préparer →",
  },
  {
    key: "planning",  label: "En préparation", color: "text-yellow-700",
    bg: "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800",
    icon: <ZapIcon />, next: "active", nextLabel: "Lancer →",
  },
  {
    key: "active",    label: "Active",          color: "text-green-700",
    bg: "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800",
    icon: <FlameIcon />, next: "completed", nextLabel: "Terminer →",
  },
  {
    key: "paused",    label: "En pause",        color: "text-orange-700",
    bg: "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800",
    icon: <PauseIcon />, next: "active", nextLabel: "Reprendre →",
  },
  {
    key: "completed", label: "Terminée",        color: "text-purple-700",
    bg: "bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800",
    icon: <CheckIcon />, next: null, nextLabel: null,
  },
];

function FileIcon()  { return <Megaphone className="h-3.5 w-3.5" />; }
function ZapIcon()   { return <Zap className="h-3.5 w-3.5" />; }
function FlameIcon() { return <Flame className="h-3.5 w-3.5" />; }
function PauseIcon() { return <PauseCircle className="h-3.5 w-3.5" />; }
function CheckIcon() { return <CheckCircle2 className="h-3.5 w-3.5" />; }

const OBJECTIVES = [
  { value: "notoriete",    label: "🔊 Notoriété de marque"  },
  { value: "acquisition",  label: "🎯 Acquisition de leads"  },
  { value: "engagement",   label: "💬 Engagement communauté" },
  { value: "conversion",   label: "💰 Conversion / Ventes"   },
  { value: "fidelisation", label: "🤝 Fidélisation clients"  },
  { value: "lancement",    label: "🚀 Lancement produit"     },
];

const PLATFORM_EMOJI: Record<string, string> = {
  FACEBOOK: "📘", INSTAGRAM: "📷", LINKEDIN: "💼",
  TIKTOK: "🎵", EMAIL: "📧", WHATSAPP: "💬",
};
const PLATFORM_OPTIONS = Object.entries(PLATFORM_EMOJI).map(([v, e]) => ({
  value: v, label: `${e} ${v.charAt(0) + v.slice(1).toLowerCase()}`,
}));

// ── Campaign health score ─────────────────────────────────────────────────

function computeCampaignScore(campaign: CampaignItem): number {
  let s = 0;
  if (campaign.name)              s += 15;
  if (campaign.objective)         s += 15;
  if (campaign.description)       s += 10;
  if (campaign.channels.length > 0) s += 20;
  if (campaign.budget)            s += 20;
  if (campaign.startDate)         s += 10;
  if (campaign.endDate)           s += 10;
  return s;
}

// ── KPI bar ────────────────────────────────────────────────────────────────

function PipelineKPIs({ campaigns }: { campaigns: CampaignItem[] }) {
  const total     = campaigns.length;
  const active    = campaigns.filter((c) => c.status === "active").length;
  const completed = campaigns.filter((c) => c.status === "completed").length;
  const totalBudget = campaigns.reduce((s, c) => s + (c.budget ?? 0), 0);
  const activeBudget = campaigns.filter((c) => c.status === "active").reduce((s, c) => s + (c.budget ?? 0), 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardContent className="pt-5">
          <p className="text-xs text-muted-foreground">Total campagnes</p>
          <p className="text-3xl font-black tabular-nums">{total}</p>
          <p className="text-xs text-muted-foreground mt-1">{completed} terminée{completed !== 1 ? "s" : ""}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-5">
          <p className="text-xs text-muted-foreground">Actives en ce moment</p>
          <p className="text-3xl font-black tabular-nums text-green-600">{active}</p>
          <div className="flex items-center gap-1 mt-1">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse inline-block" />
            <span className="text-xs text-green-600">En cours</span>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-5">
          <p className="text-xs text-muted-foreground">Budget total engagé</p>
          <p className="text-2xl font-black tabular-nums">{totalBudget > 0 ? totalBudget.toLocaleString("fr-FR") : "—"}</p>
          {totalBudget > 0 && <p className="text-xs text-muted-foreground mt-1">XAF</p>}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-5">
          <p className="text-xs text-muted-foreground">Budget actif</p>
          <p className="text-2xl font-black tabular-nums text-orange-600">{activeBudget > 0 ? activeBudget.toLocaleString("fr-FR") : "—"}</p>
          {activeBudget > 0 && <p className="text-xs text-muted-foreground mt-1">XAF en circulation</p>}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Form Dialog ─────────────────────────────────────────────────────────────

function CampaignFormDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({
    name: "", objective: "", description: "",
    channels: [] as string[], budget: "", startDate: "", endDate: "",
  });
  const [isPending, startTransition] = useTransition();

  function field(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }
  function toggleChannel(ch: string) {
    setForm((prev) => ({
      ...prev,
      channels: prev.channels.includes(ch) ? prev.channels.filter((c) => c !== ch) : [...prev.channels, ch],
    }));
  }
  function handleSubmit() {
    if (!form.name || !form.objective) return;
    startTransition(async () => {
      await createCampaign({
        name: form.name, objective: form.objective,
        description: form.description || undefined,
        channels: form.channels,
        budget: form.budget ? Number(form.budget) : undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      });
      onClose(); window.location.reload();
    });
  }

  const daysCount = form.startDate && form.endDate
    ? Math.max(0, Math.ceil((new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / 86400000))
    : null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-purple-600" />
            Nouvelle campagne
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nom de la campagne *</Label>
            <Input placeholder="ex: Campagne Fête des Mères 2026" value={form.name} onChange={(e) => field("name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Objectif *</Label>
            <Select value={form.objective} onValueChange={(v) => field("objective", v)}>
              <SelectTrigger><SelectValue placeholder="Choisir un objectif..." /></SelectTrigger>
              <SelectContent>{OBJECTIVES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Description / Brief</Label>
            <Textarea placeholder="Cible, message clé, contexte marché..." value={form.description} onChange={(e) => field("description", e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Plateformes ciblées</Label>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_OPTIONS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => toggleChannel(p.value)}
                  className={`rounded-full px-3 py-1.5 text-sm border-2 transition-all font-medium ${form.channels.includes(p.value) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-muted hover:border-primary/40"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Budget (XAF)</Label>
              <Input type="number" placeholder="ex: 500 000" value={form.budget} onChange={(e) => field("budget", e.target.value)} />
            </div>
            <div />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date de début</Label>
              <Input type="date" value={form.startDate} onChange={(e) => field("startDate", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Date de fin</Label>
              <Input type="date" value={form.endDate} onChange={(e) => field("endDate", e.target.value)} />
            </div>
          </div>
          {daysCount !== null && (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 px-3 py-2 flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-blue-600 shrink-0" />
              <span className="text-blue-700 dark:text-blue-300 font-medium">Durée : {daysCount} jour{daysCount !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={isPending || !form.name || !form.objective}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Créer la campagne
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Campaign Card ────────────────────────────────────────────────────────────

function CampaignCard({
  campaign, stage,
}: {
  campaign: CampaignItem; stage: (typeof STAGES)[number];
}) {
  const [isMoving, startMoveTransition]     = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();

  const now = Date.now();
  let progress = 0;
  let daysLeft: number | null = null;
  if (campaign.startDate && campaign.endDate) {
    const total = campaign.endDate.getTime() - campaign.startDate.getTime();
    progress    = Math.min(100, Math.max(0, Math.round(((now - campaign.startDate.getTime()) / total) * 100)));
    daysLeft    = Math.max(0, Math.ceil((campaign.endDate.getTime() - now) / 86400000));
  }

  const score       = computeCampaignScore(campaign);
  const objective   = OBJECTIVES.find((o) => o.value === campaign.objective)?.label ?? campaign.objective;

  return (
    <div className="rounded-xl border-2 bg-background p-3.5 space-y-3 hover:shadow-md transition-all">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-tight truncate">{campaign.name}</p>
          {campaign.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{campaign.description}</p>
          )}
        </div>
        <Button
          variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-red-600"
          onClick={() => { if (!confirm(`Supprimer "${campaign.name}" ?`)) return; startDeleteTransition(async () => { await deleteCampaign(campaign.id); window.location.reload(); }); }}
          disabled={isDeleting}
        >
          {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
        </Button>
      </div>

      {/* Objective */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Target className="h-3 w-3 shrink-0" />
        <span className="truncate">{objective}</span>
      </div>

      {/* Platforms */}
      {campaign.channels.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {campaign.channels.map((ch) => (
            <span key={ch} className="text-sm">{PLATFORM_EMOJI[ch] ?? "📡"}</span>
          ))}
        </div>
      )}

      {/* Budget */}
      {campaign.budget != null && (
        <div className="flex items-center gap-1.5 text-xs">
          <DollarSign className="h-3 w-3 text-green-600 shrink-0" />
          <span className="font-semibold text-green-700 dark:text-green-400">
            {campaign.budget.toLocaleString("fr-FR")} XAF
          </span>
        </div>
      )}

      {/* Dates + Progress */}
      {(campaign.startDate || campaign.endDate) && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3 shrink-0" />
              {campaign.startDate?.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) ?? "—"}
              {" → "}
              {campaign.endDate?.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) ?? "—"}
            </span>
            {daysLeft !== null && stage.key === "active" && (
              <span className={`font-bold ${daysLeft <= 3 ? "text-red-600" : daysLeft <= 7 ? "text-orange-600" : "text-muted-foreground"}`}>
                {daysLeft === 0 ? "Expire auj." : `${daysLeft}j`}
              </span>
            )}
          </div>
          {progress > 0 && (
            <div className="space-y-0.5">
              <Progress
                value={progress}
                className={`h-2 ${progress > 90 && stage.key === "active" ? "[&>div]:bg-orange-500" : progress >= 100 ? "[&>div]:bg-purple-500" : ""}`}
              />
              <p className="text-xs text-muted-foreground text-right">{progress}% écoulé</p>
            </div>
          )}
        </div>
      )}

      {/* Health Score */}
      <div className="flex items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5">
        <BarChart3 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground">Complétude</span>
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${score >= 80 ? "bg-green-500" : score >= 50 ? "bg-yellow-500" : "bg-red-400"}`}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className={`text-xs font-bold tabular-nums ${score >= 80 ? "text-green-600" : score >= 50 ? "text-yellow-600" : "text-red-500"}`}>{score}%</span>
      </div>

      {/* Move button */}
      {stage.next && (
        <Button
          size="sm" variant="outline" className="w-full h-8 text-xs gap-1 font-semibold"
          onClick={() => startMoveTransition(async () => { await updateCampaignStatus(campaign.id, stage.next!); window.location.reload(); })}
          disabled={isMoving}
        >
          {isMoving ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronRight className="h-3.5 w-3.5" />}
          {stage.nextLabel}
        </Button>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props { campaigns: CampaignItem[]; }

export function CampaignPipeline({ campaigns }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-6 pt-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-purple-600" />
          <h2 className="text-lg font-semibold">Pipeline Campagnes</h2>
          <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300">
            {campaigns.length} campagne{campaigns.length !== 1 ? "s" : ""}
          </Badge>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nouvelle campagne
        </Button>
      </div>

      {/* KPIs */}
      <PipelineKPIs campaigns={campaigns} />

      {/* Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {STAGES.map((stage) => {
          const stageCampaigns = campaigns.filter((c) => c.status === stage.key);
          const stageBudget    = stageCampaigns.reduce((s, c) => s + (c.budget ?? 0), 0);
          return (
            <div key={stage.key} className="space-y-3">
              {/* Column header */}
              <div className={`rounded-xl border-2 p-3 ${stage.bg}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={stage.color}>{stage.icon}</span>
                    <span className={`text-sm font-bold ${stage.color}`}>{stage.label}</span>
                  </div>
                  <span className={`text-lg font-black tabular-nums ${stage.color}`}>{stageCampaigns.length}</span>
                </div>
                {stageBudget > 0 && (
                  <p className={`text-xs mt-1 flex items-center gap-1 ${stage.color} opacity-80`}>
                    <TrendingUp className="h-3 w-3" />
                    {stageBudget.toLocaleString("fr-FR")} XAF
                  </p>
                )}
              </div>

              {/* Cards */}
              {stageCampaigns.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed p-4 text-center">
                  <p className="text-xs text-muted-foreground">Aucune campagne</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {stageCampaigns.map((c) => (
                    <CampaignCard key={c.id} campaign={c} stage={stage} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {campaigns.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <Megaphone className="mx-auto h-12 w-12 text-muted-foreground opacity-30" />
            <p className="font-semibold text-muted-foreground">Aucune campagne créée</p>
            <p className="text-sm text-muted-foreground">Lancez votre première campagne marketing Horion</p>
            <Button variant="outline" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />Créer une campagne
            </Button>
          </CardContent>
        </Card>
      )}

      <CampaignFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
