import type { KnowledgeAudience } from "@prisma/client";

import { prisma } from "@/lib/db";

type KnowledgeResult = {
  chunkId: string;
  documentId: string;
  title: string;
  module: string | null;
  content: string;
  sourceType: string;
  sourceUrl: string | null;
  score: number;
};

const PUBLIC_FALLBACK_DOCS = [
  {
    title: "Paiement Horion",
    module: "payments",
    content:
      "Horion propose Mobile Money, virement bancaire et depot en agence. Les paiements manuels demandent une preuve et une verification interne avant execution.",
  },
  {
    title: "Preuve de paiement",
    module: "payments",
    content:
      "Pour un virement ou un depot, le client peut televerser une photo ou un PDF du recu. Horion confirme ensuite l'encaissement avant de lancer la commande.",
  },
  {
    title: "Recu client",
    module: "payments",
    content:
      "Une fois le paiement confirme, le client peut telecharger son recu depuis la page de paiement Horion.",
  },
];

function normalizeTerms(query: string) {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, " ")
        .split(/\s+/)
        .map((term) => term.trim())
        .filter((term) => term.length >= 3)
    )
  );
}

function scoreText(content: string, terms: string[]) {
  const haystack = content.toLowerCase();
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

export class KnowledgeRetrievalService {
  static async search(params: {
    tenantId: string;
    audience: KnowledgeAudience;
    query: string;
    module?: string | null;
    limit?: number;
  }): Promise<KnowledgeResult[]> {
    const limit = Math.max(1, Math.min(params.limit ?? 5, 10));
    const terms = normalizeTerms(params.query);

    const chunks = await prisma.knowledgeChunk.findMany({
      where: {
        document: {
          tenantId: params.tenantId,
          audience: params.audience,
          status: "ACTIVE",
          ...(params.module ? { module: params.module } : {}),
        },
        ...(terms.length
          ? {
              OR: terms.flatMap((term) => [
                { content: { contains: term, mode: "insensitive" as const } },
                { document: { title: { contains: term, mode: "insensitive" as const } } },
              ]),
            }
          : {}),
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            module: true,
            sourceType: true,
            sourceUrl: true,
          },
        },
      },
      take: Math.max(limit * 3, 12),
    });

    const ranked = chunks
      .map((chunk) => ({
        chunkId: chunk.id,
        documentId: chunk.document.id,
        title: chunk.document.title,
        module: chunk.module ?? chunk.document.module,
        content: chunk.content,
        sourceType: chunk.document.sourceType,
        sourceUrl: chunk.document.sourceUrl,
        score: scoreText(`${chunk.document.title} ${chunk.content}`, terms),
      }))
      .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
      .slice(0, limit);

    if (ranked.length > 0) {
      return ranked;
    }

    if (params.audience === "PUBLIC") {
      return PUBLIC_FALLBACK_DOCS.filter((doc) => !params.module || doc.module === params.module)
        .map((doc, index) => ({
          chunkId: `public-fallback-${index}`,
          documentId: `public-fallback-${index}`,
          title: doc.title,
          module: doc.module,
          content: doc.content,
          sourceType: "RUNTIME",
          sourceUrl: null,
          score: scoreText(`${doc.title} ${doc.content}`, terms),
        }))
        .sort((left, right) => right.score - left.score)
        .slice(0, limit);
    }

    return [];
  }
}

export type { KnowledgeResult };
