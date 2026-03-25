import { Users, Target, AlertTriangle, DollarSign, Award, Brain, GitBranch, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getContactTypeCount, getLeads, getLeadPipeline, getContacts } from "@/lib/actions/contact.actions";
import { getCRMDashboardIntelligence } from "@/lib/actions/customer-intelligence.actions";
import { getPipelines, getLeadScoringWeights } from "@/lib/actions/crm-advanced.actions";
import { getTeamMembers } from "@/lib/actions/task.actions";
import PipelineManager from "@/components/crm/pipeline-manager";
import { LeadScoringRulesEditor } from "@/components/crm/lead-scoring-rules";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { formatCurrency } from "@/config/currencies";
import { formatDate } from "@/lib/utils";
import { LeadsKanban } from "@/components/crm/leads-kanban";
import { GlobalIntentDialog } from "@/components/crm/global-intent-dialog";

export const metadata = {
  title: "Customer Intelligence CRM | Horion ERP",
};

const LEAD_STATUS_LABELS: Record<string, string> = {
  NEW: "Nouveau",
  CONTACTED: "Contacté",
  QUALIFIED: "Devis indicatif envoyé",
  QUOTED: "En négociation",
  WON: "Converti",
  LOST: "Perdu",
};

const LEAD_STATUS_COLORS: Record<string, string> = {
  NEW: "bg-muted text-muted-foreground",
  CONTACTED: "bg-primary/10 text-primary",
  QUALIFIED: "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-100",
  QUOTED: "bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-100",
  WON: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-100",
  LOST: "bg-destructive/10 text-destructive",
};

export default async function CRMIntelligencePage() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  const [contactTypes, pipelineResult, leadsResult, intelligenceResult, contactsResult, membersResult, pipelinesResult, weightsResult] = await Promise.all([
    getContactTypeCount(),
    getLeadPipeline(),
    getLeads({}),
    getCRMDashboardIntelligence(session.user.tenantId),
    getContacts({ limit: 200 }),
    getTeamMembers("crm"),
    getPipelines(),
    getLeadScoringWeights(),
  ]);

  const types = contactTypes.data || {};
  const pipeline = pipelineResult.data || [];
  const leads = leadsResult.data || [];
  const intelligence = intelligenceResult.data;
  const contacts = (contactsResult.data ?? []).map((c: any) => ({
    id: c.id,
    name: c.name as string,
    company: (c.company ?? null) as string | null,
  }));
  const teamMembers = (membersResult.data ?? []) as { id: string; name: string | null; email: string }[];
  const crmPipelines = (pipelinesResult.data ?? []) as any[];
  const leadScoringWeights = weightsResult.data;

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
            Customer Intelligence
          </h1>
          <p className="text-muted-foreground">
            Analyse financière, risques, pipeline et stratégies clients
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GlobalIntentDialog contacts={contacts} />
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90" asChild>
            <Link href="/contacts/new">Nouveau contact</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/crm/leads/new">Nouveau lead</Link>
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
            <Link href="/contacts?type=CLIENT" className="text-xs text-primary hover:underline">
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

      {/* 4 Tabs — fusion intelligente */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4 border border-border/80 bg-card shadow-sm">
          <TabsTrigger value="overview" className="data-[state=active]:bg-accent/10 data-[state=active]:text-primary">
            Vue Globale
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="data-[state=active]:bg-accent/10 data-[state=active]:text-primary">
            Pipeline & Kanban
          </TabsTrigger>
          <TabsTrigger value="risks" className="data-[state=active]:bg-accent/10 data-[state=active]:text-primary">
            Risques & Scoring
          </TabsTrigger>
          <TabsTrigger value="segments" className="data-[state=active]:bg-accent/10 data-[state=active]:text-primary">
            <GitBranch className="h-3.5 w-3.5 mr-1.5" />
            Segmentation
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab 1 : Vue Globale (Contributeurs + Inactifs) ─── */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top Contributors */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-accent" />
                  Top Contributeurs au Cashflow
                </CardTitle>
              </CardHeader>
              <CardContent>
                {intelligence?.topContributors && intelligence.topContributors.length > 0 ? (
                  <div className="space-y-4">
                    {intelligence.topContributors.slice(0, 5).map((contributor, idx) => (
                      <div key={contributor.contactId} className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold text-muted-foreground">#{idx + 1}</span>
                              <Link
                                href={`/contacts/${contributor.contactId}`}
                                className="font-medium text-primary hover:underline"
                              >
                                {contributor.contact.name}
                              </Link>
                            </div>
                            <p className="text-xs text-muted-foreground">{contributor.contact.company || "—"}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{formatCurrency(Number(contributor.lifetimeGrossRevenue), "XAF")}</p>
                            <p className="text-xs text-muted-foreground">Marge: {Number(contributor.averageMarginPercent).toFixed(1)}%</p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Contribution</span>
                            <span className="font-medium">{Number(contributor.contributionScore).toFixed(0)}/100</span>
                          </div>
                          <Progress value={Number(contributor.contributionScore)} className="h-1.5" />
                        </div>
                        <Separator />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8 text-sm">Aucune donnée disponible</p>
                )}
              </CardContent>
            </Card>

            {/* Clients Inactifs */}
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
                        className="flex items-center justify-between border rounded-lg p-3 hover:bg-accent/50 transition-colors"
                      >
                        <div>
                          <Link
                            href={`/contacts/${segmentation.contactId}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {segmentation.contact.name}
                          </Link>
                          <p className="text-xs text-muted-foreground">{segmentation.contact.company || "—"}</p>
                        </div>
                        <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20">
                          À relancer
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <TrendingUp className="h-10 w-10 text-emerald-500 mb-3 opacity-60" />
                    <p className="text-sm font-medium text-emerald-600">Tous les clients sont actifs</p>
                    <p className="text-xs text-muted-foreground mt-1">Aucun client inactif depuis 90 jours</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Tab 2 : Pipeline & Kanban ─── */}
        <TabsContent value="pipeline" className="space-y-6">
          {/* Pipeline Stats */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Répartition du Pipeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pipeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun lead</p>
                ) : (
                  pipeline.map((item) => (
                    <div key={item.status} className="flex items-center justify-between">
                      <Badge className={LEAD_STATUS_COLORS[item.status] || ""}>
                        {LEAD_STATUS_LABELS[item.status] || item.status}
                      </Badge>
                      <div className="text-right">
                        <span className="text-sm font-medium">{item.count} leads</span>
                        {item.totalValue > 0 && (
                          <p className="text-xs text-muted-foreground">{formatCurrency(item.totalValue, "XAF")}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Leads récents</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/crm/leads">Tous les leads</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {leads.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun lead récent</p>
                ) : (
                  <div className="space-y-2">
                    {leads.slice(0, 5).map((lead) => (
                      <Link
                        key={lead.id}
                        href={`/crm/leads/${lead.id}`}
                        className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium">{lead.contact.name}</p>
                          <p className="text-xs text-muted-foreground">{lead.description || lead.source || "—"}</p>
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

          {/* Kanban */}
          {leads.length > 0 ? (
            <LeadsKanban
              teamMembers={teamMembers}
              leads={leads.map((l: any) => ({
                id: l.id,
                status: l.status,
                description: l.description,
                source: l.source,
                estimatedValue: l.estimatedValue ? String(l.estimatedValue) : null,
                currency: l.currency,
                category: l.category,
                assignedTo: l.assignedTo ?? null,
                contact: l.contact,
              }))}
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p className="text-sm">Créez votre premier lead pour utiliser le Kanban</p>
                <Button asChild size="sm" className="mt-4">
                  <Link href="/crm/leads/new">Nouveau lead</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── Tab 3 : Risques & Scoring ─── */}
        <TabsContent value="risks" className="space-y-6">
          {/* High Risk Clients */}
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
                            className="font-medium text-primary hover:underline"
                          >
                            {client.contact.name}
                          </Link>
                          <p className="text-sm text-muted-foreground">{client.contact.company || "—"}</p>
                        </div>
                        <Badge variant="destructive">Risque: {client.globalRiskScore}/100</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Cash exposé</p>
                          <p className="font-bold text-destructive">
                            {formatCurrency(Number(client.cashExposure), "XAF")}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Risques</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(client.riskBadges as string[]).map((badge) => (
                              <Badge key={badge} variant="outline" className="text-xs">{badge}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Award className="h-10 w-10 text-emerald-500 mb-3 opacity-60" />
                  <p className="text-sm font-medium text-emerald-600">Aucun client à risque élevé</p>
                  <p className="text-xs text-muted-foreground mt-1">Votre portefeuille est en bonne santé</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scoring Rules */}
          {leadScoringWeights ? (
            <LeadScoringRulesEditor initial={leadScoringWeights as any} />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Aucun paramètre de scoring configuré.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── Tab 4 : Segmentation & Pipelines ─── */}
        <TabsContent value="segments" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader><CardTitle>Répartition par Type</CardTitle></CardHeader>
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

            <Card className="md:col-span-2">
              <CardHeader><CardTitle>Comptes Stratégiques</CardTitle></CardHeader>
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
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600">
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

          <Separator />

          {/* Multi-Pipeline Manager */}
          <PipelineManager pipelines={crmPipelines} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
