import { OrderStatus } from "@prisma/client";

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DEMANDE:           [OrderStatus.RECHERCHE_PRODUIT, OrderStatus.ANNULE],
  RECHERCHE_PRODUIT: [OrderStatus.DEVIS, OrderStatus.ANNULE],
  DEVIS:             [OrderStatus.PAIEMENT_EN_COURS, OrderStatus.RECHERCHE_PRODUIT, OrderStatus.ANNULE],
  PAIEMENT_EN_COURS: [OrderStatus.SOURCING, OrderStatus.ANNULE],
  SOURCING:          [OrderStatus.EN_PRODUCTION, OrderStatus.ANNULE],
  EN_PRODUCTION:     [OrderStatus.QC_EN_COURS, OrderStatus.EN_TRANSIT],
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
  QC_EN_COURS:       "QC en cours",
  QC_VALIDE:         "QC valide",
  EN_TRANSIT:        "En transit",
  DEDOUANE:          "Dedouane",
  LIVRE:             "Livre",
  CLOTURE:           "Cloture",
  ANNULE:            "Annule",
  LITIGE:            "Litige",
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  DEMANDE:           "bg-gray-100 text-gray-800",
  RECHERCHE_PRODUIT: "bg-blue-100 text-blue-800",
  DEVIS:             "bg-indigo-100 text-indigo-800",
  PAIEMENT_EN_COURS: "bg-yellow-100 text-yellow-800",
  SOURCING:          "bg-orange-100 text-orange-800",
  EN_PRODUCTION:     "bg-amber-100 text-amber-800",
  QC_EN_COURS:       "bg-purple-100 text-purple-800",
  QC_VALIDE:         "bg-green-100 text-green-800",
  EN_TRANSIT:        "bg-cyan-100 text-cyan-800",
  DEDOUANE:          "bg-teal-100 text-teal-800",
  LIVRE:             "bg-emerald-100 text-emerald-800",
  CLOTURE:           "bg-gray-200 text-gray-600",
  ANNULE:            "bg-red-100 text-red-800",
  LITIGE:            "bg-red-200 text-red-900",
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
