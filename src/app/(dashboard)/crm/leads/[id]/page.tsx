import { ArrowLeft, Calendar, DollarSign, Tag, User, Users, Building, Phone, Mail, MessageSquare } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getLeadById, validateLead } from "@/lib/actions/contact.actions";
import { getTeamMembers } from "@/lib/actions/task.actions";
import { formatCurrency } from "@/config/currencies";
import { formatDate, serializeDecimals } from "@/lib/utils";
import { LeadStatusSelect } from "@/components/crm/lead-status-select";
import { LeadAssigneeSelect } from "@/components/crm/lead-assignee-select";

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

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [result, membersResult] = await Promise.all([
    getLeadById(id),
    getTeamMembers("crm"),
  ]);

  if (result.error || !result.data) {
    notFound();
  }

  const lead = serializeDecimals(result.data);
  const contact = lead.contact;
  const teamMembers = membersResult.data || [];
  const ownerName = (lead as any).owner?.name || (lead as any).owner?.email;
  const onboardedName = (lead as any).onboardedBy?.name || (lead as any).onboardedBy?.email;
  const collaboratorNames = Array.isArray((lead as any).collaborators)
    ? (lead as any).collaborators
        .map((c: any) => c.user?.name || c.user?.email || c.userId)
        .filter(Boolean)
    : [];

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
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Lead</h1>
              <Badge className={LEAD_STATUS_COLORS[lead.status] || ""}>
                {LEAD_STATUS_LABELS[lead.status] || lead.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {lead.description || lead.source || "Sans description"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Lead Details */}
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
                  </div>
                </div>
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
                {["NEW", "CONTACTED", "QUALIFIED", "QUOTED", "WON"].map((status, idx) => {
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
                      <p className={`text-xs mt-1 text-center ${
                        isActive && !isLost ? "text-primary font-medium" : "text-muted-foreground"
                      }`}>
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
        </div>

        {/* Sidebar - Contact Info */}
        <div className="space-y-6">
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
                {contact.city && (
                  <p className="text-sm text-muted-foreground">
                    {contact.city}, {contact.country}
                  </p>
                )}
              </div>

              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link href={`/contacts/${contact.id}`}>
                  Voir fiche complète
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Equipe CRM</CardTitle>
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
                  OnboardÃƒÂ© par: {onboardedName}
                </div>
              )}
              {collaboratorNames.length > 0 && (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  {collaboratorNames.join(", ")}
                </div>
              )}
              {!ownerName && !onboardedName && collaboratorNames.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucune information d'Ã©quipe</p>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Actions rapides</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
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
