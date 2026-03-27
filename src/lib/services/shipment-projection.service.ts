import { LogisticsGovernanceService } from "@/lib/services/logistics-governance.service";

type ShipmentRecord = {
  id: string;
  status: any;
  mode: any;
  origin?: string | null;
  destination?: string | null;
  freightPartnerId?: string | null;
  trackingProvider?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  lastTrackingSyncAt?: Date | null;
  containerNumber?: string | null;
  blNumber?: string | null;
  proofImageUrl?: string | null;
  estimatedDeparture?: Date | null;
  actualDeparture?: Date | null;
  estimatedArrival?: Date | null;
  actualArrival?: Date | null;
  updatedAt: Date;
  weightValidatedAt?: Date | null;
  aiInsight?: { riskLevel?: any } | null;
  warehouseReceipt?: {
    receivedAt: Date;
    readyToShip: boolean;
    condition: string;
  } | null;
  customsClearance?: {
    status: any;
    clearedAt?: Date | null;
    documents?: unknown;
  } | null;
  trackingEvents?: Array<{
    event: string;
    location?: string | null;
    occurredAt: Date;
  }>;
  incidents?: Array<{
    id: string;
    type: string;
    severity: any;
    status: string;
  }>;
};

export class ShipmentProjectionService {
  static projectRecord(record: ShipmentRecord) {
    return LogisticsGovernanceService.buildWorkflowSnapshotFromContext({
      id: record.id,
      status: record.status,
      mode: record.mode,
      origin: record.origin ?? null,
      destination: record.destination ?? null,
      freightPartnerId: record.freightPartnerId ?? null,
      trackingProvider: record.trackingProvider ?? null,
      trackingNumber: record.trackingNumber ?? null,
      trackingUrl: record.trackingUrl ?? null,
      lastTrackingSyncAt: record.lastTrackingSyncAt ?? null,
      containerNumber: record.containerNumber ?? null,
      blNumber: record.blNumber ?? null,
      proofImageUrl: record.proofImageUrl ?? null,
      estimatedDeparture: record.estimatedDeparture ?? null,
      actualDeparture: record.actualDeparture ?? null,
      estimatedArrival: record.estimatedArrival ?? null,
      actualArrival: record.actualArrival ?? null,
      updatedAt: record.updatedAt,
      weightValidatedAt: record.weightValidatedAt ?? null,
      aiRiskLevel: record.aiInsight?.riskLevel ?? null,
      warehouseReceipt: record.warehouseReceipt
        ? {
            receivedAt: record.warehouseReceipt.receivedAt,
            readyToShip: record.warehouseReceipt.readyToShip,
            condition: record.warehouseReceipt.condition,
          }
        : null,
      customsClearance: record.customsClearance
        ? {
            status: record.customsClearance.status,
            clearedAt: record.customsClearance.clearedAt ?? null,
            documents: record.customsClearance.documents,
          }
        : null,
      trackingEvents: (record.trackingEvents ?? []).map((event) => ({
        event: event.event,
        location: event.location ?? null,
        occurredAt: event.occurredAt,
      })),
      incidents: record.incidents ?? [],
    });
  }

  static async getById(shipmentId: string) {
    return LogisticsGovernanceService.getShipmentWorkflowSnapshot(shipmentId);
  }
}
