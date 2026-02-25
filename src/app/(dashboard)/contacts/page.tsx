import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { contactColumns, type ContactTableRow } from "@/components/contacts/contact-table";
import { ExportContactsButton } from "@/components/contacts/export-contacts-button";
import { getContacts } from "@/lib/actions/contact.actions";

export const metadata = {
  title: "Contacts | Horion ERP",
};

export default async function ContactsPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Contacts</h1>
          <p className="text-muted-foreground">
            Clients, fournisseurs et partenaires
          </p>
        </div>
        <div className="flex gap-2">
          <ExportContactsButton />
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90" asChild>
            <Link href="/contacts/new">
              <Plus className="mr-2 h-4 w-4" />
              Nouveau contact
            </Link>
          </Button>
        </div>
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <ContactsList />
      </Suspense>
    </div>
  );
}

async function ContactsList() {
  const result = await getContacts({});

  if (result.error) {
    return <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">{result.error}</div>;
  }

  const contacts = result.data || [];

  if (contacts.length === 0) {
    return (
      <EmptyState
        title="Aucun contact"
        description="Ajoutez votre premier client ou fournisseur"
        actionLabel="Nouveau contact"
        actionHref="/contacts/new"
      />
    );
  }

  const tableData: ContactTableRow[] = contacts.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    company: c.company,
    phone: c.phone,
    email: c.email,
    city: c.city,
    trustScore: c.trustScore,
    ordersCount: c._count.orders,
    leadsCount: c._count.leads,
    createdAt: c.createdAt,
  }));

  return (
    <DataTable
      columns={contactColumns}
      data={tableData}
      searchKey="name"
      searchPlaceholder="Rechercher un contact..."
    />
  );
}
