import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

import { getSession } from '@/lib/session';
import { checkPermission } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { StorageService } from '@/lib/services/storage.service';

function resolveMediaType(file: File, explicitType?: string | null) {
  const requested = (explicitType || '').trim().toLowerCase();
  if (requested === 'image' || requested === 'video' || requested === 'pdf' || requested === 'document') {
    return requested;
  }

  const mime = (file.type || '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf') return 'pdf';
  return 'document';
}

function resolveUploadKind(mediaType: string) {
  if (mediaType === 'image') return 'image' as const;
  if (mediaType === 'video') return 'video' as const;
  return 'document' as const;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSession();
    checkPermission(user.role, 'catalog.manage');

    const { id } = await params;
    const product = await prisma.catalogProduct.findFirst({
      where: { id, tenantId: user.tenantId },
      select: { id: true, tenantId: true, name: true },
    });
    if (!product) {
      return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
    }

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 });
    }

    const mediaType = resolveMediaType(file, form.get('type')?.toString() ?? null);
    const uploadKind = resolveUploadKind(mediaType);

    StorageService.assertPrivateUploads();
    StorageService.validateUpload({
      filename: file.name || 'media',
      mimeType: file.type,
      size: file.size,
      kind: uploadKind,
    });

    const buffer = Buffer.from(await file.arrayBuffer());
    await StorageService.scanBufferIfEnabled({
      buffer,
      filename: file.name || 'media',
      mimeType: file.type,
      size: file.size,
    });

    const path = StorageService.buildObjectPath(
      ['tenants', user.tenantId, 'catalog', 'products', product.id, 'media'],
      file.name || 'media'
    );

    const upload = await StorageService.upload({
      path,
      data: buffer,
      contentType: file.type || 'application/octet-stream',
    });

    const media = await prisma.catalogMedia.create({
      data: {
        tenantId: user.tenantId,
        type: mediaType,
        url: `storage://${upload.bucket}/${upload.path}`,
        filename: (form.get('name')?.toString() || file.name || 'media').trim(),
        tags: [],
        linkedEntityType: 'product',
        linkedEntityId: product.id,
        productId: product.id,
      },
    });

    revalidatePath(`/catalog/products/${product.id}`);
    revalidatePath('/catalog/vault');

    return NextResponse.json({
      data: {
        ...media,
        downloadUrl: await StorageService.createDownloadUrl(media.url),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur upload media' },
      { status: 500 }
    );
  }
}
