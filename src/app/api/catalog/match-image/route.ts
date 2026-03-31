import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

import { CatalogProductService } from "@/lib/services/catalog-product.service";
import { aiRateLimit } from "@/lib/rate-limit";

function stripExtension(filename?: string | null) {
  if (!filename) return "";
  return filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  if (!match) return null;
  return { mediaType: match[1], data: match[2] };
}

function normalizeExtractedPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;
  const keywords = Array.isArray(data.keywords) ? data.keywords.map(String).filter(Boolean) : [];
  return {
    productName: typeof data.productName === "string" ? data.productName.trim() : "",
    categoryName: typeof data.categoryName === "string" ? data.categoryName.trim() : "",
    keywords,
  };
}

export async function POST(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  });

  if (!token?.tenantId) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  }

  // Rate limit per user: 20 AI image analysis calls/min
  const rl = await aiRateLimit(req, `img:${String(token.sub)}`);
  if (!rl.success) {
    return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    imageDataUrl,
    filename,
    categoryName,
    queryHint,
  } = body as {
    imageDataUrl?: string;
    filename?: string;
    categoryName?: string;
    queryHint?: string;
  };

  const fallbackQuery = [queryHint, stripExtension(filename)].filter(Boolean).join(" ").trim();
  if (!imageDataUrl && !fallbackQuery) {
    return NextResponse.json({ error: "Image ou indice requis" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  let extracted = {
    productName: "",
    categoryName: categoryName || "",
    keywords: [] as string[],
  };

  if (apiKey && imageDataUrl) {
    const parsed = parseDataUrl(imageDataUrl);
    if (!parsed) {
      return NextResponse.json({ error: "Image invalide" }, { status: 400 });
    }

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: parsed.mediaType,
                  data: parsed.data,
                },
              },
              {
                type: "text",
                text: `Tu identifies des produits pour le sourcing Horion.
Analyse cette image et réponds uniquement en JSON strict:
{
  "productName": "string",
  "categoryName": "string",
  "keywords": ["string", "string"]
}
Contexte catégorie suggérée: ${categoryName || "inconnue"}.
Indice texte: ${queryHint || stripExtension(filename) || "aucun"}.`,
              },
            ],
          },
        ],
      }),
    });

    if (anthropicRes.ok) {
      const response = await anthropicRes.json();
      const text = response.content?.[0]?.text ?? "{}";
      try {
        const parsedPayload = normalizeExtractedPayload(JSON.parse(text));
        if (parsedPayload) extracted = parsedPayload;
      } catch {
        // fallback text path below
      }
    }
  }

  const searchQuery = [extracted.productName, ...extracted.keywords, fallbackQuery]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (!searchQuery) {
    return NextResponse.json({
      matches: [],
      extracted,
      warning: "Aucune information exploitable n'a pu être extraite de l'image.",
    });
  }

  const matches = await CatalogProductService.searchMemoryMatches(String(token.tenantId), {
    query: searchQuery,
    categoryName: extracted.categoryName || categoryName,
    limit: 6,
  });

  return NextResponse.json({
    extracted,
    matches,
  });
}
