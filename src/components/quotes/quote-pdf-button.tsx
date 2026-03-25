"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { exportQuotePDF } from "@/lib/actions/order.actions";

export function QuotePdfButton({
  quoteId,
  orderNumber,
}: {
  quoteId: string;
  orderNumber?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const res = await exportQuotePDF(quoteId);
      if (res.error || !res.data) {
        toast.error(res.error || "Erreur PDF");
        return;
      }

      const bytes = Uint8Array.from(atob(res.data), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = res.filename || `devis-${orderNumber || quoteId}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Erreur PDF");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleDownload} disabled={loading}>
      <Download className="mr-2 h-4 w-4" />
      {loading ? "PDF..." : "PDF"}
    </Button>
  );
}
