"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  sources?: Array<{ title: string; module?: string | null; sourceUrl?: string | null }>;
};

export function MessageList({ messages }: { messages: ChatMessage[] }) {
  return (
    <ScrollArea className="h-[320px] rounded-2xl border bg-slate-50/60 p-4">
      <div className="space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "max-w-[92%] rounded-2xl px-4 py-3 text-sm shadow-sm",
              message.role === "assistant"
                ? "bg-white text-slate-700"
                : "ml-auto bg-slate-950 text-white"
            )}
          >
            <p className="whitespace-pre-wrap leading-6">{message.content}</p>
            {message.role === "assistant" && message.sources && message.sources.length > 0 && (
              <div className="mt-3 space-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-400">
                {message.sources.slice(0, 2).map((source) => (
                  <div key={`${message.id}-${source.title}`}>
                    Source: {source.title}
                    {source.module ? ` (${source.module})` : ""}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
