"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, Check, CheckCheck, ExternalLink, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  getMyNotifications, getUnreadNotificationCount,
  markNotificationRead, markAllNotificationsRead,
} from "@/lib/actions/task.actions";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<string, string> = {
  TASK_ASSIGNED: "user",
  TASK_COMPLETED: "check",
  TASK_BLOCKED: "alert",
  SLA_BREACH: "clock",
  APPROVAL_REQUIRED: "shield",
  APPROVAL_GIVEN: "check-2",
  COMMENT_ADDED: "message",
  DEPENDENCY_RESOLVED: "link",
  AGENT_RESULT: "bot",
  TASK_OVERDUE: "alert-triangle",
  STATUS_CHANGED: "refresh",
  MENTION: "at-sign",
};

const TYPE_COLORS: Record<string, string> = {
  TASK_ASSIGNED: "bg-blue-100 text-blue-600",
  TASK_COMPLETED: "bg-green-100 text-green-600",
  TASK_BLOCKED: "bg-orange-100 text-orange-600",
  SLA_BREACH: "bg-red-100 text-red-600",
  APPROVAL_REQUIRED: "bg-yellow-100 text-yellow-600",
  APPROVAL_GIVEN: "bg-green-100 text-green-600",
  COMMENT_ADDED: "bg-purple-100 text-purple-600",
  DEPENDENCY_RESOLVED: "bg-teal-100 text-teal-600",
  AGENT_RESULT: "bg-indigo-100 text-indigo-600",
  TASK_OVERDUE: "bg-red-100 text-red-600",
  STATUS_CHANGED: "bg-blue-100 text-blue-600",
  MENTION: "bg-pink-100 text-pink-600",
};

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}j`;
  return `${Math.floor(diffD / 7)}sem`;
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  // Poll unread count every 30s
  const fetchCount = useCallback(async () => {
    try {
      const res = await getUnreadNotificationCount();
      if (res.data !== undefined) setCount(res.data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await getMyNotifications();
      if (res.data) setNotifications((res.data as any).notifications ?? (Array.isArray(res.data) ? res.data : []));
    } catch {}
    setLoading(false);
  };

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) fetchNotifications();
  };

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true, readAt: new Date() } : n))
    );
    setCount((c) => Math.max(0, c - 1));
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true, readAt: new Date() })));
    setCount(0);
    setMarkingAll(false);
    toast.success("Toutes les notifications marquées comme lues");
  };

  const handleClick = (notif: any) => {
    if (!notif.read) handleMarkRead(notif.id);
    if (notif.taskId) {
      setOpen(false);
      router.push(`/tasks/${notif.taskId}`);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-8 w-8 rounded-full">
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white px-1 animate-in fade-in zoom-in">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
          <div className="flex items-center gap-2">
            {count > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={handleMarkAllRead}
                disabled={markingAll}
              >
                {markingAll ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <CheckCheck className="mr-1 h-3 w-3" />
                )}
                Tout lire
              </Button>
            )}
          </div>
        </div>

        {/* Notifications list */}
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-12 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Aucune notification</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.slice(0, 20).map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleClick(notif)}
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex gap-3",
                    !notif.read && "bg-blue-50/50 dark:bg-blue-950/10"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold",
                    TYPE_COLORS[notif.type] ?? "bg-gray-100 text-gray-600"
                  )}>
                    {notif.type === "TASK_COMPLETED" ? "✓" :
                     notif.type === "SLA_BREACH" ? "!" :
                     notif.type === "COMMENT_ADDED" ? "💬" :
                     notif.type === "AGENT_RESULT" ? "🤖" :
                     notif.type === "APPROVAL_REQUIRED" ? "⚡" :
                     "📋"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("text-sm leading-tight line-clamp-2", !notif.read && "font-medium")}>
                        {notif.title}
                      </p>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatTimeAgo(notif.createdAt)}
                      </span>
                    </div>
                    {notif.message && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{notif.message}</p>
                    )}
                  </div>
                  {!notif.read && (
                    <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t px-4 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={() => {
                setOpen(false);
                router.push("/tasks?status=all");
              }}
            >
              Voir toutes les tâches
              <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
