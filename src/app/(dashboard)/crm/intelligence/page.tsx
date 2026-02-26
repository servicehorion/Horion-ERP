import { Users, Target, TrendingUp, Plus, AlertTriangle, DollarSign, TrendingDown, Award, Brain } from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getContactTypeCount, getLeads, getLeadPipeline } from "@/lib/actions/contact.actions";
import { getCRMDashboardIntelligence } from "@/lib/actions/customer-intelligence.actions";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { formatCurrency } from "@/config/currencies";
import { formatDate } from "@/lib/utils";
import { LeadsKanban } from "@/components/crm/leads-kanban";

export const metadata = {
  title: "Customer Intelligence CRM | Horion ERP",
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
  NEW: "bg-muted text-muted-foreground",
  CONTACTED: "bg-primary/10 text-primary",
  QUALIFIED: "bg-secondary/10 text-secondary",
  QUOTED: "bg-accent/10 text-accent-foreground",
  WON: "bg-green-100 text-green-800",
  LOST: "bg-destructive/10 text-destructive",
};

export default async function CRMPage() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  const [contactTypes, pipelineResult, leadsResult, intelligenceResult] = await Promise.all([
    getContactTypeCount(),
    getLeadPipeline(),
    getLeads({}),
    getCRMDashboardIntelligence(session.user.tenantId),
  ]);

  const types = contactTypes.data || {};
  const pipeline = pipelineResult.data || [];
  const leads = leadsResult.data || [];
  const intelligence = intelligenceResult.data;

  const totalClients = (types as Record<string, number>)["CLIENT"] || 0;
  const totalProspects = (types as Record<string, number>)["PROSPECT"] || 0;
  const totalSuppliers = (types as Record<string, number>)["SUPPLIER"] || 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Brain className="h-8 w-8 text-primary" />
            Customer Intelligence CRM
          </h1>
          <p className="text-muted-foreground">
            Analyse financière, risques, pipeline et stratégies clients
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90" asChild>
            <Link href="/contacts/new">
              <Plus className="mr-2 h-4 w-4" />
              Nouveau contact
            </Link>
          </Button>
          <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90" asChild>
            <Link href="/crm/leads/new">
              <Plus className="mr-2 h-4 w-4" />
              Nouveau lead
            </Link>
          </Button>
        </div>
      </div>

      {/* Strategic KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clients Actifs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClients}</div>
            <Link
              href="/contacts?type=CLIENT"
              className="text-xs text-primary hover:underline"
            >
              Voir tous les clients
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Prévu</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {intelligence?.pipelineRevenue
                ? formatCurrency(intelligence.pipelineRevenue.total, "XAF")
                : "—"}
            </div>
            <p className="text-xs text-muted-foreground">
              {intelligence?.pipelineRevenue?.count || 0} intentions actives
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clients à Risque</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {intelligence?.highRiskClients?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Risque élevé + cash exposé</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comptes Clés</CardTitle>
            <Award className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{intelligence?.keyAccounts?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Top contributeurs</p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Intelligence Tabs */}
      <Tabs defaultValue="contributors" className="w-full">
        <TabsList className="grid w-full grid-cols-6 border border-border/80 bg-card shadow-sm">
          <TabsTrigger className="text-xs sm:text-sm data-[state=active]:bg-accent/10 data-[state=active]:text-primary" value="contributors">
            Top Contributeurs
          </TabsTrigger>
          <TabsTrigger className="text-xs sm:text-sm data-[state=active]:bg-accent/10 data-[state=active]:text-primary" value="risk">
            Risques Élevés
          </TabsTrigger>
          <TabsTrigger className="text-xs sm:text-sm data-[state=active]:bg-accent/10 data-[state=active]:text-primary" value="at-risk">
            Clients Inactifs
          </TabsTrigger>
          <TabsTrigger className="text-xs sm:text-sm data-[state=active]:bg-accent/10 data-[state=active]:text-primary" value="pipeline">
            Pipeline Leads
          </TabsTrigger>
          <TabsTrigger className="text-xs sm:text-sm data-[state=active]:bg-accent/10 data-[state=active]:text-primary" value="kanban">
            Kanban
          </TabsTrigger>
          <TabsTrigger className="text-xs sm:text-sm data-[state=active]:bg-accent/10 data-[state=active]:text-primary" value="segments">
            Segmentation
          </TabsTrigger>
        </TabsList>

        {/* Top Contributors Tab */}
        <TabsContent value="contributors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-accent" />
                Top 5 Contributeurs au Cashflow
              </CardTitle>
            </CardHeader>
            <CardContent>
              {intelligence?.topContributors && intelligence.topContributors.length > 0 ? (
                <div className="space-y-4">
                  {intelligence.topContributors.map((contributor, idx) => (
                    <div key={contributor.contactId} className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-muted-foreground">
                              #{idx + 1}
                            </span>
                            <Link
                              href={`/contacts/${contributor.contactId}`}
                              className="text-lg font-medium text-primary hover:underline"
                            >
                              {contributor.contact.name}
                            </Link>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {contributor.contact.company || "—"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">
                            {formatCurrency(
                              Number(contributor.lifetimeGrossRevenue),
                              "XAF"
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Marge: {Number(contributor.averageMarginPercent).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Contribution Score</span>
                          <span className="font-medium">
                            {Number(contributor.contributionScore).toFixed(0)}/100
                          </span>
                        </div>
                        <Progress
                          value={Number(contributor.contributionScore)}
                          className="h-2"
                        />
                      </div>
                      <Separator />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Aucune donnée disponible
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* High Risk Clients Tab */}
        <TabsContent value="risk" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Clients à Risque Élevé
              </CardTitle>
            </CardHeader>
            <CardContent>
              {intelligence?.highRiskClients && intelligence.highRiskClients.length > 0 ? (
                <div className="space-y-4">
                  {intelligence.highRiskClients.map((client) => (
                    <div
                      key={client.contactId}
                      className="border-l-4 border-destructive rounded-lg p-4 bg-destructive/5"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <Link
                            href={`/contacts/${client.contactId}`}
                            className="text-lg font-medium text-primary hover:underline"
                          >
                            {client.contact.name}
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            {client.contact.company || "—"}
                          </p>
                        </div>
                        <Badge variant="destructive">
                          Risque: {client.globalRiskScore}/100
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Cash exposé</p>
                          <p className="font-bold text-destructive">
                            {formatCurrency(Number(client.cashExposure), "XAF")}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Risques principaux</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(client.riskBadges as string[]).map((badge) => (
                              <Badge key={badge} variant="outline" className="text-xs">
                                {badge}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Aucun client à risque élevé
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* At-Risk (Inactive) Clients Tab */}
        <TabsContent value="at-risk" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-orange-500" />
                Clients Inactifs (90+ jours)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {intelligence?.atRiskClients && intelligence.atRiskClients.length > 0 ? (
                <div className="space-y-3">
                  {intelligence.atRiskClients.map((segmentation) => (
                    <div
                      key={segmentation.id}
                      className="flex items-center justify-between border rounded-lg p-3 hover:bg-accent transition-colors"
                    >
                      <div>
                        <Link
                          href={`/contacts/${segmentation.contactId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {segmentation.contact.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {segmentation.contact.company || "—"}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-orange-500/10 text-orange-600">
                        À Risque
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Aucun client inactif détecté
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pipeline Leads Tab */}
        <TabsContent value="pipeline" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Pipeline Stats */}
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
                      <Link
                        key={lead.id}
                        href={`/crm/leads/${lead.id}`}
                        className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium">{lead.contact.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {lead.description || lead.source || "Sans description"}
                          </p>
                        </div>
                        <Badge className={LEAD_STATUS_COLORS[lead.status] || ""}>
                          {LEAD_STATUS_LABELS[lead.status] || lead.status}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Kanban Tab */}
        <TabsContent value="kanban" className="space-y-4">
          {leads.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p>Aucun lead à afficher dans le Kanban</p>
              </CardContent>
            </Card>
          ) : (
            <LeadsKanban
              leads={leads.map((l) => ({
                id: l.id,
                status: l.status,
                description: l.description,
                source: l.source,
                estimatedValue: l.estimatedValue ? String(l.estimatedValue) : null,
                currency: l.currency,
                category: l.category,
                contact: l.contact,
              }))}
            />
          )}
        </TabsContent>

        {/* Segmentation Tab */}
        <TabsContent value="segments" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Répartition par Type</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Clients</span>
                  <Badge variant="secondary">{totalClients}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Prospects</span>
                  <Badge variant="secondary">{totalProspects}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Fournisseurs</span>
                  <Badge variant="secondary">{totalSuppliers}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Comptes Stratégiques</CardTitle>
              </CardHeader>
              <CardContent>
                {intelligence?.keyAccounts && intelligence.keyAccounts.length > 0 ? (
                  <div className="space-y-2">
                    {intelligence.keyAccounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center justify-between border-l-4 border-emerald-500 rounded-lg p-2 bg-emerald-500/5"
                      >
                        <Link
                          href={`/contacts/${account.contactId}`}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          {account.contact.name}
                        </Link>
                        <Badge
                          variant="outline"
                          className="bg-emerald-500/10 text-emerald-600"
                        >
                          Compte Clé
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4 text-sm">
                    Aucun compte clé identifié
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
