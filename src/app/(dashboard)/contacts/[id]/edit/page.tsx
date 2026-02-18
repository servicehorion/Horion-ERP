import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ContactForm } from "@/components/contacts/contact-form";
import { getContactById } from "@/lib/actions/contact.actions";

export const metadata = {
  title: "Modifier contact | Horion ERP",
};

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getContactById(id);

  if (result.error || !result.data) {
    notFound();
  }

  const contact = result.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/contacts/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Modifier le contact</h1>
          <p className="text-muted-foreground">{contact.name}</p>
        </div>
      </div>
      <div className="mx-auto max-w-3xl">
        <ContactForm
          contact={{
            id: contact.id,
            name: contact.name,
            type: contact.type,
            company: contact.company,
            phone: contact.phone,
            email: contact.email,
            whatsapp: contact.whatsapp,
            city: contact.city,
            country: contact.country,
            notes: contact.notes,
          }}
        />
      </div>
    </div>
  );
}
