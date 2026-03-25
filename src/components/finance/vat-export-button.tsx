"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { exportVatReport } from "@/lib/actions/finance-advanced.actions";
import { toast } from "sonner";

export function VatExportButton({ reportId }: { reportId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    const res = await exportVatReport(reportId);
    setLoading(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Erreur export");
      return;
    }

    const blob = new Blob([res.data.csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vat-report-${reportId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export TVA telecharge");
  }

  return (
    <Button size="sm" variant="outline" onClick={handleExport} disabled={loading}>
      Export TVA
    </Button>
  );
}
