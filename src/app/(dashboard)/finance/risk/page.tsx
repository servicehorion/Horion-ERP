import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { MarketService } from "@/lib/services/market.service";
import { upsertMarketData, createExposure, createRiskMetric } from "@/lib/actions/finance-advanced.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Risk & Market Data | Horion ERP" };

export default async function FinanceRiskPage() {
  const user = await getSession();
  checkPermission(user.role, "finance.view");

  const [market, exposures, risks] = await Promise.all([
    MarketService.listMarketData(user.tenantId),
    MarketService.listExposures(user.tenantId),
    MarketService.listRiskMetrics(user.tenantId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Risk & market data</h1>
        <p className="text-muted-foreground">Expositions, spreads, data marche</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Market data</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={upsertMarketData} className="grid grid-cols-1 gap-2 mb-4">
              <Input name="symbol" placeholder="Symbol" required />
              <Input name="name" placeholder="Nom" />
              <Input name="type" placeholder="Type" />
              <Input name="lastPrice" type="number" step="0.0001" placeholder="Last" required />
              <Input name="changePct" type="number" step="0.01" placeholder="Change %" />
              <Button type="submit">Ajouter</Button>
            </form>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Last</TableHead>
                    <TableHead>Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {market.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono">{m.symbol}</TableCell>
                      <TableCell>{Number(m.lastPrice).toFixed(4)}</TableCell>
                      <TableCell>{m.changePct ? `${Number(m.changePct).toFixed(2)}%` : "-"}</TableCell>
                    </TableRow>
                  ))}
                  {market.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                        Aucune data
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
            <CardTitle>Expositions</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createExposure} className="grid grid-cols-1 gap-2 mb-4">
              <select name="type" className="h-9 rounded-md border bg-transparent px-3 text-sm">
                <option value="FX">FX</option>
                <option value="CUSTOMER">CUSTOMER</option>
                <option value="SUPPLIER">SUPPLIER</option>
              </select>
              <Input name="currency" placeholder="Devise" />
              <Input name="amount" type="number" step="0.01" placeholder="Montant" required />
              <Input name="counterparty" placeholder="Contrepartie" />
              <Input name="dueAt" type="date" />
              <Button type="submit">Ajouter</Button>
            </form>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Devise</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exposures.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell>{e.type}</TableCell>
                      <TableCell>{Number(e.amount).toFixed(2)}</TableCell>
                      <TableCell>{e.currency || "-"}</TableCell>
                    </TableRow>
                  ))}
                  {exposures.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                        Aucune exposition
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
            <CardTitle>Risk metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createRiskMetric} className="grid grid-cols-1 gap-2 mb-4">
              <select name="type" className="h-9 rounded-md border bg-transparent px-3 text-sm">
                <option value="FX">FX</option>
                <option value="CREDIT">CREDIT</option>
                <option value="LIQUIDITY">LIQUIDITY</option>
                <option value="MARKET">MARKET</option>
              </select>
              <Input name="value" type="number" step="0.01" placeholder="Valeur" required />
              <Input name="status" placeholder="Status" defaultValue="OK" />
              <Button type="submit">Ajouter</Button>
            </form>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Valeur</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {risks.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.type}</TableCell>
                      <TableCell>{Number(r.value).toFixed(2)}</TableCell>
                      <TableCell>{r.status}</TableCell>
                    </TableRow>
                  ))}
                  {risks.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                        Aucune mesure
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
