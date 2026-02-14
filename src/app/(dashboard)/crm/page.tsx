import { Users, Target, TrendingUp, Plus } from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getContactTypeCount, getLeads, getLeadPipeline } from "@/lib/actions/contact.actions";
import { formatCurrency } from "@/config/currencies";
import { formatDate } from "@/lib/utils";

export const metadata = {
  title: "CRM | Horion ERP",
};

const LEAD_STATUS_LABELS: Record<string, string> = {
  NEW: "Nouveau",
  CONTACTED: "Contacté",
  QUALIFIED: "Qualifié",
  QUOTED: "Devis envoyé",
  WON: "Gagné",
  LOST: "Perdu",
};

const LEAD_STATUS_COLORS: Record<string, string> = {
  NEW: "bg-gray-100 text-gray-800",
  CONTACTED: "bg-blue-100 text-blue-800",
  QUALIFIED: "bg-indigo-100 text-indigo-800",
  QUOTED: "bg-yellow-100 text-yellow-800",
  WON: "bg-green-100 text-green-800",
  LOST: "bg-red-100 text-red-800",
};

export default async function CRMPage() {
  const [contactTypes, pipelineResult, leadsResult] = await Promise.all([
    getContactTypeCount(),
    getLeadPipeline(),
    getLeads({}),
  ]);

  const types = contactTypes.data || {};
  const pipeline = pipelineResult.data || [];
  const leads = leadsResult.data || [];

  const totalClients = (types as Record<string, number>)["CLIENT"] || 0;
  const totalProspects = (types as Record<string, number>)["PROSPECT"] || 0;
  const totalSuppliers = (types as Record<string, number>)["SUPPLIER"] || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">CRM</h1>
          <p className="text-muted-foreground">Contacts, leads et relations clients</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/contacts/new"><Plus className="mr-2 h-4 w-4" />Nouveau contact</Link>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClients}</div>
            <Link href="/contacts?type=CLIENT" className="text-xs text-primary hover:underline">
              Voir les clients
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prospects</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProspects}</div>
            <Link href="/contacts?type=PROSPECT" className="text-xs text-primary hover:underline">
              Voir les prospects
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fournisseurs</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSuppliers}</div>
            <Link href="/contacts?type=SUPPLIER" className="text-xs text-primary hover:underline">
              Voir les fournisseurs
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Pipeline Leads */}
        <Card>
          <CardHeader>
            <CardTitle>Pipeline Leads</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pipeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun lead</p>
            ) : (
              pipeline.map((item) => (
                <div key={item.status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={LEAD_STATUS_COLORS[item.status] || ""}>
                      {LEAD_STATUS_LABELS[item.status] || item.status}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium">{item.count} leads</span>
                    {item.totalValue > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(item.totalValue, "XAF")}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Leads */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Leads récents</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/contacts">Tous les contacts</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {leads.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun lead récent</p>
            ) : (
              <div className="space-y-3">
                {leads.slice(0, 5).map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{lead.contact.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {lead.description || lead.source || "Sans description"}
                      </p>
                    </div>
                    <Badge className={LEAD_STATUS_COLORS[lead.status] || ""}>
                      {LEAD_STATUS_LABELS[lead.status] || lead.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
