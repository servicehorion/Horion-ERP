import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/data-table";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { getProducts } from "@/lib/actions/catalog.actions";
import type { ColumnDef } from "@tanstack/react-table";

export const metadata = {
  title: "Produits | Horion ERP",
  description: "Bibliotheque de produits du catalogue",
};

const STATUS_COLOR: Record<string, string> = {
  TESTING: "bg-yellow-100 text-yellow-800",
  TESTED: "bg-blue-100 text-blue-800",
  CURATED: "bg-green-100 text-green-800",
  BLACKLIST: "bg-red-100 text-red-800",
};

interface ProductTableRow {
  id: string;
  name: string;
  categoryName: string;
  status: string;
  moqMin: number | null;
  priceMin: number | null;
  priceMax: number | null;
  priceCurrency: string;
  supplierCount: number;
  qcCount: number;
}

const productColumns: ColumnDef<ProductTableRow, unknown>[] = [
  {
    accessorKey: "name",
    header: "Nom",
    cell: ({ row }) => (
      <Link
        href={`/catalog/products/${row.original.id}`}
        className="font-medium hover:underline"
      >
        {row.getValue("name")}
      </Link>
    ),
  },
  {
    accessorKey: "categoryName",
    header: "Categorie",
  },
  {
    accessorKey: "status",
    header: "Statut",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return (
        <Badge className={STATUS_COLOR[status] || "bg-gray-100 text-gray-800"}>
          {status}
        </Badge>
      );
    },
  },
  {
    accessorKey: "moqMin",
    header: "MOQ min",
    cell: ({ row }) => {
      const moq = row.getValue("moqMin") as number | null;
      return moq != null ? moq : "-";
    },
  },
  {
    accessorKey: "priceMin",
    header: "Prix range",
    cell: ({ row }) => {
      const min = row.original.priceMin;
      const max = row.original.priceMax;
      const currency = row.original.priceCurrency;
      if (min == null && max == null) return "-";
      return `${min ?? "?"}-${max ?? "?"} ${currency}`;
    },
  },
  {
    accessorKey: "supplierCount",
    header: "Fournisseurs",
  },
  {
    accessorKey: "qcCount",
    header: "QC",
  },
];

export default async function ProductsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Produits</h1>
          <p className="text-muted-foreground">
            Bibliotheque de produits du catalogue
          </p>
        </div>
        <Button asChild>
          <Link href="/catalog/products/new">
            <Plus className="mr-2 h-4 w-4" />
            Nouveau produit
          </Link>
        </Button>
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <ProductsList />
      </Suspense>
    </div>
  );
}

async function ProductsList() {
  const result = await getProducts({});

  if (result.error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
        {result.error}
      </div>
    );
  }

  const products = result.data || [];

  if (products.length === 0) {
    return (
      <EmptyState
        title="Aucun produit"
        description="Ajoutez votre premier produit au catalogue"
        actionLabel="Nouveau produit"
        actionHref="/catalog/products/new"
      />
    );
  }

  const tableData: ProductTableRow[] = products.map((product: any) => ({
    id: product.id,
    name: product.name,
    categoryName: product.category?.name || "-",
    status: product.status,
    moqMin: product.moqMin != null ? Number(product.moqMin) : null,
    priceMin: product.priceMin != null ? Number(product.priceMin) : null,
    priceMax: product.priceMax != null ? Number(product.priceMax) : null,
    priceCurrency: product.priceCurrency || "RMB",
    supplierCount: product._count?.supplierProducts ?? 0,
    qcCount: product._count?.qcReports ?? 0,
  }));

  return (
    <DataTable
      columns={productColumns}
      data={tableData}
      searchKey="name"
      searchPlaceholder="Rechercher un produit..."
    />
  );
}
