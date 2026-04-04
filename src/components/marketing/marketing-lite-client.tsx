"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowRight,
  BadgeDollarSign,
  BriefcaseBusiness,
  Mail,
  Megaphone,
  MessageCircle,
  Send,
  Sparkles,
  Target,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  createCampaign,
  createEmailCampaign,
  deleteCampaign,
  deleteEmailCampaign,
  saveBrandSettings,
  sendEmailCampaign,
  updateCampaignStatus,
  type AudienceData,
  type BrandSettings,
  type CampaignItem,
  type EmailCampaignItem,
} from "@/lib/actions/marketing.actions";

type Props = {
  audienceData: AudienceData;
  campaigns: CampaignItem[];
  brandSettings: BrandSettings;
  emailCampaigns: EmailCampaignItem[];
};

const CHANNEL_OPTIONS = ["WHATSAPP", "EMAIL", "FACEBOOK", "INSTAGRAM"] as const;

const CAMPAIGN_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  draft: { label: "Brouillon", className: "bg-slate-100 text-slate-700" },
  active: { label: "Active", className: "bg-emerald-100 text-emerald-700" },
  paused: { label: "En pause", className: "bg-amber-100 text-amber-700" },
  completed: { label: "Terminée", className: "bg-blue-100 text-blue-700" },
};

const EMAIL_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Brouillon", className: "bg-slate-100 text-slate-700" },
  SCHEDULED: { label: "Planifiée", className: "bg-blue-100 text-blue-700" },
  SENDING: { label: "En envoi", className: "bg-amber-100 text-amber-700" },
  SENT: { label: "Envoyée", className: "bg-emerald-100 text-emerald-700" },
  CANCELLED: { label: "Annulée", className: "bg-rose-100 text-rose-700" },
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XAF",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(date: Date | string | null | undefined) {
  if (!date) return "-";
  const parsed = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("fr-FR");
}

function toPlainTextHtml(content: string) {
  return content
    .split(/\n{2,}/)
    .map((chunk) => `<p style="margin:0 0 16px">${chunk.replace(/\n/g, "<br />")}</p>`)
    .join("");
}
function OverviewTab({
  audienceData,
  campaigns,
  emailCampaigns,
  brandSettings,
}: {
  audienceData: AudienceData;
  campaigns: CampaignItem[];
  emailCampaigns: EmailCampaignItem[];
  brandSettings: BrandSettings;
}) {
  const activeCampaigns = campaigns.filter((campaign) => campaign.status.toLowerCase() === "active").length;
  const emailDrafts = emailCampaigns.filter((campaign) => campaign.status === "DRAFT").length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Base audience",
            value: audienceData.contacts.total.toLocaleString("fr-FR"),
            hint: `${audienceData.contacts.prospects} prospects, ${audienceData.contacts.clients} clients`,
            icon: Users,
          },
          {
            label: "Pipeline leads",
            value: formatMoney(audienceData.leads.totalPipelineValue),
            hint: `${audienceData.leads.total} leads actifs`,
            icon: Target,
          },
          {
            label: "Campagnes en cours",
            value: activeCampaigns.toString(),
            hint: `${campaigns.length} campagnes suivies`,
            icon: Megaphone,
          },
          {
            label: "Emails en attente",
            value: emailDrafts.toString(),
            hint: `${emailCampaigns.length} campagnes email`,
            icon: Mail,
          },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="flex items-start justify-between p-4">
              <div className="space-y-1">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</div>
                <div className="text-2xl font-semibold">{item.value}</div>
                <div className="text-xs text-muted-foreground">{item.hint}</div>
              </div>
              <item.icon className="h-5 w-5 text-primary" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Focus Day 1</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-lg border bg-muted/30 p-3">
              Le Marketing Lite reste volontairement serre: audience, relances simples,
              email et message de marque minimum. Pour la conversion terrain, on continue de
              s&apos;appuyer d'abord sur WhatsApp OS et CRM OS.
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Link href="/whatsapp" className="rounded-lg border p-3 hover:bg-muted/40">
                <div className="font-medium">WhatsApp OS</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Repondre, relancer, convertir
                </div>
              </Link>
              <Link href="/crm" className="rounded-lg border p-3 hover:bg-muted/40">
                <div className="font-medium">CRM OS</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Qualifier, suivre, nourrir
                </div>
              </Link>
              <Link href="/tasks" className="rounded-lg border p-3 hover:bg-muted/40">
                <div className="font-medium">Task OS</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Relances, handoff, discipline
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Socle de marque</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="font-medium">{brandSettings.name}</div>
              <div className="text-muted-foreground">{brandSettings.tagline}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Ton</div>
              <div className="mt-1">{brandSettings.tone}</div>
            </div>
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Messages cles</div>
              <div className="flex flex-wrap gap-2">
                {brandSettings.keyMessages.slice(0, 4).map((message) => (
                  <Badge key={message} variant="outline" className="text-[11px]">
                    {message}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AudienceTab({ audienceData }: { audienceData: AudienceData }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contacts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Total</span>
              <strong>{audienceData.contacts.total.toLocaleString("fr-FR")}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Clients</span>
              <strong>{audienceData.contacts.clients.toLocaleString("fr-FR")}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Prospects</span>
              <strong>{audienceData.contacts.prospects.toLocaleString("fr-FR")}</strong>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leads</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Total</span>
              <strong>{audienceData.leads.total.toLocaleString("fr-FR")}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Conversion</span>
              <strong>{audienceData.leads.conversionRate}%</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Pipeline</span>
              <strong>{formatMoney(audienceData.leads.totalPipelineValue)}</strong>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Commandes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Total</span>
              <strong>{audienceData.orders.total.toLocaleString("fr-FR")}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Derniers 90 jours</span>
              <strong>{audienceData.orders.recent90d.toLocaleString("fr-FR")}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Valeur moyenne</span>
              <strong>{formatMoney(audienceData.orders.avgValue)}</strong>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top clients</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {audienceData.contacts.topClients.length === 0 ? (
              <div className="text-sm text-muted-foreground">Aucun client significatif pour le moment.</div>
            ) : (
              audienceData.contacts.topClients.slice(0, 6).map((client) => (
                <div key={client.id} className="flex items-center justify-between gap-4 text-sm">
                  <div>
                    <div className="font-medium">{client.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {client.company ?? "Sans societe"} - {client.orderCount} commandes
                    </div>
                  </div>
                  <div className="font-medium">{formatMoney(client.totalValue)}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leads recents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {audienceData.leads.recent.length === 0 ? (
              <div className="text-sm text-muted-foreground">Aucun lead recent.</div>
            ) : (
              audienceData.leads.recent.slice(0, 6).map((lead) => (
                <div key={lead.id} className="flex items-center justify-between gap-4 text-sm">
                  <div>
                    <div className="font-medium">{lead.contactName}</div>
                    <div className="text-xs text-muted-foreground">
                      {lead.status} - {lead.originCountry ?? "Origine non precise"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      {lead.estimatedValue ? formatMoney(lead.estimatedValue) : "-"}
                    </div>
                    <div className="text-xs text-muted-foreground">{formatDate(lead.createdAt)}</div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
function QuickBroadcastDialog({
  onCreated,
}: {
  onCreated: (campaign: CampaignItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("Reactivation");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [channels, setChannels] = useState<string[]>(["WHATSAPP"]);

  function toggleChannel(channel: string) {
    setChannels((current) =>
      current.includes(channel) ? current.filter((entry) => entry !== channel) : [...current, channel]
    );
  }

  function reset() {
    setName("");
    setObjective("Reactivation");
    setDescription("");
    setBudget("");
    setChannels(["WHATSAPP"]);
  }

  function handleCreate() {
    if (!name.trim() || !objective.trim() || channels.length === 0) {
      toast.error("Nom, objectif et canal minimum requis.");
      return;
    }

    startTransition(async () => {
      const response = await createCampaign({
        name,
        objective,
        description,
        channels,
        budget: budget ? Number(budget) : undefined,
      });

      if (response.error || !response.data) {
        toast.error(response.error ?? "Impossible de creer la campagne.");
        return;
      }

      toast.success("Campagne Lite créée.");
      onCreated(response.data);
      setOpen(false);
      reset();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Megaphone className="mr-1.5 h-4 w-4" />
          Nouveau broadcast
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Creer un broadcast simple</DialogTitle>
          <DialogDescription>
            Day 1: on garde une campagne legere, claire et exploitable. L&apos;execution WhatsApp reste dans WhatsApp OS.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="campaign-name">Nom</Label>
            <Input id="campaign-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="campaign-objective">Objectif</Label>
            <Input
              id="campaign-objective"
              value={objective}
              onChange={(event) => setObjective(event.target.value)}
              placeholder="Reactivation, annonce produit, preuve client..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="campaign-description">Message de cadrage</Label>
            <Textarea
              id="campaign-description"
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Quel est le message, pour qui, et quel resultat on attend ?"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="campaign-budget">Budget indicatif (optionnel)</Label>
            <Input
              id="campaign-budget"
              type="number"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              placeholder="150000"
            />
          </div>

          <div className="space-y-2">
            <Label>Canaux</Label>
            <div className="flex flex-wrap gap-2">
              {CHANNEL_OPTIONS.map((channel) => {
                const selected = channels.includes(channel);
                return (
                  <Button
                    key={channel}
                    type="button"
                    size="sm"
                    variant={selected ? "default" : "outline"}
                    onClick={() => toggleChannel(channel)}
                  >
                    {channel}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={handleCreate} disabled={pending}>
            Creer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BroadcastsTab({
  campaigns,
  onCreated,
  onUpdated,
  onDeleted,
}: {
  campaigns: CampaignItem[];
  onCreated: (campaign: CampaignItem) => void;
  onUpdated: (campaignId: string, status: string) => void;
  onDeleted: (campaignId: string) => void;
}) {
  const [pending, startTransition] = useTransition();

  async function handleStatus(campaignId: string, status: string) {
    startTransition(async () => {
      const response = await updateCampaignStatus(campaignId, status);
      if (response.error) {
        toast.error(response.error);
        return;
      }
      toast.success("Statut de campagne mis a jour.");
      onUpdated(campaignId, status);
    });
  }

  async function handleDelete(campaignId: string) {
    startTransition(async () => {
      const response = await deleteCampaign(campaignId);
      if (response.error) {
        toast.error(response.error);
        return;
      }
      toast.success("Campagne supprimee.");
      onDeleted(campaignId);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Broadcasts simples</div>
          <div className="text-xs text-muted-foreground">
            On garde ici le cadrage, le statut et le suivi. Pour l&apos;envoi WhatsApp reel, on bascule sur WhatsApp OS.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/whatsapp">
              Aller vers WhatsApp OS
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          <QuickBroadcastDialog onCreated={onCreated} />
        </div>
      </div>

      <div className="space-y-3">
        {campaigns.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Aucune campagne simple pour le moment.
            </CardContent>
          </Card>
        ) : (
          campaigns.map((campaign) => {
            const statusInfo =
              CAMPAIGN_STATUS_LABELS[campaign.status.toLowerCase()] ??
              { label: campaign.status, className: "bg-slate-100 text-slate-700" };

            return (
              <Card key={campaign.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{campaign.name}</div>
                        <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">{campaign.objective}</div>
                      {campaign.description ? (
                        <div className="text-sm text-muted-foreground">{campaign.description}</div>
                      ) : null}
                    </div>

                    <div className="text-right text-xs text-muted-foreground">
                      <div>Canaux: {campaign.channels.join(", ") || "-"}</div>
                      <div>Budget: {campaign.budget ? formatMoney(campaign.budget) : "-"}</div>
                      <div>Maj: {formatDate(campaign.updatedAt)}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending || campaign.status.toLowerCase() === "active"}
                      onClick={() => handleStatus(campaign.id, "active")}
                    >
                      Activer
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending || campaign.status.toLowerCase() === "paused"}
                      onClick={() => handleStatus(campaign.id, "paused")}
                    >
                      Pause
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending || campaign.status.toLowerCase() === "completed"}
                      onClick={() => handleStatus(campaign.id, "completed")}
                    >
                      Cloturer
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(campaign.id)}>
                      <Trash2 className="mr-1.5 h-4 w-4" />
                      Supprimer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
function QuickEmailDialog({
  onCreated,
  brandSettings,
}: {
  onCreated: (campaign: EmailCampaignItem) => void;
  brandSettings: BrandSettings;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [fromName, setFromName] = useState(brandSettings.name);
  const [body, setBody] = useState(
    `${brandSettings.tagline}\n\nBonjour,\n\nVoici notre mise a jour du moment.\n\n- Votre message principal\n- La preuve ou l'offre du moment\n- La prochaine action attendue`
  );

  function reset() {
    setName("");
    setSubject("");
    setFromName(brandSettings.name);
    setBody(
      `${brandSettings.tagline}\n\nBonjour,\n\nVoici notre mise a jour du moment.\n\n- Votre message principal\n- La preuve ou l'offre du moment\n- La prochaine action attendue`
    );
  }

  function handleCreate() {
    if (!name.trim() || !subject.trim() || !body.trim()) {
      toast.error("Nom, objet et contenu requis.");
      return;
    }

    startTransition(async () => {
      const response = await createEmailCampaign({
        name,
        subject,
        fromName,
        htmlContent: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px">${toPlainTextHtml(body)}</div>`,
        textContent: body,
      });

      if (response.error || !response.data) {
        toast.error(response.error ?? "Impossible de creer la campagne email.");
        return;
      }

      toast.success("Campagne email créée.");
      onCreated(response.data);
      setOpen(false);
      reset();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Mail className="mr-1.5 h-4 w-4" />
          Nouvelle campagne email
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Creer un email simple</DialogTitle>
          <DialogDescription>
            Objectif Day 1: envoyer vite un message propre et coherent, pas construire un studio complexe.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email-name">Nom</Label>
              <Input id="email-name" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-from">Expediteur</Label>
              <Input id="email-from" value={fromName} onChange={(event) => setFromName(event.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-subject">Objet</Label>
            <Input id="email-subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-body">Contenu</Label>
            <Textarea id="email-body" rows={10} value={body} onChange={(event) => setBody(event.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={handleCreate} disabled={pending}>
            Creer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmailTab({
  emailCampaigns,
  brandSettings,
  onCreated,
  onDeleted,
  onSent,
}: {
  emailCampaigns: EmailCampaignItem[];
  brandSettings: BrandSettings;
  onCreated: (campaign: EmailCampaignItem) => void;
  onDeleted: (campaignId: string) => void;
  onSent: (campaignId: string, sentAt: Date) => void;
}) {
  const [pending, startTransition] = useTransition();

  async function handleSend(campaignId: string) {
    startTransition(async () => {
      const response = await sendEmailCampaign(campaignId);
      if (response.error) {
        toast.error(response.error);
        return;
      }
      toast.success(`Campagne envoyee: ${response.data?.sent ?? 0} emails.`);
      onSent(campaignId, new Date());
    });
  }

  async function handleDelete(campaignId: string) {
    startTransition(async () => {
      const response = await deleteEmailCampaign(campaignId);
      if (response.error) {
        toast.error(response.error);
        return;
      }
      toast.success("Campagne email supprimee.");
      onDeleted(campaignId);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Email simple</div>
          <div className="text-xs text-muted-foreground">
            Messages propres, cadence legere, pas d&apos;usine a gaz de segmentation au Day 1.
          </div>
        </div>
        <QuickEmailDialog onCreated={onCreated} brandSettings={brandSettings} />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Mail className="h-5 w-5 text-primary" />
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Total</div>
              <div className="text-xl font-semibold">{emailCampaigns.length}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Send className="h-5 w-5 text-primary" />
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Envoyees</div>
              <div className="text-xl font-semibold">
                {emailCampaigns.filter((campaign) => campaign.status === "SENT").length}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Destinataires</div>
              <div className="text-xl font-semibold">
                {emailCampaigns.reduce((sum, campaign) => sum + campaign._count.recipients, 0)}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        {emailCampaigns.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Aucune campagne email pour le moment.
            </CardContent>
          </Card>
        ) : (
          emailCampaigns.map((campaign) => {
            const statusInfo =
              EMAIL_STATUS_LABELS[campaign.status] ??
              { label: campaign.status, className: "bg-slate-100 text-slate-700" };
            const stats = (campaign.stats ?? {}) as Record<string, number>;

            return (
              <Card key={campaign.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{campaign.name}</div>
                        <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">{campaign.subject}</div>
                      <div className="text-xs text-muted-foreground">
                        {campaign.fromName ?? brandSettings.name} - {campaign._count.recipients} destinataires
                      </div>
                    </div>

                    <div className="text-right text-xs text-muted-foreground">
                      <div>Creation: {formatDate(campaign.createdAt)}</div>
                      <div>Envoi: {formatDate(campaign.sentAt)}</div>
                      {campaign.status === "SENT" ? (
                        <div>
                          {stats.sent ?? 0} envoyes - {stats.errors ?? 0} erreurs
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {campaign.status === "DRAFT" ? (
                      <Button size="sm" disabled={pending} onClick={() => handleSend(campaign.id)}>
                        Envoyer
                      </Button>
                    ) : null}
                    {campaign.status !== "SENT" ? (
                      <Button size="sm" variant="ghost" disabled={pending} onClick={() => handleDelete(campaign.id)}>
                        <Trash2 className="mr-1.5 h-4 w-4" />
                        Supprimer
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
function BrandTab({
  initialSettings,
  onSaved,
}: {
  initialSettings: BrandSettings;
  onSaved: (settings: BrandSettings) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<BrandSettings>(initialSettings);

  function update<K extends keyof BrandSettings>(key: K, value: BrandSettings[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateLines(key: "keyMessages" | "dos" | "donts", value: string) {
    update(
      key,
      value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean) as BrandSettings[typeof key]
    );
  }

  function handleSave() {
    startTransition(async () => {
      const response = await saveBrandSettings(draft);
      if (response.error) {
        toast.error(response.error);
        return;
      }
      toast.success("Socle de marque mis a jour.");
      onSaved(draft);
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Marque minimum viable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="brand-name">Nom</Label>
            <Input
              id="brand-name"
              value={draft.name}
              onChange={(event) => update("name", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-tagline">Tagline</Label>
            <Input
              id="brand-tagline"
              value={draft.tagline}
              onChange={(event) => update("tagline", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-tone">Ton</Label>
            <Input
              id="brand-tone"
              value={draft.tone}
              onChange={(event) => update("tone", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-persona">Positionnement</Label>
            <Textarea
              id="brand-persona"
              rows={5}
              value={draft.persona}
              onChange={(event) => update("persona", event.target.value)}
            />
          </div>
          <Button onClick={handleSave} disabled={pending}>
            Sauvegarder
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Messages et garde-fous</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="brand-messages">Messages cles (une ligne = un message)</Label>
            <Textarea
              id="brand-messages"
              rows={5}
              value={draft.keyMessages.join("\n")}
              onChange={(event) => updateLines("keyMessages", event.target.value)}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="brand-dos">A faire</Label>
              <Textarea
                id="brand-dos"
                rows={6}
                value={draft.dos.join("\n")}
                onChange={(event) => updateLines("dos", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand-donts">A eviter</Label>
              <Textarea
                id="brand-donts"
                rows={6}
                value={draft.donts.join("\n")}
                onChange={(event) => updateLines("donts", event.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function MarketingLiteClient({
  audienceData,
  campaigns,
  brandSettings,
  emailCampaigns,
}: Props) {
  const [campaignState, setCampaignState] = useState(campaigns);
  const [emailState, setEmailState] = useState(emailCampaigns);
  const [brandState, setBrandState] = useState(brandSettings);

  const warmLeads = useMemo(
    () => audienceData.leads.recent.filter((lead) => ["NEW", "CONTACTED", "QUALIFIED"].includes(lead.status)).length,
    [audienceData]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-900 p-5 text-white">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-300" />
            <span className="text-sm font-medium text-emerald-100">Marketing OS Lite</span>
            <Badge className="bg-white/10 text-white">Day 1</Badge>
          </div>
          <h2 className="text-2xl font-semibold">Audience, relance et diffusion simple</h2>
          <p className="max-w-3xl text-sm text-slate-200">
            On garde ici le socle vraiment rentable maintenant: comprendre l&apos;audience,
            lancer des campagnes simples, envoyer des emails propres et garder une
            marque coherente avec le terrain WhatsApp-first.
          </p>
        </div>

        <div className="grid gap-2 text-sm">
          <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
            <Users className="h-4 w-4" />
            <span>{audienceData.contacts.total.toLocaleString("fr-FR")} contacts en base</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
            <BriefcaseBusiness className="h-4 w-4" />
            <span>{warmLeads} leads a travailler</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
            <BadgeDollarSign className="h-4 w-4" />
            <span>{formatMoney(audienceData.leads.totalPipelineValue)} de pipeline</span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
          <TabsTrigger value="overview">Vue</TabsTrigger>
          <TabsTrigger value="audience">Audience</TabsTrigger>
          <TabsTrigger value="broadcasts">Broadcasts</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="brand">Marque</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab
            audienceData={audienceData}
            campaigns={campaignState}
            emailCampaigns={emailState}
            brandSettings={brandState}
          />
        </TabsContent>

        <TabsContent value="audience">
          <AudienceTab audienceData={audienceData} />
        </TabsContent>

        <TabsContent value="broadcasts">
          <BroadcastsTab
            campaigns={campaignState}
            onCreated={(campaign) => setCampaignState((current) => [campaign, ...current])}
            onUpdated={(campaignId, status) =>
              setCampaignState((current) =>
                current.map((campaign) => (campaign.id === campaignId ? { ...campaign, status } : campaign))
              )
            }
            onDeleted={(campaignId) =>
              setCampaignState((current) => current.filter((campaign) => campaign.id !== campaignId))
            }
          />
        </TabsContent>

        <TabsContent value="email">
          <EmailTab
            emailCampaigns={emailState}
            brandSettings={brandState}
            onCreated={(campaign) => setEmailState((current) => [campaign, ...current])}
            onDeleted={(campaignId) =>
              setEmailState((current) => current.filter((campaign) => campaign.id !== campaignId))
            }
            onSent={(campaignId, sentAt) =>
              setEmailState((current) =>
                current.map((campaign) =>
                  campaign.id === campaignId
                    ? {
                        ...campaign,
                        status: "SENT",
                        sentAt,
                      }
                    : campaign
                )
              )
            }
          />
        </TabsContent>

        <TabsContent value="brand">
          <BrandTab
            initialSettings={brandState}
            onSaved={(settings) => setBrandState(settings)}
          />
        </TabsContent>
      </Tabs>

      <div className="rounded-xl border bg-muted/30 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm font-medium">Ce qu'on ne surinvestit pas maintenant</div>
            <div className="text-xs text-muted-foreground">
              Pas de studio complexe, pas d&apos;analytics lourdes, pas d'orchestration omnicanale.
              L'enjeu du moment reste la conversion, la relance et la diffusion propre.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/crm">Voir le CRM</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/whatsapp">
                Prioriser WhatsApp
                <MessageCircle className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

