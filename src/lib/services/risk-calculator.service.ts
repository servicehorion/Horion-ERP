// ============================================================
// HORION — Risk Calculator Service
// Computes a 0-100 risk score from order signals
// No DB access — pure computation on order data
// ============================================================

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskSignal {
  label: string;
  points: number;
  type: "margin" | "sla" | "qc" | "payment" | "dispute" | "status";
}

export interface RiskResult {
  score: number;
  level: RiskLevel;
  aiConfidence: number;
  signals: RiskSignal[];
  recommendations: string[];
}

export interface RiskInputFull {
  status: string;
  priority: string;
  estimatedDelivery?: Date | null;
  createdAt: Date;
  marginReport?: { marginPercent: any } | null;
  payments?: { status: string; direction: string; dueAt?: Date | null }[];
  disputes?: { resolvedAt?: Date | null }[];
  qcRequests?: { status: string }[];
  sourcingCases?: { status: string }[];
}

export interface RiskInputLight {
  status: string;
  priority: string;
  riskLevel?: string | null;
  estimatedDelivery?: Date | null;
}

const TERMINAL = ["ANNULE", "CLOTURE"];
const SCORE_TO_LEVEL = (score: number): RiskLevel =>
  score >= 60 ? "CRITICAL" : score >= 35 ? "HIGH" : score >= 15 ? "MEDIUM" : "LOW";

export class RiskCalculatorService {
  /** Full risk computation — requires payments, disputes, qcRequests */
  static compute(order: RiskInputFull): RiskResult {
    if (TERMINAL.includes(order.status)) {
      return { score: 0, level: "LOW", aiConfidence: 95, signals: [], recommendations: ["Commande terminée"] };
    }

    let score = 0;
    const signals: RiskSignal[] = [];
    const recommendations: string[] = [];
    const now = new Date();

    // ── Status ────────────────────────────────────────────────
    if (order.status === "LITIGE") {
      score += 35;
      signals.push({ label: "Commande en litige", points: 35, type: "status" });
      recommendations.push("Traiter le litige en priorité absolue");
    }

    // ── Priority ──────────────────────────────────────────────
    if (order.priority === "CRITIQUE") {
      score += 15;
      signals.push({ label: "Priorité critique", points: 15, type: "status" });
    } else if (order.priority === "URGENT") {
      score += 8;
      signals.push({ label: "Priorité urgente", points: 8, type: "status" });
    }

    // ── Margin ────────────────────────────────────────────────
    if (order.marginReport) {
      const margin = Number(order.marginReport.marginPercent);
      if (margin < 0) {
        score += 45;
        signals.push({ label: `Marge négative (${margin.toFixed(1)}%)`, points: 45, type: "margin" });
        recommendations.push("Renégocier les prix fournisseur immédiatement");
        recommendations.push("Envisager l'annulation si non rentable");
      } else if (margin < 15) {
        score += 35;
        signals.push({ label: `Marge critique ${margin.toFixed(1)}% (seuil 15%)`, points: 35, type: "margin" });
        recommendations.push("Revoir la structure des coûts — marge sous seuil minimum");
      } else if (margin < 25) {
        score += 15;
        signals.push({ label: `Marge faible ${margin.toFixed(1)}% (cible 30%)`, points: 15, type: "margin" });
      }
    }

    // ── Disputes ──────────────────────────────────────────────
    const openDisputes = order.disputes?.filter((d) => !d.resolvedAt).length ?? 0;
    if (openDisputes > 0) {
      const pts = Math.min(30, 15 * openDisputes);
      score += pts;
      signals.push({ label: `${openDisputes} litige(s) ouvert(s)`, points: pts, type: "dispute" });
      recommendations.push("Résoudre les litiges pour débloquer la livraison");
    }

    // ── QC failures ───────────────────────────────────────────
    const qcFailed = order.qcRequests?.some(
      (q) => q.status === "REJECTED" || q.status === "FAIL" || q.status === "FAILED"
    );
    if (qcFailed) {
      score += 20;
      signals.push({ label: "Contrôle qualité échoué", points: 20, type: "qc" });
      recommendations.push("Retourner en production ou négocier un correctif qualité");
    }

    // ── Overdue payments (INBOUND) ────────────────────────────
    const overduePayments =
      order.payments?.filter(
        (p) =>
          p.direction === "INBOUND" &&
          p.status === "PENDING" &&
          p.dueAt &&
          new Date(p.dueAt) < now
      ).length ?? 0;
    if (overduePayments > 0) {
      const pts = Math.min(25, 12 * overduePayments);
      score += pts;
      signals.push({ label: `${overduePayments} paiement(s) client en retard`, points: pts, type: "payment" });
      recommendations.push("Relancer le client — paiement(s) en souffrance");
    }

    // ── Delivery overdue ──────────────────────────────────────
    if (order.estimatedDelivery) {
      const daysOverdue = Math.floor(
        (now.getTime() - new Date(order.estimatedDelivery).getTime()) / 86_400_000
      );
      if (daysOverdue > 14) {
        score += 20;
        signals.push({ label: `Livraison en retard de ${daysOverdue} jours`, points: 20, type: "sla" });
        recommendations.push("Communiquer un nouveau délai au client");
      } else if (daysOverdue > 7) {
        score += 10;
        signals.push({ label: `Livraison en retard de ${daysOverdue} jours`, points: 10, type: "sla" });
      } else if (daysOverdue > 0) {
        score += 5;
        signals.push({ label: `Livraison en retard de ${daysOverdue} jours`, points: 5, type: "sla" });
      }
    }

    // ── Cycle time anomaly (> 60 days active) ────────────────
    const cycleTimeDays = Math.floor(
      (now.getTime() - new Date(order.createdAt).getTime()) / 86_400_000
    );
    if (cycleTimeDays > 60) {
      score += 8;
      signals.push({ label: `Cycle long : ${cycleTimeDays} jours`, points: 8, type: "sla" });
    }

    score = Math.min(100, score);
    const level = SCORE_TO_LEVEL(score);

    // Default recommendation for healthy orders
    if (recommendations.length === 0) {
      recommendations.push("Commande saine — procéder normalement");
      if (score < 5) recommendations.push("Excellent profil de risque");
    }

    // AI confidence inversely proportional to score (more signals = less certainty)
    const aiConfidence = Math.max(50, 95 - signals.length * 5);

    return { score, level, aiConfidence, signals, recommendations };
  }

  /** Light computation for list page — uses riskLevel field + basic signals */
  static computeLight(order: RiskInputLight): { score: number; level: RiskLevel } {
    if (TERMINAL.includes(order.status)) return { score: 0, level: "LOW" };

    let score = 0;
    if (order.status === "LITIGE") score += 35;
    if (order.priority === "CRITIQUE") score += 15;
    else if (order.priority === "URGENT") score += 8;

    // Use stored riskLevel as floor
    const floorByLevel: Record<string, number> = {
      CRITICAL: 65, HIGH: 40, MEDIUM: 20, LOW: 0,
    };
    if (order.riskLevel) score = Math.max(score, floorByLevel[order.riskLevel] ?? 0);

    const now = new Date();
    if (order.estimatedDelivery && new Date(order.estimatedDelivery) < now) score += 10;

    score = Math.min(100, score);
    return { score, level: SCORE_TO_LEVEL(score) };
  }
}
