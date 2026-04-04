"use client";

import Link from "next/link";
import {
  Zap, AlertTriangle, CheckCircle2, Clock, TrendingUp,
  Sparkles, ArrowRight, FileText, Megaphone, Radio,
  BarChart3, Target, Flame, Shield, CalendarClock,
  Activity, Circle, Eye, RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import type {
  MarketingStats, ContentPostItem, CampaignItem, BrandSettings,
} from "@/lib/actions/marketing.actions";

// ���� Config ������������������������������������������������������������������������������������������������������������������������������������

const PLATFORM_CONFIG: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  FACEBOOK:  { label: "Facebook",  emoji: "�x�", color: "text-blue-600",   bg: "surface-info"   },
  INSTAGRAM: { label: "Instagram", emoji: "�x�", color: "text-pink-600",   bg: "bg-pink-50 dark:bg-pink-950/30"   },
  LINKEDIN:  { label: "LinkedIn",  emoji: "�x�", color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-950/30" },
  TIKTOK:    { label: "TikTok",    emoji: "�x}�", color: "text-slate-700",  bg: "bg-slate-50 dark:bg-slate-800/30"  },
  EMAIL:     { label: "Email",     emoji: "�x�", color: "text-gray-600",   bg: "bg-gray-50 dark:bg-gray-800/30"    },
  WHATSAPP:  { label: "WhatsApp",  emoji: "�x�", color: "text-green-600",  bg: "surface-success"  },
};

const WEEKLY_GOAL = 3; // posts per week target

// ���� Helpers ������������������������������������������������������������������������������������������������������������������������������������

function computeBrandHealth(stats: MarketingStats, posts: ContentPostItem[], campaigns: CampaignItem[]) {
  const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const recentPosts = posts.filter((p) => p.status === "published" && p.createdAt.getTime() > sevenDaysAgo).length;
  const platforms   = new Set(posts.filter((p) => p.status === "published").map((p) => p.format)).size;
  const active      = campaigns.filter((c) => c.status === "active").length;

  const scores = [
    { label: "Présence",    score: Math.min(30, stats.publishedPosts * 3), max: 30, color: "bg-blue-400"   },
    { label: "Régularité",  score: Math.min(20, recentPosts * 4),          max: 20, color: "bg-green-400"  },
    { label: "Diversité",   score: Math.min(20, platforms * 5),            max: 20, color: "bg-purple-400" },
    { label: "Campagnes",   score: Math.min(15, active * 8),               max: 15, color: "bg-orange-400" },
    { label: "Distribution",score: Math.min(15, stats.activeChannels * 3), max: 15, color: "bg-pink-400"   },
  ];
  return { score: scores.reduce((s, d) => s + d.score, 0), breakdown: scores };
}

function computeContentScore(post: ContentPostItem): number {
  let s = 0;
  if (post.title?.trim())             s += 20;
  if (post.body?.trim())              s += 30;
  if ((post.body?.length ?? 0) > 100) s += 20;
  if (post.theme?.trim())             s += 15;
  if (post.category?.trim())          s += 15;
  return s;
}

function buildUrgentActions(posts: ContentPostItem[], campaigns: CampaignItem[]) {
  const now = Date.now();
  const actions: { label: string; severity: "error" | "warning"; count: number }[] = [];

  const review = posts.filter((p) => p.status === "review").length;
  if (review > 0) actions.push({ label: `${review} post${review > 1 ? "s" : ""} en attente de révision`, severity: "warning", count: review });

  const expiring = campaigns.filter((c) => {
    if (c.status !== "active" || !c.endDate) return false;
    return (c.endDate.getTime() - now) / 86400000 <= 3;
  }).length;
  if (expiring > 0) actions.push({ label: `${expiring} campagne${expiring > 1 ? "s" : ""} expire dans 3 jours`, severity: "error", count: expiring });

  const overdue = posts.filter((p) => p.status === "scheduled" && p.scheduledAt && p.scheduledAt.getTime() < now).length;
  if (overdue > 0) actions.push({ label: `${overdue} post${overdue > 1 ? "s" : ""} planifié${overdue > 1 ? "s" : ""} dépassé${overdue > 1 ? "s" : ""}`, severity: "error", count: overdue });

  const lowScore = posts.filter((p) => p.status === "draft" && computeContentScore(p) < 50).length;
  if (lowScore > 0) actions.push({ label: `${lowScore} brouillon${lowScore > 1 ? "s" : ""} avec score qualité < 50`, severity: "warning", count: lowScore });

  return actions.slice(0, 4);
}

function buildRecommendations(stats: MarketingStats, posts: ContentPostItem[], campaigns: CampaignItem[]) {
  const recs: { icon: string; text: string; priority: "high" | "medium" | "low" }[] = [];
  if (stats.publishedPosts === 0)          recs.push({ icon: "�xa�", text: "Publiez votre premier contenu pour lancer votre présence digitale.", priority: "high" });
  else if (stats.publishedPosts < 5)       recs.push({ icon: "�x�", text: "Augmentez la cadence � visez 3 posts/semaine minimum.", priority: "high" });
  if (stats.activeCampaigns === 0)         recs.push({ icon: "�x}�", text: "Lancez une campagne de notoriété pour booster votre visibilité.", priority: "high" });
  if (stats.draftPosts > 3)               recs.push({ icon: "�S�️", text: `${stats.draftPosts} brouillons en attente � planifiez-les pour maintenir le rythme.`, priority: "medium" });
  const formats = new Set(posts.filter((p) => p.status === "published").map((p) => p.format));
  if (formats.size < 3)                    recs.push({ icon: "�xR�", text: "Diversifiez les canaux � LinkedIn + Instagram essentiels en B2B logistique.", priority: "medium" });
  if (stats.activeChannels < 3)            recs.push({ icon: "�x�", text: "Connectez plus de canaux pour maximiser la distribution.", priority: "medium" });
  if (posts.some((p) => p.status === "review")) recs.push({ icon: "�x�️", text: "Des posts attendent une révision avant publication.", priority: "high" });
  recs.push({ icon: "�x�", text: "Studio IA � générez du contenu adapté à chaque plateforme en 1 clic.", priority: "low" });
  recs.push({ icon: "�x`", text: "Identifiez vos formats les plus performants dans l'onglet Analytics.", priority: "low" });
  recs.push({ icon: "�x️", text: "Planifiez 2 semaines à l'avance dans le Calendrier �0ditorial.", priority: "low" });
  return recs.slice(0, 5);
}

function getUpcoming(posts: ContentPostItem[]) {
  const now = Date.now();
  return posts
    .filter((p) => p.scheduledAt && p.scheduledAt.getTime() >= now && p.scheduledAt.getTime() <= now + 7 * 86400000)
    .sort((a, b) => a.scheduledAt!.getTime() - b.scheduledAt!.getTime())
    .slice(0, 4);
}

function getActivityFeed(posts: ContentPostItem[], campaigns: CampaignItem[]) {
  const events: { time: Date; icon: string; label: string; type: string }[] = [];
  for (const p of posts.slice(0, 10)) {
    const label = p.title ?? p.body?.slice(0, 40) ?? "Post sans titre";
    const cfg = PLATFORM_CONFIG[p.format];
    events.push({ time: p.createdAt, icon: cfg?.emoji ?? "�x", label: `Post ${p.status === "published" ? "publié" : "créé"} � ${label}`, type: p.status });
  }
  for (const c of campaigns.slice(0, 5)) {
    events.push({ time: c.createdAt, icon: "�x}�", label: `Campagne créée � ${c.name}`, type: "campaign" });
  }
  return events.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 6);
}

function getPlatformPulse(posts: ContentPostItem[]) {
  const sevenDaysAgo = Date.now() - 7 * 86400000;
  return Object.entries(PLATFORM_CONFIG).map(([key, cfg]) => {
    const total   = posts.filter((p) => p.format === key).length;
    const recent  = posts.filter((p) => p.format === key && p.createdAt.getTime() > sevenDaysAgo).length;
    const published = posts.filter((p) => p.format === key && p.status === "published").length;
    const status = recent > 0 ? "active" : total > 0 ? "idle" : "inactive";
    return { key, ...cfg, total, recent, published, status };
  });
}

// ���� Component ����������������������������������������������������������������������������������������������������������������������������

interface Props {
  stats: MarketingStats;
  posts: ContentPostItem[];
  campaigns: CampaignItem[];
  brandSettings: BrandSettings;
}

export function MarketingOverview({ stats, posts, campaigns, brandSettings }: Props) {
  const health     = computeBrandHealth(stats, posts, campaigns);
  const recs       = buildRecommendations(stats, posts, campaigns);
  const urgent     = buildUrgentActions(posts, campaigns);
  const upcoming   = getUpcoming(posts);
  const feed       = getActivityFeed(posts, campaigns);
  const pulse      = getPlatformPulse(posts);
  const active     = campaigns.filter((c) => c.status === "active" || c.status === "planning");
  const reviewCount = posts.filter((p) => p.status === "review").length;

  const now          = Date.now();
  const weekStart    = now - 7 * 86400000;
  const thisWeekPosts = posts.filter((p) => p.status === "published" && p.createdAt.getTime() > weekStart).length;
  const goalPct      = Math.min(100, Math.round((thisWeekPosts / WEEKLY_GOAL) * 100));

  const avgScore = posts.length > 0
    ? Math.round(posts.reduce((s, p) => s + computeContentScore(p), 0) / posts.length)
    : 0;

  const scoreColor    = health.score >= 70 ? "text-green-400" : health.score >= 40 ? "text-yellow-400" : "text-red-400";
  const scoreLabel    = health.score >= 70 ? "Excellente" : health.score >= 40 ? "En progression" : "ì renforcer";

  return (
    <div className="space-y-5 pt-4">
      {/* ���� Mission Control Bar �������������������������������������������������������������������������������� */}
      <div className="flex items-center justify-between flex-wrap gap-2 rounded-xl border bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-3 text-white">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
            <Circle className="h-2.5 w-2.5 fill-red-400 animate-pulse" />
            LIVE
          </span>
          <span className="text-slate-400 text-xs">|</span>
          <span className="text-sm font-bold text-white">{brandSettings.name} � Marketing OS</span>
          <span className="text-slate-400 text-xs">|</span>
          <span className="text-xs text-slate-400">
            {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-300">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
            {stats.publishedPosts} publiés
          </span>
          <span className="flex items-center gap-1.5">
            <Megaphone className="h-3.5 w-3.5 text-purple-400" />
            {stats.activeCampaigns} campagnes
          </span>
          <span className="flex items-center gap-1.5">
            <Radio className="h-3.5 w-3.5 text-orange-400" />
            {stats.activeChannels} canaux
          </span>
          <Badge className="bg-purple-700/60 text-purple-200 border-purple-600 text-xs gap-1">
            <Sparkles className="h-3 w-3" />
            IA active
          </Badge>
        </div>
      </div>

      {/* ���� KPI Chips ������������������������������������������������������������������������������������������������������ */}
      <div className="flex flex-wrap gap-2">
        {[
          { icon: <CheckCircle2 className="h-4 w-4 text-green-600" />, value: stats.publishedPosts, label: "Publiés",      color: "bg-green-50 border-green-200 dark:bg-green-950/20"  },
          { icon: <Clock className="h-4 w-4 text-blue-600" />,         value: stats.scheduledPosts, label: "Planifiés",    color: "bg-blue-50 border-blue-200 dark:bg-blue-950/20"     },
          { icon: <FileText className="h-4 w-4 text-gray-500" />,      value: stats.draftPosts,     label: "Brouillons",   color: "bg-gray-50 border-gray-200 dark:bg-gray-950/20"     },
          { icon: <Eye className="h-4 w-4 text-yellow-600" />,         value: reviewCount,          label: "En révision",  color: "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20" },
          { icon: <Megaphone className="h-4 w-4 text-purple-600" />,   value: stats.activeCampaigns,label: "Campagnes",    color: "bg-purple-50 border-purple-200 dark:bg-purple-950/20"},
          { icon: <BarChart3 className="h-4 w-4 text-indigo-600" />,   value: `${avgScore}/100`,    label: "Score moyen",  color: "bg-indigo-50 border-indigo-200 dark:bg-indigo-950/20"},
        ].map((kpi) => (
          <div key={kpi.label} className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium ${kpi.color}`}>
            {kpi.icon}
            <span className="font-bold">{kpi.value}</span>
            <span className="text-muted-foreground text-xs">{kpi.label}</span>
          </div>
        ))}
      </div>

      {/* ���� Main Grid ������������������������������������������������������������������������������������������������������ */}
      <div className="grid gap-5 lg:grid-cols-3">

        {/* Col 1 � Weekly Goal + Alerts + Upcoming */}
        <div className="space-y-4">

          {/* Weekly Publishing Goal */}
          <Card className="overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
            <CardHeader className="pb-3 pt-4">
              <CardTitle className="flex items-center justify-between text-sm font-semibold">
                <span className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-500" />
                  Objectif de la semaine
                </span>
                <span className={`text-xs font-bold ${goalPct >= 100 ? "text-green-600" : "text-muted-foreground"}`}>
                  {thisWeekPosts}/{WEEKLY_GOAL} posts
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 space-y-3">
              <div className="space-y-2">
                <Progress value={goalPct} className="h-3" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{goalPct >= 100 ? "�x}0 Objectif atteint !" : `${WEEKLY_GOAL - thisWeekPosts} post${WEEKLY_GOAL - thisWeekPosts > 1 ? "s" : ""} restant${WEEKLY_GOAL - thisWeekPosts > 1 ? "s" : ""}`}</span>
                  <span>{goalPct}%</span>
                </div>
              </div>
              {/* Mini week bars */}
              <div className="grid grid-cols-7 gap-1">
                {["L", "M", "M", "J", "V", "S", "D"].map((day, i) => {
                  const dStart = new Date(); dStart.setDate(dStart.getDate() - dStart.getDay() + 1 + i); dStart.setHours(0,0,0,0);
                  const dEnd   = new Date(dStart); dEnd.setDate(dEnd.getDate() + 1);
                  const count  = posts.filter((p) => p.status === "published" && p.createdAt >= dStart && p.createdAt < dEnd).length;
                  return (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div className={`h-8 w-full rounded-sm flex items-end justify-center pb-0.5 text-xs font-bold ${count > 0 ? "bg-blue-500 text-white" : "bg-muted text-muted-foreground"}`}>
                        {count > 0 ? count : ""}
                      </div>
                      <span className="text-xs text-muted-foreground">{day}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Urgent Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Zap className="h-4 w-4 text-yellow-500" />
                Actions urgentes
                {urgent.length > 0 && (
                  <Badge className="bg-red-100 text-red-700 text-xs ml-auto">{urgent.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {urgent.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/20 px-3 py-2.5">
                  <Shield className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="text-xs text-green-700 dark:text-green-400">Tout est en ordre</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {urgent.map((a, i) => (
                    <div key={i} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs font-medium ${a.severity === "error" ? "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400" : "bg-yellow-50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-400"}`}>
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      {a.label}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <CalendarClock className="h-4 w-4 text-blue-500" />
                Publications à venir (7j)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <p className="text-xs text-muted-foreground py-1">Aucune publication planifiée</p>
              ) : (
                <div className="space-y-2.5">
                  {upcoming.map((post) => {
                    const p = PLATFORM_CONFIG[post.format] ?? { emoji: "�x" };
                    return (
                      <div key={post.id} className="flex items-start gap-2 text-xs">
                        <span className="text-base leading-none mt-0.5">{p.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{post.title ?? post.body?.slice(0, 50) ?? "Sans titre"}</p>
                          <p className="text-muted-foreground">{post.scheduledAt!.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Col 2 � Brand Health + Platform Pulse */}
        <div className="space-y-4">
          {/* Brand Health Score */}
          <div className="rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 text-white shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-400" />
                <span className="text-sm font-semibold text-slate-200">Brand Health Score</span>
              </div>
              <Badge className="bg-slate-700 text-slate-200 border-slate-600 text-xs">{scoreLabel}</Badge>
            </div>
            <div className="flex items-end gap-2 mb-5">
              <span className={`text-6xl font-black tabular-nums ${scoreColor}`}>{health.score}</span>
              <span className="text-slate-400 text-xl mb-1">/100</span>
            </div>
            <div className="space-y-2.5">
              {health.breakdown.map((d) => (
                <div key={d.label}>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>{d.label}</span>
                    <span className="font-medium text-slate-300">{d.score}/{d.max}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${d.color}`} style={{ width: `${d.max > 0 ? (d.score / d.max) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-2 gap-2 text-xs text-slate-400">
              <div>Score moyen contenu <span className="text-white font-bold ml-1">{avgScore}/100</span></div>
              <div>Total posts <span className="text-white font-bold ml-1">{stats.totalPosts}</span></div>
            </div>
          </div>

          {/* Platform Pulse Grid */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Activity className="h-4 w-4 text-green-500" />
                Platform Pulse
                <span className="text-xs text-muted-foreground font-normal ml-auto">7 derniers jours</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {pulse.map((p) => (
                  <div key={p.key} className={`rounded-lg p-2.5 space-y-1 ${p.bg}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-base">{p.emoji}</span>
                      <span className={`h-2 w-2 rounded-full ${p.status === "active" ? "bg-green-500 animate-pulse" : p.status === "idle" ? "bg-yellow-400" : "bg-gray-300"}`} />
                    </div>
                    <p className={`text-xs font-semibold ${p.color}`}>{p.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.recent > 0 ? `+${p.recent} cette sem.` : p.total > 0 ? `${p.published} publiés` : "Inactif"}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Content Pipeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <BarChart3 className="h-4 w-4 text-slate-500" />
                Pipeline de contenu
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {[
                { label: "Publiés",    value: stats.publishedPosts, color: "bg-green-500"  },
                { label: "Planifiés",  value: stats.scheduledPosts, color: "bg-blue-500"   },
                { label: "Révision",   value: reviewCount,          color: "bg-yellow-500" },
                { label: "Brouillons", value: stats.draftPosts,     color: "bg-gray-400"   },
              ].map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-bold tabular-nums">{item.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${item.color}`} style={{ width: stats.totalPosts > 0 ? `${(item.value / stats.totalPosts) * 100}%` : "0%" }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Col 3 � AI Recommendations + Activity Feed */}
        <div className="space-y-4">
          {/* AI Recommendations */}
          <Card className="border-purple-200 bg-gradient-to-br from-purple-50/80 to-indigo-50/80 dark:from-purple-950/30 dark:to-indigo-950/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-purple-800 dark:text-purple-300">
                <Sparkles className="h-4 w-4" />
                Intelligence Marketing IA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recs.map((rec, i) => (
                <div key={i} className={`rounded-lg px-3 py-2 text-xs flex items-start gap-2 ${rec.priority === "high" ? "bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900" : rec.priority === "medium" ? "bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900" : "bg-white dark:bg-slate-800 border border-purple-100 dark:border-purple-900"}`}>
                  <span className="text-sm leading-none mt-0.5 shrink-0">{rec.icon}</span>
                  <span className={rec.priority === "high" ? "text-red-800 dark:text-red-300" : rec.priority === "medium" ? "text-amber-800 dark:text-amber-300" : "text-slate-700 dark:text-slate-300"}>
                    {rec.text}
                  </span>
                </div>
              ))}
              <Link href="/ai" className="flex items-center gap-1 text-xs text-purple-700 dark:text-purple-400 hover:underline pt-1">
                Centre IA complet <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>

          {/* Activity Feed */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <RefreshCw className="h-4 w-4 text-blue-500" />
                Activité récente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {feed.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucune activité enregistrée</p>
              ) : (
                <div className="space-y-0">
                  {feed.map((event, i) => (
                    <div key={i} className="flex items-start gap-3 py-2 border-b last:border-0">
                      <span className="text-base leading-none mt-0.5 shrink-0">{event.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{event.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {event.time.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <div className={`h-2 w-2 rounded-full shrink-0 mt-1.5 ${event.type === "published" ? "bg-green-500" : event.type === "campaign" ? "bg-purple-500" : "bg-gray-300"}`} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Brand Quick View */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Target className="h-4 w-4 text-indigo-500" />
                Identité de marque
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  {[brandSettings.primaryColor, brandSettings.secondaryColor, brandSettings.accentColor].map((col) => (
                    <div key={col} className="h-7 w-7 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: col }} />
                  ))}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{brandSettings.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{brandSettings.tagline}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground capitalize">{brandSettings.tone}</span>
                <Button variant="ghost" size="sm" className="h-6 text-xs text-indigo-600 px-2" asChild>
                  <Link href="/marketing">Brand Center <ArrowRight className="h-3 w-3 ml-1" /></Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ���� Active Campaigns Strip ������������������������������������������������������������������������������ */}
      {active.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Megaphone className="h-4 w-4 text-purple-600" />
              Campagnes en cours
              <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 text-xs ml-1">{active.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {active.slice(0, 6).map((c) => {
                const now2 = Date.now();
                let progress = 0;
                if (c.startDate && c.endDate) {
                  const total = c.endDate.getTime() - c.startDate.getTime();
                  progress = Math.min(100, Math.max(0, Math.round(((now2 - c.startDate.getTime()) / total) * 100)));
                }
                return (
                  <div key={c.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold leading-tight">{c.name}</p>
                      <Badge variant="secondary" className={c.status === "active" ? "bg-green-100 text-green-800 text-xs shrink-0" : "bg-yellow-100 text-yellow-800 text-xs shrink-0"}>
                        {c.status === "active" ? "Active" : "Planning"}
                      </Badge>
                    </div>
                    {c.objective && <p className="text-xs text-muted-foreground line-clamp-1">{c.objective}</p>}
                    {c.channels.length > 0 && (
                      <div className="flex gap-1">
                        {c.channels.slice(0, 5).map((ch) => {
                          const pc = PLATFORM_CONFIG[ch]; return pc ? <span key={ch} className="text-sm">{pc.emoji}</span> : null;
                        })}
                      </div>
                    )}
                    {c.budget && <p className="text-xs text-muted-foreground font-medium">Budget : {c.budget.toLocaleString("fr-FR")} XAF</p>}
                    {progress > 0 && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Progression temporelle</span>
                          <span className="font-bold">{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-1.5" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
