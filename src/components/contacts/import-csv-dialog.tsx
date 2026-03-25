"use client";

import { useState, useRef } from "react";
import { Upload, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { importContacts } from "@/lib/actions/contact.actions";

const CSV_HEADERS = ["nom", "type", "entreprise", "telephone", "email", "ville", "pays"];
const EXAMPLE_CSV = [
  CSV_HEADERS.join(","),
  "Jean Dupont,CLIENT,Dupont SARL,+242060001234,jean@dupont.cd,Brazzaville,CG",
  "Marie Mbemba,PROSPECT,,+242055001234,marie@email.com,Pointe-Noire,CG",
].join("\n");

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    return headers.reduce((acc, h, i) => {
      acc[h] = values[i] || "";
      return acc;
    }, {} as Record<string, string>);
  });
}

export function ImportCsvDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    setFile(f);
    setResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith(".csv")) handleFile(f);
    else toast.error("Veuillez déposer un fichier CSV");
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (!rows.length) {
        toast.error("Fichier vide ou format invalide");
        return;
      }
      const res = await importContacts(rows);
      if (res.error) {
        toast.error(res.error);
      } else {
        setResult(res.data!);
        toast.success(`${res.data!.imported} contact(s) importé(s)`);
        router.refresh();
      }
    } catch {
      toast.error("Erreur lors de la lecture du fichier");
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Importer CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importer des contacts</DialogTitle>
          <DialogDescription>
            Importez plusieurs contacts depuis un fichier CSV
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Format hint */}
          <div className="rounded-md bg-muted p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Format attendu (en-têtes) :</p>
            <code className="text-xs text-foreground">{CSV_HEADERS.join(", ")}</code>
            <p className="text-xs text-muted-foreground mt-2">
              Types valides : <span className="font-medium">client, prospect, fournisseur, transitaire, douanier, qc, autre</span>
            </p>
          </div>

          {/* Drop zone */}
          {!result && (
            <div
              className={`relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
            >
              {file ? (
                <>
                  <FileText className="h-8 w-8 text-primary" />
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} Ko</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); reset(); }}
                    className="text-xs"
                  >
                    Changer de fichier
                  </Button>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">Glisser-déposer un fichier CSV</p>
                  <p className="text-xs text-muted-foreground">ou cliquer pour sélectionner</p>
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>
          )}

          {/* Result display */}
          {result && (
            <div className="space-y-2">
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  {result.imported} contact(s) importé(s) avec succès
                </AlertDescription>
              </Alert>
              {result.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium mb-1">{result.errors.length} erreur(s) :</p>
                    <ul className="text-xs space-y-0.5 max-h-32 overflow-y-auto">
                      {result.errors.map((e, i) => (
                        <li key={i}>• {e}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Example CSV download link */}
          <div className="text-center">
            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(EXAMPLE_CSV)}`}
              download="modele-contacts.csv"
              className="text-xs text-primary hover:underline"
            >
              Télécharger un modèle CSV
            </a>
          </div>
        </div>

        <DialogFooter>
          {result ? (
            <Button onClick={() => { setOpen(false); reset(); }}>Fermer</Button>
          ) : (
            <Button
              onClick={handleImport}
              disabled={!file || importing}
            >
              {importing ? "Import en cours..." : "Importer"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
