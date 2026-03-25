import { CrmDashboard, type Customer, type Lead, type Prospect } from "@/components/crm/crm-dashboard";
import { getContacts, getLeads } from "@/lib/actions/contact.actions";
import { getTeamMembers } from "@/lib/actions/task.actions";
import { getDemandIntakes } from "@/lib/actions/demand-intake.actions";
import { auth } from "@/lib/auth";
import { formatCurrency } from "@/config/currencies";
import { formatDate } from "@/lib/utils";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Inbox, AlertCircle, CheckCircle, ArrowRight } from "lucide-react";

export const metadata = {
  title: "CRM | Horion ERP",
};

function mapRiskScore(trustScore?: number, predictedChurnRisk?: number | null): Customer["riskScore"] {
  // Prefer real AI churn risk over trustScore proxy
  if (predictedChurnRisk != null) {
    if (predictedChurnRisk >= 0.6) return "High";
    if (predictedChurnRisk >= 0.3) return "Medium";
    return "Low";
  }
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

  const [customersResult, prospectsResult, leadsResult, membersResult, demandsResult] = await Promise.all([
    getContacts({ type: "CLIENT", limit: 200 }),
    getContacts({ type: "PROSPECT", limit: 200 }),
    getLeads({ limit: 200 }),
    getTeamMembers("crm"),
    getDemandIntakes({}),
  ]);

  const members = membersResult.data || [];
  const teamMap = new Map(members.map((m) => [m.id, m.name || m.email]));

  const customers: Customer[] = (customersResult.data || []).map((c: any) => {
    const churnRisk = c.aiProfile?.predictedChurnRisk != null
      ? Number(c.aiProfile.predictedChurnRisk)
      : null;
    return {
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
      riskScore: mapRiskScore(c.trustScore, churnRisk),
      churnRisk: churnRisk ?? undefined,
      owner: c.owner?.name || c.owner?.email || teamMap.get(c.ownerId) || c.ownerName || "Non assigné",
      onboardedBy: c.onboardedBy?.name || c.onboardedBy?.email || teamMap.get(c.onboardedById) || c.createdByName || currentUserName,
      aiScore: typeof c.trustScore === "number" ? Math.min(100, Math.max(20, c.trustScore)) : 60,
      nextAction: c.trustScore && c.trustScore < 40 ? "Relancer client" : "Suivi commercial",
      collaborators: extractCollaborators(c.collaborators, teamMap),
      lastContact: formatDate(c.updatedAt),
      notes: c.notes || undefined,
    };
  });

  const prospects: Prospect[] = (prospectsResult.data || []).map((c: any) => ({
    id: c.id,
    ownerId: c.ownerId || undefined,
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
    updatedAtTs: l.updatedAt ? new Date(l.updatedAt).getTime() : undefined,
    notes: l.notes || undefined,
    containerType: l.containerType || undefined,
    originCountry: l.originCountry || undefined,
  }));

  const recentDemands = (demandsResult.data?.demands ?? []).slice(0, 5) as any[];
  const demandKpis = demandsResult.data?.kpis;

  return (
    <div className="space-y-6">
      {/* ─── Demandes pré-vente widget ─── */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Inbox className="h-4 w-4 text-primary" />
            Pipeline Demandes Clients
            {demandKpis && demandKpis.raw > 0 && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-100 text-xs font-semibold px-2 py-0.5">
                <AlertCircle className="h-3 w-3" />
                {demandKpis.raw} à traiter
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {demandKpis && (
              <>
                <span><strong>{demandKpis.total}</strong> total</span>
                <span className="text-blue-600"><strong>{demandKpis.qualified}</strong> qualif.</span>
                <span className="text-amber-600"><strong>{demandKpis.indicatifPending}</strong> sourcing</span>
                <span className="text-green-600"><strong>{demandKpis.converted}</strong> converties</span>
              </>
            )}
            <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
              <Link href="/crm/demands">
                Gérer <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        {recentDemands.length > 0 ? (
          <CardContent className="pt-0">
            <div className="space-y-2">
              {recentDemands.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between rounded-lg border bg-background p-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{d.clientName}</p>
                    <p className="text-xs text-muted-foreground truncate">{d.rawDescription}</p>
                  </div>
                  <Badge
                    className={`ml-3 shrink-0 text-xs border-0 ${
                      d.status === "RAW" ? "bg-muted text-muted-foreground"
                      : d.status === "QUALIFIED" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-100"
                      : d.status === "INDICATIF_PENDING" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-100"
                      : d.status === "CONVERTED" ? "bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-100"
                      : d.status === "LOST" ? "bg-destructive/10 text-destructive"
                      : "bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-100"
                    }`}
                  >
                    {d.status === "RAW" ? "Brut" : d.status === "QUALIFIED" ? "Qualifié" : d.status === "INDICATIF_PENDING" ? "Sourcing" : d.status === "CONVERTED" ? "Converti" : d.status === "LOST" ? "Perdu" : "Devis"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        ) : (
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucune demande pour le moment — elles apparaissent automatiquement depuis WhatsApp ou le CRM
            </p>
          </CardContent>
        )}
      </Card>

      <CrmDashboard
        initialCustomers={customers}
        initialLeads={leads}
        initialProspects={prospects}
        currentUserName={currentUserName}
        currentUserId={currentUserId}
      />
    </div>
  );
}
