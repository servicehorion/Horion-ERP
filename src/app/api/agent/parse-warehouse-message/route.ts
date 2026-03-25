import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

import { WarehouseMessageParserService } from "@/lib/services/warehouse-message-parser.service";

export async function POST(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const text = String(body.text || "").trim();
  const photoUrls = Array.isArray(body.photoUrls)
    ? body.photoUrls.map((value: unknown) => String(value)).filter(Boolean)
    : [];

  if (!text) {
    return NextResponse.json({ error: "text requis" }, { status: 400 });
  }

  const result = await WarehouseMessageParserService.parse({ text, photoUrls });
  return NextResponse.json(result);
}
