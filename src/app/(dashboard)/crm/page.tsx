import { redirect } from "next/navigation";

import { CrmDashboard } from "@/components/crm/crm-dashboard";
import { CrmDemandWidget } from "@/components/crm/crm-demand-widget";
import { auth } from "@/lib/auth";
import { CrmDashboardProjectionService } from "@/lib/services/crm-dashboard-projection.service";

export const metadata = {
  title: "CRM | Horion ERP",
};

export default async function CRMPage() {
  const session = await auth();
  if (!session?.user?.tenantId || !session.user.id || !session.user.role) {
    redirect("/login");
  }

  const projection = await CrmDashboardProjectionService.get({
    id: session.user.id,
    tenantId: session.user.tenantId,
    role: session.user.role,
    name: session.user.name,
    email: session.user.email,
  });

  return (
    <div className="space-y-6">
      <CrmDemandWidget projection={projection.demandWidget} />

      <CrmDashboard
        initialCustomers={projection.customers}
        initialLeads={projection.leads}
        initialProspects={projection.prospects}
        overview={projection.overview}
        priorityActions={projection.priorityActions}
        currentUserName={session.user.name || "Utilisateur"}
        currentUserId={session.user.id}
      />
    </div>
  );
}
