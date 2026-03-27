export interface SourcingPriorityAction {
  id: string;
  title: string;
  description: string;
  severity: "info" | "warning" | "critical";
  href?: string;
  count?: number;
}

export interface SourcingOverviewProjection {
  demandInbox: number;
  qualifiedDemandQueue: number;
  activeCases: number;
  confirmedCases: number;
  breachedCases: number;
  warningCases: number;
  conversionRate: number;
  canonicalJourney: Array<{
    key: string;
    label: string;
    count: number;
    description: string;
  }>;
}

export interface SourcingCommandCenterProjection {
  overview: SourcingOverviewProjection;
  priorityActions: SourcingPriorityAction[];
}

export interface SourcingTransitionReadiness {
  status: string;
  label: string;
  allowed: boolean;
  blockers: string[];
}

export interface SourcingWorkflowSnapshot {
  currentStatus: string;
  nextAction: string;
  blockers: string[];
  allowedTransitions: SourcingTransitionReadiness[];
  businessRisk: "LOW" | "MEDIUM" | "HIGH";
}
