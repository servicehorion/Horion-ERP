import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ContactForm } from "@/components/contacts/contact-form";

export const metadata = {
  title: "Nouveau contact | Horion ERP",
};

export default function NewContactPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/contacts"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Nouveau contact</h1>
          <p className="text-muted-foreground">Ajouter un client, fournisseur ou partenaire</p>
        </div>
      </div>
      <div className="mx-auto max-w-3xl">
        <ContactForm />
      </div>
    </div>
  );
}
