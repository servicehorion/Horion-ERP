import { CrmDashboard, type Customer, type Lead, type Prospect } from "@/components/crm/crm-dashboard";
import { getContacts, getLeads } from "@/lib/actions/contact.actions";
import { getTeamMembers } from "@/lib/actions/task.actions";
import { auth } from "@/lib/auth";
import { formatCurrency } from "@/config/currencies";
import { formatDate } from "@/lib/utils";
import { redirect } from "next/navigation";

export const metadata = {
  title: "CRM | Horion ERP",
};

function mapRiskScore(trustScore?: number): Customer["riskScore"] {
  if (trustScore == null) return "Medium";
  if (trustScore >= 70) return "Low";
  if (trustScore >= 40) return "Medium";
  return "High";
}

function mapLeadStatus(status: string): Lead["status"] {
  switch (status) {
    case "WON":
      return "Paid";
    case "LOST":
      return "Lost";
    case "QUOTED":
      return "Quoted";
    case "QUALIFIED":
    case "CONTACTED":
      return "Qualified";
    case "NEW":
    default:
      return "New";
  }
}

function extractTags(tags: unknown): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map((t) => String(t));
  return [];
}

function extractCollaborators(collaborators: unknown, teamMap: Map<string, string>): string[] {
  if (!Array.isArray(collaborators)) return [];
  return collaborators
    .map((c: any) => {
      if (typeof c === "string") return c;
      const user = c?.user;
      return user?.name || user?.email || teamMap.get(c?.userId || user?.id) || c?.userId || "";
    })
    .filter(Boolean);
}

export default async function CRMPage() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    redirect("/login");
  }
  const currentUserName = session?.user?.name || "Utilisateur";
  const currentUserId = session?.user?.id || "";

  const [customersResult, prospectsResult, leadsResult, membersResult] = await Promise.all([
    getContacts({ type: "CLIENT", limit: 200 }),
    getContacts({ type: "PROSPECT", limit: 200 }),
    getLeads({ limit: 200 }),
    getTeamMembers(),
  ]);

  const members = membersResult.data || [];
  const teamMap = new Map(members.map((m) => [m.id, m.name || m.email]));

  const customers: Customer[] = (customersResult.data || []).map((c: any) => ({
    id: c.id,
    ownerId: c.ownerId || undefined,
    name: c.name,
    phone: c.phone || "",
    email: c.email || undefined,
    country: c.country || "—",
    city: c.city || undefined,
    whatsapp: c.whatsapp ? "Active" : "Inactive",
    orders: c._count?.orders ?? 0,
    ltv: c.financialMetrics?.lifetimeGrossRevenue
      ? formatCurrency(Number(c.financialMetrics.lifetimeGrossRevenue), "XAF")
      : "—",
    tags: extractTags(c.tags),
    riskScore: mapRiskScore(c.trustScore),
    owner: c.owner?.name || c.owner?.email || teamMap.get(c.ownerId) || c.ownerName || "Non assigné",
    onboardedBy: c.onboardedBy?.name || c.onboardedBy?.email || teamMap.get(c.onboardedById) || c.createdByName || currentUserName,
    aiScore: typeof c.trustScore === "number" ? Math.min(100, Math.max(20, c.trustScore)) : 60,
    nextAction: c.trustScore && c.trustScore < 40 ? "Relancer client" : "Suivi commercial",
    collaborators: extractCollaborators(c.collaborators, teamMap),
    lastContact: formatDate(c.updatedAt),
    notes: c.notes || undefined,
  }));

  const prospects: Prospect[] = (prospectsResult.data || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    phone: c.phone || "",
    country: c.country || "—",
    inquiry: c.notes || "Prospect CRM",
    source: "CRM",
    owner: c.owner?.name || c.owner?.email || teamMap.get(c.ownerId) || c.ownerName || "Non assigné",
    onboardedBy: c.onboardedBy?.name || c.onboardedBy?.email || teamMap.get(c.onboardedById) || c.createdByName || currentUserName,
    intentScore: typeof c.trustScore === "number" ? Math.min(100, Math.max(20, c.trustScore)) : 50,
    collaborators: extractCollaborators(c.collaborators, teamMap),
    status: "New",
    notes: c.notes || undefined,
  }));

  const leads: Lead[] = (leadsResult.data || []).map((l: any) => ({
    id: l.id,
    ownerId: l.ownerId || undefined,
    name: l.contact?.name || "—",
    phone: l.contact?.phone || "",
    country: l.contact?.country || "—",
    product: l.description || l.category || "—",
    estimatedValue: l.estimatedValue
      ? formatCurrency(Number(l.estimatedValue), l.currency || "XAF")
      : "—",
    status: mapLeadStatus(l.status),
    assignedAgent: l.assignedTo ? teamMap.get(l.assignedTo) || l.assignedTo : "Non assigne",
    owner: l.owner?.name || l.owner?.email || teamMap.get(l.ownerId) || (l.assignedTo ? teamMap.get(l.assignedTo) || l.assignedTo : "") || "Non assigné",
    onboardedBy: l.onboardedBy?.name || l.onboardedBy?.email || teamMap.get(l.onboardedById) || currentUserName,
    source: l.source || "CRM",
    aiScore: typeof l.contact?.trustScore === "number" ? Math.min(100, Math.max(20, l.contact.trustScore)) : 55,
    nextAction: l.status === "QUOTED" ? "Relancer devis" : "Contacter",
    collaborators: extractCollaborators(l.collaborators, teamMap),
    lastContact: formatDate(l.updatedAt),
    notes: l.notes || undefined,
    containerType: l.containerType || undefined,
    originCountry: l.originCountry || undefined,
  }));

  return (
    <CrmDashboard
      initialCustomers={customers}
      initialLeads={leads}
      initialProspects={prospects}
      currentUserName={currentUserName}
      currentUserId={currentUserId}
    />
  );
}
