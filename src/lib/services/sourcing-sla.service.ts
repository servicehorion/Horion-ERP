// ============================================================
// HORION — Sourcing SLA Service
// Computes SLA status for sourcing pipeline stages
// ============================================================

export type SourcingSlaStatus = "ON_TIME" | "WARNING" | "BREACHED";

export interface SourcingSlaResult {
  status: SourcingSlaStatus;
  hoursRemaining: number;
  totalHours: number;
  percentUsed: number;
  label: string;
}

const SLA_HOURS_BY_STATUS: Record<string, number> = {
  SEARCHING: 72,
  OFFERS_RECEIVED: 48,
  NEGOTIATING: 72,
  SELECTED: 48,
  CONFIRMED: 24,
  CANCELLED: 0,
};

const TERMINAL = ["CONFIRMED", "CANCELLED"];
const WARNING_THRESHOLD = 0.75; // 75% of budget consumed → WARNING

export class SourcingSlaService {
  static compute(status: string, statusEnteredAt: Date): SourcingSlaResult {
    if (TERMINAL.includes(status)) {
      return { status: "ON_TIME", hoursRemaining: 0, totalHours: 0, percentUsed: 0, label: "Terminé" };
    }

    const totalHours = SLA_HOURS_BY_STATUS[status] ?? 48;
    const now = new Date();
    const elapsedHours = (now.getTime() - new Date(statusEnteredAt).getTime()) / 3_600_000;
    const hoursRemaining = totalHours - elapsedHours;
    const percentUsed = Math.min(100, (elapsedHours / totalHours) * 100);

    let slaStatus: SourcingSlaStatus;
    if (hoursRemaining < 0) {
      slaStatus = "BREACHED";
    } else if (percentUsed >= WARNING_THRESHOLD * 100) {
      slaStatus = "WARNING";
    } else {
      slaStatus = "ON_TIME";
    }

    const absHours = Math.abs(hoursRemaining);
    let label: string;
    if (hoursRemaining < 0) {
      if (absHours >= 24) {
        label = `SLA dépassé de ${Math.round(absHours / 24)}j`;
      } else {
        label = `SLA dépassé de ${Math.round(absHours)}h`;
      }
    } else if (absHours < 24) {
      label = `${Math.round(absHours)}h restantes`;
    } else {
      label = `${Math.round(absHours / 24)}j restants`;
    }

    return { status: slaStatus, hoursRemaining, totalHours, percentUsed, label };
  }
}

