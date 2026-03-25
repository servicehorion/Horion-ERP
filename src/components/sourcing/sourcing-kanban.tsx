"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Badge } from "@/components/ui/badge";
import { updateSourcingStatus } from "@/lib/actions/sourcing.actions";
import { GripVertical, Package } from "lucide-react";
import { toast } from "sonner";

interface KanbanCase {
  id: string;
  status: string;
  requirement: string;
  budget: unknown;
  currency: string;
  order: { orderNumber: string; contact: { name: string } };
  supplier: { id: string; name: string } | null;
  _count: { offers: number };
}

const COLUMNS = [
  { id: "SEARCHING", label: "Recherche", color: "bg-blue-500" },
  { id: "OFFERS_RECEIVED", label: "Offres reçues", color: "bg-indigo-500" },
  { id: "NEGOTIATING", label: "Négociation", color: "bg-yellow-500" },
  { id: "SELECTED", label: "Sélectionné", color: "bg-purple-500" },
  { id: "CONFIRMED", label: "Confirmé", color: "bg-green-500" },
  { id: "CANCELLED", label: "Annulé", color: "bg-red-500" },
];

export function SourcingKanban({ cases }: { cases: KanbanCase[] }) {
  const router = useRouter();
  const [items, setItems] = useState(cases);

  const grouped = COLUMNS.reduce(
    (acc, col) => {
      acc[col.id] = items.filter((c) => c.status === col.id);
      return acc;
    },
    {} as Record<string, KanbanCase[]>
  );

  async function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newStatus = destination.droppableId;

    const item = items.find((c) => c.id === draggableId);
    if (!item || item.status === newStatus) return;

    // Optimistic update
    const prev = [...items];
    setItems(items.map((c) => (c.id === draggableId ? { ...c, status: newStatus } : c)));

    const res = await updateSourcingStatus(draggableId, { status: newStatus });
    if (res.error) {
      setItems(prev);
      toast.error(res.error);
      return;
    }
    toast.success("Statut de cas mis a jour");
    router.refresh();
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {COLUMNS.map((col) => (
          <div key={col.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${col.color}`} />
              <span className="text-xs font-semibold uppercase tracking-wide">
                {col.label}
              </span>
              <Badge variant="secondary" className="text-[10px] ml-auto">
                {grouped[col.id]?.length || 0}
              </Badge>
            </div>

            <Droppable droppableId={col.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`min-h-[200px] space-y-2 rounded-lg border p-2 transition-colors ${
                    snapshot.isDraggingOver ? "bg-accent/50 border-primary" : "bg-muted/30"
                  }`}
                >
                  {grouped[col.id]?.map((c, index) => (
                    <Draggable key={c.id} draggableId={c.id} index={index}>
                      {(prov, snap) => (
                        <div
                          ref={prov.innerRef}
                          {...prov.draggableProps}
                          className={`rounded-md border bg-background p-2 text-xs shadow-sm ${
                            snap.isDragging ? "shadow-lg ring-2 ring-primary" : ""
                          }`}
                        >
                          <div className="flex items-start gap-1">
                            <div {...prov.dragHandleProps} className="mt-0.5 shrink-0">
                              <GripVertical className="h-3 w-3 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <Link
                                href={`/sourcing/cases/${c.id}`}
                                className="font-medium text-primary hover:underline line-clamp-1"
                              >
                                {c.order.orderNumber}
                              </Link>
                              <p className="text-muted-foreground truncate">
                                {c.order.contact.name}
                              </p>
                              <p className="text-muted-foreground line-clamp-2 mt-0.5">
                                {c.requirement}
                              </p>
                              <div className="flex items-center gap-1 mt-1">
                                <Package className="h-3 w-3 text-muted-foreground" />
                                <span>{c._count.offers} offre(s)</span>
                              </div>
                              {c.supplier && (
                                <Badge variant="secondary" className="text-[10px] mt-1">
                                  {c.supplier.name}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}
