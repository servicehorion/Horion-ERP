import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/config/currencies";

interface AgingItem {
  orderId: string;
  orderNumber: string;
  client: string;
  outstanding: number;
  daysOld: number;
}

interface AgingData {
  aging: {
    current: AgingItem[];
    days30: AgingItem[];
    days60: AgingItem[];
    days90: AgingItem[];
    over90: AgingItem[];
  };
  totals: {
    current: number;
    days30: number;
    days60: number;
    days90: number;
    over90: number;
  };
  totalOutstanding: number;
}

const BUCKETS = [
  { key: "current" as const, label: "En cours", color: "bg-green-500", textColor: "text-green-700" },
  { key: "days30" as const, label: "1-30j", color: "bg-blue-500", textColor: "text-blue-700" },
  { key: "days60" as const, label: "31-60j", color: "bg-yellow-500", textColor: "text-yellow-700" },
  { key: "days90" as const, label: "61-90j", color: "bg-orange-500", textColor: "text-orange-700" },
  { key: "over90" as const, label: ">90j", color: "bg-red-500", textColor: "text-red-700" },
];

export function AgingPanel({ data }: { data: AgingData }) {
  const hasData = data.totalOutstanding > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-orange-600" />
          Balance âgée (créances clients)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasData ? (
          <p className="text-center text-sm text-muted-foreground py-4">
            Aucune créance en cours
          </p>
        ) : (
          <>
            {/* Total */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <span className="font-semibold">Total impayé</span>
              <span className="text-xl font-bold">
                {formatCurrency(data.totalOutstanding, "XAF")}
              </span>
            </div>

            {/* Aging bars */}
            <div className="space-y-3">
              {BUCKETS.map((bucket) => {
                const amount = data.totals[bucket.key];
                const pct = data.totalOutstanding > 0 ? (amount / data.totalOutstanding) * 100 : 0;
                const items = data.aging[bucket.key];

                return (
                  <div key={bucket.key} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className={`font-medium ${bucket.textColor}`}>
                        {bucket.label}
                        {items.length > 0 && (
                          <Badge variant="secondary" className="ml-2 text-[10px]">
                            {items.length}
                          </Badge>
                        )}
                      </span>
                      <span className="font-medium">
                        {amount > 0 ? formatCurrency(amount, "XAF") : "-"}
                      </span>
                    </div>
                    <Progress value={pct} className={`h-2 ${bucket.color}`} />
                  </div>
                );
              })}
            </div>

            {/* Critical items (>60 days) */}
            {(data.aging.days90.length > 0 || data.aging.over90.length > 0) && (
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center gap-1 text-sm font-medium text-red-600">
                  <AlertTriangle className="h-3 w-3" />
                  Créances critiques (&gt;60 jours)
                </div>
                {[...data.aging.days90, ...data.aging.over90].slice(0, 5).map((item) => (
                  <div key={item.orderId} className="flex items-center justify-between text-xs">
                    <Link href={`/orders/${item.orderId}`} className="text-primary hover:underline">
                      {item.orderNumber} — {item.client}
                    </Link>
                    <span className="font-medium text-red-600">
                      {formatCurrency(item.outstanding, "XAF")} ({item.daysOld}j)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
