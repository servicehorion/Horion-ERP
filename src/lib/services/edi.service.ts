import type { Order, OrderItem, Contact, Supplier } from "@prisma/client";

export class EdiService {
  private static normalizeProvider(provider: string) {
    return provider.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  }

  private static resolveEndpoint(provider: string) {
    const key = `EDI_WEBHOOK_URL_${this.normalizeProvider(provider)}`;
    return process.env[key] || process.env.EDI_WEBHOOK_URL;
  }

  private static resolveToken(provider: string) {
    const key = `EDI_WEBHOOK_TOKEN_${this.normalizeProvider(provider)}`;
    return process.env[key] || process.env.EDI_WEBHOOK_TOKEN;
  }

  static buildOrderPayload(params: {
    order: Order;
    items: OrderItem[];
    contact: Contact;
    supplier?: Supplier | null;
  }) {
    const { order, items, contact, supplier } = params;
    return {
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      destination: order.destinationCity,
      origin: order.originCountry,
      contact: {
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
      },
      supplier: supplier
        ? {
            id: supplier.id,
            name: supplier.name,
            country: supplier.country,
            email: supplier.email,
            phone: supplier.phone,
          }
        : null,
      items: items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        currency: item.currency,
        hsCode: item.hsCode,
      })),
      totals: {
        merchandiseTotal: Number(order.merchandiseTotal),
        logisticsCost: Number(order.logisticsCost),
        insuranceAmount: Number(order.insuranceAmount),
        totalClient: Number(order.totalClient),
        currency: order.currency,
      },
    };
  }

  static async sendOrderPayload(provider: string, payload: unknown) {
    const endpoint = this.resolveEndpoint(provider);
    const token = this.resolveToken(provider);

    if (!endpoint) {
      return {
        ok: false,
        status: "PENDING" as const,
        errorMessage: "EDI webhook non configure",
        response: null,
      };
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          provider,
          payload,
          sentAt: new Date().toISOString(),
        }),
      });

      const text = await res.text();
      let response: unknown = text;
      try {
        response = JSON.parse(text);
      } catch {
        // keep raw text
      }

      let acknowledged = false;
      if (response && typeof response === "object") {
        const status = (response as any).status || (response as any).state;
        if ((response as any).ack === true || status === "ACK" || status === "ACKNOWLEDGED") {
          acknowledged = true;
        }
      }

      return {
        ok: res.ok,
        status: res.ok ? (acknowledged ? ("ACKNOWLEDGED" as const) : ("SENT" as const)) : ("FAILED" as const),
        errorMessage: res.ok ? null : `EDI webhook ${res.status}`,
        response,
        acknowledged,
      };
    } catch (error) {
      return {
        ok: false,
        status: "FAILED" as const,
        errorMessage: error instanceof Error ? error.message : "EDI webhook erreur",
        response: null,
      };
    }
  }
}
