import { SourcingCommandCenter } from "@/components/sourcing/command-center";
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

export const metadata = { title: "Sourcing Command Center | Horion ERP" };

export default async function SourcingPage() {
  const [
    demandsRes,
    pipelineRes,
    suppliersRes,
    marketRes,
    auditRes,
    performanceRes,
    groupageRes,
    assigneesRes,
  ] = await Promise.all([
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
      <SourcingCommandCenter
        demands={(demandsRes.data ?? []) as any}
        pipeline={(pipelineRes.data ?? []) as any}
        suppliers={(suppliersRes.data ?? []) as any}
        marketInsights={(marketRes.data ?? []) as any}
        auditLogs={(auditRes.data ?? []) as any}
        performance={(performanceRes.data ?? { dependency: [], categoryConcentration: [], heatmap: [] }) as any}
        groupageBatches={(groupageRes.data ?? []) as any}
        assignees={(assigneesRes.data ?? []) as any}
      />
    </div>
  );
}
