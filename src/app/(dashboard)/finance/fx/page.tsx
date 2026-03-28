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
import { FXCalculator } from "@/components/finance/fx-calculator";

export const metadata = { title: "Taux de change | Horion ERP" };

const DEFAULT_RATES: Record<string, number> = {
  "USD/XAF": 605,
  "RMB/XAF": 83,
  "EUR/XAF": 655.957,
  "USD/RMB": 7.25,
};

const PAIR_DECIMALS: Record<string, number> = {
  "USD/XAF": 2,
  "RMB/XAF": 2,
  "EUR/XAF": 3,
  "USD/RMB": 4,
};

export default async function FXPage() {
  const [ratesRes, usdHistRes, rmbHistRes, eurHistRes, usdRmbHistRes] = await Promise.all([
    getLatestFXRates(),
    getFXHistory("USD", "XAF"),
    getFXHistory("RMB", "XAF"),
    getFXHistory("EUR", "XAF"),
    getFXHistory("USD", "RMB"),
  ]);

  const rates = ratesRes.data || [];
  const usdHistory = usdHistRes.data || [];
  const rmbHistory = rmbHistRes.data || [];
  const eurHistory = eurHistRes.data || [];
  const usdRmbHistory = usdRmbHistRes.data || [];

  const historyPairs = [
    { label: "USD / XAF", history: usdHistory, decimals: 2 },
    { label: "RMB / XAF", history: rmbHistory, decimals: 2 },
    { label: "EUR / XAF", history: eurHistory, decimals: 3 },
    { label: "USD / RMB", history: usdRmbHistory, decimals: 4 },
  ];

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
          const decimals = PAIR_DECIMALS[r.pair] ?? 4;

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
                  {rate ? rate.toFixed(decimals) : "N/A"}
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

      {/* Calculatrice + intro */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <FXCalculator />
        </div>
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base">Taux de référence Horion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                Les taux affichés en <Badge className="bg-green-100 text-green-800 text-[10px]">Live</Badge> sont
                les derniers taux saisis manuellement dans le système.
              </p>
              <p>
                Les taux affichés en <Badge variant="secondary" className="text-[10px]">Défaut</Badge> sont
                les taux de référence Horion (USD=605, RMB=83, EUR=655.957 FCFA) utilisés
                en fallback pour toutes les conversions automatiques.
              </p>
              <p className="text-xs">
                La calculatrice utilise en priorité les taux Live de la base de données,
                puis les taux Défaut si aucun taux Live n'est disponible.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* History Tables — 4 paires */}
      <div className="grid gap-6 lg:grid-cols-2">
        {historyPairs.map(({ label, history, decimals }) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                Historique {label}
                <Badge variant="outline" className="text-[10px]">
                  {history.length} entrée{history.length !== 1 ? "s" : ""}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">
                  Aucun historique — enregistrez un taux pour commencer
                </p>
              ) : (
                <div className="rounded-md border max-h-[280px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Taux</TableHead>
                        <TableHead>Source</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((h, idx) => {
                        const prev = history[idx + 1];
                        const diff = prev ? Number(h.rate) - Number(prev.rate) : 0;
                        return (
                          <TableRow key={h.id}>
                            <TableCell className="text-sm">
                              {new Date(h.effectiveAt).toLocaleDateString("fr-FR")}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="font-mono font-medium">
                                {Number(h.rate).toFixed(decimals)}
                              </span>
                              {diff !== 0 && (
                                <span className={`ml-1 text-[10px] ${diff > 0 ? "text-green-600" : "text-red-600"}`}>
                                  {diff > 0 ? "▲" : "▼"}{Math.abs(diff).toFixed(decimals)}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {h.source}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
