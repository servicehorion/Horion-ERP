import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { getOrderScopeWithDelegation } from "@/lib/access-control";
import { OrderService } from "@/lib/services/order.service";
import { StorageService } from "@/lib/services/storage.service";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSession();
    checkPermission(user.role, "order.update");

    const scope = await getOrderScopeWithDelegation(user);
    if (!scope) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const { id } = await params;
    const order = await OrderService.getById(id, scope);
    if (!order || order.tenantId !== user.tenantId) {
      return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
    }

    StorageService.assertPrivateUploads();
    StorageService.validateUpload({
      filename: file.name || "document",
      mimeType: file.type,
      size: file.size,
      kind: "document",
    });

    const name = (form.get("name") as string) || file.name || "document";
    const type = (form.get("type") as string) || "document";

    const buffer = Buffer.from(await file.arrayBuffer());
    await StorageService.scanBufferIfEnabled({
      buffer,
      filename: file.name || "document",
      mimeType: file.type,
      size: file.size,
    });

    const path = StorageService.buildObjectPath(
      ["tenants", user.tenantId, "orders", order.id],
      file.name || "file"
    );

    const upload = await StorageService.upload({
      path,
      data: buffer,
      contentType: file.type || "application/octet-stream",
    });

    const attachment = await prisma.orderAttachment.create({
      data: {
        orderId: order.id,
        userId: user.id,
        name: name.trim(),
        url: `storage://${upload.bucket}/${upload.path}`,
        type,
        storageProvider: "supabase",
        bucket: upload.bucket,
        storageKey: upload.path,
        mimeType: file.type || undefined,
        size: file.size,
      },
      include: { user: { select: { name: true } } },
    });

    const signedUrl = await StorageService.createSignedUrl({
      bucket: upload.bucket,
      path: upload.path,
      expiresIn: 3600,
    });

    return NextResponse.json({ data: { ...attachment, downloadUrl: signedUrl } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur upload document" },
      { status: 500 }
    );
  }
}
