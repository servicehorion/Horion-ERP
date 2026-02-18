"use client";

import { useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { DollarSign, GripVertical, User } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { updateLeadStatus } from "@/lib/actions/contact.actions";
import { formatCurrency } from "@/config/currencies";

interface KanbanLead {
  id: string;
  status: string;
  description: string | null;
  source: string | null;
  estimatedValue: string | null;
  currency: string;
  category: string | null;
  contact: {
    name: string;
    company: string | null;
    phone: string | null;
  };
}

interface LeadsKanbanProps {
  leads: KanbanLead[];
}

const COLUMNS = [
  { id: "NEW", label: "Nouveau", color: "border-t-gray-400", bgHeader: "bg-gray-50 dark:bg-gray-900" },
  { id: "CONTACTED", label: "Contacté", color: "border-t-blue-400", bgHeader: "bg-blue-50 dark:bg-blue-950" },
  { id: "QUALIFIED", label: "Qualifié", color: "border-t-indigo-400", bgHeader: "bg-indigo-50 dark:bg-indigo-950" },
  { id: "QUOTED", label: "Devis envoyé", color: "border-t-yellow-400", bgHeader: "bg-yellow-50 dark:bg-yellow-950" },
  { id: "WON", label: "Gagné", color: "border-t-green-400", bgHeader: "bg-green-50 dark:bg-green-950" },
  { id: "LOST", label: "Perdu", color: "border-t-red-400", bgHeader: "bg-red-50 dark:bg-red-950" },
];

export function LeadsKanban({ leads: initialLeads }: LeadsKanbanProps) {
  const [leads, setLeads] = useState(initialLeads);
  const router = useRouter();

  const columnLeads = COLUMNS.reduce(
    (acc, col) => {
      acc[col.id] = leads.filter((l) => l.status === col.id);
      return acc;
    },
    {} as Record<string, KanbanLead[]>
  );

  const columnTotals = COLUMNS.reduce(
    (acc, col) => {
      acc[col.id] = columnLeads[col.id].reduce(
        (sum, l) => sum + (l.estimatedValue ? Number(l.estimatedValue) : 0),
        0
      );
      return acc;
    },
    {} as Record<string, number>
  );

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStatus = destination.droppableId;
    const oldStatus = source.droppableId;

    // Optimistic update
    setLeads((prev) =>
      prev.map((l) => (l.id === draggableId ? { ...l, status: newStatus } : l))
    );

    try {
      const result = await updateLeadStatus(draggableId, newStatus);
      if (result.error) {
        // Revert
        setLeads((prev) =>
          prev.map((l) => (l.id === draggableId ? { ...l, status: oldStatus } : l))
        );
        toast.error(result.error);
      } else {
        toast.success(`Lead déplacé vers "${COLUMNS.find((c) => c.id === newStatus)?.label}"`);
        router.refresh();
      }
    } catch {
      setLeads((prev) =>
        prev.map((l) => (l.id === draggableId ? { ...l, status: oldStatus } : l))
      );
      toast.error("Erreur lors de la mise à jour");
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((column) => (
          <div key={column.id} className="flex-shrink-0 w-[280px]">
            <Card className={`border-t-4 ${column.color}`}>
              <CardHeader className={`py-3 ${column.bgHeader}`}>
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>{column.label}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {columnLeads[column.id].length}
                    </Badge>
                  </div>
                </CardTitle>
                {columnTotals[column.id] > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(columnTotals[column.id], "XAF")}
                  </p>
                )}
              </CardHeader>
              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <CardContent
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`min-h-[200px] space-y-2 p-2 transition-colors ${
                      snapshot.isDraggingOver ? "bg-accent/50" : ""
                    }`}
                  >
                    {columnLeads[column.id].map((lead, index) => (
                      <Draggable key={lead.id} draggableId={lead.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`rounded-lg border bg-card p-3 shadow-sm transition-shadow ${
                              snapshot.isDragging ? "shadow-lg ring-2 ring-primary/20" : ""
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <div
                                {...provided.dragHandleProps}
                                className="mt-0.5 cursor-grab text-muted-foreground hover:text-foreground"
                              >
                                <GripVertical className="h-4 w-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <Link
                                  href={`/crm/leads/${lead.id}`}
                                  className="text-sm font-medium text-primary hover:underline line-clamp-2"
                                >
                                  {lead.description || lead.source || "Sans description"}
                                </Link>
                                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                  <User className="h-3 w-3" />
                                  <span className="truncate">{lead.contact.name}</span>
                                </div>
                                {lead.estimatedValue && Number(lead.estimatedValue) > 0 && (
                                  <div className="flex items-center gap-1 mt-1 text-xs font-medium text-green-600">
                                    <DollarSign className="h-3 w-3" />
                                    {formatCurrency(Number(lead.estimatedValue), lead.currency)}
                                  </div>
                                )}
                                {lead.category && (
                                  <Badge variant="outline" className="mt-1 text-xs">
                                    {lead.category}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {columnLeads[column.id].length === 0 && !snapshot.isDraggingOver && (
                      <p className="text-center text-xs text-muted-foreground py-8">
                        Aucun lead
                      </p>
                    )}
                  </CardContent>
                )}
              </Droppable>
            </Card>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}
