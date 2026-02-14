import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface TimelineEntry {
  id: string;
  event: string;
  fromValue: string | null;
  toValue: string | null;
  note: string | null;
  userId: string | null;
  createdAt: Date;
}

interface OrderTimelineProps {
  entries: TimelineEntry[];
}

export function OrderTimeline({ entries }: OrderTimelineProps) {
  if (entries.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        Aucun événement pour le moment
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {entries.map((entry, index) => (
        <div key={entry.id} className="relative flex gap-4">
          {/* Timeline line */}
          {index < entries.length - 1 && (
            <div className="absolute left-[11px] top-6 h-full w-[2px] bg-border" />
          )}

          {/* Timeline dot */}
          <div
            className={cn(
              "relative z-10 mt-1.5 h-6 w-6 rounded-full border-2 border-background",
              entry.event === "status_changed"
                ? "bg-primary"
                : entry.event === "order_created"
                  ? "bg-green-500"
                  : "bg-muted-foreground"
            )}
          />

          {/* Content */}
          <div className="flex-1 space-y-1 pb-8">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {getActionLabel(entry.event, entry.fromValue, entry.toValue)}
              </p>
              <time className="text-xs text-muted-foreground">
                {formatDate(entry.createdAt, true)}
              </time>
            </div>
            {entry.note && (
              <p className="text-sm text-muted-foreground">
                {entry.note}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function getActionLabel(
  event: string,
  fromValue: string | null,
  toValue: string | null
): string {
  if (event === "order_created") {
    return "Commande créée";
  }

  if (event === "status_changed" && toValue) {
    return `Statut changé vers ${getStatusLabel(toValue)}`;
  }

  return event;
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    DEMANDE: "Demande",
    RECHERCHE_PRODUIT: "Recherche produit",
    DEVIS: "Devis",
    PAIEMENT_EN_COURS: "Paiement en cours",
    SOURCING: "Sourcing",
    COMMANDE_USINE: "Commande usine",
    EN_PRODUCTION: "En production",
    QC_EN_COURS: "QC en cours",
    QC_VALIDE: "QC validé",
    EN_TRANSIT: "En transit",
    AU_PORT: "Au port",
    DEDOUANEMENT: "Dédouanement",
    LIVRE: "Livré",
    ANNULE: "Annulé",
  };

  return labels[status] || status;
}
