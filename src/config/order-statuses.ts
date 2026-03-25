import { OrderStatus } from "@prisma/client";

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DEMANDE:           [OrderStatus.RECHERCHE_PRODUIT, OrderStatus.ANNULE],
  RECHERCHE_PRODUIT: [OrderStatus.DEVIS, OrderStatus.ANNULE],
  DEVIS:             [OrderStatus.PAIEMENT_EN_COURS, OrderStatus.RECHERCHE_PRODUIT, OrderStatus.ANNULE],
  PAIEMENT_EN_COURS: [OrderStatus.SOURCING, OrderStatus.ANNULE],
  SOURCING:          [OrderStatus.EN_PRODUCTION, OrderStatus.ANNULE],
  EN_PRODUCTION:     [OrderStatus.RECU_ENTREPOT, OrderStatus.EN_TRANSIT],
  RECU_ENTREPOT:     [OrderStatus.QC_EN_COURS, OrderStatus.QC_VALIDE, OrderStatus.EN_TRANSIT, OrderStatus.LITIGE],
  QC_EN_COURS:       [OrderStatus.QC_VALIDE, OrderStatus.EN_PRODUCTION, OrderStatus.LITIGE],
  QC_VALIDE:         [OrderStatus.EN_TRANSIT],
  EN_TRANSIT:        [OrderStatus.DEDOUANE, OrderStatus.LITIGE],
  DEDOUANE:          [OrderStatus.LIVRE],
  LIVRE:             [OrderStatus.CLOTURE, OrderStatus.LITIGE],
  CLOTURE:           [],
  ANNULE:            [],
  LITIGE:            [OrderStatus.EN_PRODUCTION, OrderStatus.EN_TRANSIT, OrderStatus.CLOTURE, OrderStatus.ANNULE],
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  DEMANDE:           "Demande",
  RECHERCHE_PRODUIT: "Recherche produit",
  DEVIS:             "Devis",
  PAIEMENT_EN_COURS: "Paiement en cours",
  SOURCING:          "Sourcing",
  EN_PRODUCTION:     "En production",
  RECU_ENTREPOT:     "Reçu entrepôt",
  QC_EN_COURS:       "QC en cours",
  QC_VALIDE:         "QC validé",
  EN_TRANSIT:        "En transit",
  DEDOUANE:          "Dédouané",
  LIVRE:             "Livré",
  CLOTURE:           "Clôturé",
  ANNULE:            "Annulé",
  LITIGE:            "Litige",
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  DEMANDE:           "bg-gray-100 text-gray-800",
  RECHERCHE_PRODUIT: "bg-blue-100 text-blue-800",
  DEVIS:             "bg-indigo-100 text-indigo-800",
  PAIEMENT_EN_COURS: "bg-yellow-100 text-yellow-800",
  SOURCING:          "bg-orange-100 text-orange-800",
  EN_PRODUCTION:     "bg-amber-100 text-amber-800",
  RECU_ENTREPOT:     "bg-orange-50 text-orange-700",
  QC_EN_COURS:       "bg-purple-100 text-purple-800",
  QC_VALIDE:         "bg-green-100 text-green-800",
  EN_TRANSIT:        "bg-cyan-100 text-cyan-800",
  DEDOUANE:          "bg-teal-100 text-teal-800",
  LIVRE:             "bg-emerald-100 text-emerald-800",
  CLOTURE:           "bg-gray-200 text-gray-600",
  ANNULE:            "bg-red-100 text-red-800",
  LITIGE:            "bg-red-200 text-red-900",
};

export const ORDER_STATUSES = [
  { value: "DEMANDE", label: "Demande" },
  { value: "RECHERCHE_PRODUIT", label: "Recherche produit" },
  { value: "DEVIS", label: "Devis" },
  { value: "PAIEMENT_EN_COURS", label: "Paiement en cours" },
  { value: "SOURCING", label: "Sourcing" },
  { value: "EN_PRODUCTION", label: "En production" },
  { value: "RECU_ENTREPOT", label: "Reçu entrepôt" },
  { value: "QC_EN_COURS", label: "QC en cours" },
  { value: "QC_VALIDE", label: "QC validé" },
  { value: "EN_TRANSIT", label: "En transit" },
  { value: "DEDOUANE", label: "Dédouané" },
  { value: "LIVRE", label: "Livré" },
  { value: "CLOTURE", label: "Clôturé" },
  { value: "ANNULE", label: "Annulé" },
  { value: "LITIGE", label: "Litige" },
] as const;

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

