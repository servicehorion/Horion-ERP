import type React from "react";
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  Tag,
  User,
  Users,
  Building,
  Phone,
  Mail,
  MessageSquare,
  AlertTriangle,
  Clock,
  CheckCircle2,
  BarChart2,
  Video,
  MapPin,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getLeadById, validateLead, getContactTimeline } from "@/lib/actions/contact.actions";
import { getTeamMembers } from "@/lib/actions/task.actions";
import {
  getCustomFieldsSchema,
  getLeadNurturing,
  getMeetings,
  createQuoteFromLead,
} from "@/lib/actions/crm-advanced.actions";
import { formatCurrency } from "@/config/currencies";
import { formatDate, serializeDecimals } from "@/lib/utils";
import { LeadStatusSelect } from "@/components/crm/lead-status-select";
import { LeadAssigneeSelect } from "@/components/crm/lead-assignee-select";
import LeadNbaPanel from "@/components/crm/lead-nba-panel";
import LeadCustomFields from "@/components/crm/lead-custom-fields";
import { CallLogDialog } from "@/components/crm/call-log-dialog";
import { LeadWinProbabilityEditor } from "@/components/crm/lead-win-probability";
import { ContactTimeline } from "@/components/crm/contact-timeline";
import { LeadTaskDialog } from "@/components/crm/lead-task-dialog";

export const metadata = {
  title: "Détail Lead | Horion ERP",
};

const LEAD_STATUS_COLORS: Record<string, string> = {
  NEW: "bg-gray-100 text-gray-800",
  CONTACTED: "bg-blue-100 text-blue-800",
  QUALIFIED: "bg-indigo-100 text-indigo-800",
  QUOTED: "bg-yellow-100 text-yellow-800",
  WON: "bg-green-100 text-green-800",
  LOST: "bg-red-100 text-red-800",
};

const LEAD_STATUS_LABELS: Record<string, string> = {
  NEW: "Nouveau",
  CONTACTED: "Contacté",
  QUALIFIED: "Qualifié",
  QUOTED: "Devis envoyé",
  WON: "Gagné",
  LOST: "Perdu",
};

const TYPE_LABELS: Record<string, string> = {
  CLIENT: "Client",
  PROSPECT: "Prospect",
  SUPPLIER: "Fournisseur",
  FREIGHT_PARTNER: "Transitaire",
  CUSTOMS_BROKER: "Douanier",
  QC_PARTNER: "QC",
  OTHER: "Autre",
};

const MEETING_TYPE_ICONS: Record<string, React.ReactNode> = {
  CALL: <Phone className="h-3 w-3" />,
  VIDEO: <Video className="h-3 w-3" />,
  IN_PERSON: <MapPin className="h-3 w-3" />,
};

const MEETING_TYPE_COLORS: Record<string, string> = {
  CALL: "bg-blue-100 text-blue-800",
  VIDEO: "bg-violet-100 text-violet-800",
  IN_PERSON: "bg-green-100 text-green-800",
};

function SlaBadge({ slaStatus }: { slaStatus: string | null }) {
  if (!slaStatus) return null;
  if (slaStatus === "BREACH")
    return (
      <Badge className="bg-red-100 text-red-800">
        <AlertTriangle className="h-3 w-3 mr-1" />
        SLA Dépassé
      </Badge>
    );
  if (slaStatus === "WARNING")
    return (
      <Badge className="bg-orange-100 text-orange-800">
        <Clock className="h-3 w-3 mr-1" />
        SLA Critique
      </Badge>
    );
  return (
    <Badge className="bg-green-100 text-green-800">
      <CheckCircle2 className="h-3 w-3 mr-1" />
      SLA OK
    </Badge>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70
      ? "bg-green-100 text-green-800"
      : score >= 40
      ? "bg-amber-100 text-amber-800"
      : "bg-red-100 text-red-800";
  return (
    <Badge className={color}>
      <BarChart2 className="h-3 w-3 mr-1" />
      Score {score}%
    </Badge>
  );
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [result, membersResult, customFieldsResult, nurturingResult, meetingsResult] =
    await Promise.all([
      getLeadById(id),
      getTeamMembers("crm"),
      getCustomFieldsSchema(),
      getLeadNurturing(id),
      getMeetings({ leadId: id }),
    ]);

  if (result.error || !result.data) {
    notFound();
  }

  const lead = serializeDecimals(result.data) as any;
  const contact = lead.contact;
  const teamMembers = membersResult.data || [];
  const ownerName = lead.owner?.name || lead.owner?.email;
  const onboardedName = lead.onboardedBy?.name || lead.onboardedBy?.email;
  const collaboratorNames = Array.isArray(lead.collaborators)
    ? lead.collaborators
        .map((c: any) => c.user?.name || c.user?.email || c.userId)
        .filter(Boolean)
    : [];

  const customFieldSchema = customFieldsResult.lead ?? [];
  const customFieldValues = (lead.customFields as Record<string, unknown>) ?? {};
  const nurturingEnrollments = nurturingResult.data ?? [];
  const leadMeetings = (meetingsResult.data ?? []) as any[];
  const timelineResult = await getContactTimeline(contact.id, 120);
  const timelineItems = (timelineResult.data ?? []) as any[];

  const upcomingMeetings = leadMeetings
    .filter((m: any) => m.status === "SCHEDULED" && new Date(m.startAt) >= new Date())
    .sort((a: any, b: any) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, 3);

  const slaStatus = lead.slaStatus as string | null;
  const score = Number(lead.score ?? 0);
  const daysSince = Math.floor(
    (Date.now() - new Date(lead.createdAt).getTime()) / 86400000
  );
  const salesTeamName = lead.salesTeam?.name || "Equipe: -";
  const territoryName = lead.territory?.name || "Territoire: -";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/crm">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-3xl font-bold">Lead</h1>
              <Badge className={LEAD_STATUS_COLORS[lead.status] || ""}>
                {LEAD_STATUS_LABELS[lead.status] || lead.status}
              </Badge>
              <ScoreBadge score={score} />
              <SlaBadge slaStatus={slaStatus} />
              <Badge variant="outline">{salesTeamName}</Badge>
              <Badge variant="outline">{territoryName}</Badge>
            </div>
            <p className="text-muted-foreground">
              {lead.description || lead.source || "Sans description"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <form
            action={async () => {
              "use server";
              await createQuoteFromLead(lead.id);
            }}
          >
            <Button variant="default" size="sm" type="submit" disabled={!lead.estimatedValue}>
              Creer devis
            </Button>
          </form>
          {["NEW", "CONTACTED"].includes(lead.status) && (
            <form
              action={async () => {
                "use server";
                await validateLead(lead.id);
              }}
            >
              <Button variant="outline" size="sm" type="submit">
                Valider lead
              </Button>
            </form>
          )}
          <LeadStatusSelect leadId={lead.id} currentStatus={lead.status} />
          <LeadAssigneeSelect
            leadId={lead.id}
            currentAssignee={lead.assignedTo}
            teamMembers={teamMembers}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main — Tabbed */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="details" className="space-y-4">
            <TabsList>
              <TabsTrigger value="details">Détails</TabsTrigger>
              <TabsTrigger value="fields">
                Champs
                {customFieldSchema.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                    {customFieldSchema.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="nurturing">
                Nurturing
                {nurturingEnrollments.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                    {nurturingEnrollments.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="timeline">
                Timeline
                {timelineItems.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                    {timelineItems.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ── Détails ── */}
            <TabsContent value="details" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Détails du lead</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {lead.description && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Description</p>
                      <p className="mt-1">{lead.description}</p>
                    </div>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <LeadWinProbabilityEditor leadId={lead.id} value={Number(lead.winProbability ?? 0)} />
                    {lead.estimatedValue && (
                      <div className="flex items-start gap-3">
                        <DollarSign className="h-4 w-4 mt-0.5 text-green-600" />
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Valeur estimée</p>
                          <p className="font-bold text-lg">
                            {formatCurrency(Number(lead.estimatedValue), lead.currency)}
                          </p>
                        </div>
                      </div>
                    )}
                    {lead.source && (
                      <div className="flex items-start gap-3">
                        <Tag className="h-4 w-4 mt-0.5 text-blue-600" />
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Source</p>
                          <p>{lead.source}</p>
                        </div>
                      </div>
                    )}
                    {lead.category && (
                      <div className="flex items-start gap-3">
                        <Tag className="h-4 w-4 mt-0.5 text-purple-600" />
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Catégorie</p>
                          <p>{lead.category}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Créé le</p>
                        <p>{formatDate(lead.createdAt, true)}</p>
                        <p className="text-xs text-muted-foreground">{daysSince}j depuis création</p>
                      </div>
                    </div>
                    {lead.slaDeadline && (
                      <div className="flex items-start gap-3">
                        <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Deadline SLA</p>
                          <p>{formatDate(lead.slaDeadline, true)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Pipeline Progress */}
              <Card>
                <CardHeader>
                  <CardTitle>Progression pipeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-1">
                    {["NEW", "CONTACTED", "QUALIFIED", "QUOTED", "WON"].map((status) => {
                      const statusOrder = ["NEW", "CONTACTED", "QUALIFIED", "QUOTED", "WON", "LOST"];
                      const currentIdx = statusOrder.indexOf(lead.status);
                      const thisIdx = statusOrder.indexOf(status);
                      const isActive = lead.status !== "LOST" && thisIdx <= currentIdx;
                      const isLost = lead.status === "LOST";
                      return (
                        <div key={status} className="flex-1">
                          <div
                            className={`h-2 rounded-full ${
                              isLost
                                ? "bg-red-200"
                                : isActive
                                ? "bg-primary"
                                : "bg-muted"
                            }`}
                          />
                          <p
                            className={`text-xs mt-1 text-center ${
                              isActive && !isLost ? "text-primary font-medium" : "text-muted-foreground"
                            }`}
                          >
                            {LEAD_STATUS_LABELS[status]}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  {lead.status === "LOST" && (
                    <div className="mt-3 rounded-lg bg-red-50 dark:bg-red-950/20 p-3 text-center">
                      <Badge variant="destructive">Lead perdu</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Champs personnalisés ── */}
            <TabsContent value="fields">
              <Card>
                <CardHeader>
                  <CardTitle>Champs personnalisés</CardTitle>
                </CardHeader>
                <CardContent>
                  <LeadCustomFields
                    leadId={lead.id}
                    schema={customFieldSchema}
                    values={customFieldValues}
                    canAdmin={true}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Nurturing ── */}
            <TabsContent value="nurturing">
              <Card>
                <CardHeader>
                  <CardTitle>Séquences de nurturing</CardTitle>
                </CardHeader>
                <CardContent>
                  {nurturingEnrollments.length === 0 ? (
                    <div className="text-center py-8 space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Ce lead n&apos;est inscrit dans aucune séquence.
                      </p>
                      <Button size="sm" variant="outline" asChild>
                        <Link href="/crm/intelligence">
                          <Plus className="h-3.5 w-3.5 mr-1.5" />
                          Créer une séquence
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {nurturingEnrollments.map((enrollment: any) => {
                        const seq = enrollment.sequence;
                        const steps = seq?.steps ?? [];
                        const currentStep = enrollment.currentStep;
                        const isCompleted = enrollment.status === "COMPLETED";
                        const isCancelled = enrollment.status === "CANCELLED";
                        return (
                          <div key={enrollment.id} className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-sm">{seq?.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {isCompleted
                                    ? "Terminée"
                                    : isCancelled
                                    ? "Annulée"
                                    : `Étape ${currentStep + 1} / ${steps.length}`}
                                </p>
                              </div>
                              <Badge
                                className={
                                  isCompleted
                                    ? "bg-green-100 text-green-800"
                                    : isCancelled
                                    ? "bg-slate-100 text-slate-600"
                                    : "bg-blue-100 text-blue-800"
                                }
                              >
                                {enrollment.status}
                              </Badge>
                            </div>
                            {steps.length > 0 && (
                              <div className="space-y-1">
                                {steps.map((step: any, i: number) => {
                                  const done = i < currentStep;
                                  const active = i === currentStep && !isCompleted && !isCancelled;
                                  return (
                                    <div
                                      key={step.id}
                                      className={`flex items-center gap-2 text-xs ${
                                        done
                                          ? "text-muted-foreground line-through"
                                          : active
                                          ? "text-foreground font-medium"
                                          : "text-muted-foreground"
                                      }`}
                                    >
                                      <div
                                        className={`h-2 w-2 rounded-full shrink-0 ${
                                          done
                                            ? "bg-green-400"
                                            : active
                                            ? "bg-blue-500"
                                            : "bg-muted-foreground/30"
                                        }`}
                                      />
                                      J+{step.delayDays} · {step.channel} ·{" "}
                                      {step.subject || step.body.slice(0, 40)}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {enrollment.nextStepAt && !isCompleted && !isCancelled && (
                              <p className="text-xs text-muted-foreground">
                                Prochaine étape : {formatDate(enrollment.nextStepAt, true)}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Timeline ── */}
            <TabsContent value="timeline">
              <Card>
                <CardHeader>
                  <CardTitle>Timeline client</CardTitle>
                </CardHeader>
                <CardContent>
                  <ContactTimeline
                    contactId={contact.id}
                    items={timelineItems}
                    contactEmail={contact.email}
                    contactPhone={contact.phone}
                    contactName={contact.name}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Contact card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Contact associé
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Link
                  href={`/contacts/${contact.id}`}
                  className="text-lg font-medium text-primary hover:underline"
                >
                  {contact.name}
                </Link>
                <Badge variant="secondary" className="ml-2 text-xs">
                  {TYPE_LABELS[contact.type] || contact.type}
                </Badge>
              </div>
              <Separator />
              <div className="space-y-3">
                {contact.company && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{contact.company}</span>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{contact.phone}</span>
                  </div>
                )}
                {contact.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{contact.email}</span>
                  </div>
                )}
                {contact.whatsapp && (
                  <div className="flex items-center gap-2 text-sm">
                    <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{contact.whatsapp}</span>
                  </div>
                )}
              </div>
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link href={`/contacts/${contact.id}`}>Voir fiche complète</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Équipe */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Équipe CRM</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {ownerName && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Owner: {ownerName}
                </div>
              )}
              {onboardedName && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Onboardé par: {onboardedName}
                </div>
              )}
              {collaboratorNames.length > 0 && (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  {collaboratorNames.join(", ")}
                </div>
              )}
              {!ownerName && !onboardedName && collaboratorNames.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucune information d&apos;équipe</p>
              )}
            </CardContent>
          </Card>

          {/* NBA Panel */}
          <LeadNbaPanel
            leadId={lead.id}
            status={lead.status}
            score={score}
            estimatedValue={lead.estimatedValue ? Number(lead.estimatedValue) : null}
            contactName={contact.name}
            createdAt={lead.createdAt}
            source={lead.source}
          />

          {/* Upcoming Meetings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Prochains RDV
                </span>
                <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
                  <Link href="/crm/calendar">
                    <Plus className="h-3 w-3 mr-1" />
                    Planifier
                  </Link>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingMeetings.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">Aucun RDV à venir</p>
              ) : (
                <div className="space-y-2">
                  {upcomingMeetings.map((m: any) => {
                    const start = new Date(m.startAt);
                    return (
                      <div key={m.id} className="flex items-start gap-2 text-xs">
                        <span
                          className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 ${
                            MEETING_TYPE_COLORS[m.type] ?? "bg-slate-100 text-slate-800"
                          }`}
                        >
                          {MEETING_TYPE_ICONS[m.type as keyof typeof MEETING_TYPE_ICONS]}
                        </span>
                        <div>
                          <p className="font-medium">{m.title}</p>
                          <p className="text-muted-foreground">
                            {start.toLocaleDateString("fr-FR", {
                              day: "numeric",
                              month: "short",
                            })}{" "}
                            {start.toLocaleTimeString("fr-FR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Actions rapides</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <CallLogDialog
                contactId={contact.id}
                defaultPhone={contact.phone || contact.whatsapp}
              />
              <LeadTaskDialog
                leadId={lead.id}
                teamMembers={teamMembers}
                defaultAssigneeId={lead.assignedTo || lead.ownerId}
              />
              <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                <Link href={`/orders/new?contactId=${contact.id}`}>
                  Créer une commande
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                <Link href={`/contacts/${contact.id}/edit`}>
                  Modifier le contact
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}




