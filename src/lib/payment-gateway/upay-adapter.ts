import type { PaymentInitiationParams, PaymentIntent, TransactionStatus, WebhookResult } from "@/lib/payment-gateway/gateway.interface";
import { AggregatorAdapter } from "@/lib/payment-gateway/aggregator-adapter";

function buildCheckoutUrl(baseUrl: string, params: PaymentInitiationParams, providerReference: string) {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set("payment_id", params.paymentId);
    url.searchParams.set("order_id", params.orderId);
    url.searchParams.set("amount", String(params.amount));
    url.searchParams.set("currency", params.currency);
    url.searchParams.set("method", params.method);
    url.searchParams.set("provider_ref", providerReference);

    if (params.customerPhone) {
      url.searchParams.set("customer_phone", params.customerPhone);
    }
    if (params.customerEmail) {
      url.searchParams.set("customer_email", params.customerEmail);
    }
    if (params.returnUrl) {
      url.searchParams.set("return_url", params.returnUrl);
    }

    return url.toString();
  } catch {
    return null;
  }
}

export class UpayAdapter extends AggregatorAdapter {
  readonly providerName = "UPAY";

  async initiatePayment(params: PaymentInitiationParams): Promise<PaymentIntent> {
    const providerReference = `upay_${params.paymentId}`;
    const hostedCheckoutBaseUrl =
      process.env.UPAY_CHECKOUT_BASE_URL || process.env.PAYMENT_GATEWAY_CHECKOUT_BASE_URL || "";
    const checkoutUrl = hostedCheckoutBaseUrl
      ? buildCheckoutUrl(hostedCheckoutBaseUrl, params, providerReference)
      : null;

    return {
      provider: this.providerName,
      providerReference,
      checkoutUrl,
      status: "PROCESSING",
      raw: {
        mode: checkoutUrl ? "hosted_checkout" : "stub",
        message: checkoutUrl
          ? "Redirection vers Upay preparee."
          : "UpayAdapter initialise sans URL de checkout. Ajoutez UPAY_CHECKOUT_BASE_URL pour activer la redirection.",
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
    const parsed = await super.handleWebhook(payload, signature);
    return {
      ...parsed,
      eventType: parsed.eventType || "upay.webhook",
      raw: {
        ...(parsed.raw ?? {}),
        provider: this.providerName,
      },
    };
  }
}
