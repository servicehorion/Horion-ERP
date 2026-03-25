import type { PaymentMethod } from "@prisma/client";

import type {
  IPaymentGateway,
  PaymentInitiationParams,
  PaymentIntent,
  TransactionStatus,
  WebhookResult,
} from "@/lib/payment-gateway/gateway.interface";

const SUPPORTED_METHODS = new Set<PaymentMethod>([
  "MOBILE_MONEY_MTN",
  "MOBILE_MONEY_AIRTEL",
  "CARD_VISA",
  "CARD_MASTERCARD",
  "AGGREGATOR",
]);

const SUCCESS_STATUSES = new Set(["SUCCESS", "SUCCEEDED", "CONFIRMED", "COMPLETED", "PAID"]);
const FAILED_STATUSES = new Set(["FAILED", "FAILURE", "ERROR", "DECLINED"]);
const CANCELLED_STATUSES = new Set(["CANCELLED", "CANCELED", "EXPIRED", "VOIDED"]);
const PROCESSING_STATUSES = new Set(["PROCESSING", "IN_PROGRESS"]);
const PENDING_STATUSES = new Set(["PENDING", "CREATED", "INITIATED", "RECEIVED"]);

function normalizeIncomingStatus(value: unknown): TransactionStatus["status"] | null {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (!normalized) return null;
  if (SUCCESS_STATUSES.has(normalized)) return "CONFIRMED";
  if (FAILED_STATUSES.has(normalized)) return "FAILED";
  if (CANCELLED_STATUSES.has(normalized)) return "CANCELLED";
  if (PROCESSING_STATUSES.has(normalized)) return "PROCESSING";
  if (PENDING_STATUSES.has(normalized)) return "PENDING";
  return null;
}

function extractObject(value: unknown) {
  return typeof value === "object" && value ? (value as Record<string, unknown>) : null;
}

function pickProviderReference(payload: Record<string, unknown>) {
  const nested = extractObject(payload.data) ?? extractObject(payload.transaction) ?? extractObject(payload.payment);
  const candidates = [
    payload.providerReference,
    payload.reference,
    payload.transactionReference,
    payload.transactionId,
    payload.paymentReference,
    payload.id,
    nested?.providerReference,
    nested?.reference,
    nested?.transactionReference,
    nested?.transactionId,
    nested?.paymentReference,
    nested?.id,
  ];

  for (const candidate of candidates) {
    const normalized = String(candidate ?? "").trim();
    if (normalized) return normalized;
  }
  return null;
}

export class AggregatorAdapter implements IPaymentGateway {
  readonly providerName: string = "AGGREGATOR";

  supportsMethod(method: PaymentMethod) {
    return SUPPORTED_METHODS.has(method);
  }

  async initiatePayment(params: PaymentInitiationParams): Promise<PaymentIntent> {
    return {
      provider: this.providerName,
      providerReference: `agg_${params.paymentId}`,
      status: "PROCESSING",
      checkoutUrl: null,
      raw: {
        mode: "stub",
        method: params.method,
        customerPhone: params.customerPhone ?? null,
        message: "AggregatorAdapter branche en squelette. L'integration reelle viendra ensuite.",
      },
    };
  }

  async verifyTransaction(reference: string): Promise<TransactionStatus> {
    return {
      provider: this.providerName,
      providerReference: reference,
      status: "PENDING",
      raw: {
        mode: "stub",
      },
    };
  }

  async handleWebhook(payload: unknown, signature?: string | null): Promise<WebhookResult> {
    const raw = extractObject(payload) ?? { payload };
    const nested = extractObject(raw.data) ?? extractObject(raw.transaction) ?? extractObject(raw.payment);
    const providerReference = pickProviderReference(raw);
    const transactionStatus =
      normalizeIncomingStatus(raw.status) ??
      normalizeIncomingStatus(raw.event) ??
      normalizeIncomingStatus(raw.state) ??
      normalizeIncomingStatus(nested?.status) ??
      normalizeIncomingStatus(nested?.event) ??
      normalizeIncomingStatus(nested?.state);

    return {
      accepted: true,
      eventType: String(raw.eventType ?? raw.type ?? raw.event ?? "aggregator.webhook"),
      providerReference,
      transactionStatus,
      raw: {
        ...raw,
        signature: signature ?? null,
      },
    };
  }
}
