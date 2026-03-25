import type { PaymentMethod } from "@prisma/client";

import { AggregatorAdapter } from "@/lib/payment-gateway/aggregator-adapter";
import type { IPaymentGateway } from "@/lib/payment-gateway/gateway.interface";
import { UpayAdapter } from "@/lib/payment-gateway/upay-adapter";

type GatewayProviderName = "AGGREGATOR" | "UPAY";

function normalizeProviderName(value?: string | null): GatewayProviderName {
  return String(value ?? process.env.PAYMENT_GATEWAY_PROVIDER ?? "AGGREGATOR")
    .trim()
    .toUpperCase() === "UPAY"
    ? "UPAY"
    : "AGGREGATOR";
}

export class PaymentGatewayFactory {
  static resolve(method: PaymentMethod, providerName?: string | null): IPaymentGateway {
    const preferred = normalizeProviderName(providerName);
    const orderedProviders: IPaymentGateway[] =
      preferred === "UPAY"
        ? [new UpayAdapter(), new AggregatorAdapter()]
        : [new AggregatorAdapter(), new UpayAdapter()];

    const gateway = orderedProviders.find((candidate) => candidate.supportsMethod(method));
    if (gateway) {
      return gateway;
    }

    throw new Error(`Aucune passerelle de paiement disponible pour ${method}.`);
  }

  static getPreferredProvider(providerName?: string | null) {
    return normalizeProviderName(providerName);
  }
}
