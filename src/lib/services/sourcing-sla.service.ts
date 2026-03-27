// ============================================================
// HORION - Sourcing SLA Service
// Contextual SLA for sourcing pipeline stages
// ============================================================

export type SourcingSlaStatus = "ON_TIME" | "WARNING" | "BREACHED";

export interface SourcingSlaResult {
  status: SourcingSlaStatus;
  hoursRemaining: number;
  totalHours: number;
  percentUsed: number;
  label: string;
}

export interface SourcingSlaContext {
  status: string;
  statusEnteredAt?: Date | null;
  level?: string | null;
  pipelineType?: string | null;
  urgency?: string | null;
  category?: string | null;
  platform?: string | null;
  sensitiveProduct?: boolean | null;
}

const BASE_HOURS_BY_STATUS: Record<string, number> = {
  SEARCHING: 72,
  OFFERS_RECEIVED: 48,
  NEGOTIATING: 72,
  SELECTED: 48,
  CONFIRMED: 24,
  CANCELLED: 0,
};

const TERMINAL = new Set(["CONFIRMED", "CANCELLED"]);

function normalizeHours(value: number) {
  return Math.max(4, Math.round(value));
}

export class SourcingSlaService {
  static buildContextualConfig(context: SourcingSlaContext) {
    let totalHours = BASE_HOURS_BY_STATUS[context.status] ?? 48;
    let warningThreshold = 0.75;

    if (context.level === "PROFOND") {
      totalHours += 24;
    }

    if (context.pipelineType === "VIP" || context.pipelineType === "STRATEGIC") {
      totalHours -= 12;
      warningThreshold = 0.65;
    }

    if (context.urgency === "CRITICAL") {
      totalHours = Math.max(8, totalHours * 0.5);
      warningThreshold = 0.6;
    } else if (context.urgency === "HIGH") {
      totalHours = Math.max(12, totalHours * 0.75);
      warningThreshold = 0.7;
    }

    if (context.sensitiveProduct) {
      totalHours += 12;
    }

    const platform = (context.platform || "").toLowerCase();
    if (platform === "1688" || platform === "alibaba") {
      totalHours += 6;
    }

    const category = (context.category || "").toUpperCase();
    if (["MEDICAL", "SMARTPHONE", "LAPTOP", "SPECIAL"].includes(category)) {
      totalHours += 12;
      warningThreshold = Math.min(warningThreshold, 0.7);
    }

    totalHours = normalizeHours(totalHours);

    return {
      totalHours,
      dueInHours: Math.max(2, Math.round(totalHours * 0.65)),
      warningThreshold,
    };
  }

  static computeProfile(context: SourcingSlaContext) {
    const config = this.buildContextualConfig(context);
    return {
      slaHours: config.totalHours,
      dueInHours: config.dueInHours,
      warningThreshold: config.warningThreshold,
    };
  }

  static compute(
    status: string,
    statusEnteredAt: Date,
    context: Omit<SourcingSlaContext, "status" | "statusEnteredAt"> = {}
  ): SourcingSlaResult {
    if (TERMINAL.has(status)) {
      return { status: "ON_TIME", hoursRemaining: 0, totalHours: 0, percentUsed: 0, label: "Termine" };
    }

    const profile = this.computeProfile({
      ...context,
      status,
      statusEnteredAt,
    });

    const now = new Date();
    const elapsedHours = (now.getTime() - new Date(statusEnteredAt).getTime()) / 3_600_000;
    const hoursRemaining = profile.slaHours - elapsedHours;
    const percentUsed = Math.min(100, (elapsedHours / profile.slaHours) * 100);

    let slaStatus: SourcingSlaStatus;
    if (hoursRemaining < 0) {
      slaStatus = "BREACHED";
    } else if (percentUsed >= profile.warningThreshold * 100) {
      slaStatus = "WARNING";
    } else {
      slaStatus = "ON_TIME";
    }

    const absHours = Math.abs(hoursRemaining);
    let label: string;
    if (hoursRemaining < 0) {
      label = absHours >= 24 ? `SLA depasse de ${Math.round(absHours / 24)}j` : `SLA depasse de ${Math.round(absHours)}h`;
    } else if (absHours < 24) {
      label = `${Math.round(absHours)}h restantes`;
    } else {
      label = `${Math.round(absHours / 24)}j restants`;
    }

    return {
      status: slaStatus,
      hoursRemaining,
      totalHours: profile.slaHours,
      percentUsed,
      label,
    };
  }
}
