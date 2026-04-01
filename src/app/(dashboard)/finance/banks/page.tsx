import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { BankService } from "@/lib/services/bank.service";
import { createBankConnection, addBankTransaction, reconcileBankTransaction, autoReconcileBankTransactions, syncBankTransactions } from "@/lib/actions/finance-advanced.actions";
import { BankReconciliationPanel } from "@/components/finance/bank-reconciliation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { FinanceTransactionService } from "@/lib/services/finance-transaction.service";
import { formatCurrency } from "@/config/currencies";

export const metadata = { title: "Banques & Reconciliation | Horion ERP" };

async function createBankConnectionAction(formData: FormData): Promise<void> {
  "use server";
  await createBankConnection(formData);
}

async function addBankTransactionAction(formData: FormData): Promise<void> {
  "use server";
  await addBankTransaction(formData);
}

async function reconcileBankTransactionAction(transactionId: string): Promise<void> {
  "use server";
  await reconcileBankTransaction(transactionId);
}

async function autoReconcileBankTransactionsAction(): Promise<void> {
  "use server";
  await autoReconcileBankTransactions();
}

async function syncBankTransactionsAction(connectionId: string): Promise<void> {
  "use server";
  await syncBankTransactions(connectionId);
}

export default async function FinanceBanksPage() {
  const user = await getSession();
  checkPermission(user.role, "finance.view");

  const [connections, transactions] = await Promise.all([
    BankService.listConnections(user.tenantId),
    BankService.listTransactions(user.tenantId),
  ]);
  const ledgerTransactions = await FinanceTransactionService.getBankLedger(user.tenantId);

  const ledgerEntryIds = transactions
    .map((t) => (t.metadata as Record<string, unknown> | null)?.ledgerEntryId)
    .filter((id): id is string => typeof id === "string");
  const ledgerEntries = ledgerEntryIds.length
    ? await prisma.ledgerEntry.findMany({
        where: { id: { in: ledgerEntryIds } },
        include: { account: true },
      })
    : [];
  const ledgerMap = Object.fromEntries(ledgerEntries.map((e) => [e.id, e]));

  return (
    <div className="space-y-6">
      <PageHeader title="Banques & Réconciliation" description="Intégrations temps réel et rapprochements" />

      <Card>
        <CardHeader>
          <CardTitle>Nouvelle connexion bancaire</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createBankConnectionAction} className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <Input name="provider" placeholder="Provider (BGFI, ECOBANK)" required />
            <Input name="accountName" placeholder="Nom compte" />
            <Input name="accountNumber" placeholder="Numero" />
            <Input name="currency" defaultValue="XAF" />
            <Input name="apiBaseUrl" placeholder="API Base URL (optionnel)" />
            <Input name="clientId" placeholder="Client ID (optionnel)" />
            <Input name="clientSecret" placeholder="Client Secret (optionnel)" />
            <Input name="accessToken" placeholder="Access Token (optionnel)" />
            <Input name="refreshToken" placeholder="Refresh Token (optionnel)" />
            <Input name="webhookSecret" placeholder="Webhook Secret (optionnel)" />
            <Button type="submit" className="md:col-span-2">Ajouter</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Flux bancaires unifies</CardTitle>
            <form action={autoReconcileBankTransactionsAction}>
              <Button size="sm" variant="outline">Auto-reconcile</Button>
            </form>
          </div>
        </CardHeader>
        <CardContent>
          {connections.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {connections.map((c) => (
                <form key={c.id} action={syncBankTransactionsAction.bind(null, c.id)}>
                  <Button size="sm" variant="outline">
                    Sync {c.provider}
                  </Button>
                </form>
              ))}
            </div>
          )}
          <form action={addBankTransactionAction} className="grid grid-cols-1 md:grid-cols-8 gap-2 mb-4">
            <select name="connectionId" className="h-9 rounded-md border bg-transparent px-3 text-sm" required>
              <option value="">Connexion</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>{c.provider} - {c.accountName || c.accountNumber || ""}</option>
              ))}
            </select>
            <Input name="occurredAt" type="date" required />
            <Input name="amount" type="number" step="0.01" placeholder="Montant" required />
            <Input name="currency" defaultValue="XAF" />
            <select name="direction" className="h-9 rounded-md border bg-transparent px-3 text-sm">
              <option value="IN">IN</option>
              <option value="OUT">OUT</option>
            </select>
            <Input name="counterparty" placeholder="Contrepartie" />
            <Input name="category" placeholder="Categorie" />
            <Input name="description" placeholder="Description" />
            <Input name="reference" placeholder="Reference" />
            <Button type="submit">Ajouter</Button>
          </form>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerTransactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{(t.completedAt || t.createdAt).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell>{t.walletCode}</TableCell>
                    <TableCell>{t.sourceType}</TableCell>
                    <TableCell>{t.direction}</TableCell>
                    <TableCell>{formatCurrency(Number(t.amountXAF), "XAF")}</TableCell>
                    <TableCell>{t.status}</TableCell>
                    <TableCell>{t.reference || "-"}</TableCell>
                  </TableRow>
                ))}
                {ledgerTransactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                      Aucune transaction
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
          <CardTitle>Transactions bancaires brutes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Compte</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.occurredAt.toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell>{t.connection.accountName || t.connection.accountNumber || t.connection.provider}</TableCell>
                    <TableCell>{t.direction}</TableCell>
                    <TableCell>{Number(t.amount).toFixed(2)} {t.currency}</TableCell>
                    <TableCell>{t.status}</TableCell>
                    <TableCell>{t.matchScore ? `${Number(t.matchScore).toFixed(0)}%` : "-"}</TableCell>
                    <TableCell className="text-right">
                      {t.status !== "RECONCILED" && (
                        <form action={reconcileBankTransactionAction.bind(null, t.id)}>
                          <Button size="sm" variant="outline">Reconciler</Button>
                        </form>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {transactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                      Aucune transaction
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <BankReconciliationPanel
        connections={connections}
        transactions={transactions}
        ledgerEntries={ledgerMap}
      />
    </div>
  );
}
