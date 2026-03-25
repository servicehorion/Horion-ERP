import { Plus, Users, UserCheck, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ExportContactsButton } from "@/components/contacts/export-contacts-button";
import { ImportCsvDialog } from "@/components/contacts/import-csv-dialog";
import { ContactsTableClient, type ContactRow } from "@/components/contacts/contacts-table-client";
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
          <ImportCsvDialog />
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
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
        {result.error}
      </div>
    );
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

  const prospects = contacts.filter((c) => c.type === "PROSPECT").length;
  const clients = contacts.filter((c) => c.type === "CLIENT").length;
  const leadsActifs = contacts.filter(
    (c) => (c._count?.leads ?? 0) > 0 && c.type !== "CLIENT"
  ).length;

  const tableData: ContactRow[] = contacts.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    company: c.company,
    phone: c.phone,
    whatsapp: (c as any).whatsapp ?? null,
    email: c.email,
    city: c.city,
    trustScore: c.trustScore,
    ordersCount: c._count?.orders ?? 0,
    leadsCount: c._count?.leads ?? 0,
    tags: (c as any).tags ?? [],
    createdAt: c.createdAt,
  }));

  return (
    <div className="space-y-6">
      {/* Funnel KPI bar */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Prospects
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{prospects}</div>
            <p className="text-xs text-muted-foreground mt-1">À qualifier</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Leads actifs
            </CardTitle>
            <Users className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leadsActifs}</div>
            <p className="text-xs text-muted-foreground mt-1">En pipeline</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Clients
            </CardTitle>
            <UserCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clients}</div>
            <p className="text-xs text-muted-foreground mt-1">Convertis</p>
          </CardContent>
        </Card>
      </div>

      <ContactsTableClient data={tableData} />
    </div>
  );
}
