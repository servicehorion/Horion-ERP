import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { WhatsappMessageService } from "@/lib/services/whatsapp-message.service";

export async function POST(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  });
  if (!token) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { conversationId, mediaType, mediaUrl, caption } = await req.json();
  if (!conversationId || !mediaType || !mediaUrl) {
    return NextResponse.json({ error: "conversationId, mediaType et mediaUrl sont requis" }, { status: 400 });
  }
  if (!["image", "video", "document", "audio"].includes(mediaType)) {
    return NextResponse.json({ error: "mediaType invalide" }, { status: 400 });
  }

  try {
    const message = await WhatsappMessageService.sendMedia({
      conversationId,
      tenantId: token.tenantId as string,
      mediaType,
      mediaUrl,
      caption,
    });
    return NextResponse.json(message);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur envoi média" },
      { status: 500 }
    );
  }
}
