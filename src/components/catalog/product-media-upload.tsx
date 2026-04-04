"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Film, Image, FileText, Plus, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createMedia, deleteMedia } from "@/lib/actions/catalog.actions";

type MediaItem = {
  id: string;
  type: string;
  url: string;
  filename: string | null;
  createdAt: Date | string;
};

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Image; color: string }> = {
  image: { label: "Image",    icon: Image,    color: "bg-blue-100 text-blue-700" },
  video: { label: "Vidéo",    icon: Film,     color: "bg-purple-100 text-purple-700" },
  pdf:   { label: "PDF",      icon: FileText, color: "bg-red-100 text-red-700" },
  document: { label: "Doc",   icon: FileText, color: "bg-gray-100 text-gray-700" },
};

interface Props {
  productId: string;
  initialMedia: MediaItem[];
}

export function ProductMediaUpload({ productId, initialMedia }: Props) {
  const router = useRouter();
  const [media, setMedia] = useState<MediaItem[]>(initialMedia);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>("image");
  const [url, setUrl] = useState("");
  const [filename, setFilename] = useState("");
  const [pending, startTransition] = useTransition();

  function handleAdd() {
    if (!url.trim()) { toast.error("URL requise"); return; }
    startTransition(async () => {
      const res = await createMedia({
        type,
        url: url.trim(),
        filename: filename.trim() || undefined,
        linkedEntityType: "product",
        linkedEntityId: productId,
        productId,
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success("Média ajouté");
      setMedia((prev) => [
        ...prev,
        { id: res.data!.id, type, url: url.trim(), filename: filename.trim() || null, createdAt: new Date() },
      ]);
      setUrl("");
      setFilename("");
      setOpen(false);
      router.refresh();
    });
  }

  function handleDelete(mediaId: string) {
    startTransition(async () => {
      const res = await deleteMedia(mediaId);
      if (res.error) { toast.error(res.error); return; }
      setMedia((prev) => prev.filter((m) => m.id !== mediaId));
      toast.success("Média supprimé");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Upload button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {media.length === 0
            ? "Aucun média — ajoutez au moins 3 photos et une vidéo."
            : `${media.length} média(s) associé(s)`}
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un média
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Ajouter un média produit</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">Image (photo produit)</SelectItem>
                    <SelectItem value="video">Vidéo (présentation)</SelectItem>
                    <SelectItem value="pdf">PDF (fiche technique)</SelectItem>
                    <SelectItem value="document">Document</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>URL</Label>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://… (lien Alibaba, Supabase Storage, Google Drive…)"
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
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                <Button onClick={handleAdd} disabled={pending}>
                  {pending ? "Ajout…" : "Ajouter"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Media quality indicator */}
      {media.length < 3 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          ⚠️ Recommandation : ajoutez au moins <strong>3 photos</strong> et <strong>1 vidéo</strong> pour maximiser la confiance client.
        </div>
      )}

      {/* Grid */}
      {media.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {media.map((m) => {
            const config = TYPE_CONFIG[m.type] ?? TYPE_CONFIG.document;
            const Icon = config.icon;
            return (
              <div key={m.id} className="group relative rounded-lg border bg-card p-3 space-y-2">
                {/* Preview for images */}
                {m.type === "image" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.url}
                    alt={m.filename ?? "Image produit"}
                    className="w-full h-28 object-cover rounded"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
                {m.type === "video" && (
                  <video
                    src={m.url}
                    className="w-full h-28 object-cover rounded"
                    controls={false}
                    muted
                    preload="metadata"
                  />
                )}
                {(m.type !== "image" && m.type !== "video") && (
                  <div className="flex h-28 items-center justify-center rounded bg-muted">
                    <Icon className="h-10 w-10 text-muted-foreground" />
                  </div>
                )}
                <div className="flex items-center justify-between gap-1">
                  <Badge variant="secondary" className={`text-xs ${config.color}`}>{config.label}</Badge>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                      <a href={m.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      onClick={() => handleDelete(m.id)}
                      disabled={pending}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {m.filename && (
                  <p className="text-xs text-muted-foreground truncate">{m.filename}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {new Date(m.createdAt).toLocaleDateString("fr-FR")}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
