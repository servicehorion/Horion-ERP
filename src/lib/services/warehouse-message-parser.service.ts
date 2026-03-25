type WarehouseParseResult = {
  orderId: string | null;
  weightKg: number | null;
  dimensionsCm: { L: number; W: number; H: number } | null;
  photoUrls: string[];
  status: "complete" | "incomplete";
  missingFields: string[];
  missingPrompt?: string;
};

function normalizeNumber(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOrderId(text: string) {
  const patterns = [
    /(?:cmd|commande|order|horion)\s*[-#: ]?\s*([a-z0-9-]{4,})/i,
    /#\s*([a-z0-9-]{4,})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].toUpperCase();
  }

  return null;
}

function parseWeight(text: string) {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|kgs|kilo|kilos)/i);
  return match?.[1] ? normalizeNumber(match[1]) : null;
}

function parseDimensions(text: string) {
  const explicit = text.match(
    /(\d+(?:[.,]\d+)?)\s*[x*]\s*(\d+(?:[.,]\d+)?)\s*[x*]\s*(\d+(?:[.,]\d+)?)/i
  );
  if (explicit?.[1] && explicit?.[2] && explicit?.[3]) {
    const L = normalizeNumber(explicit[1]);
    const W = normalizeNumber(explicit[2]);
    const H = normalizeNumber(explicit[3]);
    if (L && W && H) return { L, W, H };
  }

  const compact = text.match(/(?:taille|size|dim|dimensions?)\s*[:#-]?\s*(\d{6})/i);
  if (compact?.[1]) {
    const raw = compact[1];
    return {
      L: Number(raw.slice(0, 2)),
      W: Number(raw.slice(2, 4)),
      H: Number(raw.slice(4, 6)),
    };
  }

  return null;
}

function buildMissingPrompt(missingFields: string[]) {
  if (missingFields.length === 0) return undefined;
  return `Merci. Il me manque encore: ${missingFields.join(", ")}. Merci de renvoyer ces informations.`;
}

function buildFallbackResult(text: string, photoUrls: string[]): WarehouseParseResult {
  const orderId = parseOrderId(text);
  const weightKg = parseWeight(text);
  const dimensionsCm = parseDimensions(text);
  const missingFields = [
    !orderId ? "orderId" : null,
    !weightKg ? "weightKg" : null,
    !dimensionsCm ? "dimensionsCm" : null,
  ].filter((value): value is string => Boolean(value));

  return {
    orderId,
    weightKg,
    dimensionsCm,
    photoUrls,
    status: missingFields.length === 0 ? "complete" : "incomplete",
    missingFields,
    missingPrompt: buildMissingPrompt(missingFields),
  };
}

async function parseWithAnthropic(text: string, photoUrls: string[]) {
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
      max_tokens: 700,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract warehouse intake data from this partner message. Return valid JSON only.
Message: ${text}
Photo URLs: ${photoUrls.join(", ") || "none"}
Schema:
{
  "orderId": "string|null",
  "weightKg": 0,
  "dimensionsCm": {"L": 0, "W": 0, "H": 0} | null,
  "photoUrls": ["string"],
  "status": "complete|incomplete",
  "missingFields": ["orderId|weightKg|dimensionsCm"],
  "missingPrompt": "string|optional"
}`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  const textResponse = payload?.content?.[0]?.text;
  if (!textResponse) return null;

  try {
    return JSON.parse(textResponse) as WarehouseParseResult;
  } catch {
    return null;
  }
}

export class WarehouseMessageParserService {
  static looksLikeWarehouseMessage(text: string) {
    const normalized = text.toLowerCase();
    return ["cmd", "commande", "colis", "kg", "taille", "dimension", "received", "warehouse"].some(
      (keyword) => normalized.includes(keyword)
    );
  }

  static async parse(params: { text: string; photoUrls?: string[] }) {
    const text = params.text.trim();
    const photoUrls = (params.photoUrls ?? []).map((value) => String(value)).filter(Boolean);

    if (!text) {
      return {
        orderId: null,
        weightKg: null,
        dimensionsCm: null,
        photoUrls,
        status: "incomplete" as const,
        missingFields: ["orderId", "weightKg", "dimensionsCm"],
        missingPrompt: buildMissingPrompt(["orderId", "weightKg", "dimensionsCm"]),
      };
    }

    const aiResult = await parseWithAnthropic(text, photoUrls);
    if (aiResult) return aiResult;

    return buildFallbackResult(text, photoUrls);
  }
}

export type { WarehouseParseResult };
