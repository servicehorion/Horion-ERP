import { Badge } from "@/components/ui/badge";
import { MarketingLiteClient } from "@/components/marketing/marketing-lite-client";
import {
  getAudienceData,
  getBrandSettings,
  getCampaigns,
  getEmailCampaigns,
} from "@/lib/actions/marketing.actions";

export const metadata = { title: "Marketing OS Lite | Horion ERP" };

export default async function MarketingPage() {
  const [audienceData, brandSettings, campaignsResult, emailCampaignsResult] = await Promise.all([
    getAudienceData(),
    getBrandSettings(),
    getCampaigns(),
    getEmailCampaigns(),
  ]);

  const campaigns = campaignsResult.data ?? [];
  const emailCampaigns = emailCampaignsResult.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">Marketing OS Lite</h1>
            <Badge variant="secondary">Day 1</Badge>
          </div>
          <p className="text-muted-foreground">
            Audience, relances simples, email propre et socle de marque minimum.
          </p>
        </div>
      </div>

      <MarketingLiteClient
        audienceData={audienceData}
        campaigns={campaigns}
        brandSettings={brandSettings}
        emailCampaigns={emailCampaigns}
      />
    </div>
  );
}
