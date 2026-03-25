import {
  getLabConnections,
  getQcDashboard,
  getQcInspections,
  getQcPartners,
  getQcPlans,
  getQcReports,
  getQcRequestOptions,
  getQcRequests,
  listLabTests,
  listLotTraces,
  listSpcCharts,
} from "@/lib/actions/qc.actions";
import { QcClient } from "@/components/qc/qc-client";
import { PageHeader } from "@/components/shared/page-header";

export default async function QcPage() {
  const [
    dashRes,
    plansRes,
    inspRes,
    requestsRes,
    reportsRes,
    partnersRes,
    optionsRes,
    labConnsRes,
    labTestsRes,
    spcChartsRes,
    lotTracesRes,
  ] = await Promise.all([
    getQcDashboard(),
    getQcPlans(),
    getQcInspections(),
    getQcRequests(),
    getQcReports(),
    getQcPartners(),
    getQcRequestOptions(),
    getLabConnections(),
    listLabTests(),
    listSpcCharts(),
    listLotTraces(),
  ]);

  const dashboard = dashRes.data ?? {
    plansCount: 0,
    total: 0,
    scheduled: 0,
    inProgress: 0,
    completed: 0,
    passed: 0,
    failed: 0,
    conditional: 0,
    passRate: 0,
    avgDefectRate: "0",
    monthlyTrend: [],
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Controle Qualite"
        description="Plans d'inspection, rapports QC, laboratoires et tracabilite des lots"
      />
      <QcClient
        dashboard={dashboard as any}
        plans={(plansRes.data ?? []) as any}
        inspections={(inspRes.data ?? []) as any}
        requests={(requestsRes.data ?? []) as any}
        reports={(reportsRes.data ?? []) as any}
        partners={(partnersRes.data ?? []) as any}
        options={(optionsRes.data ?? { orders: [], suppliers: [], products: [], partners: [] }) as any}
        labConnections={(labConnsRes.data ?? []) as any}
        labTests={(labTestsRes.data ?? []) as any}
        spcCharts={(spcChartsRes.data ?? []) as any}
        lotTraces={(lotTracesRes.data ?? []) as any}
      />
    </div>
  );
}
