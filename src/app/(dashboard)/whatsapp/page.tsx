import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { WhatsAppClient } from "@/components/whatsapp/whatsapp-client";
import { getSession } from "@/lib/session";
import {
  getWhatsAppAccounts,
  getWhatsAppCampaigns,
  getWhatsAppConversations,
  getWhatsAppDashboard,
  getWhatsAppGroups,
  getWhatsAppIntents,
  getWhatsAppTemplates,
  getWhatsAppBotFlows,
} from "@/lib/actions/whatsapp.actions";

export const metadata = { title: "WhatsApp OS | Horion ERP" };

export default async function WhatsAppPage() {
  const user = await getSession();
  const [
    statsResult,
    conversationsResult,
    intentsResult,
    groupsResult,
    campaignsResult,
    templatesResult,
    accountsResult,
    botFlowsResult,
  ] = await Promise.all([
    getWhatsAppDashboard(),
    getWhatsAppConversations(),
    getWhatsAppIntents(),
    getWhatsAppGroups(),
    getWhatsAppCampaigns(),
    getWhatsAppTemplates(),
    getWhatsAppAccounts(),
    getWhatsAppBotFlows(),
  ]);

  const stats = statsResult.data ?? {
    openConversations: 0,
    slaBreaches: 0,
    highIntents: 0,
    messagesToday: 0,
    groupsActive: 0,
    broadcastsScheduled: 0,
  };

  return (
    <div className="space-y-6">
      <PageHeader title="WhatsApp OS" description="Inbox, intentions, broadcasts, groupes, templates">
        <Badge
          variant="secondary"
          className="gap-1.5 border-emerald-200 bg-emerald-100 text-emerald-800"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Canal actif
        </Badge>
      </PageHeader>

      <WhatsAppClient
        stats={stats}
        conversations={conversationsResult.data ?? []}
        intents={intentsResult.data ?? []}
        groups={groupsResult.data ?? []}
        campaigns={campaignsResult.data ?? []}
        templates={templatesResult.data ?? []}
        accounts={accountsResult.data ?? []}
        botFlows={botFlowsResult.data ?? []}
        viewerId={user.id}
      />
    </div>
  );
}
