import { runTenantCached } from "@/lib/server-cache";
import { RiskCommandService } from "@/lib/services/risk-command.service";
import { StrategicForecastService } from "@/lib/services/strategic-forecast.service";
import { StrategicIntelligenceService } from "@/lib/services/strategic-intelligence.service";

export class PilotageSnapshotService {
  static async getStrategicIntelligence(tenantId: string) {
    return runTenantCached(
      "pilotage-intelligence",
      tenantId,
      () => StrategicIntelligenceService.getSnapshot(tenantId),
      45
    );
  }

  static async getStrategicForecast(tenantId: string) {
    return runTenantCached(
      "pilotage-forecast",
      tenantId,
      () => StrategicForecastService.getSnapshot(tenantId),
      60
    );
  }

  static async getRiskDashboard(tenantId: string) {
    return runTenantCached(
      "pilotage-risk-dashboard",
      tenantId,
      () => RiskCommandService.getDashboard(tenantId),
      30
    );
  }
}
