"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, RefreshCw, ChevronRight, AlertTriangle, Info } from "lucide-react";

type NbaResult = {
  action: string;
  reason: string;
  urgency: "low" | "medium" | "high";
  nextSteps: string[];
};

type Props = {
  leadId: string;
  status: string;
  score: number;
  estimatedValue?: number | null;
  contactName: string;
  createdAt: Date | string;
  source?: string | null;
};

const URGENCY_CONFIG = {
  high: { label: "Urgent", className: "bg-red-100 text-red-800" },
  medium: { label: "À traiter", className: "bg-amber-100 text-amber-800" },
  low: { label: "Basse priorité", className: "bg-green-100 text-green-800" },
};

export default function LeadNbaPanel({
  leadId,
  status,
  score,
  estimatedValue,
  contactName,
  createdAt,
  source,
}: Props) {
  const [result, setResult] = useState<NbaResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const daysSince = Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / 86400000
  );

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/next-best-action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          leadId,
          status,
          score,
          estimatedValue: estimatedValue ? Number(estimatedValue) : undefined,
          contactName,
          daysSince,
          source: source ?? undefined,
        }),
      });
      if (!res.ok) throw new Error("Erreur serveur");
      const data: NbaResult = await res.json();
      setResult(data);
    } catch {
      setError("Impossible de générer la suggestion. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  const urgencyCfg = result ? URGENCY_CONFIG[result.urgency] : null;

  return (
    <Card className="border-violet-200 bg-violet-50/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-violet-800">
          <Sparkles className="h-4 w-4" />
          Next Best Action (IA)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!result && !loading && (
          <div className="text-center py-3">
            <p className="text-xs text-muted-foreground mb-3">
              L'IA analyse le profil de ce lead et suggère l'action commerciale optimale.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="border-violet-300 text-violet-700 hover:bg-violet-100"
              onClick={generate}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Générer la prochaine action
            </Button>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Analyse en cours...</span>
          </div>
        )}

        {error && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
            <Button size="sm" variant="outline" onClick={generate}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Réessayer
            </Button>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            {/* Header: action + urgency */}
            <div className="flex items-start gap-2">
              <Badge className={urgencyCfg?.className}>
                {urgencyCfg?.label}
              </Badge>
            </div>
            <p className="font-semibold text-sm leading-snug">{result.action}</p>

            {/* Reason */}
            <p className="text-xs text-muted-foreground italic flex gap-1.5">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {result.reason}
            </p>

            {/* Next steps */}
            {result.nextSteps.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Étapes suggérées
                </p>
                <ul className="space-y-1">
                  {result.nextSteps.map((step, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs">
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-violet-500" />
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Regenerate */}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-muted-foreground w-full"
              onClick={generate}
              disabled={loading}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Régénérer
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
