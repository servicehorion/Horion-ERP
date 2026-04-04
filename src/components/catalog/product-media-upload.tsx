'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, FileText, Film, Image as ImageIcon, Link2, Plus, Trash2, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createMedia, deleteMedia } from '@/lib/actions/catalog.actions';

export type MediaItem = {
  id: string;
  type: string;
  url: string;
  downloadUrl?: string | null;
  filename: string | null;
  createdAt: Date | string;
};

const TYPE_CONFIG: Record<string, { label: string; icon: typeof ImageIcon; color: string }> = {
  image: { label: 'Image', icon: ImageIcon, color: 'bg-blue-100 text-blue-700' },
  video: { label: 'Video', icon: Film, color: 'bg-purple-100 text-purple-700' },
  pdf: { label: 'PDF', icon: FileText, color: 'bg-red-100 text-red-700' },
  document: { label: 'Doc', icon: FileText, color: 'bg-gray-100 text-gray-700' },
};

type Mode = 'upload' | 'link';

interface Props {
  productId: string;
  initialMedia: MediaItem[];
}

function inferMediaType(mimeType?: string | null) {
  const lower = (mimeType || '').toLowerCase();
  if (lower.startsWith('image/')) return 'image';
  if (lower.startsWith('video/')) return 'video';
  if (lower === 'application/pdf') return 'pdf';
  return 'document';
}

export function ProductMediaUpload({ productId, initialMedia }: Props) {
  const router = useRouter();
  const [media, setMedia] = useState<MediaItem[]>(initialMedia);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('upload');
  const [linkType, setLinkType] = useState('image');
  const [url, setUrl] = useState('');
  const [filename, setFilename] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  function resetForm() {
    setMode('upload');
    setLinkType('image');
    setUrl('');
    setFilename('');
    setFile(null);
  }

  async function handleUpload() {
    if (!file) {
      toast.error('Fichier requis');
      return;
    }

    const formData = new FormData();
    formData.set('file', file);
    if (filename.trim()) formData.set('name', filename.trim());
    formData.set('type', inferMediaType(file.type));

    setBusy(true);
    try {
      const response = await fetch(`/api/catalog/products/${productId}/media`, {
        method: 'POST',
        body: formData,
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || json?.error) {
        toast.error(json?.error || 'Erreur upload media');
        return;
      }

      const created = json.data as MediaItem;
      setMedia((prev) => [...prev, created]);
      toast.success('Media ajoute');
      setOpen(false);
      resetForm();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de l upload');
    } finally {
      setBusy(false);
    }
  }

  async function handleLink() {
    if (!url.trim()) {
      toast.error('URL requise');
      return;
    }

    setBusy(true);
    try {
      const res = await createMedia({
        type: linkType,
        url: url.trim(),
        filename: filename.trim() || undefined,
        linkedEntityType: 'product',
        linkedEntityId: productId,
        productId,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }

      const created = res.data as MediaItem;
      setMedia((prev) => [...prev, created]);
      toast.success('Media ajoute');
      setOpen(false);
      resetForm();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de l ajout');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(mediaId: string) {
    setBusy(true);
    try {
      const res = await deleteMedia(mediaId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setMedia((prev) => prev.filter((m) => m.id !== mediaId));
      toast.success('Media supprime');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la suppression');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {media.length === 0
            ? 'Aucun media. Ajoutez au moins 3 photos et idealement une courte video.'
            : `${media.length} media(s) associe(s)`}
        </p>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un media
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Ajouter un media produit</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={mode === 'upload' ? 'default' : 'outline'}
                  onClick={() => setMode('upload')}
                  className="justify-start"
                >
                  <UploadCloud className="mr-2 h-4 w-4" />
                  Upload fichier
                </Button>
                <Button
                  type="button"
                  variant={mode === 'link' ? 'default' : 'outline'}
                  onClick={() => setMode('link')}
                  className="justify-start"
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  Lien externe
                </Button>
              </div>

              {mode === 'upload' ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Fichier</Label>
                    <Input
                      type="file"
                      accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
                      onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                    />
                    {file && (
                      <p className="text-xs text-muted-foreground">
                        Fichier selectionne: {file.name}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Nom du fichier (optionnel)</Label>
                    <Input
                      value={filename}
                      onChange={(e) => setFilename(e.target.value)}
                      placeholder="photo_face.jpg"
                    />
                  </div>
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Conseil: mettez au moins 3 photos produit. Les videos courtes sont utiles pour valider l etat reel du produit.
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={linkType} onValueChange={setLinkType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="image">Image</SelectItem>
                        <SelectItem value="video">Video</SelectItem>
                        <SelectItem value="pdf">PDF</SelectItem>
                        <SelectItem value="document">Document</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>URL</Label>
                    <Input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nom du fichier (optionnel)</Label>
                    <Input
                      value={filename}
                      onChange={(e) => setFilename(e.target.value)}
                      placeholder="photo_face.jpg"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)} type="button">
                  Annuler
                </Button>
                <Button
                  onClick={mode === 'upload' ? handleUpload : handleLink}
                  disabled={busy}
                  type="button"
                >
                  {busy ? 'Ajout...' : 'Ajouter'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {media.length < 3 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Attention: ajoutez au moins 3 photos pour valider le produit. Une courte video reste recommandee.
        </div>
      )}

      {media.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {media.map((m) => {
            const config = TYPE_CONFIG[m.type] ?? TYPE_CONFIG.document;
            const Icon = config.icon;
            const previewUrl = m.downloadUrl ?? m.url;

            return (
              <div key={m.id} className="group relative space-y-2 rounded-lg border bg-card p-3">
                {m.type === 'image' && previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt={m.filename ?? 'Image produit'}
                    className="h-28 w-full rounded object-cover"
                    onError={(event) => {
                      (event.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                {m.type === 'video' && previewUrl && (
                  <video
                    src={previewUrl}
                    className="h-28 w-full rounded object-cover"
                    controls
                    preload="metadata"
                  />
                )}
                {m.type !== 'image' && m.type !== 'video' && (
                  <div className="flex h-28 items-center justify-center rounded bg-muted">
                    <Icon className="h-10 w-10 text-muted-foreground" />
                  </div>
                )}

                <div className="flex items-center justify-between gap-1">
                  <Badge variant="secondary" className={`text-xs ${config.color}`}>
                    {config.label}
                  </Badge>
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                      <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      onClick={() => handleDelete(m.id)}
                      disabled={busy}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {m.filename && (
                  <p className="truncate text-xs text-muted-foreground">{m.filename}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {new Date(m.createdAt).toLocaleDateString('fr-FR')}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
