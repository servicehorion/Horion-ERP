export const STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  BOOKED: "Reserve",
  PICKED_UP: "Enleve",
  IN_TRANSIT: "En transit",
  ARRIVED_PORT: "Arrive port",
  CUSTOMS: "Dedouanement",
  CLEARED: "Dedouane",
  IN_DELIVERY: "En livraison",
  DELIVERED: "Livre",
};

export const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  BOOKED: "bg-blue-100 text-blue-700",
  PICKED_UP: "bg-indigo-100 text-indigo-700",
  IN_TRANSIT: "bg-amber-100 text-amber-700",
  ARRIVED_PORT: "bg-orange-100 text-orange-700",
  CUSTOMS: "bg-purple-100 text-purple-700",
  CLEARED: "bg-teal-100 text-teal-700",
  IN_DELIVERY: "bg-cyan-100 text-cyan-700",
  DELIVERED: "bg-green-100 text-green-700",
};

export const MODE_LABELS: Record<string, string> = {
  SEA: "Sea",
  AIR: "Air",
  ROAD: "Road",
  RAIL: "Rail",
  MULTIMODAL: "Multi",
};

export const RISK_COLORS: Record<string, string> = {
  LOW: "bg-green-100 text-green-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  HIGH: "bg-red-100 text-red-700",
  CRITICAL: "bg-red-200 text-red-800",
};

export const RISK_RANK: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

export const ALERT_COLORS: Record<string, string> = {
  LOW: "bg-green-100 text-green-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  HIGH: "bg-red-100 text-red-700",
  CRITICAL: "bg-red-200 text-red-800",
};
