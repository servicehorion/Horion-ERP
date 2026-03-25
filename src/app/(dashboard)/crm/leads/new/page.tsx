import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { LeadForm } from "@/components/crm/lead-form";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export const metadata = {
  title: "Nouveau lead | Horion ERP",
  description: "Creer un nouveau lead",
};

export default async function NewLeadPage() {
  const session = await auth();

  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  const [contacts, members, salesTeams, territories] = await Promise.all([
    prisma.contact.findMany({
      where: { tenantId: session.user.tenantId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { tenantId: session.user.tenantId, isActive: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.salesTeam.findMany({
      where: { tenantId: session.user.tenantId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.salesTerritory.findMany({
      where: { tenantId: session.user.tenantId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/crm/leads">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Nouveau lead</h1>
          <p className="text-muted-foreground">Creer un lead dans le CRM</p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl">
        <LeadForm
          contacts={contacts}
          teamMembers={members}
          salesTeams={salesTeams}
          territories={territories}
          currentUserId={session.user.id}
        />
      </div>
    </div>
  );
}
