import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export default async function OrderPortalPage({
  params,
}: {
  params: { token: string };
}) {
  const token = params.token;
  const portal = await prisma.orderPortalToken.findUnique({
    where: { token },
    include: {
      order: {
        include: {
          contact: { select: { name: true, email: true, phone: true } },
          shipments: {
            include: { trackingEvents: { orderBy: { occurredAt: "desc" }, take: 5 } },
            orderBy: { createdAt: "desc" },
          },
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

  const order = portal.order;
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Suivi commande</h1>
        <p className="text-muted-foreground">Commande {order.orderNumber}</p>
      </div>

      <div className="rounded-lg border p-4 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Client</span>
          <span className="font-medium">{order.contact?.name || "-"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Statut</span>
          <span className="font-medium">{order.status}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Destination</span>
          <span className="font-medium">{order.destinationCity}</span>
        </div>
        {order.estimatedDelivery && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Livraison prévue</span>
            <span className="font-medium">{formatDate(order.estimatedDelivery)}</span>
          </div>
        )}
        {order.actualDelivery && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Livraison réelle</span>
            <span className="font-medium text-green-600">{formatDate(order.actualDelivery)}</span>
          </div>
        )}
      </div>

      <div className="rounded-lg border p-4">
        <h2 className="font-semibold mb-2">Expéditions</h2>
        {order.shipments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune expédition enregistrée.</p>
        ) : (
          <div className="space-y-3">
            {order.shipments.map((ship) => (
              <div key={ship.id} className="rounded-md border p-3 text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{ship.mode}</span>
                  <span className="text-muted-foreground">{ship.status}</span>
                </div>
                <div className="text-muted-foreground">
                  {ship.origin || "-"} {"->"} {ship.destination || "-"}
                </div>
                {ship.estimatedArrival && (
                  <div>ETA: {formatDate(ship.estimatedArrival)}</div>
                )}
                {ship.trackingEvents.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Dernier event: {ship.trackingEvents[0].event} · {formatDate(ship.trackingEvents[0].occurredAt, true)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
