import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SupplierForm } from "@/components/catalog/supplier-form";

export const metadata = {
  title: "Nouveau fournisseur | Horion ERP",
};

export default function NewSupplierPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/catalog/suppliers">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Nouveau fournisseur</h1>
          <p className="text-muted-foreground">
            Ajouter un fournisseur au catalogue
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-3xl">
        <SupplierForm />
      </div>
    </div>
  );
}
