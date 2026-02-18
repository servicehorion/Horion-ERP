import Link from "next/link";
import { ArrowLeft, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getLatestFXRates, getFXHistory } from "@/lib/actions/finance.actions";
import { AddFXRateForm } from "@/components/finance/add-fx-rate-form";

export const metadata = { title: "Taux de change | Horion ERP" };

const DEFAULT_RATES: Record<string, number> = {
  "USD/XAF": 605,
  "RMB/XAF": 83,
  "EUR/XAF": 655.957,
  "USD/RMB": 7.25,
};

export default async function FXPage() {
  const [ratesRes, usdHistRes, rmbHistRes] = await Promise.all([
    getLatestFXRates(),
    getFXHistory("USD", "XAF"),
    getFXHistory("RMB", "XAF"),
  ]);

  const rates = ratesRes.data || [];
  const usdHistory = usdHistRes.data || [];
  const rmbHistory = rmbHistRes.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/finance"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ArrowRightLeft className="h-7 w-7" />
            Taux de change
          </h1>
          <p className="text-muted-foreground">
            Gestion des taux de change multi-devises (XAF, USD, RMB, EUR)
          </p>
        </div>
        <AddFXRateForm />
      </div>

      {/* Current Rates */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {rates.map((r) => {
          const rate = r.rate ? Number(r.rate) : DEFAULT_RATES[r.pair];
          const [from, to] = r.pair.split("/");
          const isLive = !!r.rate;

          return (
            <Card key={r.pair}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="font-mono">{from}</Badge>
                    <ArrowRightLeft className="h-3 w-3" />
                    <Badge variant="outline" className="font-mono">{to}</Badge>
                  </div>
                  {isLive ? (
                    <Badge className="bg-green-100 text-green-800 text-[10px]">Live</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">Défaut</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">
                  {rate ? rate.toFixed(to === "XAF" ? 2 : 4) : "N/A"}
                </div>
                {isLive && r.effectiveAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(r.effectiveAt).toLocaleDateString("fr-FR")} · {r.source}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* History Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historique USD/XAF</CardTitle>
          </CardHeader>
          <CardContent>
            {usdHistory.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">
                Aucun historique — enregistrez un taux pour commencer
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Taux</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usdHistory.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="text-sm">
                          {new Date(h.effectiveAt).toLocaleDateString("fr-FR")}
                        </TableCell>
                        <TableCell className="font-mono font-medium">
                          {Number(h.rate).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {h.source}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historique RMB/XAF</CardTitle>
          </CardHeader>
          <CardContent>
            {rmbHistory.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">
                Aucun historique — enregistrez un taux pour commencer
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Taux</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rmbHistory.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="text-sm">
                          {new Date(h.effectiveAt).toLocaleDateString("fr-FR")}
                        </TableCell>
                        <TableCell className="font-mono font-medium">
                          {Number(h.rate).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {h.source}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
