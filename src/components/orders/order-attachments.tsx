"use client";

import { useState } from "react";
import { ExternalLink, Link2, Loader2, Plus, Trash2, File, Image, FileText, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addOrderAttachment, removeOrderAttachment } from "@/lib/actions/order.actions";
import { formatDate } from "@/lib/utils";

interface Attachment {
  id: string;
  name: string;
  url: string;
  downloadUrl?: string;
  type: string;
  createdAt: Date;
  user?: { name: string | null } | null;
}

interface OrderAttachmentsProps {
  orderId: string;
  attachments: Attachment[];
  canEdit?: boolean;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  link: <Link2 className="h-4 w-4 text-blue-500" />,
  image: <Image className="h-4 w-4 text-green-500" />,
  document: <FileText className="h-4 w-4 text-orange-500" />,
  file: <File className="h-4 w-4 text-gray-500" />,
};

export function OrderAttachments({ orderId, attachments, canEdit }: OrderAttachmentsProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState("link");
  const [mode, setMode] = useState<"upload" | "link">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  async function handleAdd() {
    if (mode === "link") {
      if (!name.trim() || !url.trim()) return;
    }
    setSaving(true);
    try {
      if (mode === "link") {
        const res = await addOrderAttachment(orderId, { name: name.trim(), url: url.trim(), type });
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success("Document ajoute");
          setName("");
          setUrl("");
          setType("link");
          setShowForm(false);
          router.refresh();
        }
      } else {
        if (!file) {
          toast.error("Fichier manquant");
          return;
        }
        const formData = new FormData();
        formData.append("file", file);
        formData.append("name", name.trim() || file.name);
        formData.append("type", type);
        const res = await fetch(`/api/orders/${orderId}/attachments`, {
          method: "POST",
          body: formData,
        });
        const json = await res.json();
        if (!res.ok || json?.error) {
          toast.error(json?.error || "Erreur upload");
        } else {
          toast.success("Document uploadé");
          setName("");
          setUrl("");
          setType("document");
          setFile(null);
          setShowForm(false);
          router.refresh();
        }
      }
    } catch {
      toast.error("Erreur lors de l'ajout");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(attachmentId: string) {
    setRemoving(attachmentId);
    try {
      const res = await removeOrderAttachment(attachmentId);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Supprime");
        router.refresh();
      }
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="space-y-2">
      {attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2 text-center">Aucun document</p>
      ) : (
        <div className="space-y-1.5">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors group"
            >
              <span className="shrink-0">{TYPE_ICONS[att.type] ?? TYPE_ICONS.file}</span>
              <a
                href={(att as any).downloadUrl ?? att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0 text-sm font-medium truncate hover:text-primary flex items-center gap-1"
              >
                {att.name}
                <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
              </a>
              <span className="text-xs text-muted-foreground hidden group-hover:block shrink-0">
                {(att.user?.name || "System")} · {formatDate(att.createdAt)}
              </span>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                  disabled={removing === att.id}
                  onClick={() => handleRemove(att.id)}
                >
                  {removing === att.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <>
          {showForm ? (
            <div className="space-y-2 border rounded-lg p-3 bg-muted/20">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nom du document..."
                className="h-8 text-sm"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={mode === "upload" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setMode("upload");
                    if (type === "link") setType("document");
                  }}
                >
                  Upload
                </Button>
                <Button
                  type="button"
                  variant={mode === "link" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMode("link")}
                >
                  Lien
                </Button>
              </div>
              {mode === "link" ? (
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="URL (https://...)"
                  className="h-8 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && name.trim() && url.trim()) handleAdd();
                    if (e.key === "Escape") setShowForm(false);
                  }}
                />
              ) : (
                <Input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="h-8 text-sm"
                />
              )}
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="link">Lien</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="file">Fichier</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setShowForm(false); setName(""); setUrl(""); setFile(null); setMode("upload"); }}
                >
                  Annuler
                </Button>
                <Button
                  size="sm"
                  disabled={
                    saving ||
                    !name.trim() ||
                    (mode === "link" ? !url.trim() : !file)
                  }
                  onClick={handleAdd}
                >
                  {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <UploadCloud className="mr-1 h-3 w-3" />}
                  {mode === "link" ? "Ajouter" : "Uploader"}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-muted-foreground text-xs"
              onClick={() => setShowForm(true)}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Ajouter un document
            </Button>
          )}
        </>
      )}
    </div>
  );
}
