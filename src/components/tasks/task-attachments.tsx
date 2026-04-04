"use client";

import { useState } from "react";
import { ExternalLink, Link2, Loader2, Plus, Trash2, File, Image, FileText, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addTaskAttachment, removeTaskAttachment } from "@/lib/actions/task.actions";
import { formatDate } from "@/lib/utils";

interface Attachment {
  id: string;
  name: string;
  url: string;
  downloadUrl?: string | null;
  type: string;
  createdAt: Date;
  user: { name: string };
}

interface TaskAttachmentsProps {
  taskId: string;
  attachments: Attachment[];
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  link: <Link2 className="h-4 w-4 text-blue-500" />,
  image: <Image className="h-4 w-4 text-green-500" />,
  document: <FileText className="h-4 w-4 text-orange-500" />,
  file: <File className="h-4 w-4 text-gray-500" />,
};

export function TaskAttachments({ taskId, attachments }: TaskAttachmentsProps) {
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
    setSaving(true);
    try {
      if (mode === "link") {
        if (!name.trim() || !url.trim()) return;
        const res = await addTaskAttachment(taskId, { name: name.trim(), url: url.trim(), type });
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success("Piece jointe ajoutee");
          setName("");
          setUrl("");
          setType("link");
          setShowForm(false);
          router.refresh();
        }
        return;
      }

      if (!file) {
        toast.error("Fichier manquant");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", name.trim() || file.name);
      formData.append("type", type === "link" ? "document" : type);

      const res = await fetch(`/api/tasks/${taskId}/attachments`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) {
        toast.error(json?.error || "Erreur upload");
      } else {
        toast.success("Piece jointe uploadee");
        setName("");
        setUrl("");
        setType("document");
        setFile(null);
        setShowForm(false);
        router.refresh();
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
      const res = await removeTaskAttachment(attachmentId);
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
        <p className="py-2 text-center text-xs text-muted-foreground">Aucune piece jointe</p>
      ) : (
        <div className="space-y-1.5">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="group flex items-center gap-2 rounded-lg border bg-muted/30 p-2 transition-colors hover:bg-muted/50"
            >
              <span className="shrink-0">{TYPE_ICONS[att.type] ?? TYPE_ICONS.file}</span>
              <a
                href={att.downloadUrl ?? att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0 truncate text-sm font-medium hover:text-primary flex items-center gap-1"
              >
                {att.name}
                <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
              </a>
              <span className="hidden shrink-0 text-xs text-muted-foreground group-hover:block">
                {att.user.name} · {formatDate(att.createdAt)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 opacity-0 text-destructive hover:text-destructive group-hover:opacity-100"
                disabled={removing === att.id}
                onClick={() => handleRemove(att.id)}
              >
                {removing === att.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom de la piece jointe..."
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

          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowForm(false);
                setName("");
                setUrl("");
                setFile(null);
                setMode("upload");
              }}
            >
              Annuler
            </Button>
            <Button
              size="sm"
              disabled={saving || !name.trim() || (mode === "link" ? !url.trim() : !file)}
              onClick={handleAdd}
            >
              {saving ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : mode === "upload" ? (
                <UploadCloud className="mr-1 h-3 w-3" />
              ) : (
                <Plus className="mr-1 h-3 w-3" />
              )}
              {mode === "upload" ? "Uploader" : "Ajouter"}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs text-muted-foreground"
          onClick={() => setShowForm(true)}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Ajouter une piece jointe
        </Button>
      )}
    </div>
  );
}
