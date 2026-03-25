"use client";

import { useState, useTransition, useMemo } from "react";
import {
  Plus, Trash2, Edit3, Sparkles, Loader2, FileText,
  Search, LayoutGrid, List, CheckSquare, Square,
  Star, Clock, CheckCircle2, AlertCircle, ChevronDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  createContentPost, updateContentPost, deleteContentPost, type ContentPostItem,
} from "@/lib/actions/marketing.actions";

// ── Config ──────────────────────────────────────────────────────────────────

const PLATFORMS = [
  { value: "FACEBOOK",  label: "Facebook",  emoji: "📘", color: "bg-blue-600",   maxChars: 63206, limit: 500  },
  { value: "INSTAGRAM", label: "Instagram", emoji: "📷", color: "bg-pink-600",   maxChars: 2200,  limit: 300  },
  { value: "LINKEDIN",  label: "LinkedIn",  emoji: "💼", color: "bg-indigo-600", maxChars: 3000,  limit: 400  },
  { value: "TIKTOK",    label: "TikTok",    emoji: "🎵", color: "bg-slate-800",  maxChars: 2200,  limit: 150  },
  { value: "EMAIL",     label: "Email",     emoji: "📧", color: "bg-gray-600",   maxChars: 0,     limit: 600  },
  { value: "WHATSAPP",  label: "WhatsApp",  emoji: "💬", color: "bg-green-600",  maxChars: 4096,  limit: 300  },
];

const CATEGORIES = [
  { value: "promo",       label: "Promotion"         },
  { value: "info",        label: "Information"        },
  { value: "temoignage",  label: "Témoignage client"  },
  { value: "tendance",    label: "Tendance secteur"   },
  { value: "coulisses",   label: "Coulisses Horion"   },
  { value: "offre",       label: "Offre spéciale"     },
  { value: "tip",         label: "Conseil / Astuce"   },
];

const TONES = [
  { value: "professionnel",  label: "Professionnel"           },
  { value: "accessible",     label: "Accessible & chaleureux" },
  { value: "dynamique",      label: "Dynamique & motivant"    },
  { value: "educatif",       label: "Éducatif & expert"       },
];

const STATUSES = [
  { value: "draft",     label: "Brouillon",  color: "bg-gray-100 text-gray-700",         icon: <FileText className="h-3 w-3"      /> },
  { value: "review",    label: "Révision",   color: "bg-yellow-100 text-yellow-700",     icon: <AlertCircle className="h-3 w-3"   /> },
  { value: "scheduled", label: "Planifié",   color: "bg-blue-100 text-blue-700",         icon: <Clock className="h-3 w-3"         /> },
  { value: "published", label: "Publié",     color: "bg-green-100 text-green-700",       icon: <CheckCircle2 className="h-3 w-3"  /> },
];

const PLATFORM_MAP = Object.fromEntries(PLATFORMS.map((p) => [p.value, p]));

// ── Content Score ────────────────────────────────────────────────────────────

function computeContentScore(post: ContentPostItem): number {
  let s = 0;
  if (post.title?.trim())              s += 20;
  if (post.body?.trim())               s += 30;
  if ((post.body?.length ?? 0) > 100) s += 20;
  if (post.theme?.trim())              s += 15;
  if (post.category?.trim())           s += 15;
  return s;
}

function ScoreBadge({ score }: { score: number }) {
  const cfg =
    score >= 80 ? { bg: "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300",  label: "Excellent" } :
    score >= 50 ? { bg: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300", label: "Moyen" } :
                  { bg: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",             label: "Faible" };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${cfg.bg}`}>
      <Star className="h-2.5 w-2.5" />
      {score}
    </span>
  );
}

// ── Post Form Dialog ─────────────────────────────────────────────────────────

interface PostFormData {
  format: string; theme: string; category: string;
  title: string; body: string; status: string; scheduledAt: string;
}

function PostFormDialog({
  open, onClose, onSaved, editPost,
}: {
  open: boolean; onClose: () => void; onSaved: () => void; editPost?: ContentPostItem | null;
}) {
  const [form, setForm] = useState<PostFormData>(() =>
    editPost ? {
      format: editPost.format, theme: editPost.theme ?? "", category: editPost.category ?? "",
      title: editPost.title ?? "", body: editPost.body ?? "", status: editPost.status,
      scheduledAt: editPost.scheduledAt ? editPost.scheduledAt.toISOString().slice(0, 16) : "",
    } : { format: "FACEBOOK", theme: "", category: "", title: "", body: "", status: "draft", scheduledAt: "" }
  );
  const [isPending, startTransition] = useTransition();
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiTone, setAiTone] = useState("professionnel");
  const [aiError, setAiError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  const platform = PLATFORM_MAP[form.format];
  const charCount = form.body.length;
  const charLimit = platform?.limit ?? 500;
  const charPct   = charLimit > 0 ? Math.min(100, Math.round((charCount / charLimit) * 100)) : 0;
  const charOver  = charLimit > 0 && charCount > charLimit;

  const previewScore = computeContentScore({
    id: "", tenantId: "", authorId: null, format: form.format, theme: form.theme || null,
    category: form.category || null, title: form.title || null, body: form.body || null,
    language: "fr", status: form.status, createdBy: "human", channelTargets: [],
    publishedAt: null, scheduledAt: null, createdAt: new Date(), updatedAt: new Date(),
  });

  function field(key: keyof PostFormData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleGenerateAI() {
    setIsGenerating(true); setAiError(null);
    try {
      const res = await fetch("/api/marketing/generate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: form.format, theme: form.theme || "logistique et import Chine-Congo", tone: aiTone, cta: "Contactez Horion pour votre prochain projet" }),
      });
      const data = await res.json();
      if (data.content) field("body", data.content);
    } catch { setAiError("Erreur lors de la génération"); }
    finally { setIsGenerating(false); }
  }

  function handleSubmit() {
    startTransition(async () => {
      if (editPost) {
        await updateContentPost(editPost.id, {
          title: form.title || undefined, body: form.body || undefined, status: form.status,
          theme: form.theme || undefined, category: form.category || undefined,
          scheduledAt: form.scheduledAt || null,
        });
      } else {
        await createContentPost({
          format: form.format, theme: form.theme || undefined, category: form.category || undefined,
          title: form.title || undefined, body: form.body || undefined, status: form.status,
          scheduledAt: form.scheduledAt || undefined,
        });
      }
      onSaved(); onClose();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{editPost ? "Modifier le post" : "Créer un post"}</DialogTitle>
            <div className="flex items-center gap-2 mr-6">
              <span className="text-xs text-muted-foreground">Score qualité :</span>
              <ScoreBadge score={previewScore} />
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Platform Selector — visual tiles */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Plateforme</Label>
            <div className="grid grid-cols-6 gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => field("format", p.value)}
                  className={`flex flex-col items-center gap-1 rounded-lg border-2 p-2 transition-all ${form.format === p.value ? `border-current ${p.color.replace("bg-", "text-")} bg-current/10` : "border-muted hover:border-current/30"}`}
                >
                  <span className="text-xl">{p.emoji}</span>
                  <span className="text-xs font-medium truncate w-full text-center">{p.label.slice(0, 4)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Catégorie</Label>
              <Select value={form.category} onValueChange={(v) => field("category", v)}>
                <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Statut</Label>
              <Select value={form.status} onValueChange={(v) => field("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Thème / Sujet</Label>
            <Input placeholder="ex: Importation textiles depuis Guangzhou" value={form.theme} onChange={(e) => field("theme", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Titre (optionnel)</Label>
            <Input placeholder="ex: 5 raisons de choisir Horion pour vos imports" value={form.title} onChange={(e) => field("title", e.target.value)} />
          </div>

          {/* AI Generator */}
          <div className="rounded-xl border-2 border-purple-200 bg-gradient-to-r from-purple-50/80 to-indigo-50/80 dark:from-purple-950/20 dark:to-indigo-950/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold text-purple-800 dark:text-purple-300">
                <Sparkles className="h-4 w-4" />
                Générateur IA — Contenu {platform?.label}
              </span>
              <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 text-xs">Claude</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Select value={aiTone} onValueChange={setAiTone}>
                <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{TONES.map((t) => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white" onClick={handleGenerateAI} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                {isGenerating ? "Génération..." : "Générer"}
              </Button>
            </div>
            {aiError && <p className="text-xs text-red-500">{aiError}</p>}
          </div>

          {/* Body + Preview toggle */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Contenu {platform && <span className="text-xs text-muted-foreground ml-1">({platform.emoji} {platform.label})</span>}</Label>
              <button onClick={() => setPreviewMode(!previewMode)} className="text-xs text-blue-600 hover:underline">
                {previewMode ? "Éditer" : "Prévisualiser"}
              </button>
            </div>
            {previewMode ? (
              /* Platform-style preview */
              <div className={`rounded-xl border-2 p-4 ${platform ? "border-current/20" : ""}`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-sm ${platform?.color ?? "bg-gray-500"}`}>H</div>
                  <div>
                    <p className="text-sm font-bold">Horion Logistics</p>
                    <p className="text-xs text-muted-foreground">{platform?.emoji} {platform?.label ?? "Plateforme"}</p>
                  </div>
                </div>
                {form.title && <p className="text-sm font-bold mb-2">{form.title}</p>}
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{form.body || <span className="text-muted-foreground italic">Aucun contenu...</span>}</p>
                {form.theme && <p className="text-xs text-blue-600 mt-2">#{form.theme.replace(/\s+/g, "")}</p>}
              </div>
            ) : (
              <Textarea
                placeholder="Rédigez votre post ici, ou utilisez le générateur IA ci-dessus..."
                value={form.body}
                onChange={(e) => field("body", e.target.value)}
                rows={6}
                className="resize-none font-mono text-sm"
              />
            )}
            {/* Character count bar */}
            {charLimit > 0 && !previewMode && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className={charOver ? "text-red-500 font-bold" : "text-muted-foreground"}>
                    {charCount.toLocaleString("fr-FR")} / {charLimit} caractères recommandés
                  </span>
                  <span className={charOver ? "text-red-500 font-bold" : "text-muted-foreground"}>{charPct}%</span>
                </div>
                <Progress value={Math.min(charPct, 100)} className={`h-1.5 ${charOver ? "[&>div]:bg-red-500" : ""}`} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date de publication</Label>
              <Input type="datetime-local" value={form.scheduledAt} onChange={(e) => field("scheduledAt", e.target.value)} />
            </div>
            {/* Score preview */}
            <div className="space-y-1.5">
              <Label>Score qualité du post</Label>
              <div className="rounded-lg border bg-muted/30 p-2 space-y-1">
                <div className="flex items-center justify-between">
                  <ScoreBadge score={previewScore} />
                  <span className="text-xs text-muted-foreground">{previewScore}/100</span>
                </div>
                <Progress value={previewScore} className="h-1.5" />
                <p className="text-xs text-muted-foreground">{previewScore < 50 ? "Ajoutez titre, thème et catégorie" : previewScore < 80 ? "Complétez le contenu pour améliorer" : "Excellent post !"}</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={isPending || !form.format}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {editPost ? "Enregistrer" : "Créer le post"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Post Card (Grid View) ────────────────────────────────────────────────────

function PostCard({
  post, onEdit, onDelete, selected, onSelect,
}: {
  post: ContentPostItem; onEdit: (p: ContentPostItem) => void; onDelete: (id: string) => void;
  selected: boolean; onSelect: (id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const platform  = PLATFORM_MAP[post.format] ?? { label: post.format, emoji: "📄", color: "bg-gray-600", limit: 300 };
  const statusCfg = STATUSES.find((s) => s.value === post.status) ?? STATUSES[0];
  const score     = computeContentScore(post);
  const charCount = post.body?.length ?? 0;
  const charPct   = platform.limit > 0 ? Math.min(100, Math.round((charCount / platform.limit) * 100)) : 0;

  return (
    <Card className={`hover:shadow-md transition-all overflow-hidden ${selected ? "ring-2 ring-primary" : ""}`}>
      {/* Platform color bar */}
      <div className={`h-1 ${platform.color}`} />
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <button onClick={() => onSelect(post.id)} className="text-muted-foreground hover:text-primary transition-colors">
              {selected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
            </button>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white ${platform.color}`}>
              {platform.emoji} {platform.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <ScoreBadge score={score} />
            <Badge variant="secondary" className={`text-xs ${statusCfg.color}`}>
              {statusCfg.icon}
              <span className="ml-1">{statusCfg.label}</span>
            </Badge>
          </div>
        </div>

        {/* Content */}
        <div className="min-h-[3.5rem]">
          {post.title && <p className="text-sm font-bold line-clamp-1">{post.title}</p>}
          <p className="text-xs text-muted-foreground line-clamp-3 mt-0.5">{post.body ?? "Aucun contenu"}</p>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {post.category && <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{post.category}</span>}
          {post.theme    && <span className="rounded-full bg-purple-100 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 text-xs">#{post.theme}</span>}
        </div>

        {/* Character bar */}
        {platform.limit > 0 && charCount > 0 && (
          <div className="space-y-0.5">
            <Progress value={charPct} className={`h-1 ${charPct > 100 ? "[&>div]:bg-red-500" : ""}`} />
            <p className="text-xs text-muted-foreground text-right">{charCount}/{platform.limit} chars</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t pt-2">
          <div className="text-xs text-muted-foreground">
            {post.scheduledAt ? (
              <span className="flex items-center gap-1 text-blue-600">
                <Clock className="h-3 w-3" />
                {post.scheduledAt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
            ) : (
              post.createdAt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2">
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(post)}>
                <Edit3 className="h-3.5 w-3.5 mr-2" />Modifier
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {["draft","review","scheduled","published"].filter((s) => s !== post.status).map((s) => {
                const cfg = STATUSES.find((x) => x.value === s)!;
                return (
                  <DropdownMenuItem key={s} onClick={() => startTransition(async () => {
                    await updateContentPost(post.id, { status: s }); window.location.reload();
                  })}>
                    {cfg.icon}<span className="ml-2">→ {cfg.label}</span>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600" onClick={() => { if (!confirm("Supprimer ?")) return; startTransition(() => onDelete(post.id)); }}>
                {isPending ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 mr-2" />}
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Post Row (List View) ─────────────────────────────────────────────────────

function PostRow({
  post, onEdit, onDelete, selected, onSelect,
}: {
  post: ContentPostItem; onEdit: (p: ContentPostItem) => void; onDelete: (id: string) => void;
  selected: boolean; onSelect: (id: string) => void;
}) {
  const platform  = PLATFORM_MAP[post.format] ?? { label: post.format, emoji: "📄", color: "bg-gray-600" };
  const statusCfg = STATUSES.find((s) => s.value === post.status) ?? STATUSES[0];
  const score     = computeContentScore(post);

  return (
    <div className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 hover:bg-muted/30 transition-colors ${selected ? "bg-primary/5 border-primary/30" : ""}`}>
      <button onClick={() => onSelect(post.id)} className="text-muted-foreground hover:text-primary shrink-0">
        {selected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
      </button>
      <span className="text-base shrink-0">{platform.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{post.title ?? post.body?.slice(0, 60) ?? "Sans titre"}</p>
        <p className="text-xs text-muted-foreground truncate">{post.theme ? `#${post.theme}` : post.category ?? "—"}</p>
      </div>
      <Badge variant="secondary" className={`text-xs shrink-0 ${statusCfg.color}`}>{statusCfg.label}</Badge>
      <ScoreBadge score={score} />
      <span className="text-xs text-muted-foreground shrink-0 w-20 text-right">
        {post.createdAt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"><ChevronDown className="h-3 w-3" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(post)}><Edit3 className="h-3.5 w-3.5 mr-2" />Modifier</DropdownMenuItem>
          <DropdownMenuItem className="text-red-600" onClick={() => { if (!confirm("Supprimer ?")) return; onDelete(post.id); }}>
            <Trash2 className="h-3.5 w-3.5 mr-2" />Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props { posts: ContentPostItem[]; }

export function ContentStudio({ posts: initialPosts }: Props) {
  const [posts, setPosts]             = useState<ContentPostItem[]>(initialPosts);
  const [filterStatus, setFilterStatus]   = useState("all");
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [search, setSearch]           = useState("");
  const [viewMode, setViewMode]       = useState<"grid" | "list">("grid");
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [editPost, setEditPost]       = useState<ContentPostItem | null>(null);
  const [, startTransition]           = useTransition();

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
      if (filterPlatform !== "all" && p.format !== filterPlatform) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (p.title?.toLowerCase().includes(q) || p.body?.toLowerCase().includes(q) || p.theme?.toLowerCase().includes(q));
      }
      return true;
    });
  }, [posts, filterStatus, filterPlatform, search]);

  // Aggregate stats
  const avgScore = posts.length > 0 ? Math.round(posts.reduce((s, p) => s + computeContentScore(p), 0) / posts.length) : 0;
  const excellent = posts.filter((p) => computeContentScore(p) >= 80).length;
  const published7d = posts.filter((p) => p.status === "published" && p.createdAt.getTime() > Date.now() - 7 * 86400000).length;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected((prev) => prev.size === filtered.length ? new Set() : new Set(filtered.map((p) => p.id)));
  }

  function bulkDelete() {
    if (!confirm(`Supprimer ${selected.size} post${selected.size > 1 ? "s" : ""} ?`)) return;
    startTransition(async () => {
      for (const id of selected) { await deleteContentPost(id); }
      setPosts((prev) => prev.filter((p) => !selected.has(p.id)));
      setSelected(new Set());
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await deleteContentPost(id);
      if (res.success) setPosts((prev) => prev.filter((p) => p.id !== id));
    });
  }

  return (
    <div className="space-y-4 pt-4">
      {/* Studio Stats Bar */}
      <div className="flex flex-wrap gap-3 rounded-xl bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900/50 dark:to-gray-900/50 border px-5 py-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Total :</span>
          <span className="font-bold">{posts.length} posts</span>
        </div>
        <span className="text-muted-foreground">|</span>
        <div className="flex items-center gap-2 text-sm">
          <Star className="h-4 w-4 text-yellow-500" />
          <span className="text-muted-foreground">Score moyen :</span>
          <span className="font-bold">{avgScore}/100</span>
        </div>
        <span className="text-muted-foreground">|</span>
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span className="text-muted-foreground">Excellents :</span>
          <span className="font-bold text-green-600">{excellent}</span>
        </div>
        <span className="text-muted-foreground">|</span>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-blue-600" />
          <span className="text-muted-foreground">Cette semaine :</span>
          <span className="font-bold text-blue-600">+{published7d}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Rechercher un post..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterPlatform} onValueChange={setFilterPlatform}>
          <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">🌐 Toutes</SelectItem>
            {PLATFORMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.emoji} {p.label}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* View toggle */}
        <div className="flex rounded-md border overflow-hidden">
          <button onClick={() => setViewMode("grid")} className={`px-3 py-2 text-sm transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setViewMode("list")} className={`px-3 py-2 text-sm transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
            <List className="h-3.5 w-3.5" />
          </button>
        </div>

        <Button onClick={() => { setEditPost(null); setDialogOpen(true); }} className="gap-1.5 h-9">
          <Plus className="h-4 w-4" /> Créer un post
        </Button>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-primary/5 border border-primary/20 px-4 py-2">
          <span className="text-sm font-medium">{selected.size} sélectionné{selected.size > 1 ? "s" : ""}</span>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={bulkDelete}>
            <Trash2 className="h-3 w-3 mr-1" />Supprimer
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs ml-auto" onClick={() => setSelected(new Set())}>
            Désélectionner tout
          </Button>
        </div>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filtered.length} post{filtered.length !== 1 ? "s" : ""}
          {search && <span> pour «&nbsp;{search}&nbsp;»</span>}
        </p>
        {filtered.length > 0 && (
          <button onClick={selectAll} className="text-xs text-primary hover:underline flex items-center gap-1">
            <CheckSquare className="h-3 w-3" />
            {selected.size === filtered.length ? "Désélectionner tout" : "Tout sélectionner"}
          </button>
        )}
      </div>

      {/* Grid / List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground opacity-30" />
            <p className="font-medium text-muted-foreground">Aucun post trouvé</p>
            <p className="text-sm text-muted-foreground">{posts.length === 0 ? "Créez votre premier post ou utilisez le générateur IA" : "Changez les filtres ou la recherche"}</p>
            <Button variant="outline" onClick={() => { setEditPost(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />Créer un post
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((post) => (
            <PostCard key={post.id} post={post} onEdit={(p) => { setEditPost(p); setDialogOpen(true); }} onDelete={handleDelete} selected={selected.has(post.id)} onSelect={toggleSelect} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((post) => (
            <PostRow key={post.id} post={post} onEdit={(p) => { setEditPost(p); setDialogOpen(true); }} onDelete={handleDelete} selected={selected.has(post.id)} onSelect={toggleSelect} />
          ))}
        </div>
      )}

      <PostFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSaved={() => window.location.reload()} editPost={editPost} />
    </div>
  );
}
