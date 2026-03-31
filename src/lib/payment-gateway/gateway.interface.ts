import type { PaymentMethod } from "@prisma/client";

export type PaymentInitiationParams = {
  orderId: string;
  paymentId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  customerPhone?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  countryCode?: string | null;
  providerCode?: string | null;
  clientReferenceId?: string | null;
  customerMessage?: string | null;
  successfulUrl?: string | null;
  failedUrl?: string | null;
  returnUrl?: string | null;
  metadata?: Record<string, unknown>;
};

export type PaymentIntent = {
  provider: string;
  providerReference: string;
  checkoutUrl?: string | null;
  status: "PENDING" | "PROCESSING" | "REQUIRES_PROOF";
  raw?: Record<string, unknown>;
};

export type TransactionStatus = {
  provider: string;
  providerReference: string;
  status: "PENDING" | "PROCESSING" | "CONFIRMED" | "FAILED" | "CANCELLED";
  raw?: Record<string, unknown>;
};

export type WebhookResult = {
  accepted: boolean;
  eventType: string;
  operationType?: "DEPOSIT" | "PAYMENT" | "REFUND" | null;
  providerReference?: string | null;
  transactionStatus?: TransactionStatus["status"] | null;
  raw?: Record<string, unknown>;
};

export interface IPaymentGateway {
  readonly providerName: string;
  supportsMethod(method: PaymentMethod): boolean;
  initiatePayment(params: PaymentInitiationParams): Promise<PaymentIntent>;
  verifyTransaction(reference: string): Promise<TransactionStatus>;
  handleWebhook(payload: unknown, signature?: string | null): Promise<WebhookResult>;
}
