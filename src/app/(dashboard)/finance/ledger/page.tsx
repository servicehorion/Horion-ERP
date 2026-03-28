import { BookOpen, TrendingUp, TrendingDown, Minus, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getLedgerAccounts, getTrialBalance } from "@/lib/actions/finance.actions";
import { CostCenterService } from "@/lib/services/cost-center.service";
import { getSession } from "@/lib/session";
import { AddLedgerEntryForm } from "@/components/finance/add-ledger-entry-form";
import { SeedChartButton } from "@/components/finance/seed-chart-button";
import { formatCurrency } from "@/config/currencies";
import { serializeDecimals } from "@/lib/utils";

export const metadata = { title: "Grand Livre | Horion ERP" };

const TYPE_LABELS: Record<string, { label: string; color: string; icon: typeof TrendingUp }> = {
  ASSET: { label: "Actif", color: "bg-blue-100 text-blue-800", icon: TrendingUp },
  LIABILITY: { label: "Passif", color: "bg-red-100 text-red-800", icon: TrendingDown },
  EQUITY: { label: "Capitaux", color: "bg-purple-100 text-purple-800", icon: Minus },
  REVENUE: { label: "Produits", color: "bg-green-100 text-green-800", icon: TrendingUp },
  EXPENSE: { label: "Charges", color: "bg-orange-100 text-orange-800", icon: TrendingDown },
};

export default async function LedgerPage() {
  const user = await getSession();
  const [accountsRes, trialRes, costCenters] = await Promise.all([
    getLedgerAccounts(),
    getTrialBalance(),
    CostCenterService.list(user.tenantId),
  ]);

  const accounts = serializeDecimals(accountsRes.data || []);
  const trial = trialRes.data || { rows: [], totalDebit: 0, totalCredit: 0, isBalanced: true };

  return (
    <div className="space-y-6">
      <PageHeader title="Grand Livre Comptable" description="Plan comptable et écritures">
        {accounts.length === 0 && <SeedChartButton />}
        {accounts.length > 0 && <AddLedgerEntryForm accounts={accounts} costCenters={costCenters} />}
      </PageHeader>

      {/* Trial Balance Summary */}
      {trial.rows.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">Total Débit</p>
              <p className="text-xl font-bold text-blue-600">
                {formatCurrency(trial.totalDebit, "XAF")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">Total Crédit</p>
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(trial.totalCredit, "XAF")}
              </p>
            </CardContent>
          </Card>
          <Card className={trial.isBalanced ? "border-green-200" : "border-red-200"}>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">Équilibre</p>
              <div className="flex items-center justify-center gap-2">
                {trial.isBalanced ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="text-xl font-bold text-green-600">Équilibré</span>
                  </>
                ) : (
                  <span className="text-xl font-bold text-red-600">
                    Écart : {formatCurrency(Math.abs(trial.totalDebit - trial.totalCredit), "XAF")}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Accounts Table */}
      {accounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground space-y-3">
            <BookOpen className="mx-auto h-12 w-12 opacity-20" />
            <p className="font-medium">Aucun compte comptable</p>
            <p className="text-sm">
              Initialisez le plan comptable standard import/export pour commencer.
            </p>
            <SeedChartButton />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              Plan comptable ({accounts.length} comptes)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Intitulé</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Devise</TableHead>
                    <TableHead className="text-right">Solde</TableHead>
                    <TableHead className="text-right">Écritures</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((a) => {
                    const typeConfig = TYPE_LABELS[a.type] || { label: a.type, color: "", icon: Minus };
                    const balance = Number(a.balance);
                    return (
                      <TableRow key={a.id} className="cursor-pointer hover:bg-muted/40">
                        <TableCell className="font-mono font-medium">
                          <Link href={`/finance/ledger/${a.id}`} className="hover:underline text-primary">
                            {a.code}
                          </Link>
                        </TableCell>
                        <TableCell className="font-medium">
                          <Link href={`/finance/ledger/${a.id}`} className="hover:underline">
                            {a.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={typeConfig.color}>
                            {typeConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{a.currency}</TableCell>
                        <TableCell className={`text-right font-bold ${balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {formatCurrency(Math.abs(balance), a.currency)}
                          {balance < 0 && " (Cr)"}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {a._count.entries}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
