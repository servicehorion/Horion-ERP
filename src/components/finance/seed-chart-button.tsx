"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { seedChartOfAccounts } from "@/lib/actions/finance.actions";
import { Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";

export function SeedChartButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [template, setTemplate] = useState<"STANDARD" | "OHADA" | "PCG_CONGO">("STANDARD");

  async function handleSeed() {
    if (!confirm("Initialiser le plan comptable ? Les comptes existants ne seront pas modifies.")) return;
    setLoading(true);
    const result = await seedChartOfAccounts(template);
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Plan comptable initialise");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={template}
        onChange={(e) => setTemplate(e.target.value as "STANDARD" | "OHADA" | "PCG_CONGO")}
        className="h-8 rounded-md border bg-transparent px-2 text-xs"
      >
        <option value="STANDARD">Standard</option>
        <option value="OHADA">OHADA</option>
        <option value="PCG_CONGO">PCG Congo</option>
      </select>
      <Button variant="outline" size="sm" onClick={handleSeed} disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookOpen className="mr-2 h-4 w-4" />}
        Initialiser plan comptable
      </Button>
    </div>
  );
}
