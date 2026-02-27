"use client";

import { useState } from "react";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { exportOrdersCSV, exportOrdersPDF } from "@/lib/actions/order.actions";

export function OrdersExportActions() {
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  async function handleCsv() {
    setExporting("csv");
    try {
      const res = await exportOrdersCSV();
      if (res.error || !res.data) {
        toast.error(res.error || "Erreur export CSV");
        return;
      }
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Erreur export CSV");
    } finally {
      setExporting(null);
    }
  }

  async function handlePdf() {
    setExporting("pdf");
    try {
      const res = await exportOrdersPDF();
      if (res.error || !res.data) {
        toast.error(res.error || "Erreur export PDF");
        return;
      }
      const bytes = Uint8Array.from(atob(res.data), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename || `orders-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Erreur export PDF");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleCsv} disabled={exporting === "csv"}>
        <Download className="mr-1.5 h-4 w-4" />
        CSV
      </Button>
      <Button variant="outline" size="sm" onClick={handlePdf} disabled={exporting === "pdf"}>
        <FileText className="mr-1.5 h-4 w-4" />
        PDF
      </Button>
    </div>
  );
}
