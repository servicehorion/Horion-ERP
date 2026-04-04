import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { canAccessTaskModule } from "@/lib/access-control";
import { prisma } from "@/lib/db";
import { StorageService } from "@/lib/services/storage.service";
import { NotificationService } from "@/lib/services/notification.service";
import { AuditService } from "@/lib/services/audit.service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSession();
    checkPermission(user.role, "task.update");

    const { id } = await params;
    const task = await prisma.task.findUnique({
      where: { id },
      select: { id: true, tenantId: true, module: true, title: true },
    });
    if (!task || task.tenantId !== user.tenantId) {
      return NextResponse.json({ error: "Tache introuvable" }, { status: 404 });
    }
    if (!canAccessTaskModule(user.role, task.module)) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
    }

    StorageService.assertPrivateUploads();
    StorageService.validateUpload({
      filename: file.name || "attachment",
      mimeType: file.type,
      size: file.size,
      kind: "any",
    });

    const name = ((form.get("name") as string) || file.name || "attachment").trim();
    const typeInput = (form.get("type") as string) || "";
    const type =
      typeInput === "image" || typeInput === "document" || typeInput === "file"
        ? typeInput
        : file.type.startsWith("image/")
          ? "image"
          : "document";

    const buffer = Buffer.from(await file.arrayBuffer());
    await StorageService.scanBufferIfEnabled({
      buffer,
      filename: file.name || "attachment",
      mimeType: file.type,
      size: file.size,
    });

    const path = StorageService.buildObjectPath(
      ["tenants", user.tenantId, "tasks", task.id, "attachments"],
      file.name || "file"
    );

    const upload = await StorageService.upload({
      path,
      data: buffer,
      contentType: file.type || "application/octet-stream",
    });

    const attachment = await prisma.taskAttachment.create({
      data: {
        taskId: task.id,
        userId: user.id,
        name,
        url: `storage://${upload.bucket}/${upload.path}`,
        type,
        size: file.size,
      },
      include: { user: { select: { name: true } } },
    });

    const downloadUrl = await StorageService.createDownloadUrl(attachment.url);

    await NotificationService.notifyTaskWatchers(
      task.id,
      {
        tenantId: user.tenantId,
        type: "ATTACHMENT_ADDED",
        title: `Piece jointe ajoutee: ${task.title}`,
        message: `${user.name} a ajoute "${name}"`,
      },
      user.id
    );

    await AuditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: "task.attachment_added",
      entityType: "task",
      entityId: task.id,
      newValue: { name, url: attachment.url, type, size: file.size },
    });

    revalidatePath(`/tasks/${task.id}`);

    return NextResponse.json({ data: { ...attachment, downloadUrl } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur upload document" },
      { status: 500 }
    );
  }
}
