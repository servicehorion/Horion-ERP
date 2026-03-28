"use client";

import { useState } from "react";
import { ArrowRightLeft, Calculator } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { convertAmount } from "@/lib/actions/finance.actions";

const CURRENCIES = ["XAF", "USD", "RMB", "EUR"];

const FALLBACK_RATES: Record<string, number> = {
  USD_XAF: 605,
  RMB_XAF: 83,
  EUR_XAF: 655.957,
  USD_RMB: 7.25,
};

function localConvert(amount: number, from: string, to: string): number | null {
  if (from === to) return amount;
  const key = `${from}_${to}`;
  const revKey = `${to}_${from}`;
  if (FALLBACK_RATES[key]) return amount * FALLBACK_RATES[key];
  if (FALLBACK_RATES[revKey]) return amount / FALLBACK_RATES[revKey];
  return null;
}

export function FXCalculator() {
  const [amount, setAmount] = useState<string>("");
  const [from, setFrom] = useState<string>("USD");
  const [to, setTo] = useState<string>("XAF");
  const [result, setResult] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  function handleSwap() {
    setFrom(to);
    setTo(from);
    setResult(null);
  }

  async function handleConvert() {
    const num = parseFloat(amount);
    if (!num || isNaN(num)) return;

    setLoading(true);
    try {
      const res = await convertAmount(num, from, to);
      if (res.data) {
        setResult(res.data.amount);
      } else {
        // Fallback local
        const local = localConvert(num, from, to);
        setResult(local);
      }
    } catch {
      const local = localConvert(num, from, to);
      setResult(local);
    } finally {
      setLoading(false);
    }
  }

  function formatResult(val: number): string {
    if (to === "XAF") return val.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " FCFA";
    return val.toLocaleString("fr-FR", { maximumFractionDigits: 4 }) + " " + to;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calculator className="h-4 w-4 text-indigo-600" />
          Calculatrice de change
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="Montant"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setResult(null); }}
            className="flex-1"
            min={0}
            step="any"
          />
          <Select value={from} onValueChange={(v) => { setFrom(v); setResult(null); }}>
            <SelectTrigger className="w-[90px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSwap}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Inverser"
          >
            <ArrowRightLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1" />
          <Select value={to} onValueChange={(v) => { setTo(v); setResult(null); }}>
            <SelectTrigger className="w-[90px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleConvert}
          disabled={!amount || loading || from === to}
          className="w-full"
          size="sm"
        >
          {loading ? "Conversion…" : "Convertir"}
        </Button>

        {result !== null && (
          <div className="rounded-lg bg-muted/60 px-4 py-3 text-center">
            <p className="text-xs text-muted-foreground">
              {parseFloat(amount).toLocaleString("fr-FR")} {from} =
            </p>
            <p className="text-xl font-bold text-primary mt-0.5">
              {formatResult(result)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Taux DB ou taux de référence Horion
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
