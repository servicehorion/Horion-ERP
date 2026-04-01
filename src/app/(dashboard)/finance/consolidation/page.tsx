import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { ConsolidationService } from "@/lib/services/consolidation.service";
import { FxService } from "@/lib/services/fx.service";
import { createLegalEntity, createConsolidationRun, addConsolidationLine } from "@/lib/actions/finance-advanced.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Consolidation Multi-entites | Horion ERP" };

export default async function FinanceConsolidationPage() {
  const user = await getSession();
  checkPermission(user.role, "finance.view");

  const [entities, runs] = await Promise.all([
    ConsolidationService.listEntities(user.tenantId),
    ConsolidationService.listRuns(user.tenantId),
  ]);
  const fxRates = await FxService.getLatestRates();
  const toBase = (amount: number, currency: string, baseCurrency: string) => {
    if (currency === baseCurrency) return amount;
    if (baseCurrency === "XAF") {
      const key = `${currency}_XAF`;
      const rate = fxRates[key];
      if (rate) return amount * rate;
    }
    return amount;
  };
  const runTotalMap = Object.fromEntries(
    runs.map((r) => [
      r.id,
      (r.lines || []).reduce(
        (sum, line) => sum + toBase(Number(line.amount), line.currency, r.baseCurrency),
        0
      ),
    ])
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Consolidation Multi-Entités" description="Consolidation, réévaluation, hedge" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Nouvelle entite</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createLegalEntity} className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Input name="name" placeholder="Nom" required />
              <Input name="country" placeholder="Pays" />
              <Input name="baseCurrency" defaultValue="XAF" />
              <Input name="taxId" placeholder="Numéro fiscal" />
              <Button type="submit">Ajouter</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nouvelle consolidation</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createConsolidationRun} className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input name="baseCurrency" defaultValue="XAF" />
              <Input name="notes" placeholder="Notes" />
              <Button type="submit">Creer</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Entites juridiques</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Pays</TableHead>
                  <TableHead>Devise</TableHead>
                  <TableHead>Tax ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entities.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell>{e.country || "-"}</TableCell>
                    <TableCell>{e.baseCurrency}</TableCell>
                    <TableCell>{e.taxId || "-"}</TableCell>
                  </TableRow>
                ))}
                {entities.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      Aucune entite
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
          <CardTitle>Runs de consolidation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Statut</TableHead>
                  <TableHead>Devise base</TableHead>
                  <TableHead>Total base</TableHead>
                  <TableHead>Ajouter ligne</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.status}</TableCell>
                    <TableCell>{r.baseCurrency}</TableCell>
                    <TableCell>{Number(runTotalMap[r.id] || 0).toFixed(0)} {r.baseCurrency}</TableCell>
                    <TableCell>
                      <form action={addConsolidationLine} className="grid grid-cols-1 md:grid-cols-5 gap-2">
                        <input type="hidden" name="runId" value={r.id} />
                        <select name="entityId" className="h-8 rounded-md border bg-transparent px-2 text-xs" required>
                          <option value="">Entite</option>
                          {entities.map((e) => (
                            <option key={e.id} value={e.id}>{e.name}</option>
                          ))}
                        </select>
                        <Input name="metric" placeholder="Indicateur" className="h-8" required />
                        <Input name="amount" type="number" step="0.01" className="h-8" required />
                        <Input name="currency" defaultValue={r.baseCurrency} className="h-8" />
                        <Button size="sm" variant="outline">Ajouter</Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
                {runs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                      Aucun run
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
