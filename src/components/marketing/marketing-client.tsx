"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Zap,
  PenSquare,
  Megaphone,
  CalendarDays,
  Radio,
  Palette,
  BarChart3,
  Users,
  Mail,
} from "lucide-react";
import { MarketingOverview }      from "./marketing-overview";
import { ContentStudio }          from "./content-studio";
import { CampaignPipeline }       from "./campaign-pipeline";
import { EditorialCalendar }      from "./editorial-calendar";
import { ChannelsPanel }          from "./channels-panel";
import { BrandCenter }            from "./brand-center";
import { AnalyticsDashboard }     from "./analytics-dashboard";
import { AudienceIntelligence }   from "./audience-intelligence";
import { EmailCampaignBuilder }   from "./email-campaign-builder";
import type {
  MarketingStats,
  ContentPostItem,
  CampaignItem,
  ChannelItem,
  SocialAccountItem,
  BrandSettings,
  AudienceData,
  MarketingPersona,
  MarketTrend,
  EmailCampaignItem,
} from "@/lib/actions/marketing.actions";

interface Props {
  stats: MarketingStats;
  posts: ContentPostItem[];
  campaigns: CampaignItem[];
  channels: ChannelItem[];
  socialAccounts: SocialAccountItem[];
  brandSettings: BrandSettings;
  audienceData: AudienceData;
  personas: MarketingPersona[];
  trends: MarketTrend[];
  emailCampaigns: EmailCampaignItem[];
}

export function MarketingClient({
  stats,
  posts,
  campaigns,
  channels,
  socialAccounts,
  brandSettings,
  audienceData,
  personas,
  trends,
  emailCampaigns,
}: Props) {
  return (
    <Tabs defaultValue="overview" className="space-y-0">
      <TabsList className="h-10 flex-wrap">
        <TabsTrigger value="overview" className="gap-1.5 text-xs sm:text-sm">
          <Zap className="h-3.5 w-3.5" />
          War Room
        </TabsTrigger>
        <TabsTrigger value="audience" className="gap-1.5 text-xs sm:text-sm">
          <Users className="h-3.5 w-3.5" />
          Audience
        </TabsTrigger>
        <TabsTrigger value="studio" className="gap-1.5 text-xs sm:text-sm">
          <PenSquare className="h-3.5 w-3.5" />
          Studio
        </TabsTrigger>
        <TabsTrigger value="campaigns" className="gap-1.5 text-xs sm:text-sm">
          <Megaphone className="h-3.5 w-3.5" />
          Campagnes
        </TabsTrigger>
        <TabsTrigger value="calendar" className="gap-1.5 text-xs sm:text-sm">
          <CalendarDays className="h-3.5 w-3.5" />
          Calendrier
        </TabsTrigger>
        <TabsTrigger value="brand" className="gap-1.5 text-xs sm:text-sm">
          <Palette className="h-3.5 w-3.5" />
          Brand Center
        </TabsTrigger>
        <TabsTrigger value="analytics" className="gap-1.5 text-xs sm:text-sm">
          <BarChart3 className="h-3.5 w-3.5" />
          Analytics
        </TabsTrigger>
        <TabsTrigger value="channels" className="gap-1.5 text-xs sm:text-sm">
          <Radio className="h-3.5 w-3.5" />
          Canaux
        </TabsTrigger>
        <TabsTrigger value="email" className="gap-1.5 text-xs sm:text-sm">
          <Mail className="h-3.5 w-3.5" />
          Email
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <MarketingOverview
          stats={stats}
          posts={posts}
          campaigns={campaigns}
          brandSettings={brandSettings}
        />
      </TabsContent>

      <TabsContent value="audience">
        <AudienceIntelligence
          audienceData={audienceData}
          personas={personas}
          trends={trends}
        />
      </TabsContent>

      <TabsContent value="studio">
        <ContentStudio posts={posts} />
      </TabsContent>

      <TabsContent value="campaigns">
        <CampaignPipeline campaigns={campaigns} />
      </TabsContent>

      <TabsContent value="calendar">
        <EditorialCalendar posts={posts} />
      </TabsContent>

      <TabsContent value="brand">
        <BrandCenter initialSettings={brandSettings} />
      </TabsContent>

      <TabsContent value="analytics">
        <AnalyticsDashboard stats={stats} posts={posts} campaigns={campaigns} />
      </TabsContent>

      <TabsContent value="channels">
        <ChannelsPanel channels={channels} socialAccounts={socialAccounts} />
      </TabsContent>

      <TabsContent value="email">
        <EmailCampaignBuilder initialCampaigns={emailCampaigns} />
      </TabsContent>
    </Tabs>
  );
}
