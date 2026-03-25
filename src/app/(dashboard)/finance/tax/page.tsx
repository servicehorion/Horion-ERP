import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { TaxService } from "@/lib/services/tax.service";
import { createTaxRate, createTaxReport, addTaxLine, markTaxReportFiled } from "@/lib/actions/finance-advanced.actions";
import { VatExportButton } from "@/components/finance/vat-export-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Fiscalite & Conformite | Horion ERP" };

export default async function FinanceTaxPage() {
  const user = await getSession();
  checkPermission(user.role, "finance.view");

  const [rates, reports] = await Promise.all([
    TaxService.listRates(user.tenantId),
    TaxService.listReports(user.tenantId),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Fiscalité & Conformité" description="TVA, déclarations, rapports" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Nouveau taux de taxe</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createTaxRate} className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Input name="name" placeholder="Nom" required />
              <Input name="rate" type="number" step="0.01" placeholder="Taux %" required />
              <Input name="type" placeholder="Type" defaultValue="VAT" />
              <Input name="country" placeholder="Pays" />
              <Button type="submit">Ajouter</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nouveau rapport fiscal</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createTaxReport} className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Input name="type" placeholder="Type" defaultValue="VAT" />
              <Input name="currency" defaultValue="XAF" />
              <Input name="periodStart" type="date" />
              <Input name="periodEnd" type="date" />
              <Input name="dueAt" type="date" />
              <Button type="submit">Creer</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Taux</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Taux</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Pays</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{Number(r.rate).toFixed(2)}%</TableCell>
                    <TableCell>{r.type}</TableCell>
                    <TableCell>{r.country || "-"}</TableCell>
                  </TableRow>
                ))}
                {rates.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      Aucun taux
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
          <CardTitle>Rapports fiscaux</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Total taxe</TableHead>
                  <TableHead>Ajouter ligne</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.type}</TableCell>
                    <TableCell>{r.status}</TableCell>
                    <TableCell>{Number(r.totalTax).toFixed(0)} {r.currency}</TableCell>
                    <TableCell>
                      <form action={addTaxLine} className="flex items-center gap-2">
                        <input type="hidden" name="reportId" value={r.id} />
                        <Input name="name" placeholder="Libelle" className="h-8" required />
                        <Input name="base" type="number" step="0.01" className="h-8 w-28" required />
                        <Input name="taxAmount" type="number" step="0.01" className="h-8 w-28" required />
                        <Button size="sm" variant="outline">Ajouter</Button>
                      </form>
                      <form action={markTaxReportFiled.bind(null, r.id)} className="mt-2">
                        <Button size="sm" variant="ghost">Marquer declare</Button>
                      </form>
                      <div className="mt-2">
                        <VatExportButton reportId={r.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {reports.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      Aucun rapport
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
