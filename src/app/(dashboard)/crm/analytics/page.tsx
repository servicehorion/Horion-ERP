import { getCrmAnalytics } from "@/lib/actions/crm-advanced.actions";
import CrmAnalytics from "@/components/crm/crm-analytics";
import { TrendingUp } from "lucide-react";

export default async function CrmAnalyticsPage() {
  const result = await getCrmAnalytics();
  const data = result.data ?? {
    funnel: [],
    conversionRate: 0,
    velocity: [],
    sources: [],
    cohorts: [],
    slaCompliance: 100,
    totalLeads: 0,
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-violet-600" />
            Analytics CRM
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Entonnoir de conversion, vélocité pipeline, performance par source et cohortes
          </p>
        </div>
      </div>
      <CrmAnalytics data={data} />
    </div>
  );
}
