import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { LeadForm } from "@/components/crm/lead-form";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getLeadById } from "@/lib/actions/contact.actions";
import { serializeDecimals } from "@/lib/utils";

export const metadata = {
  title: "Modifier lead | Horion ERP",
};

export default async function EditLeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  const { id } = await params;
  const leadResult = await getLeadById(id);
  if (leadResult.error || !leadResult.data) {
    notFound();
  }

  const lead = serializeDecimals(leadResult.data);

  const [contacts, members] = await Promise.all([
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
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/crm/leads/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Modifier lead</h1>
          <p className="text-muted-foreground">{lead.contact.name}</p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl">
        <LeadForm
          lead={{
            id: lead.id,
            contactId: lead.contactId,
            source: lead.source,
            description: lead.description,
            estimatedValue: lead.estimatedValue ? Number(lead.estimatedValue) : null,
            currency: lead.currency,
            category: lead.category,
            assignedTo: lead.assignedTo,
            ownerId: (lead as any).ownerId || undefined,
            collaboratorIds: Array.isArray((lead as any).collaborators)
              ? (lead as any).collaborators.map((c: any) => c.userId || c.user?.id).filter(Boolean)
              : [],
          }}
          contacts={contacts}
          teamMembers={members}
          currentUserId={session.user.id}
        />
      </div>
    </div>
  );
}
