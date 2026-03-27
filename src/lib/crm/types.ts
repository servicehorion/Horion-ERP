export interface Customer {
  id: string;
  ownerId?: string;
  churnRisk?: number;
  name: string;
  phone: string;
  email?: string;
  country: string;
  city?: string;
  whatsapp: "Active" | "Inactive";
  orders: number;
  ltv: string;
  tags: string[];
  riskScore: "Low" | "Medium" | "High";
  owner: string;
  onboardedBy: string;
  aiScore: number;
  nextAction: string;
  collaborators: string[];
  lastContact?: string;
  notes?: string;
}

export interface Lead {
  id: string;
  ownerId?: string;
  name: string;
  phone: string;
  country: string;
  product: string;
  estimatedValue: string;
  status: "New" | "Qualified" | "Quoted" | "Paid" | "Lost";
  assignedAgent: string;
  owner: string;
  onboardedBy: string;
  source: string;
  aiScore: number;
  nextAction: string;
  collaborators: string[];
  lastContact: string;
  containerType?: "LCL" | "FCL" | "AERIEN";
  originCountry?: string;
  notes?: string;
  updatedAtTs?: number;
  slaStatus?: "OK" | "WARNING" | "BREACH" | null;
}

export interface Prospect {
  id: string;
  ownerId?: string;
  name: string;
  phone: string;
  country: string;
  inquiry: string;
  source: string;
  owner: string;
  onboardedBy: string;
  intentScore: number;
  collaborators: string[];
  status: "New" | "Contacted" | "Qualified" | "Rejected";
  notes?: string;
}

export interface CrmPriorityAction {
  id: string;
  entityType: "customer" | "lead" | "demand";
  name: string;
  owner: string;
  score: number;
  nextAction: string;
  tag: string;
  href?: string;
}

export interface CrmDemandListItem {
  id: string;
  clientName: string;
  rawDescription: string;
  status: string;
  urgency: string;
  aiScore: number;
  assigneeName?: string;
  nextAction?: string;
}

export interface CrmDemandWidgetProjection {
  kpis: {
    total: number;
    raw: number;
    qualified: number;
    indicatifPending: number;
    quoteFlow: number;
    paymentFlow: number;
    converted: number;
    lost: number;
  };
  recentDemands: CrmDemandListItem[];
}

export interface CrmOverviewProjection {
  totalCustomers: number;
  activeLeads: number;
  newProspects: number;
  whatsappConnected: number;
  whatsappRate: number;
  totalLtvXaf: number;
  avgAiScore: number;
  highIntentLeads: number;
  atRiskCustomers: number;
  nextActions: number;
  rawDemands: number;
  leadsOutsideSla: number;
  canonicalJourney: Array<{
    label: string;
    count: number;
    tone?: "default" | "warning" | "success";
  }>;
}

export interface CrmDashboardProjection {
  customers: Customer[];
  leads: Lead[];
  prospects: Prospect[];
  overview: CrmOverviewProjection;
  priorityActions: CrmPriorityAction[];
  demandWidget: CrmDemandWidgetProjection;
}
