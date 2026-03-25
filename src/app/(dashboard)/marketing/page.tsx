import { Megaphone, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MarketingClient } from "@/components/marketing/marketing-client";
import {
  getMarketingStats,
  getContentPosts,
  getCampaigns,
  getMarketingChannels,
  getSocialAccounts,
  getBrandSettings,
  getAudienceData,
  getPersonas,
  getMarketTrends,
  getEmailCampaigns,
} from "@/lib/actions/marketing.actions";

export const metadata = { title: "Marketing OS | Horion ERP" };

export default async function MarketingPage() {
  const [
    stats,
    postsResult,
    campaignsResult,
    channelsResult,
    accountsResult,
    brandSettings,
    audienceData,
    personas,
    trends,
    emailCampaignsResult,
  ] = await Promise.all([
    getMarketingStats(),
    getContentPosts(),
    getCampaigns(),
    getMarketingChannels(),
    getSocialAccounts(),
    getBrandSettings(),
    getAudienceData(),
    getPersonas(),
    getMarketTrends(),
    getEmailCampaigns(),
  ]);

  const posts          = postsResult.data          ?? [];
  const campaigns      = campaignsResult.data      ?? [];
  const channels       = channelsResult.data        ?? [];
  const socialAccounts = accountsResult.data        ?? [];
  const emailCampaigns = emailCampaignsResult.data  ?? [];

  const hasAiKey = !!process.env.ANTHROPIC_API_KEY;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Megaphone className="h-7 w-7 text-purple-600" />
            <h1 className="text-3xl font-bold">Marketing OS</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            War Room — Audience, Contenu, Campagnes, Brand Identity, Analytics
          </p>
        </div>
        <Badge
          variant="secondary"
          className={`gap-1.5 ${
            hasAiKey
              ? "bg-purple-100 text-purple-800 border-purple-200"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {hasAiKey ? "Agent IA actif" : "Agent IA — config requise"}
        </Badge>
      </div>

      {/* Main tabbed interface */}
      <MarketingClient
        stats={stats}
        posts={posts}
        campaigns={campaigns}
        channels={channels}
        socialAccounts={socialAccounts}
        brandSettings={brandSettings}
        audienceData={audienceData}
        personas={personas}
        trends={trends}
        emailCampaigns={emailCampaigns}
      />
    </div>
  );
}
