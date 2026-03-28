import { LineChart } from "lucide-react";

import { StrategicForecast } from "@/components/pilotage/strategic-forecast";
import { getStrategicForecast } from "@/lib/actions/pilotage.actions";

export const metadata = {
  title: "Forecast Strategique | Horion ERP",
  description: "Projection directionnelle revenu, marge, volume et cash runway",
};

export default async function PilotageForecastPage() {
  const res = await getStrategicForecast();
  const data = res.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <LineChart className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Forecast strategique</h1>
          <p className="text-muted-foreground">
            Comparer les scenarios directionnels sur le revenu, la marge, le volume et le runway cash.
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
