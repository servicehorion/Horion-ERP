import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, BookOpen, TrendingUp, TrendingDown, Minus,
  CheckCircle2, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getLedgerAccountById } from "@/lib/actions/finance.actions";
import { formatCurrency } from "@/config/currencies";

export const metadata = { title: "Compte comptable | Horion ERP" };

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: typeof TrendingUp }> = {
  ASSET:     { label: "Actif",      color: "bg-blue-100 text-blue-800",   icon: TrendingUp },
  LIABILITY: { label: "Passif",     color: "bg-red-100 text-red-800",     icon: TrendingDown },
  EQUITY:    { label: "Capitaux",   color: "bg-purple-100 text-purple-800", icon: Minus },
  REVENUE:   { label: "Produits",   color: "bg-green-100 text-green-800", icon: TrendingUp },
  EXPENSE:   { label: "Charges",    color: "bg-orange-100 text-orange-800", icon: TrendingDown },
};

const ENTRY_COLORS: Record<string, string> = {
  DEBIT:  "text-blue-600",
  CREDIT: "text-red-600",
};

interface PageProps {
  params: Promise<{ accountId: string }>;
}

export default async function LedgerAccountDetailPage({ params }: PageProps) {
  const { accountId } = await params;
  const result = await getLedgerAccountById(accountId);

  if (result.error || !result.data) notFound();

  const account = result.data;
  const entries = account.entries ?? [];
  const balance = Number(account.balance);
  const typeConfig = TYPE_CONFIG[account.type] ?? { label: account.type, color: "", icon: Minus };

  // Compute running balance from entries (oldest first)
  const entriesSorted = [...entries].reverse();
  let running = 0;
  const isDebitNormal = ["ASSET", "EXPENSE"].includes(account.type);
  const withBalance = entriesSorted.map((e) => {
    const amount = Number(e.amount);
    const change = e.type === "DEBIT"
      ? (isDebitNormal ? amount : -amount)
      : (isDebitNormal ? -amount : amount);
    running += change;
    return { ...e, runningBalance: running };
  }).reverse(); // back to newest first

  // Stats
  const totalDebits = entries
    .filter((e) => e.type === "DEBIT")
    .reduce((s, e) => s + Number(e.amount), 0);
  const totalCredits = entries
    .filter((e) => e.type === "CREDIT")
    .reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/finance/ledger">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg text-muted-foreground">{account.code}</span>
            <h1 className="text-2xl font-bold">{account.name}</h1>
            <Badge className={typeConfig.color}>{typeConfig.label}</Badge>
            <Badge variant="outline">{account.currency}</Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">
            {entries.length} écriture{entries.length !== 1 ? "s" : ""} enregistrée{entries.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" /> Solde actuel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balance >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(Math.abs(balance), account.currency)}
              {balance < 0 && <span className="text-sm ml-1">(Cr)</span>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5 text-blue-600" /> Total débits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(totalDebits, account.currency)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-3.5 w-3.5 text-red-600" /> Total crédits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(totalCredits, account.currency)}
            </div>
          </CardContent>
        </Card>

        <Card className={Math.abs(totalDebits - totalCredits) < 0.01 ? "border-green-200" : "border-orange-200"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              {Math.abs(totalDebits - totalCredits) < 0.01
                ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                : <AlertTriangle className="h-3.5 w-3.5 text-orange-600" />
              }
              Équilibre
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-lg font-bold ${Math.abs(totalDebits - totalCredits) < 0.01 ? "text-green-600" : "text-orange-600"}`}>
              {Math.abs(totalDebits - totalCredits) < 0.01
                ? "Équilibré"
                : formatCurrency(Math.abs(totalDebits - totalCredits), account.currency)
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Entries table */}
      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BookOpen className="mx-auto h-10 w-10 opacity-20 mb-3" />
            <p className="font-medium">Aucune écriture sur ce compte</p>
            <p className="text-sm">Les écritures sont générées automatiquement lors de la confirmation des paiements.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Écritures (100 dernières)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Commande</TableHead>
                    <TableHead>Référence</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead className="text-right">Solde cumulé</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withBalance.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(entry.createdAt).toLocaleDateString("fr-FR")}
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">
                        {entry.description}
                      </TableCell>
                      <TableCell className="text-sm">
                        {entry.orderId ? (
                          <Link
                            href={`/orders/${entry.orderId}`}
                            className="text-primary hover:underline text-xs"
                          >
                            Voir commande
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {entry.reference ? entry.reference.slice(0, 8) + "…" : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={ENTRY_COLORS[entry.type]}
                        >
                          {entry.type}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-mono font-medium ${ENTRY_COLORS[entry.type]}`}>
                        {entry.type === "DEBIT" ? "+" : "-"}
                        {formatCurrency(Number(entry.amount), entry.currency)}
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm ${entry.runningBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatCurrency(Math.abs(entry.runningBalance), account.currency)}
                        {entry.runningBalance < 0 && " (Cr)"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
