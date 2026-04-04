"use client";

import { TrendingUp, Globe, Hash, Target, ArrowUp, ArrowDown, Minus, Star, BarChart3, Layers, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { MarketingStats, ContentPostItem, CampaignItem } from "@/lib/actions/marketing.actions";

// ── Config ───────────────────────────────────────────────────────────────────

const PLATFORM_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  FACEBOOK:  { label: "Facebook",  emoji: "📘", color: "bg-blue-500"   },
  INSTAGRAM: { label: "Instagram", emoji: "📷", color: "bg-pink-500"   },
  LINKEDIN:  { label: "LinkedIn",  emoji: "💼", color: "bg-indigo-500" },
  TIKTOK:    { label: "TikTok",    emoji: "🎵", color: "bg-slate-700"  },
  EMAIL:     { label: "Email",     emoji: "📧", color: "bg-gray-500"   },
  WHATSAPP:  { label: "WhatsApp",  emoji: "💬", color: "bg-green-500"  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeContentScore(post: ContentPostItem): number {
  let s = 0;
  if (post.title?.trim())              s += 20;
  if (post.body?.trim())               s += 30;
  if ((post.body?.length ?? 0) > 100) s += 20;
  if (post.theme?.trim())              s += 15;
  if (post.category?.trim())           s += 15;
  return s;
}

function buildHeatmap(posts: ContentPostItem[]): { count: number; date: Date; label: string }[] {
  const now = new Date();
  const cells: { count: number; date: Date; label: string }[] = [];
  for (let i = 55; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    const count = posts.filter(
      (p) => p.status === "published" && p.createdAt >= d && p.createdAt < next
    ).length;
    cells.push({
      count,
      date: d,
      label: d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }),
    });
  }
  return cells;
}

function getPlatformBreakdown(posts: ContentPostItem[]) {
  const bd: Record<string, { published: number; scheduled: number; draft: number }> = {};
  for (const p of posts) {
    if (!bd[p.format]) bd[p.format] = { published: 0, scheduled: 0, draft: 0 };
    if (p.status === "published") bd[p.format].published++;
    else if (p.status === "scheduled") bd[p.format].scheduled++;
    else bd[p.format].draft++;
  }
  return Object.entries(bd).sort((a, b) => {
    const at = a[1].published + a[1].scheduled + a[1].draft;
    const bt = b[1].published + b[1].scheduled + b[1].draft;
    return bt - at;
  });
}

function getCategoryBreakdown(posts: ContentPostItem[]) {
  const bd: Record<string, number> = {};
  for (const p of posts) {
    const cat = p.category ?? "Sans catégorie";
    bd[cat] = (bd[cat] ?? 0) + 1;
  }
  const total = posts.length;
  return Object.entries(bd).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, count]) => ({
    label, count, pct: total > 0 ? Math.round((count / total) * 100) : 0,
  }));
}

function getWeeklyVelocity(posts: ContentPostItem[]): number[] {
  const now = Date.now();
  const weeks = Array(8).fill(0) as number[];
  for (const p of posts) {
    if (p.status !== "published") continue;
    const w = Math.floor((now - p.createdAt.getTime()) / (7 * 86400000));
    if (w < 8) weeks[7 - w]++;
  }
  return weeks;
}

function getTopContent(posts: ContentPostItem[]) {
  return posts
    .map((p) => ({ post: p, score: computeContentScore(p) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  stats: MarketingStats;
  posts: ContentPostItem[];
  campaigns: CampaignItem[];
}

export function AnalyticsDashboard({ stats, posts, campaigns }: Props) {
  const platformBreakdown  = getPlatformBreakdown(posts);
  const categoryBreakdown  = getCategoryBreakdown(posts);
  const weeklyVelocity     = getWeeklyVelocity(posts);
  const maxVelocity        = Math.max(...weeklyVelocity, 1);
  const topContent         = getTopContent(posts);
  const heatmap            = buildHeatmap(posts);
  const maxHeat            = Math.max(...heatmap.map((c) => c.count), 1);

  const now = Date.now();
  const lastWeek    = now - 7 * 86400000;
  const twoWeeksAgo = lastWeek - 7 * 86400000;

  const thisWeekPosts = posts.filter((p) => p.status === "published" && p.createdAt.getTime() > lastWeek).length;
  const lastWeekPosts = posts.filter((p) => p.status === "published" && p.createdAt.getTime() > twoWeeksAgo && p.createdAt.getTime() <= lastWeek).length;
  const weekGrowth    = lastWeekPosts > 0 ? Math.round(((thisWeekPosts - lastWeekPosts) / lastWeekPosts) * 100) : null;
  const publishRate   = stats.totalPosts > 0 ? Math.round((stats.publishedPosts / stats.totalPosts) * 100) : 0;
  const avgScore      = posts.length > 0 ? Math.round(posts.reduce((s, p) => s + computeContentScore(p), 0) / posts.length) : 0;
  const excellentPct  = posts.length > 0 ? Math.round((posts.filter((p) => computeContentScore(p) >= 80).length / posts.length) * 100) : 0;

  // Score distribution
  const scoreDistrib = [
    { label: "Excellent (80-100)", count: posts.filter((p) => computeContentScore(p) >= 80).length, color: "bg-green-500"  },
    { label: "Moyen (50-79)",      count: posts.filter((p) => { const s = computeContentScore(p); return s >= 50 && s < 80; }).length, color: "bg-yellow-500" },
    { label: "Faible (0-49)",      count: posts.filter((p) => computeContentScore(p) < 50).length, color: "bg-red-500"    },
  ];

  // Publishing funnel
  const funnel = [
    { label: "Brouillons",  value: stats.draftPosts,     color: "bg-gray-400",   pct: 100 },
    { label: "En révision", value: posts.filter((p) => p.status === "review").length, color: "bg-yellow-400", pct: 0 },
    { label: "Planifiés",   value: stats.scheduledPosts, color: "bg-blue-500",   pct: 0 },
    { label: "Publiés",     value: stats.publishedPosts, color: "bg-green-500",  pct: 0 },
  ];
  const funnelMax = Math.max(...funnel.map((f) => f.value), 1);
  funnel.forEach((f) => { f.pct = Math.round((f.value / funnelMax) * 100); });

  // Days of week for heatmap column headers
  const DAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

  // Heatmap color
  function heatColor(count: number) {
    if (count === 0) return "bg-muted dark:bg-slate-800";
    if (count === 1) return "bg-green-200 dark:bg-green-900/60";
    if (count === 2) return "bg-green-400 dark:bg-green-700";
    return "bg-green-600 dark:bg-green-500";
  }

  return (
    <div className="space-y-6 pt-4">
      {/* ── KPI Summary ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Total contenu</p>
            <p className="text-3xl font-black tabular-nums">{stats.totalPosts}</p>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
              {stats.publishedPosts} publiés ({publishRate}%)
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Cette semaine</p>
            <p className="text-3xl font-black tabular-nums">{thisWeekPosts}</p>
            {weekGrowth !== null ? (
              <p className={`text-xs mt-1 flex items-center gap-1 font-semibold ${weekGrowth > 0 ? "text-green-600" : weekGrowth < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                {weekGrowth > 0 ? <ArrowUp className="h-3 w-3" /> : weekGrowth < 0 ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                {weekGrowth > 0 ? "+" : ""}{weekGrowth}% vs sem. passée
              </p>
            ) : <p className="text-xs text-muted-foreground mt-1">Première semaine</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Score qualité moyen</p>
            <p className="text-3xl font-black tabular-nums">{avgScore}<span className="text-base text-muted-foreground">/100</span></p>
            <div className="flex items-center gap-1 mt-1 text-xs">
              <Star className="h-3 w-3 text-yellow-500" />
              <span className={excellentPct >= 50 ? "text-green-600 font-semibold" : "text-muted-foreground"}>{excellentPct}% excellents</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Plateformes actives</p>
            <p className="text-3xl font-black tabular-nums">{platformBreakdown.length}<span className="text-base text-muted-foreground">/6</span></p>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <span>{stats.activeCampaigns} campagne{stats.activeCampaigns !== 1 ? "s" : ""} active{stats.activeCampaigns !== 1 ? "s" : ""}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Activity Heatmap ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-green-600" />
            Fréquence de publication — 8 dernières semaines
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            {/* Day labels */}
            <div className="flex gap-1 mb-1 pl-8">
              {Array(8).fill(null).map((_, wi) => (
                <div key={wi} className="flex gap-1 flex-1">
                  {/* intentionally empty — week column */}
                </div>
              ))}
            </div>
            <div className="flex gap-1">
              {/* Day-of-week labels on the left */}
              <div className="flex flex-col gap-1 w-6 shrink-0">
                {DAY_LABELS.map((d, i) => (
                  <div key={i} className="h-3.5 flex items-center justify-end pr-1 text-xs text-muted-foreground">{d}</div>
                ))}
              </div>
              {/* 8 weeks × 7 days */}
              {Array.from({ length: 8 }, (_, weekIdx) => {
                const weekLabel = weekIdx === 7 ? "Cette sem." : `S-${7 - weekIdx}`;
                return (
                  <div key={weekIdx} className="flex flex-col gap-1 flex-1">
                    {Array.from({ length: 7 }, (_, dayIdx) => {
                      const cellIdx = weekIdx * 7 + dayIdx;
                      const cell = heatmap[cellIdx];
                      if (!cell) return <div key={dayIdx} className="h-3.5 rounded-sm bg-muted" />;
                      return (
                        <div
                          key={dayIdx}
                          className={`h-3.5 rounded-sm transition-colors cursor-default ${heatColor(cell.count)}`}
                          title={`${cell.label} — ${cell.count} post${cell.count !== 1 ? "s" : ""}`}
                        />
                      );
                    })}
                    <p className="text-xs text-muted-foreground text-center mt-1 truncate">{weekLabel}</p>
                  </div>
                );
              })}
            </div>
            {/* Legend */}
            <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
              <span>Moins</span>
              {["bg-muted dark:bg-slate-800", "bg-green-200 dark:bg-green-900/60", "bg-green-400 dark:bg-green-700", "bg-green-600 dark:bg-green-500"].map((c, i) => (
                <div key={i} className={`h-3.5 w-3.5 rounded-sm ${c}`} />
              ))}
              <span>Plus</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Platform Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4 text-blue-600" />
              Performance par plateforme
            </CardTitle>
          </CardHeader>
          <CardContent>
            {platformBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Aucun contenu créé</p>
            ) : (
              <div className="space-y-4">
                {platformBreakdown.map(([platform, counts]) => {
                  const cfg   = PLATFORM_CONFIG[platform] ?? { label: platform, emoji: "📄", color: "bg-gray-500" };
                  const total = counts.published + counts.scheduled + counts.draft;
                  const pubPct = total > 0 ? Math.round((counts.published / total) * 100) : 0;
                  return (
                    <div key={platform} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span>{cfg.emoji}</span>
                          <span className="font-semibold">{cfg.label}</span>
                          <span className={`rounded-full px-1.5 py-0.5 text-xs text-white font-bold ${cfg.color}`}>{pubPct}% publiés</span>
                        </span>
                        <span className="text-muted-foreground text-xs tabular-nums">{total} posts</span>
                      </div>
                      <div className="h-3 rounded-full bg-muted flex overflow-hidden">
                        {counts.published > 0 && <div className="h-full bg-green-500" style={{ width: `${(counts.published / total) * 100}%` }} title={`${counts.published} publiés`} />}
                        {counts.scheduled > 0 && <div className="h-full bg-blue-400"  style={{ width: `${(counts.scheduled / total) * 100}%` }} title={`${counts.scheduled} planifiés`} />}
                        {counts.draft > 0 && <div className="h-full bg-gray-300 dark:bg-gray-600" style={{ width: `${(counts.draft / total) * 100}%` }} title={`${counts.draft} brouillons`} />}
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500 inline-block" />{counts.published} publiés</span>
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-400 inline-block" />{counts.scheduled} planifiés</span>
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-gray-300 inline-block" />{counts.draft} brouillons</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Publishing Funnel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4 text-purple-600" />
              Entonnoir de publication
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {funnel.map((stage, i) => (
                <div key={stage.label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className={`h-3 w-3 rounded-sm ${stage.color}`} />
                      <span className="font-medium">{stage.label}</span>
                    </span>
                    <span className="font-bold tabular-nums">{stage.value}</span>
                  </div>
                  <div className="h-8 rounded-md bg-muted overflow-hidden flex items-center">
                    <div className={`h-full ${stage.color} transition-all flex items-center justify-end px-2`} style={{ width: `${stage.pct}%`, minWidth: stage.value > 0 ? "2rem" : "0" }}>
                      {stage.value > 0 && <span className="text-white text-xs font-bold">{stage.value}</span>}
                    </div>
                  </div>
                  {i < funnel.length - 1 && stage.value > 0 && funnel[i + 1].value > 0 && (
                    <p className="text-xs text-muted-foreground pl-5">
                      → {Math.round((funnel[i + 1].value / stage.value) * 100)}% passent à l&apos;étape suivante
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Weekly Velocity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Vélocité de publication (8 semaines)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1.5 h-40">
              {weeklyVelocity.map((count, i) => {
                const isCurrentWeek = i === 7;
                const h = (count / maxVelocity) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400 tabular-nums">{count}</span>
                    <div className="w-full flex items-end" style={{ height: "100px" }}>
                      <div
                        className={`w-full rounded-t-sm transition-all ${isCurrentWeek ? "bg-blue-500" : "bg-slate-200 dark:bg-slate-700"}`}
                        style={{ height: `${Math.max(h, count > 0 ? 8 : 2)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground text-center leading-tight">
                      {isCurrentWeek ? "Cette\nsem." : `S-${7 - i}`}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-center gap-6 text-xs text-muted-foreground border-t pt-3">
              <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-blue-500 inline-block" />Semaine en cours</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-slate-200 dark:bg-slate-700 inline-block" />Semaines passées</span>
            </div>
          </CardContent>
        </Card>

        {/* Content Score Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="h-4 w-4 text-yellow-500" />
              Distribution qualité du contenu
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {scoreDistrib.map((tier) => {
              const pct = posts.length > 0 ? Math.round((tier.count / posts.length) * 100) : 0;
              return (
                <div key={tier.label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className={`h-3 w-3 rounded-full ${tier.color}`} />
                      <span className="font-medium">{tier.label}</span>
                    </span>
                    <span className="font-bold tabular-nums">{tier.count} <span className="text-muted-foreground font-normal">({pct}%)</span></span>
                  </div>
                  <Progress value={pct} className={`h-3 [&>div]:${tier.color}`} />
                </div>
              );
            })}
            <div className="rounded-lg bg-muted/50 px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Score moyen global</span>
              <span className="text-2xl font-black tabular-nums">{avgScore}<span className="text-sm text-muted-foreground">/100</span></span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Top Content ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Award className="h-4 w-4 text-yellow-500" />
            Top contenu — Meilleur score qualité
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topContent.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Aucun contenu créé</p>
          ) : (
            <div className="space-y-2">
              {topContent.map(({ post, score }, rank) => {
                const cfg    = PLATFORM_CONFIG[post.format] ?? { emoji: "📄", label: post.format };
                const status = post.status === "published" ? "bg-green-100 text-green-800" : post.status === "scheduled" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-700";
                return (
                  <div key={post.id} className="flex items-center gap-3 rounded-lg border px-4 py-2.5 hover:bg-muted/30">
                    <span className={`text-sm font-black tabular-nums w-5 ${rank === 0 ? "text-yellow-500" : rank === 1 ? "text-slate-400" : rank === 2 ? "text-orange-500" : "text-muted-foreground"}`}>
                      {rank + 1}
                    </span>
                    <span className="text-lg shrink-0">{cfg.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{post.title ?? post.body?.slice(0, 60) ?? "Sans titre"}</p>
                      <p className="text-xs text-muted-foreground truncate">{post.theme ? `#${post.theme}` : post.category ?? "—"}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status}`}>
                      {post.status === "published" ? "Publié" : post.status === "scheduled" ? "Planifié" : "Brouillon"}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${score >= 80 ? "bg-green-100 text-green-800" : score >= 50 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-700"}`}>
                      <Star className="h-2.5 w-2.5" />{score}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Category + Campaign Performance ────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Hash className="h-4 w-4 text-purple-600" />
              Répartition par catégorie
            </CardTitle>
          </CardHeader>
          <CardContent>
            {categoryBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Aucune catégorie définie</p>
            ) : (
              <div className="space-y-3">
                {categoryBreakdown.map((cat) => (
                  <div key={cat.label} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium truncate">{cat.label}</span>
                      <span className="text-muted-foreground text-xs ml-2 shrink-0 tabular-nums">{cat.count} ({cat.pct}%)</span>
                    </div>
                    <Progress value={cat.pct} className="h-2" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-orange-600" />
              Performance des campagnes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {campaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Aucune campagne créée</p>
            ) : (
              <div className="space-y-4">
                {campaigns.slice(0, 5).map((c) => {
                  let progress = 0;
                  if (c.startDate && c.endDate) {
                    const total = c.endDate.getTime() - c.startDate.getTime();
                    progress = Math.min(100, Math.max(0, Math.round(((now - c.startDate.getTime()) / total) * 100)));
                  }
                  const daysLeft = c.endDate ? Math.max(0, Math.ceil((c.endDate.getTime() - now) / 86400000)) : null;
                  return (
                    <div key={c.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold truncate">{c.name}</span>
                        <Badge variant="secondary" className={`text-xs shrink-0 ${c.status === "active" ? "bg-green-100 text-green-800" : c.status === "completed" ? "bg-purple-100 text-purple-800" : c.status === "planning" ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-800"}`}>
                          {c.status === "active" ? "Active" : c.status === "completed" ? "Terminée" : c.status === "planning" ? "En préparation" : c.status === "paused" ? "En pause" : c.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        {c.budget && <span className="font-semibold text-slate-600 dark:text-slate-400">Budget : {c.budget.toLocaleString("fr-FR")} XAF</span>}
                        {daysLeft !== null && c.status === "active" && <span className={daysLeft <= 3 ? "text-red-600 font-bold" : ""}>{daysLeft}j restants</span>}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Avancement</span>
                          <span className="font-bold tabular-nums">{progress}%</span>
                        </div>
                        <Progress value={progress} className={`h-2 ${progress > 90 && c.status === "active" ? "[&>div]:bg-orange-500" : ""}`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
