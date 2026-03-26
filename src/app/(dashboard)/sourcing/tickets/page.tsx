import Link from "next/link";
import { ArrowLeft, Ticket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { SourcingTicketBoard } from "@/components/sourcing/sourcing-ticket-board";
import { getSourcingTicketBoard } from "@/lib/actions/sourcing-ticket.actions";

export const metadata = { title: "Tickets sourcing | Horion ERP" };

export default async function SourcingTicketsPage() {
  const result = await getSourcingTicketBoard();

  if (result.error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/sourcing">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Tickets sourcing</h1>
            <p className="text-muted-foreground">Pipeline pre-commande et recherche produit.</p>
          </div>
        </div>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {result.error}
        </div>
      </div>
    );
  }

  const tickets = (result.data ?? []) as any[];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/sourcing">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Ticket className="h-7 w-7" />
            Tickets sourcing
          </h1>
          <p className="text-muted-foreground">
            Vue Kanban du pipeline CREATED → RESEARCHING → QUOTED → CLIENT_ACCEPTED → ORDERED.
          </p>
        </div>
      </div>

      {tickets.length === 0 ? (
        <EmptyState
          title="Aucun ticket sourcing"
          description="Les demandes pre-vente et matches catalogue apparaitront ici."
        />
      ) : (
        <SourcingTicketBoard tickets={tickets as any} />
      )}
    </div>
  );
}
