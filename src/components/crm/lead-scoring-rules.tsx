"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { saveLeadScoringWeights, type LeadScoringWeights } from "@/lib/actions/crm-advanced.actions";

const FIELDS: Array<{ key: keyof LeadScoringWeights; label: string; hint: string }> = [
  { key: "value", label: "Valeur", hint: "Poids de la valeur estimee" },
  { key: "status", label: "Statut", hint: "Impact du statut pipeline" },
  { key: "completeness", label: "Completeness", hint: "Qualite des infos" },
  { key: "assignment", label: "Assignation", hint: "Lead attribue" },
  { key: "freshness", label: "Fraicheur", hint: "Recence du lead" },
];

export function LeadScoringRulesEditor({ initial }: { initial: LeadScoringWeights }) {
  const router = useRouter();
  const [weights, setWeights] = useState<LeadScoringWeights>(initial);
  const [isPending, startTransition] = useTransition();

  const total = Object.values(weights).reduce((sum, v) => sum + Number(v || 0), 0);

  const update = (key: keyof LeadScoringWeights, value: number) => {
    setWeights((prev) => ({ ...prev, [key]: value }));
  };

  const save = () => {
    startTransition(async () => {
      const result = await saveLeadScoringWeights(weights);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Poids de scoring mis a jour");
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Regles de scoring</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-xs text-muted-foreground">
          Total actuel: <span className={total === 100 ? "text-green-600" : "text-amber-600"}>{total}</span>
          {total !== 100 && " (idealement 100)"}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {FIELDS.map((field) => (
            <div key={field.key} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{field.label}</div>
                  <div className="text-xs text-muted-foreground">{field.hint}</div>
                </div>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={weights[field.key]}
                  onChange={(e) => update(field.key, Number(e.target.value))}
                  className="w-20"
                />
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${Math.min(100, Math.max(0, Number(weights[field.key]) || 0))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={isPending}>
            Enregistrer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


