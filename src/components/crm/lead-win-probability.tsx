"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateLeadWinProbability } from "@/lib/actions/contact.actions";

export function LeadWinProbabilityEditor({
  leadId,
  value,
}: {
  leadId: string;
  value: number;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(String(value ?? 0));
  const [isPending, startTransition] = useTransition();

  const save = () => {
    const parsed = Math.min(100, Math.max(0, Number(current)));
    if (!Number.isFinite(parsed)) {
      toast.error("Valeur invalide");
      return;
    }
    startTransition(async () => {
      const result = await updateLeadWinProbability(leadId, parsed);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Probabilite mise a jour");
      router.refresh();
      setCurrent(String(parsed));
    });
  };

  return (
    <div className="col-span-2 rounded-lg border p-3 bg-muted/20">
      <div className="text-xs text-muted-foreground">Probabilite de gain</div>
      <div className="flex items-center gap-2 mt-2">
        <Input
          type="number"
          min={0}
          max={100}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className="w-24"
        />
        <span className="text-sm text-muted-foreground">%</span>
        <Button size="sm" variant="outline" onClick={save} disabled={isPending}>
          Enregistrer
        </Button>
      </div>
    </div>
  );
}


