import { prisma } from "@/lib/db";

type TrackingEventInput = {
  event: string;
  location?: string | null;
  description?: string | null;
  occurredAt: Date;
};

type TrackingSyncResult = {
  status?: string;
  trackingUrl?: string;
  estimatedArrival?: Date | null;
  events: TrackingEventInput[];
};

export class ShipmentTrackingService {
  private static aftershipKey = process.env.AFTERSHIP_API_KEY;
  private static aftershipUrl = "https://api.aftership.com/v4";

  static async syncShipmentTracking(shipmentId: string): Promise<TrackingSyncResult> {
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: {
        id: true,
        trackingProvider: true,
        trackingNumber: true,
        trackingUrl: true,
      },
    });
    if (!shipment) throw new Error("Expedition introuvable");

    if (!shipment.trackingProvider || !shipment.trackingNumber) {
      throw new Error("Tracking provider/numero manquant");
    }

    const provider = shipment.trackingProvider.toLowerCase();
    if (provider === "aftership") {
      return this.fetchAfterShip(shipment.trackingProvider, shipment.trackingNumber);
    }

    if (["msc", "cma", "cma-cgm", "cosco"].includes(provider)) {
      return {
        status: "AWAITING_WEBHOOK",
        trackingUrl: shipment.trackingUrl || undefined,
        estimatedArrival: null,
        events: [
          {
            event: "Tracking via webhook requis",
            location: null,
            description: `Provider ${shipment.trackingProvider} non connecte. Utiliser N8N/WAHA pour pousser les events.`,
            occurredAt: new Date(),
          },
        ],
      };
    }

    // Fallback stub
    return {
      status: "TRACKING_SYNCED",
      trackingUrl: shipment.trackingUrl || undefined,
      estimatedArrival: null,
      events: [
        {
          event: "Tracking synchronise (stub)",
          location: null,
          description: `Provider ${shipment.trackingProvider} non connecte`,
          occurredAt: new Date(),
        },
      ],
    };
  }

  private static async fetchAfterShip(slug: string, trackingNumber: string): Promise<TrackingSyncResult> {
    if (!this.aftershipKey) {
      return {
        status: "NO_API_KEY",
        trackingUrl: undefined,
        estimatedArrival: null,
        events: [
          {
            event: "Tracking non connecte",
            description: "AFTERSHIP_API_KEY manquante",
            occurredAt: new Date(),
          },
        ],
      };
    }

    const res = await fetch(`${this.aftershipUrl}/trackings/${slug}/${trackingNumber}`, {
      headers: {
        "aftership-api-key": this.aftershipKey,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AfterShip error: ${res.status} ${text}`);
    }

    const json = await res.json();
    const tracking = json?.data?.tracking;
    const checkpoints = Array.isArray(tracking?.checkpoints) ? tracking.checkpoints : [];
    const events: TrackingEventInput[] = checkpoints.map((cp: any) => ({
      event: cp.tag || cp.message || cp.subtag || "Update",
      location: cp.location || cp.city || null,
      description: cp.message || cp.subtag_message || null,
      occurredAt: new Date(cp.checkpoint_time || cp.created_at || new Date()),
    }));

    const estimated = tracking?.expected_delivery ? new Date(tracking.expected_delivery) : null;

    return {
      status: tracking?.tag || tracking?.subtag || "IN_TRANSIT",
      trackingUrl: tracking?.tracking_url || undefined,
      estimatedArrival: estimated,
      events,
    };
  }
}
