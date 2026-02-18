"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { confirmSourcingSelection } from "@/lib/actions/sourcing.actions";
import { CheckCircle2, Loader2 } from "lucide-react";

export function ConfirmSelectionButton({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    if (!confirm("Confirmer définitivement cette sélection de fournisseur ?")) return;
    setLoading(true);
    const result = await confirmSourcingSelection(caseId);
    setLoading(false);
    if (result.error) {
      alert(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Button onClick={handleConfirm} disabled={loading} className="bg-green-600 hover:bg-green-700">
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <CheckCircle2 className="mr-2 h-4 w-4" />
      )}
      Confirmer la sélection
    </Button>
  );
}
