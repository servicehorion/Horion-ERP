import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, ArrowLeft, Archive } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LeadFilters } from "@/components/crm/lead-filters";
import { LeadsTableClient, type LeadRowWithAssignment } from "@/components/crm/leads-table-client";
import { getLeads, getLeadPipeline } from "@/lib/actions/contact.actions";
import { getTeamMembers } from "@/lib/actions/task.actions";
import { isAuthErrorMessage } from "@/lib/auth-error";
import { formatCurrency } from "@/config/currencies";

export const metadata = {
  title: "Leads | Horion ERP",
  description: "Gestion du pipeline CRM",
};

interface PageProps {
  searchParams: Promise<{
    page?: string;
    status?: string;
    assignee?: string;
    q?: string;
    archived?: string;
  }>;
}

const LEAD_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  NEW: { label: "Nouveau", color: "bg-gray-100 text-gray-800" },
  CONTACTED: { label: "Contacté", color: "bg-blue-100 text-blue-800" },
  QUALIFIED: { label: "Qualifié", color: "bg-indigo-100 text-indigo-800" },
  QUOTED: { label: "Devis envoyé", color: "bg-yellow-100 text-yellow-800" },
  WON: { label: "Gagné", color: "bg-green-100 text-green-800" },
  LOST: { label: "Perdu", color: "bg-red-100 text-red-800" },
};

export default async function LeadsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const status = params.status;
  const assignee = params.assignee;
  const q = params.q;
  const showArchived = params.archived === "1";

  const [leadsResult, pipelineResult, membersResult] = await Promise.all([
    getLeads({
      status,
      assignedTo: assignee,
      search: q,
      page,
      limit: 50,
      includeArchived: showArchived,
    }),
    getLeadPipeline(),
    getTeamMembers("crm"),
  ]);
  const pageErrors = [leadsResult.error, pipelineResult.error, membersResult.error].filter(Boolean) as string[];
  const authError = pageErrors.find((message) => isAuthErrorMessage(message));
  if (authError) {
    redirect(`/login?callbackUrl=${encodeURIComponent(buildUrl(params, {}))}`);
  }
  const pageError = pageErrors[0];

  const leads = leadsResult.data || [];
  const totalPages = (leadsResult as any).totalPages || 1;
  const total = (leadsResult as any).total || leads.length;
  const pipeline = pipelineResult.data || [];
  const members = membersResult.data || [];

  const tableData: LeadRowWithAssignment[] = leads.map((l: any) => ({
    id: l.id,
    description: l.description,
    contactName: l.contact.name,
    contactId: l.contactId,
    status: l.status,
    estimatedValue: l.estimatedValue ? Number(l.estimatedValue) : null,
    currency: l.currency,
    source: l.source,
    category: l.category,
    assignedTo: l.assignedTo ?? null,
    isArchived: l.isArchived ?? false,
    score: l.score ?? 0,
    slaStatus: l.slaStatus ?? null,
    createdAt: l.createdAt,
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/crm">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">Leads</h1>
              {showArchived && (
                <Badge className="bg-orange-100 text-orange-800 border-orange-200">Vue Archivés</Badge>
              )}
            </div>
            <p className="text-muted-foreground">Pipeline et qualification</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            {showArchived ? (
              <Link href="/crm/leads">
                <Archive className="mr-2 h-3.5 w-3.5" />
                Voir actifs
              </Link>
            ) : (
              <Link href="/crm/leads?archived=1">
                <Archive className="mr-2 h-3.5 w-3.5" />
                Archivés
              </Link>
            )}
          </Button>
          {!showArchived && (
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90" asChild>
              <Link href="/crm/leads/new">
                <Plus className="mr-2 h-4 w-4" />
                Nouveau lead
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Pipeline KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Object.entries(LEAD_STATUS_CONFIG).map(([key, cfg]) => {
          const stat = pipeline.find((p: any) => p.status === key);
          return (
            <Link key={key} href={`/crm/leads?status=${key}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader className="pb-1 pt-3 px-3">
                  <CardTitle className="text-xs font-medium text-muted-foreground">
                    {cfg.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-3 px-3">
                  <div className="text-2xl font-bold">{stat?.count ?? 0}</div>
                  {stat && stat.totalValue > 0 && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      {formatCurrency(stat.totalValue, "XAF")}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <LeadFilters teamMembers={members} />

      {pageError ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
          {pageError}
        </div>
      ) : (
        <>
          <LeadsTableClient leads={tableData} teamMembers={members} showArchived={showArchived} />
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page} sur {totalPages} ({total} lead{total > 1 ? "s" : ""})
              </p>
              <div className="flex items-center gap-2">
                {page > 1 && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={buildUrl(params, { page: page - 1 })}>
                      Précédent
                    </Link>
                  </Button>
                )}
                {page < totalPages && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={buildUrl(params, { page: page + 1 })}>
                      Suivant
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function buildUrl(
  current: Record<string, string | undefined>,
  overrides: Record<string, string | number | undefined>
): string {
  const params = new URLSearchParams();
  const merged = { ...current, ...overrides };
  for (const [k, v] of Object.entries(merged)) {
    if (v != null && v !== "" && v !== "all") params.set(k, String(v));
  }
  const query = params.toString();
  return query ? `/crm/leads?${query}` : "/crm/leads";
}
