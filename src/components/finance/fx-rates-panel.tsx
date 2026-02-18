import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRightLeft } from "lucide-react";

interface FXRateData {
  pair: string;
  rate?: unknown;
  effectiveAt?: string | Date | null;
  source?: string | null;
}

const FALLBACK_RATES: Record<string, number> = {
  "USD/XAF": 605,
  "RMB/XAF": 83,
  "EUR/XAF": 655.957,
  "USD/RMB": 7.25,
};

export function FXRatesPanel({ rates }: { rates: FXRateData[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5 text-indigo-600" />
          Taux de change
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {rates.map((r) => {
            const rate = r.rate ? Number(r.rate) : FALLBACK_RATES[r.pair];
            const isLive = !!r.rate;
            const [from, to] = r.pair.split("/");

            return (
              <div key={r.pair} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="font-mono text-xs">
                      {from}
                    </Badge>
                    <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                    <Badge variant="outline" className="font-mono text-xs">
                      {to}
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold font-mono">
                    {rate ? rate.toFixed(to === "XAF" ? 2 : 4) : "N/A"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {isLive ? (
                      <>
                        <Badge variant="secondary" className="text-[9px] mr-1">
                          {r.source || "manual"}
                        </Badge>
                        {r.effectiveAt && new Date(r.effectiveAt).toLocaleDateString("fr-FR")}
                      </>
                    ) : (
                      <span className="text-yellow-600">Taux par défaut</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
