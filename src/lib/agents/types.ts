export type HorionAgentId =
  | "customer_service"
  | "community_manager"
  | "marketing"
  | "finance"
  | "sourcing"
  | "logistics_qc";

export type AgentChannel =
  | "whatsapp"
  | "crm"
  | "marketing"
  | "finance"
  | "sourcing"
  | "catalog"
  | "orders"
  | "logistics"
  | "qc"
  | "tasks";

export type AgentAutonomy = "assist" | "supervised" | "guarded_write";

export type AgentToolRisk = "read" | "write" | "approval";

export interface AgentToolDefinition {
  id: string;
  label: string;
  module: AgentChannel;
  description: string;
  risk: AgentToolRisk;
}

export interface HorionAgentDefinition {
  id: HorionAgentId;
  name: string;
  persona: string;
  summary: string;
  modules: AgentChannel[];
  customerFacing: boolean;
  autonomy: AgentAutonomy;
  defaultTools: string[];
  handoffTargets: HorionAgentId[];
  escalationSummary: string;
}

export interface TenantAgentOverride {
  enabled?: boolean;
  displayName?: string;
  autonomy?: AgentAutonomy;
  escalationUserId?: string | null;
  channels?: AgentChannel[];
  allowedTools?: string[];
  allowedModules?: AgentChannel[];
  notes?: string;
}

export interface AgentRuntimeProfile extends HorionAgentDefinition {
  enabled: boolean;
  displayName: string;
  registered: boolean;
  tenantId?: string;
  escalationUserId?: string | null;
  channels: AgentChannel[];
  allowedTools: string[];
  allowedModules: AgentChannel[];
  notes?: string;
}
