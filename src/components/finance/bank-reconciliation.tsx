import { importBankStatement, markUnreconciled } from "@/lib/actions/bank-reconciliation.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BankConnection, BankTransaction, LedgerEntry, LedgerAccount } from "@prisma/client";

type LedgerEntryWithAccount = LedgerEntry & { account: LedgerAccount };

export function BankReconciliationPanel({
  connections,
  transactions,
  ledgerEntries,
}: {
  connections: BankConnection[];
  transactions: BankTransaction[];
  ledgerEntries: Record<string, LedgerEntryWithAccount>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Import CSV & rapprochement</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={importBankStatement} encType="multipart/form-data" className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select name="connectionId" className="h-9 rounded-md border bg-transparent px-3 text-sm" required>
            <option value="">Connexion</option>
            {connections.map((c) => (
              <option key={c.id} value={c.id}>{c.provider} - {c.accountName || c.accountNumber || ""}</option>
            ))}
          </select>
          <input name="file" type="file" accept=".csv" className="h-9 rounded-md border px-3 text-sm" required />
          <Button type="submit">Importer CSV</Button>
        </form>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Match Ledger</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t) => {
                const meta = (t.metadata || {}) as Record<string, unknown>;
                const ledgerId = typeof meta.ledgerEntryId === "string" ? meta.ledgerEntryId : null;
                const ledger = ledgerId ? ledgerEntries[ledgerId] : null;
                return (
                  <TableRow key={t.id}>
                    <TableCell>{t.occurredAt.toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell className="max-w-[240px] truncate">{t.description || t.reference || "-"}</TableCell>
                    <TableCell>{Number(t.amount).toFixed(2)} {t.currency}</TableCell>
                    <TableCell>
                      {ledger ? (
                        <div className="text-xs">
                          <div className="font-medium">{ledger.description}</div>
                          <div className="text-muted-foreground">
                            {Number(ledger.amount).toFixed(2)} {ledger.currency} • {ledger.createdAt.toLocaleDateString("fr-FR")}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Aucun match</span>
                      )}
                    </TableCell>
                    <TableCell>{t.status}</TableCell>
                    <TableCell className="text-right">
                      {t.status === "RECONCILED" && (
                        <form action={markUnreconciled.bind(null, t.id)}>
                          <Button size="sm" variant="outline">Annuler</Button>
                        </form>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    Aucun relevé importé
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
