import type { PaymentMethod } from "@prisma/client";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  MOBILE_MONEY_MTN: "MTN Mobile Money",
  MOBILE_MONEY_AIRTEL: "Airtel Money",
  CARD_VISA: "Carte Visa",
  CARD_MASTERCARD: "Carte Mastercard",
  WIRE_TRANSFER: "Virement bancaire",
  CASH_DEPOSIT: "Depot en especes a la banque",
  AGGREGATOR: "Mobile Money",
};

export const MANUAL_PAYMENT_METHODS = new Set<PaymentMethod>(["WIRE_TRANSFER", "CASH_DEPOSIT"]);
export const MOBILE_MONEY_METHODS = new Set<PaymentMethod>(["MOBILE_MONEY_MTN", "MOBILE_MONEY_AIRTEL"]);
export const CARD_PAYMENT_METHODS = new Set<PaymentMethod>(["CARD_VISA", "CARD_MASTERCARD"]);

export function normalizePaymentMethod(raw?: string | null): PaymentMethod | null {
  switch ((raw || "").trim()) {
    case "MOBILE_MONEY_MTN":
    case "MTN_MOBILE_MONEY":
      return "MOBILE_MONEY_MTN";
    case "MOBILE_MONEY_AIRTEL":
    case "AIRTEL_MONEY":
      return "MOBILE_MONEY_AIRTEL";
    case "CARD_VISA":
      return "CARD_VISA";
    case "CARD_MASTERCARD":
      return "CARD_MASTERCARD";
    case "WIRE_TRANSFER":
    case "BANK_TRANSFER":
      return "WIRE_TRANSFER";
    case "CASH_DEPOSIT":
    case "CARD_TOPUP":
      return "CASH_DEPOSIT";
    case "AGGREGATOR":
      return "AGGREGATOR";
    default:
      return null;
  }
}

export function getPaymentMethodLabel(method?: string | PaymentMethod | null) {
  const normalized = normalizePaymentMethod(method);
  if (!normalized) return method ? String(method).replace(/_/g, " ") : "Paiement";
  return PAYMENT_METHOD_LABELS[normalized];
}

export function isManualPaymentMethod(method?: string | PaymentMethod | null) {
  const normalized = normalizePaymentMethod(method);
  return normalized ? MANUAL_PAYMENT_METHODS.has(normalized) : false;
}

export function isMobileMoneyMethod(method?: string | PaymentMethod | null) {
  const normalized = normalizePaymentMethod(method);
  return normalized ? MOBILE_MONEY_METHODS.has(normalized) : false;
}

export function generateDepositCode(orderNumber?: string | null) {
  const suffix = Math.random().toString().slice(2, 8);
  const prefix = orderNumber?.replace(/[^A-Z0-9]/gi, "").slice(-4).toUpperCase() || "HRN";
  return `DEP-${prefix}-${suffix}`;
}

