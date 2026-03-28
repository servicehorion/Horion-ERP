"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MessageCircle,
  Inbox,
  Sparkles,
  Users,
  Megaphone,
  FileText,
  Settings,
  Zap,
  CalendarDays,
  Send,
  Link2,
  ShieldAlert,
  BriefcaseBusiness,
  PackageCheck,
  Clock3,
} from "lucide-react";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, formatDate } from "@/lib/utils";
import {
  addWhatsAppConversationTags,
  assignWhatsAppConversation,
  approveWhatsAppTemplateVersion,
  createDemandFromWhatsAppConversation,
  createWhatsAppCampaign,
  createWhatsAppConversationTask,
  createWhatsAppTemplate,
  addWhatsAppTemplateVersion,
  convertWhatsAppIntentToCrm,
  createWhatsAppBotFlow,
  createLeadFromWhatsAppConversation,
  ensureWhatsAppConversationContact,
  getWhatsAppConversationMessages,
  sendWhatsAppMessage,
  updateWhatsAppBotFlow,
  updateWhatsAppConversationStatus,
  updateWhatsAppIntentStatus,
} from "@/lib/actions/whatsapp.actions";
import { EmptyState } from "@/components/shared/empty-state";
import type {
  WhatsAppAccountItem,
  WhatsAppAssignableUserItem,
  WhatsAppCampaignItem,
  WhatsAppConversationItem,
  WhatsAppDashboardStats,
  WhatsAppGroupItem,
  WhatsAppIntentItem,
  WhatsAppMessageItem,
  WhatsAppTemplateItem,
  WhatsAppBotFlowItem,
} from "@/lib/types/whatsapp";

interface Props {
  stats: WhatsAppDashboardStats;
  conversations: WhatsAppConversationItem[];
  intents: WhatsAppIntentItem[];
  groups: WhatsAppGroupItem[];
  campaigns: WhatsAppCampaignItem[];
  templates: WhatsAppTemplateItem[];
  accounts: WhatsAppAccountItem[];
  botFlows: WhatsAppBotFlowItem[];
  assignableUsers: WhatsAppAssignableUserItem[];
  viewerId?: string;
}

const INTENT_STAGES = ["DETECTED", "QUALIFIED", "TRANSFERRED", "WON", "LOST"] as const;
const QUICK_QUALIFICATION_TAGS = [
  "prospect-chaud",
  "client-existant",
  "sourcing-requis",
  "simple-info",
  "sav",
  "paiement",
  "logistique",
  "litige",
] as const;

export function WhatsAppClient({
  stats,
  conversations,
  intents,
  groups,
  campaigns,
  templates,
  accounts,
  botFlows,
  assignableUsers,
  viewerId,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(() => searchParams.get("conversationId"));
  const [messages, setMessages] = useState<WhatsAppMessageItem[]>([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [templateDraft, setTemplateDraft] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [intentFilter, setIntentFilter] = useState("ALL");
  const [tagFilter, setTagFilter] = useState("");
  const [pending, startTransition] = useTransition();
  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) ?? null,
    [activeConversationId, conversations]
  );

  // 30s polling — revalidate server data automatically
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      router.refresh();
    }, 30_000);
    return () => clearInterval(interval);
  }, [router]);

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const term = search.trim().toLowerCase();
      const matchesSearch =
        !term ||
        c.contactName.toLowerCase().includes(term) ||
        (c.contactPhone ?? "").toLowerCase().includes(term) ||
        (c.lastMessage ?? "").toLowerCase().includes(term);
      const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
      const matchesIntent = intentFilter === "ALL" || c.intentScore === intentFilter;
      const matchesTag =
        !tagFilter.trim() ||
        (c.tags ?? []).some((t) => t.toLowerCase().includes(tagFilter.trim().toLowerCase()));
      return matchesSearch && matchesStatus && matchesIntent && matchesTag;
    });
  }, [conversations, search, statusFilter, intentFilter, tagFilter]);

  const openConversation = (conversation: WhatsAppConversationItem) => {
    setActiveConversationId(conversation.id);
    setTemplateDraft("");
  };

  useEffect(() => {
    if (!activeConversation?.id) {
      setMessages([]);
      return;
    }
    startTransition(async () => {
      const res = await getWhatsAppConversationMessages(activeConversation.id);
      if (res?.error) {
        toast.error(res.error);
      } else {
        setMessages(res.data ?? []);
      }
    });
  }, [activeConversation?.id]);


  return (
    <>
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="h-10 flex-wrap">
          <TabsTrigger value="overview" className="gap-1.5 text-xs sm:text-sm">
            <MessageCircle className="h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="inbox" className="gap-1.5 text-xs sm:text-sm">
            <Inbox className="h-3.5 w-3.5" />
            Inbox
          </TabsTrigger>
          <TabsTrigger value="intents" className="gap-1.5 text-xs sm:text-sm">
            <Zap className="h-3.5 w-3.5" />
            Intents
          </TabsTrigger>
          <TabsTrigger value="groups" className="gap-1.5 text-xs sm:text-sm">
            <Users className="h-3.5 w-3.5" />
            Groupes
          </TabsTrigger>
          <TabsTrigger value="broadcasts" className="gap-1.5 text-xs sm:text-sm">
            <Megaphone className="h-3.5 w-3.5" />
            Broadcasts
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5 text-xs sm:text-sm">
            <FileText className="h-3.5 w-3.5" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="automations" className="gap-1.5 text-xs sm:text-sm">
            <Sparkles className="h-3.5 w-3.5" />
            Automatisations
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5 text-xs sm:text-sm">
            <Settings className="h-3.5 w-3.5" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <WhatsAppOverview stats={stats} conversations={conversations} intents={intents} campaigns={campaigns} />
        </TabsContent>

        <TabsContent value="inbox">
          <div className="mb-2 flex items-center justify-end">
            <Button size="sm" variant="outline" onClick={() => router.refresh()}>
              Actualiser
            </Button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
            <WhatsAppInbox
              conversations={filteredConversations}
              onSelect={openConversation}
              activeId={activeConversation?.id ?? null}
              search={search}
              statusFilter={statusFilter}
              intentFilter={intentFilter}
              tagFilter={tagFilter}
              onSearchChange={setSearch}
              onStatusChange={setStatusFilter}
              onIntentChange={setIntentFilter}
              onTagChange={setTagFilter}
            />
            <div className="rounded-lg border bg-white p-4 min-h-[520px]">
              {!activeConversation ? (
                <EmptyState
                  title="Aucune conversation selectionnee"
                  description="Choisissez une conversation dans la colonne de gauche pour afficher le fil, le contexte CRM et les actions disponibles."
                />
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Contact WA</p>
                        <p className="text-base font-semibold">{activeConversation.contactName}</p>
                        <p className="text-xs text-muted-foreground">{activeConversation.contactPhone ?? "-"}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 text-right">
                        {activeConversation.linkedContactId ? (
                          <>
                            <Badge variant="default" className="text-xs">CRM lie</Badge>
                            <Link
                              href={`/contacts/${activeConversation.linkedContactId}`}
                              className="text-xs text-primary underline"
                            >
                              {activeConversation.linkedContactName ?? "Voir le contact"}
                            </Link>
                          </>
                        ) : (
                          <Badge variant="outline" className="text-xs">Aucun contact CRM</Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {activeConversation.linkedLeadId ? (
                        <>
                          <Badge variant="secondary" className="text-xs">Lead actif</Badge>
                          <Link
                            href={`/crm/leads/${activeConversation.linkedLeadId}`}
                            className="text-xs text-primary underline"
                          >
                            {activeConversation.linkedLeadStatus ?? "Voir le lead"}
                          </Link>
                        </>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          {activeConversation.linkedContactId ? "Aucun lead lie" : "Aucun lead ni contact CRM"}
                        </Badge>
                      )}
                      {activeConversation.linkedDemandId ? (
                        <Badge variant="secondary" className="text-xs">
                          Demande {activeConversation.linkedDemandStatus ?? "-"}
                        </Badge>
                      ) : null}
                      {activeConversation.latestOrderNumber ? (
                        <Badge variant="secondary" className="text-xs">
                          Cmd {activeConversation.latestOrderNumber} · {activeConversation.latestOrderStatus ?? "-"}
                        </Badge>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {!activeConversation.linkedContactId ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => {
                            startTransition(async () => {
                              const res = await ensureWhatsAppConversationContact(activeConversation.id);
                              if (res?.error) {
                                toast.error(res.error);
                                return;
                              }
                              toast.success(res.data?.created ? "Contact CRM cree et lie" : "Contact CRM lie");
                              router.refresh();
                            });
                          }}
                        >
                          <Link2 className="mr-1.5 h-3.5 w-3.5" />
                          Creer / lier contact
                        </Button>
                      ) : null}
                      {!activeConversation.linkedLeadId && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => {
                            startTransition(async () => {
                              const res = await createLeadFromWhatsAppConversation(activeConversation.id);
                              if (res?.error) {
                                toast.error(res.error);
                                return;
                              }
                              toast.success(
                                activeConversation.linkedContactId
                                  ? "Lead cree depuis la conversation"
                                  : "Contact CRM et lead crees depuis la conversation"
                              );
                              router.refresh();
                            });
                          }}
                        >
                          <BriefcaseBusiness className="mr-1.5 h-3.5 w-3.5" />
                          Creer lead
                        </Button>
                      )}
                      {!activeConversation.linkedDemandId ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => {
                            startTransition(async () => {
                              const res = await createDemandFromWhatsAppConversation(activeConversation.id);
                              if (res?.error) {
                                toast.error(res.error);
                                return;
                              }
                              toast.success(
                                res.data?.created
                                  ? "Demand Intake creee depuis la conversation"
                                  : "Demand Intake deja existante"
                              );
                              router.refresh();
                            });
                          }}
                        >
                          <PackageCheck className="mr-1.5 h-3.5 w-3.5" />
                          Creer demande
                        </Button>
                      ) : (
                        <Link
                          href="/crm/demands"
                          className="inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs font-medium hover:bg-muted"
                        >
                          Voir les demandes
                        </Link>
                      )}
                    </div>

                    {(activeConversation.latestOrderNumber || activeConversation.linkedDemandId) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        <div className="rounded-md border bg-white/70 p-2 space-y-1">
                          <div className="font-medium">Contexte commande</div>
                          {activeConversation.latestOrderNumber ? (
                            <>
                              <div>{activeConversation.latestOrderNumber}</div>
                              <div className="text-muted-foreground">
                                Statut {activeConversation.latestOrderStatus ?? "-"}
                                {activeConversation.latestPaymentStatus ? ` · Paiement ${activeConversation.latestPaymentStatus}` : ""}
                                {activeConversation.latestShipmentStatus ? ` · Shipment ${activeConversation.latestShipmentStatus}` : ""}
                              </div>
                            </>
                          ) : (
                            <div className="text-muted-foreground">Aucune commande reliee</div>
                          )}
                        </div>
                        <div className="rounded-md border bg-white/70 p-2 space-y-1">
                          <div className="font-medium">Contexte demande</div>
                          {activeConversation.linkedDemandId ? (
                            <>
                              <div>{activeConversation.linkedDemandId}</div>
                              <div className="text-muted-foreground">
                                {activeConversation.linkedDemandStatus ?? "-"}
                                {activeConversation.linkedDemandUrgency ? ` · Urgence ${activeConversation.linkedDemandUrgency}` : ""}
                              </div>
                            </>
                          ) : (
                            <div className="text-muted-foreground">Pas encore de demande structuree</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Statut</div>
                      <Select
                        value={activeConversation.status}
                        onValueChange={(value) => {
                          startTransition(async () => {
                            const res = await updateWhatsAppConversationStatus(activeConversation.id, value);
                            if (res?.error) toast.error(res.error);
                            else {
                              toast.success("Statut mis a jour");
                              router.refresh();
                            }
                          });
                        }}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="OPEN">OPEN</SelectItem>
                          <SelectItem value="PENDING">PENDING</SelectItem>
                          <SelectItem value="CLOSED">CLOSED</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Assignation</div>
                      <div className="space-y-2">
                        <Select
                          value={activeConversation.assignedToId ?? "none"}
                          onValueChange={(value) => {
                            if (value === "none") return;
                            startTransition(async () => {
                              const res = await assignWhatsAppConversation(activeConversation.id, value);
                              if (res?.error) toast.error(res.error);
                              else {
                                toast.success("Conversation assignee");
                                router.refresh();
                              }
                            });
                          }}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Choisir owner" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Non assignee</SelectItem>
                            {assignableUsers.map((entry) => (
                              <SelectItem key={entry.id} value={entry.id}>
                                {entry.name} · {entry.role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={async () => {
                            if (!activeConversation || !viewerId) {
                              toast.error("Assignee introuvable");
                              return;
                            }
                            startTransition(async () => {
                              const res = await assignWhatsAppConversation(activeConversation.id, viewerId);
                              if (res?.error) toast.error(res.error);
                              else {
                                toast.success("Conversation assignee");
                                router.refresh();
                              }
                            });
                          }}
                          className="h-8 w-full"
                        >
                          Assigner a moi
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-muted-foreground">
                    <div>
                      <div className="uppercase">Intent</div>
                      <div className="mt-1">
                        {activeConversation.intentScore ? (
                          <Badge variant="outline" className="text-xs">{activeConversation.intentScore}</Badge>
                        ) : (
                          "-"
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="uppercase">SLA</div>
                      <div className="mt-1 space-y-1">
                        <div>{activeConversation.slaDueAt ? formatDateSafe(activeConversation.slaDueAt) : "-"}</div>
                        {activeConversation.slaState && activeConversation.slaState !== "NO_SLA" ? (
                          <SlaBadge state={activeConversation.slaState} />
                        ) : null}
                      </div>
                    </div>
                    <div>
                      <div className="uppercase">Reponse</div>
                      <div className="mt-1">
                        {activeConversation.responseState ? <ResponseBadge state={activeConversation.responseState} /> : "-"}
                      </div>
                    </div>
                    <div>
                      <div className="uppercase">Owner</div>
                      <div className="mt-1">{activeConversation.assignedTo ?? activeConversation.ownerName ?? "-"}</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs uppercase text-muted-foreground">Tags</div>
                    <div className="flex flex-wrap gap-2">
                      {(activeConversation.tags ?? []).length === 0 && (
                        <span className="text-xs text-muted-foreground">Aucun tag</span>
                      )}
                      {(activeConversation.tags ?? []).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {QUICK_QUALIFICATION_TAGS.map((tag) => {
                        const alreadyTagged = (activeConversation.tags ?? []).includes(tag);
                        return (
                          <Button
                            key={tag}
                            size="sm"
                            variant={alreadyTagged ? "secondary" : "outline"}
                            className="h-7 text-[11px]"
                            disabled={pending || alreadyTagged}
                            onClick={() => {
                              startTransition(async () => {
                                const res = await addWhatsAppConversationTags(activeConversation.id, [tag]);
                              if (res?.error) {
                                toast.error(res.error);
                                return;
                              }
                                toast.success(`Tag ${tag} ajoute`);
                                router.refresh();
                              });
                            }}
                          >
                            {tag}
                          </Button>
                        );
                      })}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={tagDraft}
                        onChange={(e) => setTagDraft(e.target.value)}
                        placeholder="Ajouter tag (ex: urgent,vip)"
                        className="h-8"
                      />
                      <Button
                        size="sm"
                        disabled={pending || tagDraft.trim().length === 0}
                        onClick={() => {
                          const tags = tagDraft.split(",").map((t) => t.trim()).filter(Boolean);
                          if (!tags.length || !activeConversation) return;
                          startTransition(async () => {
                            const res = await addWhatsAppConversationTags(activeConversation.id, tags);
                            if (res?.error) toast.error(res.error);
                            else {
                              toast.success("Tags ajoutes");
                              setTagDraft("");
                              router.refresh();
                            }
                          });
                        }}
                      >
                        Ajouter
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-slate-50 p-3 text-xs space-y-2">
                    <div className="font-semibold text-slate-700">Copilote conversation</div>
                    <div className="text-muted-foreground">
                      {activeConversation.copilotSummary || "Aucun signal recent detecte."}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="text-xs">
                        Priorite {activeConversation.intentScore ?? "NORMAL"}
                      </Badge>
                      {activeConversation.responseState ? <ResponseBadge state={activeConversation.responseState} /> : null}
                      {activeConversation.slaState && activeConversation.slaState !== "NO_SLA" ? (
                        <SlaBadge state={activeConversation.slaState} />
                      ) : null}
                    </div>
                    <div className="text-muted-foreground">
                      Action suggeree: {activeConversation.copilotNextAction || "Qualifier le besoin et confirmer les prochaines etapes."}
                    </div>
                    {(activeConversation.copilotMissingFields ?? []).length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {(activeConversation.copilotMissingFields ?? []).map((field) => (
                          <Badge key={field} variant="outline" className="text-[11px]">
                            manque: {field}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px]"
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            const res = await createWhatsAppConversationTask(activeConversation.id, "followup");
                            if (res?.error) {
                              toast.error(res.error);
                              return;
                            }
                            toast.success("Tache de relance creee");
                            router.refresh();
                          });
                        }}
                      >
                        <Clock3 className="mr-1.5 h-3.5 w-3.5" />
                        Tache relance
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px]"
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            const kind = activeConversation.latestOrderNumber ? "logistics" : "missing_info";
                            const res = await createWhatsAppConversationTask(activeConversation.id, kind);
                            if (res?.error) {
                              toast.error(res.error);
                              return;
                            }
                            toast.success("Tache creee depuis la conversation");
                            router.refresh();
                          });
                        }}
                      >
                        <ShieldAlert className="mr-1.5 h-3.5 w-3.5" />
                        Handoff task
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs uppercase text-muted-foreground">Messages</div>
                    <div className="space-y-2 max-h-[320px] overflow-auto rounded border p-2">
                      {messages.length === 0 ? (
                        <div className="text-xs text-muted-foreground">Aucun message</div>
                      ) : (
                        messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={cn(
                              "rounded-lg px-3 py-2 text-sm",
                              msg.direction === "OUT"
                                ? "bg-emerald-50 border border-emerald-100 ml-auto"
                                : "bg-slate-100 border border-slate-200"
                            )}
                          >
                            <div className="whitespace-pre-wrap">{msg.body ?? "-"}</div>
                            {Array.isArray(msg.media) && msg.media.length > 0 ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {msg.media.map((media, index) => (
                                  <Badge key={`${msg.id}-media-${index}`} variant="outline" className="text-[11px]">
                                    {media.mimeType?.startsWith("image/")
                                      ? "Image"
                                      : media.mimeType?.startsWith("video/")
                                        ? "Video"
                                        : "Document"}
                                    {media.caption ? ` · ${media.caption}` : ""}
                                  </Badge>
                                ))}
                              </div>
                            ) : null}
                            <div className="text-[11px] text-muted-foreground mt-1">
                              {formatDateSafe(msg.createdAt)}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Textarea
                        value={messageDraft}
                        onChange={(e) => setMessageDraft(e.target.value)}
                        placeholder="Ecrire une reponse..."
                        className="min-h-[64px]"
                      />
                      <Button
                        disabled={pending || messageDraft.trim().length === 0}
                        onClick={() => {
                          if (!activeConversation) return;
                          startTransition(async () => {
                            const res = await sendWhatsAppMessage(activeConversation.id, messageDraft.trim());
                            if (res?.error) toast.error(res.error);
                            else {
                              toast.success("Message envoye");
                              setMessages((prev) => [
                                ...prev,
                                {
                                  id: `local-${Date.now()}`,
                                  direction: "OUT",
                                  body: messageDraft.trim(),
                                  createdAt: new Date().toISOString(),
                                },
                              ]);
                              setMessageDraft("");
                              router.refresh();
                            }
                          });
                        }}
                        className="h-10 px-4"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Select
                        value={templateDraft}
                        onValueChange={(value) => {
                          if (value === "none") {
                            setTemplateDraft("");
                            return;
                          }
                          const template = templates.find((item) => item.id === value);
                          setTemplateDraft(value);
                          setMessageDraft(template?.latestVersionBody || "");
                        }}
                      >
                        <SelectTrigger className="h-8 w-[220px]">
                          <SelectValue placeholder="Inserer template" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Aucun</SelectItem>
                          {templates.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setMessageDraft("")}
                      >
                        Effacer
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="intents">
          <WhatsAppIntents intents={intents} />
        </TabsContent>

        <TabsContent value="groups">
          <WhatsAppGroups groups={groups} />
        </TabsContent>

        <TabsContent value="broadcasts">
          <WhatsAppBroadcasts campaigns={campaigns} />
        </TabsContent>

        <TabsContent value="templates">
          <WhatsAppTemplates templates={templates} />
        </TabsContent>

        <TabsContent value="automations">
          <WhatsAppAutomations flows={botFlows} />
        </TabsContent>

        <TabsContent value="settings">
          <WhatsAppSettings accounts={accounts} />
        </TabsContent>
      </Tabs>

    </>
  );
}

function WhatsAppOverview({
  stats,
  conversations,
  intents,
  campaigns,
}: {
  stats: WhatsAppDashboardStats;
  conversations: WhatsAppConversationItem[];
  intents: WhatsAppIntentItem[];
  campaigns: WhatsAppCampaignItem[];
}) {
  const topConversations = conversations.slice(0, 5);
  const hotIntents = intents.filter((i) => ["HIGH", "URGENT"].includes(i.score)).slice(0, 4);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <KpiCard label="Convos ouvertes" value={stats.openConversations} color="emerald" />
        <KpiCard label="SLA en retard" value={stats.slaBreaches} color="red" urgent={stats.slaBreaches > 0} />
        <KpiCard label="Attendent reponse" value={stats.needsReply} color="orange" urgent={stats.needsReply > 0} />
        <KpiCard label="Messages jour" value={stats.messagesToday} color="blue" />
        <KpiCard label="Convos non liees" value={stats.unlinkedConversations} color="purple" urgent={stats.unlinkedConversations > 0} />
        <KpiCard label="Intents high" value={stats.highIntents} color="indigo" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Inbox className="h-4 w-4 text-emerald-500" />
              Conversations recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topConversations.length === 0 ? (
              <EmptyState label="Aucune conversation" />
            ) : (
              <div className="divide-y">
                {topConversations.map((c) => (
                  <div key={c.id} className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-sm truncate">{c.contactName}</div>
                      <StatusBadge status={c.status} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{c.lastMessage ?? "-"}</div>
                    <div className="flex items-center gap-2 mt-2">
                      {c.intentScore && <Badge variant="outline" className="text-xs">{c.intentScore}</Badge>}
                      {c.slaDueAt && (
                        <span className="text-xs text-muted-foreground">SLA {formatDateSafe(c.slaDueAt)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-orange-500" />
              Intents prioritaires
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {hotIntents.length === 0 ? (
              <EmptyState label="Aucun intent critique" />
            ) : (
              <div className="divide-y">
                {hotIntents.map((intent) => (
                  <div key={intent.id} className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-sm truncate">{intent.contactName}</div>
                      <Badge className="text-xs bg-orange-100 text-orange-700">{intent.score}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{intent.summary ?? "-"}</div>
                    <div className="text-xs text-muted-foreground mt-2">{intent.status}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-indigo-500" />
            Broadcasts a venir
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {campaigns.length === 0 ? (
            <EmptyState label="Aucun broadcast programme" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campagne</TableHead>
                  <TableHead>Segment</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Envoi prevu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.slice(0, 4).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.segment ?? "-"}</TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                    <TableCell>{formatDateSafe(c.scheduledAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function WhatsAppInbox({
  conversations,
  onSelect,
  activeId,
  search,
  statusFilter,
  intentFilter,
  tagFilter,
  onSearchChange,
  onStatusChange,
  onIntentChange,
  onTagChange,
}: {
  conversations: WhatsAppConversationItem[];
  onSelect: (conversation: WhatsAppConversationItem) => void;
  activeId: string | null;
  search: string;
  statusFilter: string;
  intentFilter: string;
  tagFilter: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onIntentChange: (value: string) => void;
  onTagChange: (value: string) => void;
}) {
  const hasFilters =
    search.trim().length > 0 ||
    tagFilter.trim().length > 0 ||
    statusFilter !== "ALL" ||
    intentFilter !== "ALL";
  const counts = useMemo(() => {
    return conversations.reduce(
      (acc, c) => {
        acc.total += 1;
        acc[c.status] = (acc[c.status] ?? 0) + 1;
        return acc;
      },
      { total: 0 } as Record<string, number>
    );
  }, [conversations]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Inbox centralisee</span>
          <Badge variant="secondary" className="text-xs">{conversations.length} convos</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="px-3 pt-3 flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">OPEN {counts.OPEN ?? 0}</Badge>
          <Badge variant="outline">PENDING {counts.PENDING ?? 0}</Badge>
          <Badge variant="outline">CLOSED {counts.CLOSED ?? 0}</Badge>
        </div>
        <div className="p-3 grid grid-cols-1 lg:grid-cols-4 gap-2 border-b">
          <Input
            placeholder="Rechercher contact / message"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8"
          />
          <Select value={statusFilter} onValueChange={onStatusChange}>
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous statuts</SelectItem>
              <SelectItem value="OPEN">OPEN</SelectItem>
              <SelectItem value="PENDING">PENDING</SelectItem>
              <SelectItem value="CLOSED">CLOSED</SelectItem>
            </SelectContent>
          </Select>
          <Select value={intentFilter} onValueChange={onIntentChange}>
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Intent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous intents</SelectItem>
              <SelectItem value="LOW">LOW</SelectItem>
              <SelectItem value="MEDIUM">MEDIUM</SelectItem>
              <SelectItem value="HIGH">HIGH</SelectItem>
              <SelectItem value="URGENT">URGENT</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Filtre tag"
            value={tagFilter}
            onChange={(e) => onTagChange(e.target.value)}
            className="h-8"
          />
        </div>
        {conversations.length === 0 ? (
          <EmptyState label={hasFilters ? "Aucun resultat" : "Aucune conversation"} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Dernier message</TableHead>
                <TableHead>Contexte</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Assignation</TableHead>
                <TableHead>Reponse</TableHead>
                <TableHead>SLA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conversations.map((c) => (
                <TableRow
                  key={c.id}
                  className={cn("cursor-pointer", activeId === c.id && "bg-emerald-50/60")}
                  onClick={() => onSelect(c)}
                >
                  <TableCell>
                    <div className="font-medium">{c.contactName}</div>
                    <div className="text-xs text-muted-foreground">{c.contactPhone ?? "-"}</div>
                  </TableCell>
                  <TableCell className="max-w-[280px]">
                    <div className="text-sm line-clamp-2">{c.lastMessage ?? "-"}</div>
                    <div className="text-xs text-muted-foreground">{formatDateSafe(c.lastMessageAt)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {c.latestOrderNumber ? (
                        <div className="text-xs font-medium">Cmd {c.latestOrderNumber}</div>
                      ) : c.linkedDemandId ? (
                        <div className="text-xs font-medium">Demande {c.linkedDemandStatus ?? "-"}</div>
                      ) : c.linkedLeadId ? (
                        <div className="text-xs font-medium">Lead {c.linkedLeadStatus ?? "-"}</div>
                      ) : (
                        <div className="text-xs text-muted-foreground">Conversation brute</div>
                      )}
                      {c.mediaCount ? (
                        <div className="text-[11px] text-muted-foreground">{c.mediaCount} piece(s) jointe(s)</div>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                  <TableCell>{c.assignedTo ?? "-"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {c.intentScore ? <Badge variant="outline">{c.intentScore}</Badge> : null}
                      {c.responseState ? <ResponseBadge state={c.responseState} /> : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div>{c.slaDueAt ? formatDateSafe(c.slaDueAt) : "-"}</div>
                      {c.slaState && c.slaState !== "NO_SLA" ? (
                        <SlaBadge state={c.slaState} />
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
function WhatsAppIntents({ intents }: { intents: WhatsAppIntentItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const grouped = useMemo(() => {
    const map: Record<string, WhatsAppIntentItem[]> = {};
    for (const stage of INTENT_STAGES) map[stage] = [];
    intents.forEach((intent) => {
      map[intent.status] = map[intent.status] || [];
      map[intent.status].push(intent);
    });
    return map;
  }, [intents]);

  const handleConvert = (intentId: string) => {
    startTransition(async () => {
      const res = await convertWhatsAppIntentToCrm(intentId);
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Intent transfere au CRM");
        router.refresh();
      }
    });
  };

  const handleStatus = (intentId: string, status: string) => {
    startTransition(async () => {
      const res = await updateWhatsAppIntentStatus(intentId, status);
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Intent mis a jour");
        router.refresh();
      }
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
      {INTENT_STAGES.map((stage) => (
        <Card key={stage} className="min-h-[240px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>{stage}</span>
              <Badge variant="secondary" className="text-xs">{grouped[stage]?.length ?? 0}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(grouped[stage] ?? []).length === 0 ? (
              <div className="text-xs text-muted-foreground">Vide</div>
            ) : (
              grouped[stage].map((intent) => (
                <div key={intent.id} className="rounded border p-2 space-y-1">
                  <div className="text-sm font-medium truncate">{intent.contactName}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2">{intent.summary ?? "-"}</div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{intent.score}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDateSafe(intent.createdAt)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {stage === "DETECTED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={pending}
                        onClick={() => handleStatus(intent.id, "QUALIFIED")}
                      >
                        Qualifier
                      </Button>
                    )}
                    {stage !== "TRANSFERRED" && !intent.crmIntentId && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={pending}
                        onClick={() => handleConvert(intent.id)}
                      >
                        Transferer CRM
                      </Button>
                    )}
                    {stage !== "LOST" && stage !== "WON" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-muted-foreground"
                        disabled={pending}
                        onClick={() => handleStatus(intent.id, "LOST")}
                      >
                        Marquer perdu
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function WhatsAppGroups({ groups }: { groups: WhatsAppGroupItem[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {groups.map((g) => (
        <Card key={g.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>{g.name}</span>
              <Badge variant="outline" className="text-xs">{g.membersCount} membres</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <div>Cat: {g.category ?? "-"}</div>
            <div>Statut: {g.status}</div>
            <div>Dernier msg: {formatDateSafe(g.lastMessageAt)}</div>
          </CardContent>
        </Card>
      ))}
      {groups.length === 0 && <EmptyState label="Aucun groupe" />}
    </div>
  );
}

function WhatsAppBroadcasts({ campaigns }: { campaigns: WhatsAppCampaignItem[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [segment, setSegment] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [pending, startTransition] = useTransition();

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error("Nom requis");
      return;
    }
    startTransition(async () => {
      const res = await createWhatsAppCampaign({
        name: name.trim(),
        objective: objective || undefined,
        segment: segment || undefined,
        scheduledAt: scheduledAt || undefined,
      });
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Campagne creee");
        setName("");
        setObjective("");
        setSegment("");
        setScheduledAt("");
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Nouvelle campagne</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom campagne" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Objectif" />
            <Input value={segment} onChange={(e) => setSegment(e.target.value)} placeholder="Segment" />
            <Input
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              placeholder="Planification (YYYY-MM-DD)"
            />
          </div>
          <Button size="sm" disabled={pending} onClick={handleCreate}>
            Creer campagne
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Campagnes & Broadcasts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {campaigns.length === 0 ? (
            <EmptyState label="Aucune campagne" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Objectif</TableHead>
                  <TableHead>Segment</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Planifie</TableHead>
                  <TableHead>Envois</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.objective ?? "-"}</TableCell>
                    <TableCell>{c.segment ?? "-"}</TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                    <TableCell>{formatDateSafe(c.scheduledAt)}</TableCell>
                    <TableCell>{c.sentCount ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function WhatsAppTemplates({ templates }: { templates: WhatsAppTemplateItem[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("transactional");
  const [language, setLanguage] = useState("fr");
  const [versionTemplateId, setVersionTemplateId] = useState("");
  const [versionBody, setVersionBody] = useState("");
  const [versionVars, setVersionVars] = useState("");
  const [pending, startTransition] = useTransition();

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error("Nom requis");
      return;
    }
    startTransition(async () => {
      const res = await createWhatsAppTemplate({
        name: name.trim(),
        category,
        language,
      });
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Template cree");
        setName("");
        router.refresh();
      }
    });
  };

  const handleAddVersion = () => {
    if (!versionTemplateId || !versionBody.trim()) {
      toast.error("Template et contenu requis");
      return;
    }
    const vars = versionVars
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    startTransition(async () => {
      const res = await addWhatsAppTemplateVersion(versionTemplateId, versionBody.trim(), vars);
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Version ajoutee");
        setVersionBody("");
        setVersionVars("");
        router.refresh();
      }
    });
  };

  const handleApprove = (versionId?: string | null) => {
    if (!versionId) return;
    startTransition(async () => {
      const res = await approveWhatsAppTemplateVersion(versionId);
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Version approuvee");
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Nouveau template</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom template" />
            <div className="grid grid-cols-2 gap-2">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transactional">transactional</SelectItem>
                  <SelectItem value="marketing">marketing</SelectItem>
                  <SelectItem value="utility">utility</SelectItem>
                </SelectContent>
              </Select>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fr">fr</SelectItem>
                  <SelectItem value="en">en</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" disabled={pending} onClick={handleCreate}>
              Creer template
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ajouter version</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={versionTemplateId} onValueChange={setVersionTemplateId}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Choisir template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              value={versionBody}
              onChange={(e) => setVersionBody(e.target.value)}
              placeholder="Contenu du message"
            />
            <Input
              value={versionVars}
              onChange={(e) => setVersionVars(e.target.value)}
              placeholder="Variables (ex: name,order)"
            />
            <Button size="sm" disabled={pending} onClick={handleAddVersion}>
              Ajouter version
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Templates approuves</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {templates.length === 0 ? (
            <EmptyState label="Aucun template" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Langue</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Versions</TableHead>
                  <TableHead>Derniere</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>{t.category ?? "-"}</TableCell>
                    <TableCell>{t.language}</TableCell>
                    <TableCell><StatusBadge status={t.status} /></TableCell>
                    <TableCell>{t.versions ?? 0}</TableCell>
                    <TableCell>{t.latestVersionStatus ?? "-"}</TableCell>
                    <TableCell>
                      {t.latestVersionId && t.latestVersionStatus !== "APPROVED" && (
                        <Button size="sm" variant="outline" onClick={() => handleApprove(t.latestVersionId)} disabled={pending}>
                          Approuver
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function WhatsAppAutomations({ flows }: { flows: WhatsAppBotFlowItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("KEYWORD");
  const [triggerValue, setTriggerValue] = useState("");
  const [response, setResponse] = useState("");
  const [priority, setPriority] = useState("0");
  const [escalate, setEscalate] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const handleCreate = () => {
    if (!name.trim() || !response.trim()) {
      toast.error("Nom et reponse requis");
      return;
    }
    startTransition(async () => {
      const res = await createWhatsAppBotFlow({
        name: name.trim(),
        trigger,
        triggerValue: triggerValue.trim() || undefined,
        response: response.trim(),
        escalate,
        isActive,
        priority: Number(priority || 0),
      });
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Automation creee");
        setName("");
        setTrigger("KEYWORD");
        setTriggerValue("");
        setResponse("");
        setPriority("0");
        setEscalate(false);
        setIsActive(true);
        router.refresh();
      }
    });
  };

  const handleRowSave = (row: HTMLTableRowElement | null, id: string) => {
    if (!row) return;
    const getInput = (name: string) => row.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLTextAreaElement | null;
    const nameEl = getInput("name");
    const triggerEl = row.querySelector(`[name="trigger"]`) as HTMLSelectElement | null;
    const triggerValueEl = getInput("triggerValue");
    const responseEl = row.querySelector(`[name="response"]`) as HTMLTextAreaElement | null;
    const priorityEl = getInput("priority") as HTMLInputElement | null;
    const isActiveEl = row.querySelector(`[name="isActive"]`) as HTMLInputElement | null;
    const escalateEl = row.querySelector(`[name="escalate"]`) as HTMLInputElement | null;

    startTransition(async () => {
      const res = await updateWhatsAppBotFlow({
        id,
        name: nameEl?.value ?? "",
        trigger: triggerEl?.value ?? "",
        triggerValue: triggerValueEl?.value ?? null,
        response: responseEl?.value ?? "",
        priority: priorityEl ? Number(priorityEl.value || 0) : 0,
        escalate: Boolean(escalateEl?.checked),
        isActive: Boolean(isActiveEl?.checked),
      });
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Automation mise a jour");
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Nouvelle automation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Select value={trigger} onValueChange={setTrigger}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="KEYWORD">KEYWORD</SelectItem>
                <SelectItem value="INTENT">INTENT</SelectItem>
                <SelectItem value="GREETING">GREETING</SelectItem>
                <SelectItem value="UNHANDLED">UNHANDLED</SelectItem>
              </SelectContent>
            </Select>
            <Input value={triggerValue} onChange={(e) => setTriggerValue(e.target.value)} placeholder="Trigger value" />
            <Input value={priority} onChange={(e) => setPriority(e.target.value)} placeholder="Priorite" type="number" />
          </div>
          <Textarea value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Reponse automatique" />
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={escalate} onChange={(e) => setEscalate(e.target.checked)} />
              Escalader vers humain
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Actif
            </label>
          </div>
          <Button size="sm" disabled={pending} onClick={handleCreate}>
            Creer automation
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Automatisations actives</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {flows.length === 0 ? (
            <EmptyState label="Aucune automation" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Valeur</TableHead>
                  <TableHead>Priorite</TableHead>
                  <TableHead>Actif</TableHead>
                  <TableHead>Escalade</TableHead>
                  <TableHead>Reponse</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flows.map((flow) => (
                  <TableRow key={flow.id} className="align-top">
                    <TableCell>
                      <Input name="name" defaultValue={flow.name} className="h-8" />
                    </TableCell>
                    <TableCell>
                      <select name="trigger" defaultValue={flow.trigger} className="h-8 rounded-md border bg-transparent px-2 text-xs">
                        <option value="KEYWORD">KEYWORD</option>
                        <option value="INTENT">INTENT</option>
                        <option value="GREETING">GREETING</option>
                        <option value="UNHANDLED">UNHANDLED</option>
                      </select>
                    </TableCell>
                    <TableCell>
                      <Input name="triggerValue" defaultValue={flow.triggerValue ?? ""} className="h-8" />
                    </TableCell>
                    <TableCell>
                      <Input name="priority" defaultValue={flow.priority} className="h-8" type="number" />
                    </TableCell>
                    <TableCell>
                      <input name="isActive" type="checkbox" defaultChecked={flow.isActive} />
                    </TableCell>
                    <TableCell>
                      <input name="escalate" type="checkbox" defaultChecked={flow.escalate} />
                    </TableCell>
                    <TableCell className="min-w-[260px]">
                      <Textarea name="response" defaultValue={flow.response} className="min-h-[70px]" />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={(e) => {
                          const row = e.currentTarget.closest("tr") as HTMLTableRowElement | null;
                          handleRowSave(row, flow.id);
                        }}
                      >
                        Enregistrer
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function WhatsAppSettings({ accounts }: { accounts: WhatsAppAccountItem[] }) {
  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-500" />
            Comptes WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {accounts.length === 0 ? (
            <EmptyState
              title="Aucun compte connecte"
              description="Configurez WAHA ou Meta Cloud API pour activer l'envoi, la reception et la synchronisation des conversations."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Phone ID</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.provider}</TableCell>
                    <TableCell>{a.displayName ?? "-"}</TableCell>
                    <TableCell>{a.phoneNumberId ?? "-"}</TableCell>
                    <TableCell><StatusBadge status={a.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Button size="sm">Connecter WAHA</Button>
        <Button size="sm" variant="outline">Configurer webhooks</Button>
      </div>
    </div>
  );
}

function KpiCard({ label, value, color, urgent }: { label: string; value: number; color: string; urgent?: boolean }) {
  const colorMap: Record<string, string> = {
    emerald: "border-emerald-200 bg-emerald-50/60",
    red: "border-red-200 bg-red-50/60",
    orange: "border-orange-200 bg-orange-50/60",
    blue: "border-blue-200 bg-blue-50/60",
    purple: "border-purple-200 bg-purple-50/60",
    indigo: "border-indigo-200 bg-indigo-50/60",
  };

  return (
    <Card className={cn("border", colorMap[color], urgent && "ring-2 ring-red-300")}>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status?.toUpperCase?.() ?? status;
  const colorMap: Record<string, string> = {
    OPEN: "bg-emerald-100 text-emerald-700",
    PENDING: "bg-amber-100 text-amber-700",
    CLOSED: "bg-gray-100 text-gray-700",
    DETECTED: "bg-blue-100 text-blue-700",
    QUALIFIED: "bg-indigo-100 text-indigo-700",
    TRANSFERRED: "bg-purple-100 text-purple-700",
    WON: "bg-emerald-100 text-emerald-700",
    LOST: "bg-rose-100 text-rose-700",
    SCHEDULED: "bg-blue-100 text-blue-700",
    RUNNING: "bg-amber-100 text-amber-700",
    COMPLETED: "bg-emerald-100 text-emerald-700",
    CANCELLED: "bg-gray-100 text-gray-700",
  };

  return (
    <Badge className={cn("text-xs", colorMap[normalized] ?? "bg-gray-100 text-gray-700")}>{normalized}</Badge>
  );
}

function ResponseBadge({ state }: { state: string }) {
  const colorMap: Record<string, string> = {
    WAITING_ON_US: "bg-amber-100 text-amber-700",
    WAITING_ON_CLIENT: "bg-blue-100 text-blue-700",
    CLOSED: "bg-gray-100 text-gray-700",
  };

  const labels: Record<string, string> = {
    WAITING_ON_US: "a traiter",
    WAITING_ON_CLIENT: "attente client",
    CLOSED: "clos",
  };

  const normalized = state?.toUpperCase?.() ?? state;
  return (
    <Badge className={cn("text-xs", colorMap[normalized] ?? "bg-gray-100 text-gray-700")}>
      {labels[normalized] ?? normalized}
    </Badge>
  );
}

function SlaBadge({ state }: { state: string }) {
  const normalized = state?.toUpperCase?.() ?? state;
  const colorMap: Record<string, string> = {
    ON_TRACK: "bg-emerald-100 text-emerald-700",
    WARNING: "bg-amber-100 text-amber-700",
    BREACHED: "bg-rose-100 text-rose-700",
    NO_SLA: "bg-gray-100 text-gray-700",
  };

  return (
    <Badge className={cn("text-xs", colorMap[normalized] ?? "bg-gray-100 text-gray-700")}>
      {normalized}
    </Badge>
  );
}

function formatDateSafe(value?: string | null) {
  if (!value) return "-";
  try {
    return formatDate(new Date(value), true);
  } catch {
    return "-";
  }
}
