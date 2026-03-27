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

export default async function SourcingPage() {
  const session = await getSession();
  const [
    projection,
    demandsRes,
    pipelineRes,
    suppliersRes,
    marketRes,
    auditRes,
    performanceRes,
    groupageRes,
    assigneesRes,
  ] = await Promise.all([
    SourcingCommandCenterProjectionService.get(session.tenantId),
    getDemandIntakes(),
    getSourcingPipelineAdvanced(),
    getSuppliersForSourcing(),
    getMarketInsights(),
    getSourcingAuditLogs(),
    getSourcingPerformance(),
    getGroupageBatches(),
    getSourcingAssignees(),
  ]);

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
