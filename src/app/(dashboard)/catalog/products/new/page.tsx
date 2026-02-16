import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ProductForm } from "@/components/catalog/product-form";
import { getCategories } from "@/lib/actions/catalog.actions";

export const metadata = {
  title: "Nouveau produit | Horion ERP",
  description: "Ajouter un nouveau produit au catalogue",
};

export default async function NewProductPage() {
  const categoriesResult = await getCategories();
  const categories = categoriesResult.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/catalog/products">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Nouveau produit</h1>
          <p className="text-muted-foreground">
            Ajouter un nouveau produit au catalogue
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl">
        <ProductForm
          categories={categories.map((c: any) => ({ id: c.id, name: c.name }))}
        />
      </div>
    </div>
  );
}
