import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ContactForm } from "@/components/contacts/contact-form";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata = {
  title: "Nouveau contact | Horion ERP",
};

export default async function NewContactPage() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  const members = await prisma.user.findMany({
    where: { tenantId: session.user.tenantId, isActive: true },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });

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
        <ContactForm teamMembers={members} currentUserId={session.user.id} />
      </div>
    </div>
  );
}
