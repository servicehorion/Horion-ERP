// ============================================================
// HORION — SLA Service
// Computes per-status SLA status from elapsed time
// No DB access — pure computation
// ============================================================

export type SlaStatus = "ON_TIME" | "WARNING" | "BREACHED";

export interface SlaResult {
  status: SlaStatus;
  hoursRemaining: number;
  totalHours: number;
  percentUsed: number;
  label: string;
}

/** SLA budget per order status (hours) */
const SLA_HOURS: Record<string, number> = {
  DEMANDE:           48,
  RECHERCHE_PRODUIT: 72,
  DEVIS:             96,
  PAIEMENT_EN_COURS: 120,
  SOURCING:          240,
  EN_PRODUCTION:     168,
  RECU_ENTREPOT:     24,
  QC_EN_COURS:       72,
  QC_VALIDE:         24,
  EN_TRANSIT:        720,
  DEDOUANE:          48,
  LIVRE:             72,
  LITIGE:            48,
};

const TERMINAL = ["CLOTURE", "ANNULE"];
const WARNING_THRESHOLD = 0.75; // 75% of budget consumed → WARNING

export class SlaService {
  /**
   * Compute SLA status for an order currently in `status`.
   * @param statusEnteredAt — best approximation: use order.updatedAt for list views,
   *   or the timeline event date for the detail view.
   */
  static compute(status: string, statusEnteredAt: Date): SlaResult {
    if (TERMINAL.includes(status)) {
      return { status: "ON_TIME", hoursRemaining: 0, totalHours: 0, percentUsed: 0, label: "Terminé" };
    }

    const totalHours = SLA_HOURS[status] ?? 72;
    const now = new Date();
    const elapsedHours = (now.getTime() - new Date(statusEnteredAt).getTime()) / 3_600_000;
    const hoursRemaining = totalHours - elapsedHours;
    const percentUsed = Math.min(100, (elapsedHours / totalHours) * 100);

    let slaStatus: SlaStatus;
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

  static getStatusColor(slaStatus: SlaStatus): string {
    switch (slaStatus) {
      case "BREACHED": return "text-red-600";
      case "WARNING":  return "text-orange-500";
      default:         return "text-green-600";
    }
  }

  static getBarColor(slaStatus: SlaStatus): string {
    switch (slaStatus) {
      case "BREACHED": return "bg-red-500";
      case "WARNING":  return "bg-orange-400";
      default:         return "bg-green-500";
    }
  }
}
