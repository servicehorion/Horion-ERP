import type { AssistantType } from "@prisma/client";

type AssistantSource = {
  title: string;
  module?: string | null;
  sourceUrl?: string | null;
  snippet: string;
};

type BuildReplyParams = {
  assistantType: AssistantType;
  systemPrompt: string;
  message: string;
  context: Record<string, unknown>;
  knowledge: AssistantSource[];
  fallback: (message: string, context: Record<string, unknown>, knowledge: AssistantSource[]) => {
    answer: string;
    suggestions?: string[];
  };
};

function trimSnippet(value: string, maxLength = 260) {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

async function callAnthropic(params: BuildReplyParams) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 900,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                params.systemPrompt,
                "",
                "CONTEXTE JSON:",
                JSON.stringify(params.context, null, 2),
                "",
                "SOURCES:",
                params.knowledge
                  .map((item, index) =>
                    `[${index + 1}] ${item.title}${item.module ? ` (${item.module})` : ""}: ${trimSnippet(item.snippet)}`
                  )
                  .join("\n"),
                "",
                `QUESTION UTILISATEUR: ${params.message}`,
                "",
                "Reponds en francais. Sois concret. Si tu deduis quelque chose, dis-le explicitement. Ne revele jamais d'information non presente dans le contexte.",
              ].join("\n"),
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) return null;

  const payload = await response.json().catch(() => null);
  const text = payload?.content?.find?.((item: { type?: string }) => item.type === "text")?.text;
  if (!text) return null;

  return {
    answer: String(text).trim(),
    suggestions: [] as string[],
  };
}

export class AssistantOrchestratorService {
  static async buildReply(params: BuildReplyParams) {
    const aiReply = await callAnthropic(params).catch(() => null);
    if (aiReply) {
      return {
        answer: aiReply.answer,
        suggestions: aiReply.suggestions,
      };
    }

    return params.fallback(params.message, params.context, params.knowledge);
  }
}

export type { AssistantSource };
