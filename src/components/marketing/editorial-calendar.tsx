"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ContentPostItem } from "@/lib/actions/marketing.actions";

// ── Config ─────────────────────────────────────────────────────────────────

const PLATFORM_CONFIG: Record<string, { emoji: string; color: string }> = {
  FACEBOOK:  { emoji: "📘", color: "bg-blue-100 text-blue-800 border-blue-200" },
  INSTAGRAM: { emoji: "📷", color: "bg-pink-100 text-pink-800 border-pink-200" },
  LINKEDIN:  { emoji: "💼", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  TIKTOK:    { emoji: "🎵", color: "bg-slate-100 text-slate-800 border-slate-200" },
  EMAIL:     { emoji: "📧", color: "bg-gray-100 text-gray-700 border-gray-200" },
  WHATSAPP:  { emoji: "💬", color: "bg-green-100 text-green-800 border-green-200" },
};

const DAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

// ── Helpers ────────────────────────────────────────────────────────────────

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

interface Props {
  posts: ContentPostItem[];
}

export function EditorialCalendar({ posts }: Props) {
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [selectedPost, setSelectedPost] = useState<ContentPostItem | null>(null);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Posts that have a scheduledAt or publishedAt date
  const scheduledPosts = posts.filter(
    (p) => p.scheduledAt || (p.publishedAt && p.status === "published")
  );

  // Posts without any date
  const unscheduledPosts = posts.filter(
    (p) => !p.scheduledAt && !(p.publishedAt && p.status === "published") && p.status !== "published"
  );

  function getPostsForDay(day: Date): ContentPostItem[] {
    return scheduledPosts.filter((p) => {
      const date = p.scheduledAt ? new Date(p.scheduledAt) : new Date(p.publishedAt!);
      return isSameDay(date, day);
    });
  }

  function prevWeek() {
    setWeekStart((d) => addDays(d, -7));
  }

  function nextWeek() {
    setWeekStart((d) => addDays(d, 7));
  }

  function goToToday() {
    setWeekStart(getMonday(new Date()));
  }

  const weekLabel = (() => {
    const end = addDays(weekStart, 6);
    if (weekStart.getMonth() === end.getMonth()) {
      return `${weekStart.getDate()}–${end.getDate()} ${MONTHS_FR[weekStart.getMonth()]} ${weekStart.getFullYear()}`;
    }
    return `${weekStart.getDate()} ${MONTHS_FR[weekStart.getMonth()]} – ${end.getDate()} ${MONTHS_FR[end.getMonth()]} ${end.getFullYear()}`;
  })();

  return (
    <div className="space-y-4 pt-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium ml-1">{weekLabel}</span>
        </div>
        <Button variant="outline" size="sm" onClick={goToToday}>
          Aujourd&apos;hui
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day, idx) => {
          const dayPosts = getPostsForDay(day);
          const isToday = isSameDay(day, new Date());
          return (
            <div key={idx} className="space-y-1.5">
              {/* Day header */}
              <div
                className={`text-center py-1.5 rounded-lg text-xs font-medium ${
                  isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                <div>{DAYS_FR[idx]}</div>
                <div className={`text-base font-bold ${isToday ? "" : "text-foreground"}`}>
                  {day.getDate()}
                </div>
              </div>

              {/* Posts */}
              <div className="min-h-24 space-y-1">
                {dayPosts.map((post) => {
                  const pCfg = PLATFORM_CONFIG[post.format] ?? {
                    emoji: "📄",
                    color: "bg-gray-100 text-gray-700 border-gray-200",
                  };
                  return (
                    <button
                      key={post.id}
                      onClick={() => setSelectedPost(post === selectedPost ? null : post)}
                      className={`w-full text-left rounded-md border px-2 py-1 text-xs transition-shadow hover:shadow-sm ${pCfg.color} ${
                        selectedPost?.id === post.id ? "ring-1 ring-primary" : ""
                      }`}
                    >
                      <span className="mr-1">{pCfg.emoji}</span>
                      <span className="font-medium truncate">
                        {post.title ?? post.body?.slice(0, 25) ?? "Post"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected post detail */}
      {selectedPost && (
        <Card className="border-primary/30">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <span>
                {PLATFORM_CONFIG[selectedPost.format]?.emoji ?? "📄"}
              </span>
              {selectedPost.title ?? "Post sans titre"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">
            {selectedPost.body ?? "Aucun contenu"}
          </CardContent>
        </Card>
      )}

      {/* Unscheduled posts */}
      {unscheduledPosts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Non planifiés ({unscheduledPosts.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {unscheduledPosts.map((post) => {
              const pCfg = PLATFORM_CONFIG[post.format] ?? { emoji: "📄", color: "bg-gray-100 text-gray-700 border-gray-200" };
              return (
                <span
                  key={post.id}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${pCfg.color}`}
                >
                  {pCfg.emoji}
                  {post.title ?? post.body?.slice(0, 30) ?? "Post"}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {posts.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Calendar className="mx-auto h-10 w-10 opacity-30 mb-2" />
            <p className="text-sm">Aucun post à afficher — créez des posts dans Studio</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
