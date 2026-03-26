import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  confirmTreasuryReconciliation,
  getTreasuryReconciliationSnapshot,
  ignoreTreasuryReconciliation,
  resetTreasuryReconciliation,
  runTreasuryAutoReconciliation,
} from "@/lib/actions/treasury-reconciliation.actions";
import { formatCurrency } from "@/config/currencies";

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "RECONCILED") return "default";
  if (status === "SUGGESTED") return "secondary";
  if (status === "IGNORED") return "outline";
  return "destructive";
}

export async function TreasuryReconciliationPanel() {
  const snapshotRes = await getTreasuryReconciliationSnapshot(25);
  const transactions = snapshotRes.data || [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Rapprochement semi-auto wallet</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Suggestions de matching wallet vers paiements sortants et releves bancaires.
          </p>
        </div>
        <form action={runTreasuryAutoReconciliation.bind(null, 40)}>
          <Button type="submit" variant="outline">Lancer l'auto-rapprochement</Button>
        </form>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Aucun mouvement de tresorerie a rapprocher.
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Suggestion</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction: any) => {
                  const payment = transaction.suggestedPayment;
                  const bankTransaction = transaction.suggestedBankTransaction;
                  const suggestion = payment
                    ? `${payment.order?.orderNumber || payment.orderId} · ${formatCurrency(Number(payment.amount), payment.currency)}`
                    : bankTransaction
                      ? `${bankTransaction.reference || bankTransaction.description || bankTransaction.id} · ${formatCurrency(Number(bankTransaction.amount), bankTransaction.currency)}`
                      : "Aucune suggestion";

                  return (
                    <TableRow key={transaction.id}>
                      <TableCell>{new Date(transaction.createdAt).toLocaleDateString("fr-FR")}</TableCell>
                      <TableCell>
                        <div className="font-medium">{transaction.account.label}</div>
                        <div className="text-xs text-muted-foreground">{transaction.account.currency}</div>
                      </TableCell>
                      <TableCell>{transaction.type}</TableCell>
                      <TableCell className="max-w-[180px] truncate">{transaction.reference || "-"}</TableCell>
                      <TableCell>
                        <div className="text-sm">{suggestion}</div>
                        {transaction.matchScore != null && (
                          <div className="text-xs text-muted-foreground">
                            Score {Number(transaction.matchScore).toFixed(0)} · {transaction.matchMethod || "AUTO"}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(transaction.status)}>{transaction.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          {transaction.status === "SUGGESTED" && (transaction.matchedPaymentId || transaction.matchedBankTransactionId) ? (
                            <form action={confirmTreasuryReconciliation.bind(null, transaction.id)}>
                              <Button size="sm" type="submit">Confirmer</Button>
                            </form>
                          ) : null}

                          {transaction.status !== "PENDING" ? (
                            <form action={resetTreasuryReconciliation.bind(null, transaction.id)}>
                              <Button size="sm" variant="outline" type="submit">Reouvrir</Button>
                            </form>
                          ) : null}

                          {transaction.status !== "IGNORED" ? (
                            <form action={ignoreTreasuryReconciliation.bind(null, transaction.id)}>
                              <Button size="sm" variant="ghost" type="submit">Ignorer</Button>
                            </form>
                          ) : null}
                        </div>
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
  );
}
