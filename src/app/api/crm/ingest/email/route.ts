import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSecretHeader } from "@/lib/api/secret-auth";
import { CrmIngestionService } from "@/lib/services/crm-ingestion.service";

const extractEmail = (value?: string | null) => {
  if (!value) return null;
  const match = /<([^>]+)>/.exec(value);
  return (match ? match[1] : value).trim();
};

const extractName = (value?: string | null) => {
  if (!value) return null;
  if (value.includes("<")) return value.split("<")[0].trim() || null;
  return null;
};

export async function POST(req: Request) {
  const auth = requireSecretHeader(req, "CRM_INGEST_SECRET");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => ({}));
  const toValue = Array.isArray(body.to) ? body.to[0] : body.to;
  const fromValue = Array.isArray(body.from) ? body.from[0] : body.from;
  const toEmail = extractEmail(String(toValue || ""));
  const fromEmail = extractEmail(String(fromValue || ""));
  const fromName = extractName(String(fromValue || "")) || undefined;

  if (!toEmail) {
    return NextResponse.json({ error: "missing_to" }, { status: 400 });
  }

  const source = await prisma.crmInboundSource.findFirst({
    where: { emailAlias: toEmail, status: "ACTIVE" },
  });

  if (!source) {
    return NextResponse.json({ error: "source_not_found" }, { status: 404 });
  }

  const subject = String(body.subject || "Email inbound");
  const text = String(body.text || body.plain || "").slice(0, 4000);
  const messageId = String(body.messageId || body.id || `${toEmail}:${Date.now()}`);

  const result = await CrmIngestionService.ingest({
    tenantId: source.tenantId,
    sourceId: source.id,
    sourceType: "EMAIL_ALIAS",
    sourceRef: messageId,
    payload: body,
    contact: {
      name: fromName,
      email: fromEmail || undefined,
    },
    lead: {
      description: [subject, text].filter(Boolean).join(" - ").slice(0, 1000),
      category: "Email",
      currency: "XAF",
    },
  });

  return NextResponse.json({ data: result });
}
