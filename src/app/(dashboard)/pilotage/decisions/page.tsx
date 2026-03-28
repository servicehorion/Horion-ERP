import { Target } from "lucide-react";

import {
  getDecisionTemplates,
  getStrategicDecisions,
  getStrategicIntelligence,
} from "@/lib/actions/pilotage.actions";
import { DecisionEngine } from "@/components/pilotage/decision-engine";

export const metadata = {
  title: "Decisions Strategiques | Horion ERP",
  description: "Moteur de decision et execution strategique",
};

export default async function PilotageDecisionsPage() {
  const [decisionsRes, templatesRes, intelligenceRes] = await Promise.all([
    getStrategicDecisions(),
    getDecisionTemplates(),
    getStrategicIntelligence(),
  ]);

  const decisions = decisionsRes.data ?? [];
  const templates = templatesRes.data ?? [];
  const suggestions = intelligenceRes.data?.suggestedPriorities ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Target className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Moteur de decision</h1>
          <p className="text-muted-foreground">
            Transformer la strategie en projets, arbitrages et taches d'execution.
          </p>
        </div>
      </div>

      {decisionsRes.error ? (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {decisionsRes.error}
        </div>
      ) : null}

      {templatesRes.error ? (
        <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          {templatesRes.error}
        </div>
      ) : null}

      <DecisionEngine decisions={decisions} templates={templates} suggestions={suggestions} />
    </div>
  );
}
