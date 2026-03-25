import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import { StorageService } from "@/lib/services/storage.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const contentType = req.headers.get("content-type") || "";

  let paymentId: string | undefined;
  let proofUrl: string | undefined;
  let reference: string | undefined;
  let file: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    paymentId = String(form.get("paymentId") || "").trim() || undefined;
    proofUrl = String(form.get("proofUrl") || "").trim() || undefined;
    reference = String(form.get("reference") || "").trim() || undefined;
    const candidate = form.get("file");
    file = candidate instanceof File ? candidate : null;
  } else {
    const body = await req.json().catch(() => ({}));
    paymentId = String(body.paymentId || "").trim() || undefined;
    proofUrl = String(body.proofUrl || "").trim() || undefined;
    reference = String(body.reference || "").trim() || undefined;
  }

  if (!paymentId || (!file && !proofUrl)) {
    return NextResponse.json(
      { error: "paymentId et une preuve de paiement sont requis" },
      { status: 400 }
    );
  }

  const quote = await prisma.quote.findFirst({
    where: { paymentToken: token, isActive: true },
    select: { id: true, orderId: true },
  });
  if (!quote) {
    return NextResponse.json({ error: "Lien invalide" }, { status: 404 });
  }

  const order = await prisma.order.findUnique({
    where: { id: quote.orderId },
    select: { id: true, tenantId: true },
  });
  if (!order) {
    return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  }

  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentId,
      orderId: quote.orderId,
      direction: "INBOUND",
      status: { in: ["PENDING_PROOF", "PROOF_REJECTED"] },
    },
    select: { id: true, orderId: true },
  });
  if (!payment) {
    return NextResponse.json(
      { error: "Paiement introuvable ou deja traite" },
      { status: 404 }
    );
  }

  let finalProofUrl = proofUrl;

  if (file) {
    StorageService.assertPrivateUploads();
    StorageService.validateUpload({
      filename: file.name || "preuve-paiement",
      mimeType: file.type,
      size: file.size,
      kind: "document",
    });

    const buffer = Buffer.from(await file.arrayBuffer());
    await StorageService.scanBufferIfEnabled({
      buffer,
      filename: file.name || "preuve-paiement",
      mimeType: file.type,
      size: file.size,
    });

    const path = StorageService.buildObjectPath(
      ["tenants", order.tenantId, "payments", payment.id, "proofs"],
      file.name || "proof"
    );

    const upload = await StorageService.upload({
      path,
      data: buffer,
      contentType: file.type || "application/octet-stream",
    });

    finalProofUrl = `storage://${upload.bucket}/${upload.path}`;
  }

  if (!finalProofUrl) {
    return NextResponse.json({ error: "Preuve de paiement invalide" }, { status: 400 });
  }

  if (!file) {
    try {
      const parsed = new URL(finalProofUrl);
      if (!["https:", "http:"].includes(parsed.protocol)) throw new Error();
    } catch {
      return NextResponse.json({ error: "URL de preuve invalide" }, { status: 400 });
    }
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "PROOF_UPLOADED",
      proofUrl: finalProofUrl,
      reference: reference || undefined,
      proofUploadedAt: new Date(),
      notes: `Preuve client recue le ${new Date().toLocaleString("fr-FR")}.`,
    },
  });

  await emitEvent("payment.proof_uploaded", "payment", payment.id, {
    orderId: payment.orderId,
    proofUrl: finalProofUrl,
  });

  return NextResponse.json({
    ok: true,
    proofUrl: finalProofUrl,
    proofDownloadUrl: await StorageService.createDownloadUrl(finalProofUrl),
  });
}
