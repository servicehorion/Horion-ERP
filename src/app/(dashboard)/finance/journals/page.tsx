import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { AccountingService } from "@/lib/services/accounting.service";
import { LedgerService } from "@/lib/services/ledger.service";
import { createJournal, createJournalEntry } from "@/lib/actions/finance-advanced.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Journaux & Ecritures | Horion ERP" };

export default async function FinanceJournalsPage() {
  const user = await getSession();
  checkPermission(user.role, "finance.view");

  const [journals, entries, accounts] = await Promise.all([
    AccountingService.listJournals(user.tenantId),
    AccountingService.listJournalEntries(user.tenantId, 50),
    LedgerService.listAccounts(user.tenantId),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Journaux & Écritures" description="Journal général, ventes, banque" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Creer un journal</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createJournal} className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Input name="code" placeholder="Code" required />
              <Input name="name" placeholder="Nom" required />
              <select name="type" className="h-9 rounded-md border bg-transparent px-3 text-sm">
                {[
                  "GENERAL",
                  "SALES",
                  "PURCHASE",
                  "CASH",
                  "BANK",
                  "ADJUSTMENT",
                ].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <Button type="submit">Ajouter</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nouvelle ecriture</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createJournalEntry} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select name="journalId" className="h-9 rounded-md border bg-transparent px-3 text-sm" required>
                <option value="">Journal</option>
                {journals.map((j) => (
                  <option key={j.id} value={j.id}>{j.code} - {j.name}</option>
                ))}
              </select>
              <Input name="reference" placeholder="Reference" />
              <select name="debitAccountId" className="h-9 rounded-md border bg-transparent px-3 text-sm" required>
                <option value="">Compte debit</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                ))}
              </select>
              <select name="creditAccountId" className="h-9 rounded-md border bg-transparent px-3 text-sm" required>
                <option value="">Compte credit</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                ))}
              </select>
              <Input name="amount" type="number" step="0.01" placeholder="Montant" required />
              <Input name="currency" placeholder="Devise" defaultValue="XAF" />
              <Input name="description" placeholder="Description" required />
              <div className="flex items-center gap-2">
                <input type="hidden" name="postNow" value="true" />
                <Button type="submit" className="w-full">Poster</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Journaux</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Actif</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {journals.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="font-mono">{j.code}</TableCell>
                    <TableCell>{j.name}</TableCell>
                    <TableCell>{j.type}</TableCell>
                    <TableCell>{j.isActive ? "Oui" : "Non"}</TableCell>
                  </TableRow>
                ))}
                {journals.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      Aucun journal
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dernieres ecritures</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Journal</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Montant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => {
                  const total = e.lines.reduce((sum, l) => sum + Number(l.amount), 0) / 2;
                  return (
                    <TableRow key={e.id}>
                      <TableCell>{e.journal.code}</TableCell>
                      <TableCell>{e.reference || "-"}</TableCell>
                      <TableCell>{e.status}</TableCell>
                      <TableCell>{total.toFixed(0)}</TableCell>
                    </TableRow>
                  );
                })}
                {entries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      Aucune ecriture
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
