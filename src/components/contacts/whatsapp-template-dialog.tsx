"use client";

import { useState } from "react";
import { MessageCircle, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { WHATSAPP_TEMPLATES } from "@/config/whatsapp-templates";

interface WhatsAppTemplateDialogProps {
  contact: {
    name: string;
    company?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
  };
  agentName?: string;
  /** Controlled mode — if provided, no internal trigger is rendered */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  prospection: "Prospection",
  relance: "Relance",
  logistique: "Logistique",
  facturation: "Facturation",
  autre: "Autre",
};

function substituteVariables(
  body: string,
  contact: WhatsAppTemplateDialogProps["contact"],
  agentName?: string
): string {
  return body
    .replace(/\{nom\}/g, contact.name)
    .replace(/\{entreprise\}/g, contact.company || contact.name)
    .replace(/\{agent\}/g, agentName || "Votre conseiller Horion")
    .replace(/\{produit\}/g, "[produit]")
    .replace(/\{montant\}/g, "[montant]")
    .replace(/\{ordreId\}/g, "[n° commande]");
}

export function WhatsAppTemplateDialog({
  contact,
  agentName,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: WhatsAppTemplateDialogProps) {
  const phone = contact.whatsapp || contact.phone;
  const [internalOpen, setInternalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [preview, setPreview] = useState("");

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (controlledOnOpenChange ?? (() => {})) : setInternalOpen;

  if (!phone) return null;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    const tpl = WHATSAPP_TEMPLATES.find((t) => t.id === id);
    if (tpl) {
      setPreview(substituteVariables(tpl.body, contact, agentName));
    }
  };

  const openWhatsApp = () => {
    const num = phone.replace(/[^\d+]/g, "");
    const text = encodeURIComponent(preview);
    window.open(`https://wa.me/${num}?text=${text}`, "_blank");
    setOpen(false);
  };

  const dialogContent = (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 text-green-700 hover:text-green-800 hover:bg-green-50">
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            Envoyer un message WhatsApp
          </DialogTitle>
          <DialogDescription>
            Sélectionnez un template pour contacter{" "}
            <span className="font-medium">{contact.name}</span>{" "}
            ({phone})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Template</Label>
            <Select value={selectedId} onValueChange={handleSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un template..." />
              </SelectTrigger>
              <SelectContent>
                {WHATSAPP_TEMPLATES.map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id}>
                    <span className="flex items-center gap-2">
                      {tpl.name}
                      <Badge variant="secondary" className="text-[10px]">
                        {CATEGORY_LABELS[tpl.category]}
                      </Badge>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {preview && (
            <div className="space-y-2">
              <Label>Aperçu du message</Label>
              <Textarea
                value={preview}
                onChange={(e) => setPreview(e.target.value)}
                rows={8}
                className="font-mono text-sm resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Vous pouvez modifier le message avant envoi.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button
            onClick={openWhatsApp}
            disabled={!preview}
            className="gap-2 bg-green-600 hover:bg-green-700 text-white"
          >
            <ExternalLink className="h-4 w-4" />
            Ouvrir WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return dialogContent;
}
