import Link from "next/link";
import { Ticket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SourcingCommandCenter } from "@/components/sourcing/command-center";
import { SourcingCommandCenterProjectionService } from "@/lib/services/sourcing-command-center-projection.service";
import {
  getDemandIntakes,
  getGroupageBatches,
  getMarketInsights,
  getSourcingAuditLogs,
  getSourcingAssignees,
  getSourcingPerformance,
  getSourcingPipelineAdvanced,
  getSuppliersForSourcing,
} from "@/lib/actions/sourcing.actions";
import { getSession } from "@/lib/session";

export const metadata = { title: "Sourcing Command Center | Horion ERP" };

async function safeSourcingRead<T>(label: string, run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch (error) {
    console.error(`[sourcing-page] ${label}`, error);
    return fallback;
  }
}

export default async function SourcingPage() {
  const session = await getSession();
  const projection = await safeSourcingRead(
    "projection",
    () => SourcingCommandCenterProjectionService.get(session.tenantId),
    { overview: { demandInbox: 0, qualifiedDemandQueue: 0, activeCases: 0, confirmedCases: 0, breachedCases: 0, warningCases: 0, conversionRate: 0, canonicalJourney: [] }, priorityActions: [] }
  );
  const demandsRes = await safeSourcingRead("demands", () => getDemandIntakes(), { success: false, data: [] });
  const pipelineRes = await safeSourcingRead("pipeline", () => getSourcingPipelineAdvanced(), { success: false, data: [] });
  const suppliersRes = await safeSourcingRead("suppliers", () => getSuppliersForSourcing(), { success: false, data: [] });
  const marketRes = await safeSourcingRead("market", () => getMarketInsights(), { success: false, data: [] });
  const auditRes = await safeSourcingRead("audit", () => getSourcingAuditLogs(), { success: false, data: [] });
  const performanceRes = await safeSourcingRead(
    "performance",
    () => getSourcingPerformance(),
    { success: false, data: { dependency: [], categoryConcentration: [], heatmap: [] } }
  );
  const groupageRes = await safeSourcingRead("groupage", () => getGroupageBatches(), { success: false, data: [] });
  const assigneesRes = await safeSourcingRead("assignees", () => getSourcingAssignees(), { success: false, data: [] });

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" asChild>
          <Link href="/sourcing/tickets">
            <Ticket className="mr-2 h-4 w-4" />
            Tickets sourcing
          </Link>
        </Button>
      </div>

      <SourcingCommandCenter
        demands={(demandsRes.data ?? []) as any}
        pipeline={(pipelineRes.data ?? []) as any}
        suppliers={(suppliersRes.data ?? []) as any}
        marketInsights={(marketRes.data ?? []) as any}
        auditLogs={(auditRes.data ?? []) as any}
        performance={(
          performanceRes.data ?? { dependency: [], categoryConcentration: [], heatmap: [] }
        ) as any}
        groupageBatches={(groupageRes.data ?? []) as any}
        assignees={(assigneesRes.data ?? []) as any}
        overview={projection.overview}
        priorityActions={projection.priorityActions}
      />
    </div>
  );
}
