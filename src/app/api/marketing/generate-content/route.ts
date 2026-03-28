import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const PLATFORM_GUIDANCE: Record<string, string> = {
  FACEBOOK:
    "Post Facebook : 150-300 mots, hashtags modérés (3-5), ton conversationnel, une question pour engager",
  INSTAGRAM:
    "Post Instagram : 100-150 mots, emojis, 10-15 hashtags pertinents, accroche visuelle en première ligne",
  LINKEDIN:
    "Post LinkedIn : 200-400 mots, ton professionnel et inspirant, insight sectoriel, call-to-action en fin de post",
  TIKTOK:
    "Script TikTok : 80-120 mots, rythme dynamique, accroche percutante en 3 secondes, trending sound suggéré",
  EMAIL:
    "Email marketing : objet percutant (<50 caractères), corps 150-300 mots, un seul CTA clair, personnalisation",
  WHATSAPP:
    "Message WhatsApp : court (<100 mots), direct, emoji modéré, lien ou CTA simple",
};

function generateDemoContent(platform: string, theme: string, tone: string): string {
  const guidance = PLATFORM_GUIDANCE[platform] ?? "Post générique";
  return `[🤖 Demo — Configurez ANTHROPIC_API_KEY pour activer la génération IA réelle]

Plateforme : ${platform}
Thème : ${theme}
Ton : ${tone}
Format : ${guidance}

---

🌍 Chez Horion, nous transformons vos importations depuis la Chine.

✅ Sourcing direct auprès des fabricants certifiés
✅ Contrôle qualité avant expédition
✅ Suivi en temps réel de votre conteneur

📦 Votre marchandise, notre responsabilité.
Demandez votre devis gratuit aujourd'hui !

#Logistique #ImportCongo #Horion #Brazzaville #Commerce`;
}

const ALLOWED_PLATFORMS = new Set(Object.keys(PLATFORM_GUIDANCE));
const ALLOWED_TONES = new Set(["professionnel", "décontracté", "inspirant", "humoristique", "informatif"]);
const ALLOWED_LANGUAGES = new Set(["fr", "en", "ln"]);

function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  // Strip any attempt at injecting newlines + instruction-like patterns
  return value
    .replace(/[\r\n]+/g, " ")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLength);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await req.json();

  // Validate platform against strict whitelist
  const rawPlatform = typeof body.platform === "string" ? body.platform.toUpperCase() : "FACEBOOK";
  const platform = ALLOWED_PLATFORMS.has(rawPlatform) ? rawPlatform : "FACEBOOK";

  // Validate tone against whitelist
  const rawTone = typeof body.tone === "string" ? body.tone.toLowerCase() : "professionnel";
  const tone = ALLOWED_TONES.has(rawTone) ? rawTone : "professionnel";

  // Validate language against whitelist
  const rawLanguage = typeof body.language === "string" ? body.language.toLowerCase() : "fr";
  const language = ALLOWED_LANGUAGES.has(rawLanguage) ? rawLanguage : "fr";

  // Sanitize free-text fields: strip newlines and limit length
  const theme = sanitizeText(body.theme ?? "logistique Chine-Congo", 200);
  const cta = body.cta ? sanitizeText(body.cta, 150) : null;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      content: generateDemoContent(platform, theme, tone),
      generated: false,
      note: "Mode démo — ajoutez ANTHROPIC_API_KEY dans .env pour activer la génération IA",
    });
  }

  try {
    const guidance = PLATFORM_GUIDANCE[platform]!;
    // User-controlled values are passed as data inside XML-like tags,
    // not as raw interpolation into instructions — prevents prompt injection.
    const prompt = `Tu es un expert en marketing digital pour Horion, une entreprise de logistique et sourcing Chine → Congo (Brazzaville).

Génère un post pour la plateforme <plateforme>${platform}</plateforme>.

Voici les paramètres du post :
<theme>${theme}</theme>
<cta>${cta ?? "Contactez-nous pour votre prochain projet d'importation"}</cta>
<langue>${language === "fr" ? "Français" : language === "en" ? "Anglais" : "Lingala"}</langue>

Consignes de format : ${guidance}
Ton de voix : ${tone}
Public cible : importateurs, commerçants et entrepreneurs congolais
Mets en avant la fiabilité, la transparence et le suivi Horion.

Réponds uniquement avec le texte du post (prêt à copier-coller), sans explication.`;

    // Use fetch to call Anthropic REST API directly (no SDK dependency needed)
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json() as { content: Array<{ type: string; text: string }> };
    const content = data.content[0]?.type === "text" ? data.content[0].text : "";
    return NextResponse.json({ content, generated: true });
  } catch (e) {
    // Fallback to demo if API call fails
    return NextResponse.json({
      content: generateDemoContent(platform, theme, tone),
      generated: false,
      note: String(e),
    });
  }
}
