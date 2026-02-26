import Link from "next/link";
import { Plus, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { leadColumns, type LeadTableRow } from "@/components/crm/lead-table";
import { LeadFilters } from "@/components/crm/lead-filters";
import { getLeads } from "@/lib/actions/contact.actions";
import { getTeamMembers } from "@/lib/actions/task.actions";

export const metadata = {
  title: "Leads | Horion ERP",
  description: "Gestion du pipeline CRM",
};

interface PageProps {
  searchParams: {
    page?: string;
    status?: string;
    assignee?: string;
    q?: string;
  };
}

export default async function LeadsPage({ searchParams }: PageProps) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const status = searchParams.status;
  const assignee = searchParams.assignee;
  const q = searchParams.q;

  const [leadsResult, membersResult] = await Promise.all([
    getLeads({
      status,
      assignedTo: assignee,
      search: q,
      page,
      limit: 50,
    }),
    getTeamMembers("crm"),
  ]);

  const leads = leadsResult.data || [];
  const totalPages = (leadsResult as any).totalPages || 1;
  const total = (leadsResult as any).total || leads.length;
  const members = membersResult.data || [];
  const memberMap = new Map(members.map((m) => [m.id, m.name || m.email]));

  const tableData: LeadTableRow[] = leads.map((l: any) => ({
    id: l.id,
    description: l.description,
    contactName: l.contact.name,
    contactId: l.contactId,
    status: l.status,
    estimatedValue: l.estimatedValue ? Number(l.estimatedValue) : null,
    currency: l.currency,
    source: l.source,
    category: l.category,
    assigneeName: l.assignedTo ? memberMap.get(l.assignedTo) || l.assignedTo : null,
    createdAt: l.createdAt,
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/crm">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Leads</h1>
            <p className="text-muted-foreground">Pipeline et qualification</p>
          </div>
        </div>
        <Button className="bg-accent text-accent-foreground hover:bg-accent/90" asChild>
          <Link href="/crm/leads/new">
            <Plus className="mr-2 h-4 w-4" />
            Nouveau lead
          </Link>
        </Button>
      </div>

      <LeadFilters teamMembers={members} />

      {leadsResult.error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
          {leadsResult.error}
        </div>
      ) : (
        <>
          <DataTable columns={leadColumns} data={tableData} />
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page} sur {totalPages} ({total} lead{total > 1 ? "s" : ""})
              </p>
              <div className="flex items-center gap-2">
                {page > 1 && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={buildUrl(searchParams, { page: page - 1 })}>
                      PrÃ©cÃ©dent
                    </Link>
                  </Button>
                )}
                {page < totalPages && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={buildUrl(searchParams, { page: page + 1 })}>
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

function buildUrl(current: Record<string, string | undefined>, overrides: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  const merged = { ...current, ...overrides };
  for (const [k, v] of Object.entries(merged)) {
    if (v != null && v !== "" && v !== "all") params.set(k, String(v));
  }
  return `/crm/leads?${params.toString()}`;
}
