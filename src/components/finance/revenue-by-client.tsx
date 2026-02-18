import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Users } from "lucide-react";
import { formatCurrency } from "@/config/currencies";

interface ClientRevenue {
  name: string;
  revenue: number;
  orders: number;
}

export function RevenueByClient({ data }: { data: ClientRevenue[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-cyan-600" />
            CA par client
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground py-4">
          Aucune donnée disponible
        </CardContent>
      </Card>
    );
  }

  const maxRevenue = data[0]?.revenue || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-cyan-600" />
          Top clients par CA (XAF)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((client, idx) => (
          <div key={client.name} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground w-5">{idx + 1}</span>
                <span className="font-medium truncate">{client.name}</span>
              </div>
              <div className="text-right shrink-0">
                <span className="font-medium">{formatCurrency(client.revenue, "XAF")}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  ({client.orders} cmd)
                </span>
              </div>
            </div>
            <Progress value={(client.revenue / maxRevenue) * 100} className="h-1.5" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
