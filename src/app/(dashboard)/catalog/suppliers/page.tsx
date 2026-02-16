import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { supplierColumns, type SupplierTableRow } from "@/components/catalog/supplier-table";
import { getSuppliers } from "@/lib/actions/catalog.actions";

export const metadata = {
  title: "Fournisseurs | Horion ERP",
};

export default async function SuppliersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Fournisseurs</h1>
          <p className="text-muted-foreground">
            Biblioth&egrave;que des fournisseurs du catalogue
          </p>
        </div>
        <Button asChild>
          <Link href="/catalog/suppliers/new">
            <Plus className="mr-2 h-4 w-4" />
            Nouveau fournisseur
          </Link>
        </Button>
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <SuppliersList />
      </Suspense>
    </div>
  );
}

async function SuppliersList() {
  const result = await getSuppliers({});

  if (result.error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
        {result.error}
      </div>
    );
  }

  const suppliers = result.data || [];

  if (suppliers.length === 0) {
    return (
      <EmptyState
        title="Aucun fournisseur"
        description="Ajoutez votre premier fournisseur au catalogue"
        actionLabel="Nouveau fournisseur"
        actionHref="/catalog/suppliers/new"
      />
    );
  }

  const tableData: SupplierTableRow[] = suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    city: s.city,
    platform: s.platform,
    status: s.status,
    rating: s.rating,
    productsCount: s._count.supplierProducts,
    offersCount: s._count.offers,
    createdAt: s.createdAt,
  }));

  return (
    <DataTable
      columns={supplierColumns}
      data={tableData}
      searchKey="name"
      searchPlaceholder="Rechercher un fournisseur..."
    />
  );
}
