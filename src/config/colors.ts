/**
 * Centralized color / label maps — single source of truth for all status badges,
 * kanban column headers, and semantic chip colors across the app.
 *
 * Rules:
 *  - Always import from here, never re-declare locally.
 *  - Use Tailwind classes that are safe with dark-mode variants.
 *  - surface-* utilities are defined in globals.css.
 */

// ─── Lead Status ────────────────────────────────────────────────────────────

/** DB enum values (uppercase) */
export const LEAD_STATUS_LABELS: Record<string, string> = {
  NEW: "Nouveau",
  CONTACTED: "Contacté",
  QUALIFIED: "Devis indicatif envoyé",
  QUOTED: "En négociation",
  WON: "Converti (payé)",
  LOST: "Perdu",
};

/** Tailwind badge classes keyed by DB enum value */
export const LEAD_STATUS_COLORS: Record<string, string> = {
  NEW: "bg-gray-100 text-gray-700 dark:bg-gray-800/60 dark:text-gray-300",
  CONTACTED: "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-100",
  QUALIFIED: "bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-100",
  QUOTED: "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-100",
  WON: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-100",
  LOST: "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-100",
};

/** Kanban column config — top border + header background via design tokens */
export const LEAD_KANBAN_COLUMNS = [
  {
    id: "NEW",
    label: "Nouveau",
    borderColor: "border-t-gray-400 dark:border-t-gray-600",
    headerBg: "bg-muted/60",
  },
  {
    id: "CONTACTED",
    label: "Contacté",
    borderColor: "border-t-blue-400 dark:border-t-blue-500",
    headerBg: "bg-blue-50/70 dark:bg-blue-950/30",
  },
  {
    id: "QUALIFIED",
    label: "Devis indicatif envoyé",
    borderColor: "border-t-amber-400 dark:border-t-amber-500",
    headerBg: "bg-amber-50/70 dark:bg-amber-950/30",
  },
  {
    id: "QUOTED",
    label: "En négociation",
    borderColor: "border-t-violet-400 dark:border-t-violet-500",
    headerBg: "bg-violet-50/70 dark:bg-violet-950/30",
  },
  {
    id: "WON",
    label: "Converti (payé)",
    borderColor: "border-t-emerald-400 dark:border-t-emerald-500",
    headerBg: "bg-emerald-50/70 dark:bg-emerald-950/30",
  },
  {
    id: "LOST",
    label: "Perdu",
    borderColor: "border-t-red-400 dark:border-t-red-500",
    headerBg: "bg-red-50/70 dark:bg-red-950/30",
  },
] as const;

// ─── Task Status ─────────────────────────────────────────────────────────────

export const TASK_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  IN_PROGRESS: "En cours",
  WAITING_APPROVAL: "Approbation",
  BLOCKED: "Bloqué",
  COMPLETED: "Terminé",
  CANCELLED: "Annulé",
};

export const TASK_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700 dark:bg-gray-800/60 dark:text-gray-300",
  IN_PROGRESS: "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-100",
  WAITING_APPROVAL: "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-100",
  BLOCKED: "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-100",
  COMPLETED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-100",
  CANCELLED: "bg-gray-100 text-gray-500 dark:bg-gray-800/40 dark:text-gray-500",
};

// ─── Priority ─────────────────────────────────────────────────────────────

export const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Bas",
  NORMAL: "Normal",
  HIGH: "Haut",
  URGENT: "Urgent",
};

export const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
  NORMAL: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  HIGH: "bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-100",
  URGENT: "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-100",
};

// ─── Risk Score ───────────────────────────────────────────────────────────

export const RISK_SCORE_COLORS: Record<string, string> = {
  Low: "surface-success",
  Medium: "surface-warning",
  High: "surface-danger",
};

export const RISK_SCORE_BADGE: Record<string, string> = {
  Low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-100",
  Medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-100",
  High: "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-100",
};

// ─── SLA Status ───────────────────────────────────────────────────────────

export const SLA_STATUS_BADGE: Record<string, string> = {
  OK: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-100",
  WARNING: "bg-amber-50 text-amber-700 dark:bg-amber-900/60 dark:text-amber-100",
  BREACH: "bg-red-50 text-red-700 dark:bg-red-900/60 dark:text-red-100",
};
