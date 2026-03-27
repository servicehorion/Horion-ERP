export interface LogisticsPriorityAction {
  id: string;
  title: string;
  description: string;
  severity: "info" | "warning" | "critical";
  href?: string;
  count?: number;
}

export interface LogisticsOverviewProjection {
  activeShipments: number;
  readyToBookCount: number;
  trackingStaleCount: number;
  customsBlockedCount: number;
  criticalIncidentCount: number;
  warehouseDraftCount: number;
  canonicalJourney: Array<{
    key: string;
    label: string;
    count: number;
    description: string;
  }>;
}

export interface LogisticsDashboardProjection {
  overview: LogisticsOverviewProjection;
  priorityActions: LogisticsPriorityAction[];
}

export interface ShipmentTransitionReadiness {
  status: string;
  label: string;
  allowed: boolean;
  blockers: string[];
}

export interface ShipmentResponsibilityProjection {
  activeTaskId: string | null;
  activeTaskTitle: string | null;
  primaryOwner: { id: string; name: string; role: string } | null;
  backupOwner: { id: string; name: string; role: string } | null;
  managerOwner: { id: string; name: string; role: string } | null;
  assignmentReason: string | null;
  escalationLevel: number;
  escalationAt: string | null;
}

export interface ShipmentWorkflowSnapshot {
  currentStatus: string;
  nextAction: string;
  blockers: string[];
  allowedTransitions: ShipmentTransitionReadiness[];
  businessRisk: "LOW" | "MEDIUM" | "HIGH";
  trackingFreshness: "MISSING" | "STALE" | "LIVE";
  shipmentHealth: "STABLE" | "WATCH" | "AT_RISK" | "BLOCKED";
  responsibility: ShipmentResponsibilityProjection | null;
}
