import { ArrowLeft, Phone, Mail, MessageCircle, MapPin, RefreshCw, TrendingUp, AlertTriangle, Calendar, Clock, Download, Edit, User, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { CustomerFinancialPanel } from "@/components/crm/customer-financial-panel";
import { CustomerRiskMeter } from "@/components/crm/customer-risk-meter";
import { CustomerPipelinePanel } from "@/components/crm/customer-pipeline-panel";
import { CustomerAIBrain } from "@/components/crm/customer-ai-brain";
import { SegmentManager } from "@/components/crm/segment-manager";
import { ContactTimeline } from "@/components/crm/contact-timeline";
import { getCustomerIntelligence, recalculateCustomerIntelligence } from "@/lib/actions/customer-intelligence.actions";
import { getContactTimeline } from "@/lib/actions/contact.actions";
import { formatDate, serializeDecimals } from "@/lib/utils";
import { formatCurrency } from "@/config/currencies";

export const metadata = { title: "Customer Intelligence | Horion ERP" };

interface Props {
  params: Promise<{ id: string }>;
}

// Segment colors mapping
const SEGMENT_COLORS: Record<string, string> = {
  CASHFLOW_DRIVER: "bg-green-500/10 text-green-600 border-green-500/20",
  STRATEGIC_GROWTH: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  HIGH_RISK_HIGH_REWARD: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  LOW_MARGIN_VOLUME: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  TEST_CLIENT: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  ONE_TIME_BUYER: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  KEY_ACCOUNT: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  AT_RISK: "bg-red-500/10 text-red-600 border-red-500/20",
};

const SEGMENT_LABELS: Record<string, string> = {
  CASHFLOW_DRIVER: "Moteur Cashflow",
  STRATEGIC_GROWTH: "Croissance Stratégique",
  HIGH_RISK_HIGH_REWARD: "Risque-Rendement Élevé",
  LOW_MARGIN_VOLUME: "Volume Faible Marge",
  TEST_CLIENT: "Client Test",
  ONE_TIME_BUYER: "Achat Unique",
  KEY_ACCOUNT: "Compte Clé",
  AT_RISK: "À Risque",
};

export default async function ContactDetailPage({ params }: Props) {
  const { id } = await params;
  const [result, timelineResult] = await Promise.all([
    getCustomerIntelligence(id),
    getContactTimeline(id),
  ]);

  if (result.error || !result.data) notFound();

  const contact = serializeDecimals(result.data);
  const timelineItems = timelineResult.data || [];
  const { financialMetrics, riskProfile, pipelineIntents, aiProfile, segmentations, supplyChains } = contact;
  const ownerName = (contact as any).owner?.name || (contact as any).owner?.email;
  const onboardedName = (contact as any).onboardedBy?.name || (contact as any).onboardedBy?.email;
  const collaboratorNames = Array.isArray((contact as any).collaborators)
    ? (contact as any).collaborators
        .map((c: any) => c.user?.name || c.user?.email || c.userId)
        .filter(Boolean)
    : [];

  // Calculate quick stats
  const totalPipelineRevenue = pipelineIntents?.reduce(
    (sum, intent) => sum + Number(intent.expectedRevenue || 0),
    0
  ) || 0;

  const whatsappNumber = (contact.whatsapp || contact.phone || "").replace(/\D/g, "");
  const whatsappHref = whatsappNumber ? `https://wa.me/${whatsappNumber}` : undefined;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="-mx-6 -mt-6 border-b bg-white px-6 py-4 sticky top-0 z-20">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
              <Link href="/contacts">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-[#010150]">{contact.name}</h1>
                {riskProfile && riskProfile.globalRiskScore > 60 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Risque Élevé
                  </Badge>
                )}
                <Badge className="bg-[#DBA000] text-[#010150]">{contact.type}</Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-gray-600">
                {contact.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {contact.city}, {contact.country}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Client depuis {formatDate(contact.createdAt)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Dernier contact {formatDate(contact.updatedAt)}
                </span>
              </div>
              {contact.company && (
                <p className="text-sm text-muted-foreground mt-1">{contact.company}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <form
              action={async () => {
                "use server";
                await recalculateCustomerIntelligence(id);
              }}
            >
              <Button variant="outline" size="sm" type="submit">
                <RefreshCw className="h-4 w-4 mr-2" />
                Recalculer Intelligence
              </Button>
            </form>
            {whatsappHref && (
              <Button asChild size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                <a href={whatsappHref} target="_blank" rel="noreferrer">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  WhatsApp
                </a>
              </Button>
            )}
            {contact.email && (
              <Button asChild size="sm" variant="outline">
                <a href={`mailto:${contact.email}`}>
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </a>
              </Button>
            )}
            <Button asChild size="sm" variant="outline">
              <Link href={`/contacts/${contact.id}/edit`}>
                <Edit className="h-4 w-4 mr-2" />
                Editer
              </Link>
            </Button>
            <Button size="sm" className="bg-[#010150] text-white hover:bg-[#010150]/90">
              <Download className="h-4 w-4 mr-2" />
              Exporter
            </Button>
          </div>
        </div>
      </div>

      {/* Strategic Segments */}
      {segmentations && segmentations.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {segmentations.map((seg) => (
            <Badge
              key={seg.id}
              variant="outline"
              className={SEGMENT_COLORS[seg.segment] || ""}
            >
              {SEGMENT_LABELS[seg.segment] || seg.segment}
            </Badge>
          ))}
        </div>
      )}

      {(contact as any).tags && Array.isArray((contact as any).tags) && (contact as any).tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(contact as any).tags.map((tag: string) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              #{tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {financialMetrics
                ? formatCurrency(Number(financialMetrics.lifetimeGrossRevenue), "XAF")
                : "—"}
            </div>
            <p className="text-xs text-muted-foreground">Revenu total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {financialMetrics
                ? `${Number(financialMetrics.averageMarginPercent).toFixed(1)}%`
                : "—"}
            </div>
            <p className="text-xs text-muted-foreground">Marge moyenne</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold flex items-center gap-2">
              {riskProfile ? riskProfile.globalRiskScore : "—"}
              {riskProfile && riskProfile.globalRiskScore < 40 && (
                <TrendingUp className="h-4 w-4 text-green-500" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">Score de risque</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {formatCurrency(totalPipelineRevenue, "XAF")}
            </div>
            <p className="text-xs text-muted-foreground">Pipeline prévu</p>
          </CardContent>
        </Card>
      </div>

      <SegmentManager
        contactId={contact.id}
        currentSegments={(segmentations || []).map((s) => s.segment)}
        financialMetrics={financialMetrics as any}
        riskProfile={riskProfile as any}
      />

      <Separator />

      {/* Tabbed Intelligence Panels */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-8 border border-border/80 bg-card shadow-sm">
          <TabsTrigger className="text-xs sm:text-sm data-[state=active]:bg-accent/10 data-[state=active]:text-primary" value="overview">
            Vue d'ensemble
          </TabsTrigger>
          <TabsTrigger className="text-xs sm:text-sm data-[state=active]:bg-accent/10 data-[state=active]:text-primary" value="financial">
            Intelligence Financière
          </TabsTrigger>
          <TabsTrigger className="text-xs sm:text-sm data-[state=active]:bg-accent/10 data-[state=active]:text-primary" value="risk">
            Risque & Exposition
          </TabsTrigger>
          <TabsTrigger className="text-xs sm:text-sm data-[state=active]:bg-accent/10 data-[state=active]:text-primary" value="pipeline">
            Pipeline & Futur
          </TabsTrigger>
          <TabsTrigger className="text-xs sm:text-sm data-[state=active]:bg-accent/10 data-[state=active]:text-primary" value="ai">
            IA & Stratégie
          </TabsTrigger>
          <TabsTrigger className="text-xs sm:text-sm data-[state=active]:bg-accent/10 data-[state=active]:text-primary" value="supply">
            Supply Chain
          </TabsTrigger>
          <TabsTrigger className="text-xs sm:text-sm data-[state=active]:bg-accent/10 data-[state=active]:text-primary" value="timeline">
            Timeline
          </TabsTrigger>
          <TabsTrigger className="text-xs sm:text-sm data-[state=active]:bg-accent/10 data-[state=active]:text-primary" value="history">
            Historique
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Contact Info */}
            <Card>
              <CardHeader>
                <CardTitle>Coordonnées</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {contact.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {contact.phone}
                  </div>
                )}
                {contact.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {contact.email}
                  </div>
                )}
                {contact.whatsapp && (
                  <div className="flex items-center gap-2 text-sm">
                    <MessageCircle className="h-4 w-4 text-muted-foreground" />
                    {contact.whatsapp}
                  </div>
                )}
                  {contact.city && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      {contact.city}, {contact.country}
                    </div>
                  )}
                  {ownerName && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      Owner: {ownerName}
                    </div>
                  )}
                  {onboardedName && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      Onboardé par: {onboardedName}
                    </div>
                  )}
                  {collaboratorNames.length > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {collaboratorNames.join(", ")}
                    </div>
                  )}
                  <Separator />
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Score de confiance</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${contact.trustScore}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{contact.trustScore}/100</span>
                  </div>
                </div>
                {contact.notes && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs font-medium mb-1">Notes</p>
                      <p className="text-sm text-muted-foreground">{contact.notes}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Quick Summary */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Résumé Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Commandes totales</p>
                    <p className="text-2xl font-bold">{financialMetrics?.totalOrdersCount || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Dernière commande</p>
                    <p className="text-sm font-medium">
                      {financialMetrics?.lastOrderDate
                        ? formatDate(financialMetrics.lastOrderDate)
                        : "Jamais"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Panier moyen</p>
                    <p className="text-xl font-bold">
                      {financialMetrics
                        ? formatCurrency(Number(financialMetrics.avgOrderValue), "XAF")
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Contribution</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500"
                          style={{
                            width: `${
                              financialMetrics ? Number(financialMetrics.contributionScore) : 0
                            }%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium">
                        {financialMetrics
                          ? `${Number(financialMetrics.contributionScore).toFixed(0)}/100`
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Financial Intelligence Tab */}
        <TabsContent value="financial">
          {financialMetrics ? (
            <CustomerFinancialPanel financialMetrics={financialMetrics} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  Aucune donnée financière. Recalculez l'intelligence client.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Risk & Exposure Tab */}
        <TabsContent value="risk">
          {riskProfile ? (
            <CustomerRiskMeter riskProfile={riskProfile} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  Aucun profil de risque. Recalculez l'intelligence client.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Pipeline Tab */}
        <TabsContent value="pipeline">
          <CustomerPipelinePanel pipelineIntents={pipelineIntents || []} contactId={id} />
        </TabsContent>

        {/* AI Brain Tab */}
        <TabsContent value="ai">
          {aiProfile ? (
            <CustomerAIBrain aiProfile={aiProfile} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  Aucun profil IA. Recalculez l'intelligence client.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Supply Chain Tab */}
        <TabsContent value="supply">
          <Card>
            <CardHeader>
              <CardTitle>Chaîne d'approvisionnement client</CardTitle>
            </CardHeader>
            <CardContent>
              {supplyChains && supplyChains.length > 0 ? (
                <div className="space-y-4">
                  {supplyChains.map((sc) => (
                    <div key={sc.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{sc.supplier?.name || "Fournisseur inconnu"}</p>
                          <p className="text-sm text-muted-foreground">
                            {sc.supplier?.city || "—"} • {sc.route || "Route non spécifiée"}
                          </p>
                        </div>
                        <Badge variant="outline">
                          Score: {Number(sc.reliabilityScore).toFixed(0)}/100
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Commandes</p>
                          <p className="font-medium">{sc.ordersCount}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Retard moyen</p>
                          <p className="font-medium">
                            {sc.avgDelayDays ? `${Number(sc.avgDelayDays).toFixed(1)}j` : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Dernière utilisation</p>
                          <p className="font-medium">
                            {sc.lastUsedAt ? formatDate(sc.lastUsedAt) : "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Aucune donnée supply chain disponible
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline">
          <ContactTimeline contactId={contact.id} items={timelineItems as any} />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Historique des commandes ({contact.orders?.length || 0})</CardTitle>
              <Button size="sm" asChild>
                <Link href={`/orders/new?contactId=${contact.id}`}>Nouvelle commande</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {contact.orders && contact.orders.length > 0 ? (
                <div className="space-y-3">
                  {contact.orders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent transition-colors"
                    >
                      <div>
                        <Link
                          href={`/orders/${order.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {order.orderNumber}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(order.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-medium">
                            {formatCurrency(Number(order.totalClient), "XAF")}
                          </p>
                        </div>
                        <StatusBadge status={order.status} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">Aucune commande</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
