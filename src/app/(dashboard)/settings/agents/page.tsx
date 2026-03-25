import { Bot } from "lucide-react";

import { AgentControlCenter } from "@/components/settings/agent-control-center";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { AgentPlatformService } from "@/lib/services/agent-platform.service";

export const metadata = {
  title: "Agents IA | Horion ERP",
  description: "Configuration et supervision de la plateforme agents Horion",
};

export default async function SettingsAgentsPage() {
  const session = await getSession();
  const canManage = hasPermission(session.role, "ai.manage") || hasPermission(session.role, "user.manage");
  const canView = hasPermission(session.role, "ai.view") || canManage;

  if (!canView) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
        Permission refusee
      </div>
    );
  }

  let res:
    | { data: Awaited<ReturnType<typeof AgentPlatformService.getPlatformSnapshot>>; error?: undefined }
    | { data?: undefined; error: string };

  try {
    res = { data: await AgentPlatformService.getPlatformSnapshot(session.tenantId) };
  } catch (error) {
    res = { error: error instanceof Error ? error.message : "Impossible de charger la plateforme agents" };
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Bot className="mt-1 h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agents IA</h1>
          <p className="text-sm text-muted-foreground">
            Prepare l&apos;ERP a accueillir les agents service client, community, marketing, finance, sourcing et logistique/QC.
          </p>
        </div>
      </div>

      {res.error ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {res.error}
        </div>
      ) : (
        <AgentControlCenter snapshot={res.data!} canManage={canManage} />
      )}
    </div>
  );
}
