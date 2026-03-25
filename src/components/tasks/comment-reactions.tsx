"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { toggleCommentReaction } from "@/lib/actions/task.actions";

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😡", "🎉", "✅"];

interface Reaction {
  emoji: string;
  userId: string;
  user?: { id: string; name: string | null } | null;
}

interface CommentReactionsProps {
  commentId: string;
  currentUserId: string;
  initialReactions?: Reaction[];
}

export function CommentReactions({ commentId, currentUserId, initialReactions = [] }: CommentReactionsProps) {
  const [reactions, setReactions] = useState<Reaction[]>(initialReactions);
  const [open, setOpen] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, { emoji: string; users: string[]; count: number; reacted: boolean }>();
    for (const r of reactions) {
      const entry = map.get(r.emoji) || { emoji: r.emoji, users: [], count: 0, reacted: false };
      entry.count += 1;
      if (r.user?.name) entry.users.push(r.user.name);
      if (r.userId === currentUserId) entry.reacted = true;
      map.set(r.emoji, entry);
    }
    return Array.from(map.values());
  }, [reactions, currentUserId]);

  const handleToggle = async (emoji: string) => {
    const had = reactions.some((r) => r.emoji === emoji && r.userId === currentUserId);
    const optimistic = had
      ? reactions.filter((r) => !(r.emoji === emoji && r.userId === currentUserId))
      : [...reactions, { emoji, userId: currentUserId, user: { id: currentUserId, name: "Moi" } }];
    setReactions(optimistic);

    const res = await toggleCommentReaction(commentId, emoji);
    if (res?.error) {
      toast.error(res.error);
      setReactions(reactions);
    }
  };

  return (
    <div className="mt-2 flex items-center gap-1 flex-wrap">
      {grouped.map((g) => (
        <button
          key={g.emoji}
          type="button"
          onClick={() => handleToggle(g.emoji)}
          className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${g.reacted ? "bg-primary/10 border-primary/40" : "bg-muted/50"}`}
          title={g.users.join(", ")}
        >
          <span>{g.emoji}</span>
          <span className="text-muted-foreground">{g.count}</span>
        </button>
      ))}

      <div className="relative">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen((v) => !v)}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
        {open && (
          <div className="absolute z-20 mt-1 rounded-md border bg-popover p-1 shadow">
            <div className="flex items-center gap-1">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="rounded-md px-1.5 py-0.5 hover:bg-muted"
                  onClick={() => {
                    handleToggle(emoji);
                    setOpen(false);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
