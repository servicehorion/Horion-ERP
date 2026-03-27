import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { InvoiceService } from "@/lib/services/invoice.service";
import { createInvoice, updateInvoiceStatus, addInvoiceReminder, addInvoiceSchedule, autoSendInvoiceReminders } from "@/lib/actions/finance-advanced.actions";
import { FinanceTransactionService } from "@/lib/services/finance-transaction.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/config/currencies";

export const metadata = { title: "Facturation AP/AR | Horion ERP" };

export default async function FinanceInvoicesPage() {
  const user = await getSession();
  checkPermission(user.role, "finance.view");

  const [invoiceOpsRows, invoices, contacts, suppliers, orders] = await Promise.all([
    FinanceTransactionService.getInvoiceRows(user.tenantId),
    InvoiceService.list(user.tenantId),
    prisma.contact.findMany({ where: { tenantId: user.tenantId }, orderBy: { name: "asc" }, take: 200 }),
    prisma.supplier.findMany({ orderBy: { name: "asc" }, take: 200 }),
    prisma.order.findMany({ where: { tenantId: user.tenantId }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Facturation AP/AR" description="Factures clients et fournisseurs" />

      <Card>
        <CardHeader>
          <CardTitle>Nouvelle facture</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createInvoice} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <select name="direction" className="h-9 rounded-md border bg-transparent px-3 text-sm" required>
              <option value="AR">AR (clients)</option>
              <option value="AP">AP (fournisseurs)</option>
            </select>
            <Input name="invoiceNumber" placeholder="Numero" required />
            <select name="contactId" className="h-9 rounded-md border bg-transparent px-3 text-sm">
              <option value="">Client</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select name="supplierId" className="h-9 rounded-md border bg-transparent px-3 text-sm">
              <option value="">Fournisseur</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select name="orderId" className="h-9 rounded-md border bg-transparent px-3 text-sm">
              <option value="">Commande</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>{o.orderNumber}</option>
              ))}
            </select>
            <Input name="currency" placeholder="Devise" defaultValue="XAF" />
            <Input name="issuedAt" type="date" />
            <Input name="dueAt" type="date" />
            <Input name="lineDescription" placeholder="Description" required />
            <Input name="quantity" type="number" step="1" defaultValue="1" />
            <Input name="unitPrice" type="number" step="0.01" placeholder="Prix unitaire" required />
            <Input name="taxRate" type="number" step="0.01" placeholder="TVA %" />
            <Input name="scheduleDueAt" type="date" />
            <Input name="scheduleAmount" type="number" step="0.01" placeholder="Echeance montant" />
            <Input name="notes" placeholder="Notes" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="requireApproval" value="true" />
              Soumettre a approbation
            </label>
            <Button type="submit">Creer facture</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Facturation operationnelle</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Commande</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Facture</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Montant facture</TableHead>
                  <TableHead>Encaisse</TableHead>
                  <TableHead>Reste</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoiceOpsRows.map((row) => (
                  <TableRow key={row.orderId}>
                    <TableCell className="font-mono">{row.orderNumber}</TableCell>
                    <TableCell>{row.clientName}</TableCell>
                    <TableCell>{row.invoiceNumber || "-"}</TableCell>
                    <TableCell>{row.invoiceStatus}</TableCell>
                    <TableCell>{formatCurrency(row.billedAmount, row.currency as any)}</TableCell>
                    <TableCell>{formatCurrency(row.collectedAmount, "XAF")}</TableCell>
                    <TableCell>{formatCurrency(row.outstandingAmount, "XAF")}</TableCell>
                  </TableRow>
                ))}
                {invoiceOpsRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                      Aucun flux de facturation operationnelle.
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
          <div className="flex items-center justify-between">
            <CardTitle>Registre factures ({invoices.length})</CardTitle>
            <form action={autoSendInvoiceReminders}>
              <Button size="sm" variant="outline">Relances automatiques</Button>
            </form>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numero</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Client/Fournisseur</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv: any) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono">{inv.invoiceNumber}</TableCell>
                    <TableCell>{inv.direction}</TableCell>
                    <TableCell>{inv.contact?.name || inv.supplier?.name || "-"}</TableCell>
                    <TableCell>{inv.status}</TableCell>
                    <TableCell>{Number(inv.total).toFixed(0)} {inv.currency}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <form className="inline" action={updateInvoiceStatus.bind(null, inv.id, "SENT")}
                      >
                        <Button size="sm" variant="outline">Envoyer</Button>
                      </form>
                      <form className="inline" action={updateInvoiceStatus.bind(null, inv.id, "PAID")}
                      >
                        <Button size="sm" variant="outline">Payer</Button>
                      </form>
                      <form className="inline" action={addInvoiceReminder}>
                        <input type="hidden" name="invoiceId" value={inv.id} />
                        <input type="hidden" name="channel" value="email" />
                        <Button size="sm" variant="ghost">Relancer</Button>
                      </form>
                      <form className="inline" action={addInvoiceSchedule}>
                        <input type="hidden" name="invoiceId" value={inv.id} />
                        <input type="date" name="dueAt" className="h-8 rounded-md border px-2 text-xs" />
                        <input type="number" name="amount" step="0.01" className="h-8 w-24 rounded-md border px-2 text-xs" placeholder="Montant" />
                        <Button size="sm" variant="ghost">Echeancier</Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
                {invoices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                      Aucune facture
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
          <CardTitle>Aging AR</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Facture</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Jours de retard</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoiceOpsRows
                  .filter((row) => row.outstandingAmount > 0)
                  .map((row) => (
                  <TableRow key={row.orderId}>
                    <TableCell className="font-mono">{row.invoiceNumber || row.orderNumber}</TableCell>
                    <TableCell>{row.clientName || "-"}</TableCell>
                    <TableCell>{formatCurrency(row.outstandingAmount, "XAF")}</TableCell>
                    <TableCell>{row.lastCollectedAt ? new Date(row.lastCollectedAt).toLocaleDateString("fr-FR") : "-"}</TableCell>
                    <TableCell>{row.outstandingAmount > 0 ? "Ouvert" : "Solde"}</TableCell>
                  </TableRow>
                ))}
                {invoiceOpsRows.filter((row) => row.outstandingAmount > 0).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      Aucune creance en retard
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
