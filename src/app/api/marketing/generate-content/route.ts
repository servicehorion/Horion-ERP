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

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await req.json();
  const { platform = "FACEBOOK", theme = "logistique", tone = "professionnel", cta, language = "fr" } = body;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      content: generateDemoContent(platform, theme, tone),
      generated: false,
      note: "Mode démo — ajoutez ANTHROPIC_API_KEY dans .env pour activer la génération IA",
    });
  }

  try {
    const guidance = PLATFORM_GUIDANCE[platform] ?? "Post générique";
    const prompt = `Tu es un expert en marketing digital pour Horion, une entreprise de logistique et sourcing Chine → Congo (Brazzaville).

Génère un post ${platform} sur le thème : "${theme}".

Consignes :
- ${guidance}
- Ton de voix : ${tone}
- Call to action : ${cta ?? "Contactez-nous pour votre prochain projet d'importation"}
- Langue : ${language === "fr" ? "Français" : language}
- Public cible : importateurs, commerçants et entrepreneurs congolais
- Mets en avant la fiabilité, la transparence et le suivi Horion

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
