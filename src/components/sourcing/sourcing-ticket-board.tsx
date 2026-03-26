"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ArrowRight, CheckCircle2, CircleSlash, FileText, PackageCheck, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createOrderFromTicket, updateSourcingTicketStatus } from "@/lib/actions/sourcing-ticket.actions";

type TicketCard = {
  id: string;
  description: string;
  category?: string | null;
  quantity?: number | null;
  targetPrice?: number | string | null;
  currency: string;
  boardStage: "CREATED" | "RESEARCHING" | "QUOTED" | "CLIENT_ACCEPTED" | "ORDERED" | "LOST";
  status: string;
  contact?: { id: string; name: string } | null;
  demand?: { id: string; source: string; status: string } | null;
  order?: { id: string; orderNumber: string; status: string } | null;
  quote?: { id: string; status: string; total?: number | string | null; paymentToken?: string | null } | null;
  catalogProduct?: { id: string; name: string } | null;
  assignedTo?: { id: string; name: string } | null;
  catalogMatchSource?: string | null;
  catalogMatchScore?: number | string | null;
  updatedAt: string | Date;
};

const COLUMNS: Array<{
  id: TicketCard["boardStage"];
  label: string;
  tone: string;
}> = [
  { id: "CREATED", label: "Créés", tone: "bg-slate-500" },
  { id: "RESEARCHING", label: "Recherche", tone: "bg-blue-500" },
  { id: "QUOTED", label: "Quotés", tone: "bg-indigo-500" },
  { id: "CLIENT_ACCEPTED", label: "Client accepté", tone: "bg-amber-500" },
  { id: "ORDERED", label: "Commandés", tone: "bg-green-600" },
  { id: "LOST", label: "Perdus", tone: "bg-rose-500" },
];

function formatMoney(value?: number | string | null, currency = "XAF") {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return "-";
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function SourcingTicketBoard({ tickets }: { tickets: TicketCard[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const grouped = COLUMNS.reduce<Record<string, TicketCard[]>>((acc, column) => {
    acc[column.id] = tickets.filter((ticket) => ticket.boardStage === column.id);
    return acc;
  }, {});

  function mutate(action: () => Promise<{ error?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {COLUMNS.map((column) => (
        <div key={column.id} className="space-y-3">
          <div className="flex items-center gap-2">
            <div className={`h-2.5 w-2.5 rounded-full ${column.tone}`} />
            <h2 className="text-sm font-semibold uppercase tracking-wide">{column.label}</h2>
            <Badge variant="secondary" className="ml-auto text-[10px]">
              {grouped[column.id]?.length ?? 0}
            </Badge>
          </div>

          <div className="space-y-3">
            {grouped[column.id]?.map((ticket) => (
              <Card key={ticket.id} className="border-border/70 shadow-sm">
                <CardHeader className="space-y-2 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm leading-5">{ticket.description}</CardTitle>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {ticket.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {ticket.contact?.name ? (
                      <span className="inline-flex items-center gap-1">
                        <UserRound className="h-3 w-3" />
                        {ticket.contact.name}
                      </span>
                    ) : null}
                    {ticket.category ? <span>{ticket.category}</span> : null}
                    {ticket.quantity ? <span>Qté: {ticket.quantity}</span> : null}
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 text-xs">
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Budget cible</span>
                      <span className="font-medium">{formatMoney(ticket.targetPrice, ticket.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Catalogue</span>
                      <span className="font-medium">{ticket.catalogProduct?.name ?? "-"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Assigné à</span>
                      <span className="font-medium">{ticket.assignedTo?.name ?? "-"}</span>
                    </div>
                    {ticket.catalogMatchSource ? (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Match interne</span>
                        <span className="font-medium">
                          {ticket.catalogMatchSource}
                          {ticket.catalogMatchScore ? ` (${Number(ticket.catalogMatchScore).toFixed(0)}%)` : ""}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {ticket.quote?.id && ticket.order?.id ? (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/orders/${ticket.order.id}`}>
                          <FileText className="mr-1 h-3.5 w-3.5" />
                          Devis
                        </Link>
                      </Button>
                    ) : null}
                    {ticket.order?.id ? (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/orders/${ticket.order.id}`}>
                          <PackageCheck className="mr-1 h-3.5 w-3.5" />
                          {ticket.order.orderNumber}
                        </Link>
                      </Button>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(ticket.boardStage === "CREATED" || ticket.boardStage === "RESEARCHING") && (
                      <Button
                        size="sm"
                        disabled={isPending}
                        onClick={() =>
                          mutate(() => updateSourcingTicketStatus(ticket.id, "QUOTED"))
                        }
                      >
                        <ArrowRight className="mr-1 h-3.5 w-3.5" />
                        Marquer quoté
                      </Button>
                    )}

                    {ticket.boardStage === "QUOTED" && (
                      <Button
                        size="sm"
                        disabled={isPending}
                        onClick={() =>
                          mutate(() => updateSourcingTicketStatus(ticket.id, "CLIENT_ACCEPTED"))
                        }
                      >
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                        Client a accepté
                      </Button>
                    )}

                    {ticket.boardStage === "CLIENT_ACCEPTED" && !ticket.order?.id && (
                      <Button
                        size="sm"
                        disabled={isPending}
                        onClick={() =>
                          mutate(() => createOrderFromTicket(ticket.id))
                        }
                      >
                        <PackageCheck className="mr-1 h-3.5 w-3.5" />
                        Convertir en commande
                      </Button>
                    )}

                    {ticket.boardStage !== "LOST" && ticket.boardStage !== "ORDERED" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() =>
                          mutate(() => updateSourcingTicketStatus(ticket.id, "LOST"))
                        }
                      >
                        <CircleSlash className="mr-1 h-3.5 w-3.5" />
                        Perdu
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {(grouped[column.id]?.length ?? 0) === 0 && (
              <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                Aucun ticket
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
