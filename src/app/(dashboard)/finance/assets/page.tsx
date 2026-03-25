import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { AssetService } from "@/lib/services/asset.service";
import { createAssetCategory, createFixedAsset, runAssetDepreciation } from "@/lib/actions/finance-advanced.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Immobilisations | Horion ERP" };

async function createAssetCategoryAction(formData: FormData): Promise<void> {
  "use server";
  await createAssetCategory(formData);
}

async function runAssetDepreciationAction(formData: FormData): Promise<void> {
  "use server";
  await runAssetDepreciation(formData);
}

async function createFixedAssetAction(formData: FormData): Promise<void> {
  "use server";
  await createFixedAsset(formData);
}

export default async function FinanceAssetsPage() {
  const user = await getSession();
  checkPermission(user.role, "finance.view");

  const [categories, assets] = await Promise.all([
    AssetService.listCategories(user.tenantId),
    AssetService.listAssets(user.tenantId),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Immobilisations" description="Registre des actifs et amortissements" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Nouvelle categorie</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createAssetCategoryAction} className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input name="name" placeholder="Nom" required />
              <Input name="code" placeholder="Code" />
              <Button type="submit">Ajouter</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Run amortissement</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={runAssetDepreciationAction} className="flex items-center gap-3">
              <Input name="period" placeholder="Periode (ex: 2026-03)" required />
              <Button type="submit">Calculer</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nouvel actif</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createFixedAssetAction} className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <Input name="name" placeholder="Nom actif" required />
            <select name="categoryId" className="h-9 rounded-md border bg-transparent px-3 text-sm">
              <option value="">Categorie</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <Input name="acquisitionDate" type="date" required />
            <Input name="acquisitionCost" type="number" step="0.01" placeholder="Cout" required />
            <Input name="usefulLifeMonths" type="number" placeholder="Duree (mois)" required />
            <Input name="salvageValue" type="number" step="0.01" placeholder="Valeur residuelle" />
            <Input name="currency" defaultValue="XAF" />
            <Button type="submit">Ajouter</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Actifs ({assets.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Categorie</TableHead>
                  <TableHead>Valeur brute</TableHead>
                  <TableHead>Amort. cumule</TableHead>
                  <TableHead>Valeur nette</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>{a.category?.name || "-"}</TableCell>
                    <TableCell>{Number(a.acquisitionCost).toFixed(0)} {a.currency}</TableCell>
                    <TableCell>{Number(a.accumulatedDepreciation).toFixed(0)} {a.currency}</TableCell>
                    <TableCell>{Number(a.netBookValue).toFixed(0)} {a.currency}</TableCell>
                    <TableCell>{a.status}</TableCell>
                  </TableRow>
                ))}
                {assets.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                      Aucun actif
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
