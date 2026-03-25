import { LineChart } from "lucide-react";

import { StrategicForecast } from "@/components/pilotage/strategic-forecast";
import { getStrategicForecast } from "@/lib/actions/pilotage.actions";

export const metadata = {
  title: "Strategic Forecast | Horion ERP",
  description: "Strategic revenue, margin, volume, and runway projections",
};

export default async function PilotageForecastPage() {
  const res = await getStrategicForecast();
  const data = res.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <LineChart className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Strategic Forecast</h1>
          <p className="text-muted-foreground">
            Compare strategic scenarios on revenue, margin, volume, and cash runway.
          </p>
        </div>
      </div>

      {res.error ? (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {res.error}
        </div>
      ) : null}

      {data ? <StrategicForecast data={data} /> : null}
    </div>
  );
}
