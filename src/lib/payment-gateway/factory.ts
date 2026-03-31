import type { PaymentMethod } from "@prisma/client";

import { AggregatorAdapter } from "@/lib/payment-gateway/aggregator-adapter";
import type { IPaymentGateway } from "@/lib/payment-gateway/gateway.interface";
import { PawaPayAdapter } from "@/lib/payment-gateway/pawapay-adapter";
import { UpayAdapter } from "@/lib/payment-gateway/upay-adapter";

type GatewayProviderName = "AGGREGATOR" | "PAWAPAY" | "UPAY";

function normalizeProviderName(value?: string | null): GatewayProviderName {
  const normalized = String(value ?? process.env.PAYMENT_GATEWAY_PROVIDER ?? "AGGREGATOR")
    .trim()
    .toUpperCase();

  if (normalized === "UPAY") return "UPAY";
  if (normalized === "PAWAPAY") return "PAWAPAY";
  return "AGGREGATOR";
}

export class PaymentGatewayFactory {
  static resolve(method: PaymentMethod, providerName?: string | null): IPaymentGateway {
    const preferred = normalizeProviderName(providerName);
    const orderedProviders: IPaymentGateway[] =
      preferred === "UPAY"
        ? [new UpayAdapter(), new AggregatorAdapter(), new PawaPayAdapter()]
        : preferred === "PAWAPAY"
          ? [new PawaPayAdapter(), new AggregatorAdapter(), new UpayAdapter()]
          : [new AggregatorAdapter(), new UpayAdapter(), new PawaPayAdapter()];

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
