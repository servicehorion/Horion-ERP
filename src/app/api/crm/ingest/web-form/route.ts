import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSecretHeader } from "@/lib/api/secret-auth";
import { CrmIngestionService } from "@/lib/services/crm-ingestion.service";

export async function POST(req: Request) {
  const auth = requireSecretHeader(req, "CRM_INGEST_SECRET");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => ({}));
  const token = String(body.token || "");

  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 400 });
  }

  const source = await prisma.crmInboundSource.findFirst({
    where: { formToken: token, status: "ACTIVE" },
  });

  if (!source) {
    return NextResponse.json({ error: "source_not_found" }, { status: 404 });
  }

  const sourceRef = String(body.sourceRef || `${token}:${body.email || body.phone || Date.now()}`);

  const result = await CrmIngestionService.ingest({
    tenantId: source.tenantId,
    sourceId: source.id,
    sourceType: "WEB_FORM",
    sourceRef,
    payload: body,
    contact: {
      name: body.name,
      email: body.email,
      phone: body.phone,
      company: body.company,
      country: body.country,
      city: body.city,
    },
    lead: {
      description: body.message || body.description,
      category: body.category || "Web",
      estimatedValue: body.estimatedValue ? Number(body.estimatedValue) : undefined,
      currency: body.currency || "XAF",
      originCountry: body.originCountry || "CN",
    },
  });

  return NextResponse.json({ data: result });
}
