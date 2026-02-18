"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { seedChartOfAccounts } from "@/lib/actions/finance.actions";
import { Loader2, BookOpen } from "lucide-react";

export function SeedChartButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSeed() {
    if (!confirm("Initialiser le plan comptable standard import/export ? Les comptes existants ne seront pas modifiés.")) return;
    setLoading(true);
    const result = await seedChartOfAccounts();
    setLoading(false);
    if (result.error) {
      alert(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={handleSeed} disabled={loading}>
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookOpen className="mr-2 h-4 w-4" />}
      Initialiser plan comptable
    </Button>
  );
}
