import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getDemandIntakes } from "@/lib/actions/demand-intake.actions";
import { DemandsClient, type DemandRow, type DemandKpis } from "@/components/crm/demands-client";

export const metadata = {
  title: "Demandes Clients | Horion ERP",
};

export default async function DemandsPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const result = await getDemandIntakes({});

  const demands: DemandRow[] = (result.data?.demands ?? []).map((d: any) => ({
    id: d.id,
    clientName: d.clientName,
    rawDescription: d.rawDescription,
    category: d.category ?? null,
    status: d.status,
    source: d.source,
    urgency: d.urgency,
    estimatedRevenue: d.estimatedRevenue ? Number(d.estimatedRevenue) : null,
    receivedAt: d.receivedAt,
    contact: d.contact ? { id: d.contact.id, name: d.contact.name } : null,
    cm: d.cm ? { id: d.cm.id, name: d.cm.name } : null,
    assignedTo: d.assignedTo ? { id: d.assignedTo.id, name: d.assignedTo.name } : null,
  }));

  const kpis: DemandKpis = result.data?.kpis ?? {
    total: 0,
    raw: 0,
    qualified: 0,
    indicatifPending: 0,
    quoteFlow: 0,
    paymentFlow: 0,
    converted: 0,
    lost: 0,
  };

  return <DemandsClient demands={demands} kpis={kpis} />;
}
