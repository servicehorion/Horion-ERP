"use client";

import { useState, useTransition } from "react";
import { FileUp } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { importOrdersCSV } from "@/lib/actions/order.actions";

export function OrdersImportDialog() {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleFile(file: File) {
    const text = await file.text();
    setContent(text);
  }

  function handleImport() {
    startTransition(async () => {
      const result = await importOrdersCSV({ content });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      const created = result?.data?.created ?? 0;
      const errors = result?.data?.errors ?? [];
      toast.success(`Import: ${created} commande(s)`);
      if (errors.length > 0) {
        toast.error(errors.slice(0, 3).join(" | "));
      }
      setOpen(false);
      setContent("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileUp className="h-4 w-4" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importer des commandes (CSV)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <div className="text-xs text-muted-foreground">
            Colonnes attendues: contactName, phone, description, quantity, unitPrice, currency, destinationCity, priority, notes
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Collez votre CSV ici..."
            className="min-h-[200px]"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={handleImport} disabled={isPending || !content.trim()}>
            Importer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
