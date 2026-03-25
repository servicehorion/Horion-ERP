"use client";

import { useMemo, useState } from "react";
import { FileUp, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { importTasksFromCSV } from "@/lib/actions/task.actions";

interface CsvRow {
  title: string;
  description?: string;
  module?: string;
  priority?: string;
  status?: string;
  slaHours?: number;
  tags?: string[];
  dueDate?: string;
  estimatedHours?: number;
}

function parseCsvLine(line: string, delimiter: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map((v) => v.trim());
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const delimiter = lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";
  const header = parseCsvLine(lines[0], delimiter).map((h) => h.toLowerCase());
  const rows: CsvRow[] = [];

  const hasHeader = header.includes("title") || header.includes("titre");
  const startIndex = hasHeader ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i], delimiter);
    const get = (name: string, indexFallback: number) => {
      if (hasHeader) {
        const idx = header.indexOf(name);
        return idx >= 0 ? cols[idx] : "";
      }
      return cols[indexFallback] || "";
    };

    const title = get("title", 0) || get("titre", 0);
    if (!title) continue;

    const row: CsvRow = {
      title,
      description: get("description", 1),
      module: get("module", 2),
      priority: get("priority", 3) || get("priorite", 3),
      status: get("status", 4) || get("statut", 4),
      slaHours: Number(get("slahours", 5) || get("sla", 5) || 0) || undefined,
      tags: get("tags", 6)
        ? get("tags", 6)
            .split(/[,|]/)
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined,
      dueDate: get("duedate", 7) || get("echeance", 7) || undefined,
      estimatedHours: Number(get("estimatedhours", 8) || get("estimations", 8) || 0) || undefined,
    };
    rows.push(row);
  }

  return rows;
}

export function TaskImportDialog() {
  const [open, setOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importing, setImporting] = useState(false);
  const router = useRouter();

  const rows = useMemo(() => parseCsv(csvText), [csvText]);

  const handleFile = async (file: File) => {
    const text = await file.text();
    setCsvText(text);
  };

  const handleImport = async () => {
    if (rows.length === 0) {
      toast.error("Aucune ligne valide");
      return;
    }
    setImporting(true);
    const res = await importTasksFromCSV(rows);
    setImporting(false);
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`${res.data?.count || rows.length} tache(s) importee(s)`);
    setOpen(false);
    setCsvText("");
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs">
          <FileUp className="h-3.5 w-3.5 mr-1" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importer des taches (CSV)</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <UploadCloud className="h-4 w-4" />
            </Button>
          </div>

          <Textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={6}
            placeholder="title,description,module,priority,status,slaHours,tags"
          />

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titre</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Priorite</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>SLA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 6).map((r, idx) => (
                  <TableRow key={`${r.title}-${idx}`}>
                    <TableCell>{r.title}</TableCell>
                    <TableCell>{r.module || "manual"}</TableCell>
                    <TableCell>{r.priority || "NORMAL"}</TableCell>
                    <TableCell>{r.status || "PENDING"}</TableCell>
                    <TableCell>{r.slaHours ? `${r.slaHours}h` : "-"}</TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      Aucune ligne
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={handleImport} disabled={importing}>
            Importer ({rows.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
