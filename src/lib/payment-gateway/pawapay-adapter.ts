import { randomUUID } from "crypto";
import type { PaymentMethod } from "@prisma/client";

import type {
  IPaymentGateway,
  PaymentInitiationParams,
  PaymentIntent,
  TransactionStatus,
  WebhookResult,
} from "@/lib/payment-gateway/gateway.interface";

const SUPPORTED_METHODS = new Set<PaymentMethod>(["AGGREGATOR"]);
const BASE_URL = (process.env.PAWAPAY_BASE_URL ?? "https://api.sandbox.pawapay.io").replace(/\/$/, "");
const API_TOKEN = process.env.PAWAPAY_API_TOKEN ?? process.env.PAWAPAY_API_KEY ?? "";
const REQUEST_TIMEOUT_MS = Number(process.env.PAWAPAY_REQUEST_TIMEOUT_MS ?? "20000") || 20_000;
const REDIRECT_AUTH_POLL_DELAY_MS = Number(process.env.PAWAPAY_REDIRECT_AUTH_POLL_DELAY_MS ?? "1200") || 1_200;

type PawaPayOperationType = "DEPOSIT" | "REFUND";

type PawaPayStatus =
  | "ACCEPTED"
  | "CANCELLED"
  | "COMPLETED"
  | "DUPLICATE_IGNORED"
  | "ENQUEUED"
  | "FAILED"
  | "NOT_FOUND"
  | "PROCESSING"
  | "REDIRECT_TO_AUTH_URL"
  | "REJECTED"
  | "SUBMITTED";

type PawaPayRecord = Record<string, unknown> & {
  depositId?: string;
  refundId?: string;
  status?: string;
  nextStep?: string;
  authorizationUrl?: string;
  failureReason?: string;
  failureMessage?: string;
  successfulUrl?: string;
  failedUrl?: string;
};

export type PawaPayRefundParams = {
  depositReference: string;
  amount: number;
  currency: string;
  countryCode: string;
  providerCode?: string | null;
  metadata?: Record<string, unknown>;
  refundId?: string;
};

function ensureConfigured() {
  if (!API_TOKEN) {
    throw new Error("PAWAPAY_API_TOKEN non configure.");
  }
}

function normalizePhone(value?: string | null) {
  return String(value ?? "").replace(/[^\d]/g, "").trim();
}

function normalizeAmount(value: number) {
  const normalized = Number(value || 0);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error("Montant pawaPay invalide.");
  }
  return normalized.toFixed(2);
}

function normalizeStatus(value: unknown): TransactionStatus["status"] | null {
  const normalized = String(value ?? "").trim().toUpperCase();
  switch (normalized as PawaPayStatus) {
    case "COMPLETED":
      return "CONFIRMED";
    case "FAILED":
    case "REJECTED":
      return "FAILED";
    case "CANCELLED":
      return "CANCELLED";
    case "PROCESSING":
    case "ENQUEUED":
    case "REDIRECT_TO_AUTH_URL":
      return "PROCESSING";
    case "ACCEPTED":
    case "SUBMITTED":
    case "DUPLICATE_IGNORED":
      return "PENDING";
    case "NOT_FOUND":
      return "PENDING";
    default:
      return null;
  }
}

function toPawaMetadata(metadata?: Record<string, unknown>) {
  if (!metadata) return undefined;
  const entries = Object.entries(metadata)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([fieldName, fieldValue]) => ({
      fieldName,
      fieldValue: typeof fieldValue === "string" ? fieldValue : JSON.stringify(fieldValue),
    }));

  return entries.length > 0 ? entries : undefined;
}

function buildStatementDescription(reference?: string | null) {
  const fallback = "HORION";
  const normalized = String(reference ?? fallback)
    .toUpperCase()
    .replace(/[^A-Z0-9 -]/g, "")
    .trim();
  const candidate = normalized || fallback;
  return candidate.slice(0, 22);
}

function unwrapFirstRecord(payload: unknown): PawaPayRecord | null {
  if (Array.isArray(payload)) {
    const first = payload[0];
    return first && typeof first === "object" ? (first as PawaPayRecord) : null;
  }
  return payload && typeof payload === "object" ? (payload as PawaPayRecord) : null;
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text } as Record<string, unknown>;
  }
}

function buildApiErrorMessage(record: PawaPayRecord | null, fallback: string) {
  const parts = [record?.failureReason, record?.failureMessage, record?.status, fallback]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  return parts.join(" - ");
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export class PawaPayAdapter implements IPaymentGateway {
  readonly providerName = "PAWAPAY";

  supportsMethod(method: PaymentMethod) {
    return SUPPORTED_METHODS.has(method);
  }

  private async request(path: string, init: RequestInit = {}) {
    ensureConfigured();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${BASE_URL}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          "Content-Type": "application/json",
          ...(init.headers ?? {}),
        },
        cache: "no-store",
        signal: controller.signal,
      });

      const body = await parseJsonResponse(response);
      if (!response.ok) {
        const record = unwrapFirstRecord(body);
        throw new Error(buildApiErrorMessage(record, `pawaPay HTTP ${response.status}`));
      }

      return body;
    } finally {
      clearTimeout(timeout);
    }
  }

  async initiatePayment(params: PaymentInitiationParams): Promise<PaymentIntent> {
    const countryCode = String(params.countryCode ?? "").trim().toUpperCase();
    const providerCode = String(params.providerCode ?? "").trim().toUpperCase();
    const customerPhone = normalizePhone(params.customerPhone);

    if (!countryCode || !providerCode) {
      throw new Error("Pays et provider pawaPay requis.");
    }
    if (!customerPhone) {
      throw new Error("Numero client requis pour pawaPay.");
    }

    const depositId = randomUUID();
    const payload = [
      {
        depositId,
        amount: normalizeAmount(params.amount),
        currency: params.currency,
        country: countryCode,
        correspondent: providerCode,
        payer: {
          type: "MSISDN",
          address: {
            value: customerPhone,
          },
        },
        customerTimestamp: new Date().toISOString(),
        statementDescription: buildStatementDescription(params.clientReferenceId ?? params.orderId),
        ...(params.customerMessage ? { customerMessage: params.customerMessage } : {}),
        ...(params.successfulUrl ? { successfulUrl: params.successfulUrl } : {}),
        ...(params.failedUrl ? { failedUrl: params.failedUrl } : {}),
        ...(toPawaMetadata(params.metadata) ? { metadata: toPawaMetadata(params.metadata) } : {}),
      },
    ];

    const raw = await this.request("/v2/deposits", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const record = unwrapFirstRecord(raw);

    if (!record) {
      throw new Error("Reponse pawaPay invalide a l'initiation du depot.");
    }

    if (String(record.status ?? "").toUpperCase() === "REJECTED") {
      throw new Error(buildApiErrorMessage(record, "Depot pawaPay refuse."));
    }

    let checkoutUrl = typeof record.authorizationUrl === "string" ? record.authorizationUrl : null;
    if (!checkoutUrl && String(record.nextStep ?? "").toUpperCase() === "GET_AUTH_URL") {
      await delay(REDIRECT_AUTH_POLL_DELAY_MS);
      const status = await this.verifyTransaction(depositId);
      checkoutUrl = typeof status.raw?.authorizationUrl === "string" ? status.raw.authorizationUrl : null;
      return {
        provider: this.providerName,
        providerReference: depositId,
        checkoutUrl,
        status: status.status === "CONFIRMED" ? "PROCESSING" : status.status === "FAILED" ? "REQUIRES_PROOF" : "PROCESSING",
        raw: {
          ...(record as Record<string, unknown>),
          redirectCheck: status.raw ?? null,
        },
      };
    }

    return {
      provider: this.providerName,
      providerReference: depositId,
      checkoutUrl,
      status: checkoutUrl ? "PROCESSING" : "PENDING",
      raw: record,
    };
  }

  async getActiveConfiguration(params: { country?: string | null; operationType?: PawaPayOperationType } = {}) {
    const search = new URLSearchParams();
    if (params.country) search.set("country", String(params.country).trim().toUpperCase());
    if (params.operationType) search.set("operationType", params.operationType);
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return this.request(`/v2/active-conf${suffix}`, {
      method: "GET",
    });
  }

  async verifyTransaction(reference: string): Promise<TransactionStatus> {
    const raw = await this.request(`/v2/deposits/${reference}`, {
      method: "GET",
    });
    const record = unwrapFirstRecord(raw);

    if (!record) {
      throw new Error("Reponse pawaPay invalide lors de la verification du depot.");
    }

    return {
      provider: this.providerName,
      providerReference: String(record.depositId ?? reference),
      status: normalizeStatus(record.status) ?? "PENDING",
      raw: record,
    };
  }

  async initiateRefund(params: PawaPayRefundParams) {
    const refundId = params.refundId ?? randomUUID();
    const payload = [
      {
        refundId,
        depositId: params.depositReference,
        amount: normalizeAmount(params.amount),
        currency: params.currency,
        country: String(params.countryCode ?? "").trim().toUpperCase(),
        ...(params.providerCode ? { correspondent: params.providerCode } : {}),
        customerTimestamp: new Date().toISOString(),
        statementDescription: buildStatementDescription(params.depositReference),
        ...(toPawaMetadata(params.metadata) ? { metadata: toPawaMetadata(params.metadata) } : {}),
      },
    ];

    const raw = await this.request("/v2/refunds", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const record = unwrapFirstRecord(raw);

    if (!record) {
      throw new Error("Reponse pawaPay invalide a l'initiation du remboursement.");
    }
    if (String(record.status ?? "").toUpperCase() === "REJECTED") {
      throw new Error(buildApiErrorMessage(record, "Remboursement pawaPay refuse."));
    }

    return {
      provider: this.providerName,
      providerReference: String(record.refundId ?? refundId),
      status: normalizeStatus(record.status) ?? "PENDING",
      raw: record,
    };
  }

  async verifyRefund(reference: string): Promise<TransactionStatus> {
    const raw = await this.request(`/v2/refunds/${reference}`, {
      method: "GET",
    });
    const record = unwrapFirstRecord(raw);

    if (!record) {
      throw new Error("Reponse pawaPay invalide lors de la verification du remboursement.");
    }

    return {
      provider: this.providerName,
      providerReference: String(record.refundId ?? reference),
      status: normalizeStatus(record.status) ?? "PENDING",
      raw: record,
    };
  }

  async handleWebhook(payload: unknown, signature?: string | null): Promise<WebhookResult> {
    const record = unwrapFirstRecord(payload);
    if (!record) {
      return {
        accepted: false,
        eventType: "pawapay.invalid",
        raw: {
          payload,
          signature: signature ?? null,
        },
      };
    }

    const isRefund = Boolean(record.refundId);
    const providerReference = String(record.refundId ?? record.depositId ?? "").trim() || null;
    const transactionStatus = normalizeStatus(record.status ?? record.nextStep ?? null);

    return {
      accepted: true,
      eventType: isRefund ? "pawapay.refund.callback" : "pawapay.deposit.callback",
      operationType: isRefund ? "REFUND" : "DEPOSIT",
      providerReference,
      transactionStatus,
      raw: {
        ...record,
        signature: signature ?? null,
      },
    };
  }
}
