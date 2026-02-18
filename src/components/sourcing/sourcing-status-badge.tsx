import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  SEARCHING: { label: "Recherche", className: "bg-blue-100 text-blue-800" },
  OFFERS_RECEIVED: { label: "Offres reçues", className: "bg-indigo-100 text-indigo-800" },
  NEGOTIATING: { label: "Négociation", className: "bg-yellow-100 text-yellow-800" },
  SELECTED: { label: "Sélectionné", className: "bg-purple-100 text-purple-800" },
  CONFIRMED: { label: "Confirmé", className: "bg-green-100 text-green-800" },
  CANCELLED: { label: "Annulé", className: "bg-red-100 text-red-800" },
};

export function SourcingStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || { label: status, className: "" };
  return (
    <Badge variant="secondary" className={config.className}>
      {config.label}
    </Badge>
  );
}
