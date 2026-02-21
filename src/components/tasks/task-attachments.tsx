"use client";

import { useState } from "react";
import { ExternalLink, Link2, Loader2, Plus, Trash2, File, Image, FileText } from "lucide-react";
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
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  async function handleAdd() {
    if (!name.trim() || !url.trim()) return;
    setSaving(true);
    try {
      const res = await addTaskAttachment(taskId, { name: name.trim(), url: url.trim(), type });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Pièce jointe ajoutée");
        setName("");
        setUrl("");
        setType("link");
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
        toast.success("Supprimé");
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
      {/* Existing attachments */}
      {attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2 text-center">Aucune pièce jointe</p>
      ) : (
        <div className="space-y-1.5">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors group"
            >
              <span className="shrink-0">{TYPE_ICONS[att.type] ?? TYPE_ICONS.file}</span>
              <a
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0 text-sm font-medium truncate hover:text-primary flex items-center gap-1"
              >
                {att.name}
                <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
              </a>
              <span className="text-xs text-muted-foreground hidden group-hover:block shrink-0">
                {att.user.name} · {formatDate(att.createdAt)}
              </span>
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
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showForm ? (
        <div className="space-y-2 border rounded-lg p-3 bg-muted/20">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom de la pièce jointe..."
            className="h-8 text-sm"
            autoFocus
          />
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
              onClick={() => { setShowForm(false); setName(""); setUrl(""); }}
            >
              Annuler
            </Button>
            <Button
              size="sm"
              disabled={!name.trim() || !url.trim() || saving}
              onClick={handleAdd}
            >
              {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
              Ajouter
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
          Ajouter un lien / document
        </Button>
      )}
    </div>
  );
}
