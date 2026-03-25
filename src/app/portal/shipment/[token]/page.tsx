import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export default async function ShipmentPortalPage({
  params,
}: {
  params: { token: string };
}) {
  const token = params.token;
  const portal = await prisma.shipmentPortalToken.findUnique({
    where: { token },
    include: {
      shipment: {
        include: {
          order: { select: { orderNumber: true, contact: { select: { name: true } } } },
          freightPartner: { select: { name: true } },
          aiInsight: true,
          trackingEvents: { orderBy: { occurredAt: "desc" }, take: 10 },
        },
      },
    },
  });

  if (!portal || portal.role !== "CLIENT" || (portal.expiresAt && portal.expiresAt < new Date())) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Lien invalide
      </div>
    );
  }

  const ship = portal.shipment;
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Suivi expedition</h1>
        <p className="text-muted-foreground">Commande {ship.order.orderNumber}</p>
      </div>

      <div className="rounded-lg border p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Client</span>
          <span className="font-medium">{ship.order.contact.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Transporteur</span>
          <span className="font-medium">{ship.freightPartner?.name || "-"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Statut</span>
          <span className="font-medium">{ship.status}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Route</span>
          <span className="font-medium">{ship.origin} {"->"} {ship.destination}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">ETA</span>
          <span className="font-medium">{ship.estimatedArrival ? formatDate(ship.estimatedArrival) : "-"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">ETD</span>
          <span className="font-medium">{ship.estimatedDeparture ? formatDate(ship.estimatedDeparture) : "-"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">ETA predit</span>
          <span className="font-medium">
            {ship.aiInsight?.predictedArrival ? formatDate(ship.aiInsight.predictedArrival) : "-"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Risque</span>
          <span className="font-medium">{ship.aiInsight?.riskLevel || "-"}</span>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <h2 className="font-semibold mb-2">Dernieres mises a jour</h2>
        {ship.trackingEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun evenement disponible</p>
        ) : (
          <div className="space-y-2">
            {ship.trackingEvents.map((event) => (
              <div key={event.id} className="text-sm">
                <span className="font-medium">{event.event}</span>{" "}
                <span className="text-muted-foreground">
                  - {event.location || "-"} - {formatDate(event.occurredAt, true)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
