"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { exportProductsCSV } from "@/lib/actions/catalog.actions";
import { Loader2, Download } from "lucide-react";
import { toast } from "sonner";

export function ExportProductsButton() {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    const result = await exportProductsCSV();
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    const bom = "\uFEFF";
    const blob = new Blob([bom + result.data], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `catalogue-produits-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export catalogue telecharge");
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={loading}>
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
      Exporter CSV
    </Button>
  );
}
