export type WhatsAppDashboardStats = {
  openConversations: number;
  slaBreaches: number;
  highIntents: number;
  messagesToday: number;
  groupsActive: number;
  broadcastsScheduled: number;
  needsReply: number;
  unlinkedConversations: number;
  demo?: boolean;
};

export type WhatsAppConversationItem = {
  id: string;
  contactName: string;
  contactPhone?: string | null;
  linkedContactId?: string | null;
  linkedContactName?: string | null;
  linkedLeadId?: string | null;
  linkedLeadStatus?: string | null;
  linkedLeadCount?: number;
  linkedDemandId?: string | null;
  linkedDemandStatus?: string | null;
  linkedDemandUrgency?: string | null;
  linkedDemandReceivedAt?: string | null;
  latestOrderId?: string | null;
  latestOrderNumber?: string | null;
  latestOrderStatus?: string | null;
  latestPaymentStatus?: string | null;
  latestShipmentStatus?: string | null;
  status: string;
  priority?: string | null;
  assignedTo?: string | null;
  assignedToId?: string | null;
  ownerName?: string | null;
  ownerId?: string | null;
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  slaDueAt?: string | null;
  intentScore?: string | null;
  latestIntentId?: string | null;
  latestIntentSummary?: string | null;
  latestIntentStatus?: string | null;
  responseState?: string | null;
  slaState?: string | null;
  mediaCount?: number;
  copilotSummary?: string | null;
  copilotNextAction?: string | null;
  copilotMissingFields?: string[];
  tags?: string[];
};

export type WhatsAppMessageItem = {
  id: string;
  direction: "IN" | "OUT";
  type?: string | null;
  body?: string | null;
  status?: string | null;
  createdAt?: string | null;
  media?: Array<{
    url: string;
    mimeType?: string | null;
    caption?: string | null;
  }>;
};

export type WhatsAppIntentItem = {
  id: string;
  contactName: string;
  contactPhone?: string | null;
  score: string;
  status: string;
  summary?: string | null;
  createdAt?: string | null;
  crmIntentId?: string | null;
};

export type WhatsAppGroupItem = {
  id: string;
  name: string;
  category?: string | null;
  membersCount: number;
  status: string;
  lastMessageAt?: string | null;
};

export type WhatsAppCampaignItem = {
  id: string;
  name: string;
  objective?: string | null;
  segment?: string | null;
  status: string;
  scheduledAt?: string | null;
  sentCount?: number;
};

export type WhatsAppTemplateItem = {
  id: string;
  name: string;
  category?: string | null;
  language: string;
  status: string;
  versions?: number;
  latestVersionId?: string | null;
  latestVersionStatus?: string | null;
  latestVersionBody?: string | null;
};

export type WhatsAppAccountItem = {
  id: string;
  provider: string;
  displayName?: string | null;
  phoneNumberId?: string | null;
  status: string;
};

export type WhatsAppBotFlowItem = {
  id: string;
  name: string;
  trigger: string;
  triggerValue?: string | null;
  response: string;
  escalate: boolean;
  isActive: boolean;
  priority: number;
  createdAt?: string | null;
};

export type WhatsAppAssignableUserItem = {
  id: string;
  name: string;
  role: string;
};
