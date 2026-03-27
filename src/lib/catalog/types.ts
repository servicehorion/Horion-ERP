export interface CatalogPriorityAction {
  id: string;
  title: string;
  description: string;
  severity: "info" | "warning" | "critical";
  href: string;
  count?: number;
}

export interface CatalogDashboardProjection {
  positioning: {
    title: string;
    description: string;
    disclaimer: string;
  };
  counters: {
    hotLowConfidenceProducts: number;
    weakLogisticsMemoryProducts: number;
    priceSpreadAlerts: number;
    riskySupplierProducts: number;
  };
  priorityActions: CatalogPriorityAction[];
}

export interface CatalogMetricProvenance {
  key: string;
  label: string;
  category: "manual" | "observed" | "computed" | "recommended";
  value: string;
  provenance: string;
}

export interface CatalogProductProvenanceProjection {
  items: CatalogMetricProvenance[];
}
