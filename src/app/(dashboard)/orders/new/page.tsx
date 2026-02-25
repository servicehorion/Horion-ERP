import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { OrderForm } from "@/components/orders/order-form";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Nouvelle commande | Horion ERP",
  description: "Créer une nouvelle commande d'importation",
};

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams?: { contactId?: string };
}) {
  const session = await auth();

  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  // Fetch contacts for the dropdown
  const contacts = await prisma.contact.findMany({
    where: {
      tenantId: session.user.tenantId,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/orders">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Nouvelle commande</h1>
          <p className="text-muted-foreground">
            Créer une nouvelle commande d'importation
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl">
        <OrderForm contacts={contacts} initialContactId={searchParams?.contactId} />
      </div>
    </div>
  );
}
