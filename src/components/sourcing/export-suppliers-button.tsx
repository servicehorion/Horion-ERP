"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportSuppliersCSV } from "@/lib/actions/supplier-intelligence.actions";

export function ExportSuppliersButton() {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const result = await exportSuppliersCSV();
      if (result.error) {
        toast.error(result.error);
        return;
      }

      const bom = "\uFEFF";
      const blob = new Blob([bom + result.data], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `fournisseurs_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Export terminé");
    } catch {
      toast.error("Erreur lors de l'export");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" onClick={handleExport} disabled={loading}>
      <Download className={`mr-2 h-4 w-4 ${loading ? "animate-pulse" : ""}`} />
      {loading ? "Export..." : "Exporter CSV"}
    </Button>
  );
}
