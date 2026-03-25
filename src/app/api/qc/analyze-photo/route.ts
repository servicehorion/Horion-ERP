import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function POST(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  });
  if (!token) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  }

  const { photoUrl, context } = await req.json();
  if (!photoUrl) {
    return NextResponse.json({ error: "photoUrl requis" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      defects: [],
      overallSeverity: "PASS",
      recommendation: "ANTHROPIC_API_KEY non configure - analyse locale uniquement.",
      demo: true,
    });
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "url", url: photoUrl } },
            {
              type: "text",
              text: `Tu es un expert en controle qualite industriel.${context ? ` Contexte: ${context}` : ""}
Analyse cette image et identifie tous les defauts visuels.
Reponds uniquement en JSON valide:
{
  "defects": [{"type": "string", "severity": "LOW|MEDIUM|HIGH|CRITICAL", "location": "string", "confidence": 0.0}],
  "overallSeverity": "PASS|MINOR|MAJOR|CRITICAL",
  "recommendation": "string"
}`,
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: `Anthropic API error ${res.status}: ${err}` }, { status: 502 });
  }

  const aiResp = await res.json();
  const text = aiResp.content?.[0]?.text ?? "{}";

  try {
    return NextResponse.json(JSON.parse(text));
  } catch {
    return NextResponse.json({ defects: [], overallSeverity: "PASS", recommendation: text });
  }
}
