"use client";

import { useMemo, useState } from "react";
import { MessageCircle, Send, Sparkles, X } from "lucide-react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MessageList } from "@/components/assistant/message-list";
import { SuggestionChips } from "@/components/assistant/suggestion-chips";

type ChatShellProps = {
  endpoint: string;
  title: string;
  subtitle: string;
  welcomeMessage: string;
  accentClassName?: string;
  staticPayload?: Record<string, unknown>;
  includePathname?: boolean;
  initialSuggestions: string[];
};

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  sources?: Array<{ title: string; module?: string | null; sourceUrl?: string | null }>;
};

export function ChatShell({
  endpoint,
  title,
  subtitle,
  welcomeMessage,
  accentClassName = "bg-slate-950 text-white",
  staticPayload,
  includePathname = false,
  initialSuggestions,
}: ChatShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: welcomeMessage,
    },
  ]);

  const canSend = useMemo(() => draft.trim().length > 0 && !loading, [draft, loading]);

  async function sendMessage(content: string) {
    const message = content.trim();
    if (!message) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: message,
    };

    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setLoading(true);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(staticPayload ?? {}),
          ...(includePathname ? { route: pathname } : {}),
          sessionId,
          message,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error || "Reponse assistant indisponible");
      }

      const reply = payload.data;
      setSessionId(reply.sessionId ?? sessionId);
      setSuggestions(Array.isArray(reply.suggestions) ? reply.suggestions : []);
      setMessages((current) => [
        ...current,
        {
          id: reply.messageId ?? `assistant-${Date.now()}`,
          role: "assistant",
          content: String(reply.answer || "Je n'ai pas pu formuler de reponse pour le moment."),
          sources: Array.isArray(reply.sources) ? reply.sources : [],
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "Le service Zelia est momentanement indisponible.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-[min(92vw,380px)] rounded-[28px] border border-black/10 bg-white p-4 shadow-[0_24px_80px_-28px_rgba(15,23,42,0.45)]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-950">{title}</p>
              <p className="text-xs leading-5 text-slate-500">{subtitle}</p>
            </div>
            <Button type="button" size="icon" variant="ghost" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <MessageList messages={messages} />

          <div className="mt-3 space-y-3">
            <SuggestionChips suggestions={suggestions.slice(0, 4)} onSelect={sendMessage} />
            <div className="space-y-2">
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ecrivez votre question..."
                className="min-h-[92px] resize-none rounded-2xl"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  {loading ? "Zelia redige la reponse..." : "Reponses guidees et contextuelles"}
                </p>
                <Button
                  type="button"
                  size="sm"
                  disabled={!canSend}
                  className="rounded-full"
                  onClick={() => sendMessage(draft)}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Envoyer
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn("h-14 rounded-full px-5 shadow-lg", accentClassName)}
      >
        {open ? <X className="mr-2 h-4 w-4" /> : <MessageCircle className="mr-2 h-4 w-4" />}
        <Sparkles className="mr-2 h-4 w-4" />
        {title}
      </Button>
    </div>
  );
}
