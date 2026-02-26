import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { OrderForm } from "@/components/orders/order-form";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getOrderById } from "@/lib/actions/order.actions";
import { redirect, notFound } from "next/navigation";

export const metadata = {
  title: "Modifier commande | Horion ERP",
  description: "Modifier une commande d'importation",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditOrderPage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  const { id } = await params;
  const result = await getOrderById(id);

  if (result.error || !result.data) {
    notFound();
  }

  const order = result.data as any;

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

  const initialValues = {
    contactId: order.contactId,
    items: (order.items || []).map((item: any) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      currency: item.currency,
      hsCode: item.hsCode,
      weight: item.weight ? Number(item.weight) : undefined,
      volume: item.volume ? Number(item.volume) : undefined,
      notes: item.notes,
    })),
    priority: order.priority,
    destinationCity: order.destinationCity,
    notes: order.notes || "",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/orders/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Modifier la commande</h1>
          <p className="text-muted-foreground">
            Mettre à jour les informations de la commande
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl">
        <OrderForm
          contacts={contacts}
          mode="edit"
          orderId={id}
          initialValues={initialValues}
        />
      </div>
    </div>
  );
}
